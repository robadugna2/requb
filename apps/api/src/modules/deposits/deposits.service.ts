import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, VerificationStatus, PenaltyReason } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RulesEnforcementService } from '../groups/rules-enforcement.service';
import { PenaltiesService } from '../groups/penalties.service';
import { normalizeFtNumber } from '../../common/utils/ft-number';
import {
  AMBIGUITY_MARGIN,
  MEMBER_MATCH_THRESHOLD,
  normalizeName,
  rankMembersByPayerName,
  type MemberMatchCandidate,
} from './member-matching';

export interface CreateDepositData {
  cycleId: string;
  userId: string;
  /** Receipt photo — absent for manual FT entries verified against CBE */
  imageUrl?: string;
  ocrData?: Prisma.InputJsonValue;
  ftNumber?: string;
  amount?: number;
  bankName?: string;
  depositDate?: Date;
  senderName?: string;
  senderAccount?: string;
  receiverAccount?: string;
  branch?: string;
  narrative?: string;
  confidence?: number;
  /** Present on the admin create path; validated against the cycle's group */
  groupId?: string;
}

@Injectable()
export class DepositsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rulesEnforcement: RulesEnforcementService,
    private readonly penaltiesService: PenaltiesService,
  ) {}

  async findAll(
    filters?: {
      cycleId?: string;
      userId?: string;
      groupId?: string;
      verificationStatus?: string;
    },
    requesterId?: string,
    requesterRole?: string,
  ) {
    const where: Prisma.DepositWhereInput = {};

    if (filters?.cycleId) {
      where.cycleId = filters.cycleId;
    }

    if (filters?.userId) {
      where.userId = filters.userId;
    }

    if (filters?.groupId) {
      where.cycle = {
        groupId: filters.groupId,
      };
    }

    if (requesterRole === 'ADMIN' && requesterId) {
      where.cycle = {
        ...(where.cycle as Prisma.CycleWhereInput),
        group: {
          is: {
            createdById: requesterId,
          },
        },
      };
    } else if (requesterRole === 'SUB_ADMIN' && requesterId) {
      where.cycle = {
        ...(where.cycle as Prisma.CycleWhereInput),
        group: {
          is: {
            leaders: {
              some: {
                adminId: requesterId,
              },
            },
          },
        },
      };
    }

    if (filters?.verificationStatus) {
      where.verificationStatus = filters.verificationStatus as VerificationStatus;
    }

    return this.prisma.deposit.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, phone: true },
        },
        cycle: {
          include: {
            group: {
              select: { id: true, name: true, contributionAmount: true },
            },
          },
        },
      },
      orderBy: [
        { cycle: { cycleNumber: 'asc' } },
        { depositDate: 'asc' },
        { createdAt: 'asc' },
      ],
    });
  }

  async findOne(id: string) {
    const deposit = await this.prisma.deposit.findUnique({
      where: { id },
      include: {
        user: true,
        cycle: {
          include: {
            group: true,
          },
        },
      },
    });

    if (!deposit) {
      throw new NotFoundException(`Deposit with ID ${id} not found`);
    }

    return deposit;
  }

  async verify(id: string, adminId: string) {
    const deposit = await this.findOne(id);

    if (deposit.verificationStatus !== 'PENDING') {
      throw new BadRequestException(
        `Deposit has already been ${deposit.verificationStatus.toLowerCase()}`,
      );
    }

    const result = await this.prisma.deposit.update({
      where: { id },
      data: {
        verificationStatus: 'VERIFIED',
        verifiedById: adminId,
      },
      include: {
        user: true,
        cycle: {
          include: { group: true },
        },
      },
    });

    // Check rules for lateness and apply penalties
    if (result.depositDate) {
      const isLateInfo = await this.rulesEnforcement.isDepositLate(
        result.cycle.groupId,
        result.depositDate,
      );

      if (isLateInfo.isLate) {
        await this.prisma.deposit.update({
          where: { id },
          data: { isLate: true },
        });

        if (isLateInfo.isPastGrace) {
          const penaltyCalc = await this.rulesEnforcement.calculatePenalty(
            result.cycle.groupId,
          );

          if (penaltyCalc) {
            await this.penaltiesService.createPenalty({
              groupId: result.cycle.groupId,
              userId: result.userId,
              cycleId: result.cycleId,
              reason: PenaltyReason.LATE_PAYMENT,
              amount: penaltyCalc.amount,
              notes: `Auto-generated: ${penaltyCalc.reason} for deposit ${result.ftNumber || result.id}.`,
            });

            await this.prisma.deposit.update({
              where: { id },
              data: { penaltyApplied: true },
            });
          }
        }
      }
    }

    // Trigger update of user reliability score
    await this.rulesEnforcement.updateReliabilityScore(result.userId);

    // If max missed payments is exceeded, check and auto-suspend member
    const suspendCheck = await this.rulesEnforcement.shouldAutoSuspendMember(
      result.cycle.groupId,
      result.userId,
    );

    if (suspendCheck.shouldSuspend) {
      await this.prisma.groupMembership.update({
        where: {
          groupId_userId: {
            groupId: result.cycle.groupId,
            userId: result.userId,
          },
        },
        data: { status: 'SUSPENDED' },
      });
    }

    return result;
  }

  async reject(id: string, adminId: string, reason?: string) {
    const deposit = await this.findOne(id);

    if (deposit.verificationStatus !== 'PENDING') {
      throw new BadRequestException(
        `Deposit has already been ${deposit.verificationStatus.toLowerCase()}`,
      );
    }

    const result = await this.prisma.deposit.update({
      where: { id },
      data: {
        verificationStatus: 'REJECTED',
        verifiedById: adminId,
        rejectionReason: reason || 'Rejected by admin',
      },
      include: {
        user: true,
        cycle: {
          include: { group: true },
        },
      },
    });

    // Update user reliability score
    await this.rulesEnforcement.updateReliabilityScore(result.userId);

    return result;
  }

  async create(data: CreateDepositData) {
    // Strip extended identifiers ("FT24AB123456\BNK" -> "FT24AB123456") so
    // every creator path (telegram OCR, admin scanner) stores clean references
    const ftNumber = normalizeFtNumber(data.ftNumber);

    // Verify the cycle exists
    const cycle = await this.prisma.cycle.findUnique({
      where: { id: data.cycleId },
    });

    if (!cycle) {
      throw new NotFoundException(`Cycle with ID ${data.cycleId} not found`);
    }

    // Admin create path: groupId is supplied and must match the cycle's group
    if (data.groupId && data.groupId !== cycle.groupId) {
      throw new BadRequestException(
        'The selected cycle does not belong to the selected group',
      );
    }

    // Verify the user exists
    const user = await this.prisma.user.findUnique({
      where: { id: data.userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${data.userId} not found`);
    }

    // Admin create path: deposits require an active membership in the group
    if (data.groupId) {
      const membership = await this.prisma.groupMembership.findUnique({
        where: { groupId_userId: { groupId: data.groupId, userId: data.userId } },
      });
      if (!membership || membership.status === 'REMOVED') {
        throw new BadRequestException(
          `${user.name} is not a member of this group. Add them to the group first.`,
        );
      }
    }

    // Validate deposit details against rules
    const violations = await this.rulesEnforcement.validateDeposit(
      cycle.groupId,
      data.userId,
      data.amount,
      data.depositDate || new Date(),
    );

    const errorViolations = violations.filter(v => v.severity === 'ERROR');
    if (errorViolations.length > 0) {
      throw new BadRequestException(
        `Deposit violates rules: ${errorViolations.map(v => v.message).join(', ')}`
      );
    }

    // Check for duplicate FT number
    if (ftNumber) {
      const existingDeposit = await this.prisma.deposit.findUnique({
        where: { ftNumber },
      });

      if (existingDeposit) {
        throw new BadRequestException(
          `A deposit with FT number ${ftNumber} already exists`,
        );
      }
    }

    const deposit = await this.prisma.deposit.create({
      data: {
        cycleId: data.cycleId,
        userId: data.userId,
        imageUrl: data.imageUrl ?? null,
        ocrData: data.ocrData,
        ftNumber,
        amount: data.amount,
        bankName: data.bankName,
        depositDate: data.depositDate,
        senderName: data.senderName,
        senderAccount: data.senderAccount,
        receiverAccount: data.receiverAccount,
        branch: data.branch,
        narrative: data.narrative,
        confidence: data.confidence,
      },
      include: {
        user: true,
        cycle: {
          include: { group: true },
        },
      },
    });

    // Self-learning: every deposit created for a KNOWN member with sender
    // identity attached teaches the pairing system — the admin's action here
    // (scan pairing, suggestion accept, unknown-sender resolve, manual entry)
    // makes the next payment from the same payer name or bank account hit the
    // exact-match AUTO tier instead of landing in Unknown Senders.
    await this.learnPayerIdentity(
      data.userId,
      data.senderName,
      data.senderAccount,
    ).catch(() => undefined);

    return deposit;
  }

  /**
   * Register payer-name and sender-account aliases for a member. Best-effort:
   * never fails the deposit creation that triggered it.
   */
  private async learnPayerIdentity(
    userId: string,
    senderName?: string | null,
    senderAccount?: string | null,
  ) {
    const name = senderName?.trim();
    const account = senderAccount?.trim();
    if (!name && !account) return;

    if (name) {
      await this.prisma.memberPayerAlias
        .upsert({
          where: { userId_name: { userId, name } },
          create: { userId, name, note: 'Learned from a paired deposit' },
          update: {},
        })
        .catch(() => undefined);
    }
    if (account) {
      // One bank account maps to one member; a newer admin action re-assigns.
      await this.prisma.memberPayerAlias
        .upsert({
          where: { senderAccount: account },
          create: {
            userId,
            name: name || `acct:${account}`,
            senderAccount: account,
            note: 'Sender account learned from a paired deposit',
          },
          update: { userId },
        })
        .catch(() => undefined);
    }
  }

  async getDepositsByCycle(cycleId: string) {
    return this.prisma.deposit.findMany({
      where: { cycleId, verificationStatus: 'VERIFIED' },
      include: { user: true },
    });
  }

  /**
   * Suggest group members for a bank-transaction payer name (from a CBE
   * receipt lookup), fully automatic:
   *   1. History — if this exact payer name was paired to a member before
   *      (verified deposit in this group), reuse that pairing deterministically.
   *   2. Fuzzy — rank members by name / bank-account-name similarity and
   *      SUGGEST tier: similarity >= 0.6 with a clear margin over the
   *      runner-up; surfaced as a one-click accept chip, NEVER applied
   *      automatically.
   *   3. UNKNOWN tier: everything else (including ambiguous top-2) — the
   *      scanner offers the Unknown Senders actions (pick member, quick-create
   *      member, park in the Unknown Senders queue).
   */
  async suggestMembersForPayer(
    groupId: string,
    payerName: string,
    senderAccount?: string,
  ) {
    const memberships = await this.prisma.groupMembership.findMany({
      where: { groupId, status: { not: 'REMOVED' } },
      select: {
        status: true,
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            photoUrl: true,
            bankAccountName: true,
            payerAliases: { select: { name: true } },
          },
        },
      },
    });

    const memberByUserId = new Map(
      memberships.map((m) => [m.user.id, m.user]),
    );

    // 0) Sender-account identity — bank account numbers are stable, so a
    //    learned alias or a previously verified deposit from this exact
    //    account wins outright, even when the payer name renders differently.
    const accountKey = senderAccount?.trim();
    if (accountKey) {
      let accountHit: { userId: string; matchedVia: 'history' | 'payerAlias' } | null = null;

      const alias = await this.prisma.memberPayerAlias.findFirst({
        where: {
          senderAccount: accountKey,
          user: { memberships: { some: { groupId, status: { not: 'REMOVED' } } } },
        },
        select: { userId: true },
      });
      if (alias && memberByUserId.has(alias.userId)) {
        accountHit = { userId: alias.userId, matchedVia: 'payerAlias' };
      }

      if (!accountHit) {
        const recent = await this.prisma.deposit.findFirst({
          where: {
            cycle: { groupId },
            verificationStatus: 'VERIFIED',
            senderAccount: accountKey,
            userId: { in: [...memberByUserId.keys()] },
          },
          orderBy: { createdAt: 'desc' },
          select: { userId: true },
        });
        if (recent) {
          accountHit = { userId: recent.userId, matchedVia: 'history' };
        }
      }

      if (accountHit) {
        const user = memberByUserId.get(accountHit.userId)!;
        const match = {
          userId: accountHit.userId,
          name: user.name,
          phone: user.phone,
          photoUrl: user.photoUrl ?? undefined,
          score: 1,
          matchedVia: accountHit.matchedVia,
          autoPaired: true,
        };
        return { payerName, suggestions: [match], bestMatch: match };
      }
    }

    // 1) History: the same payer name successfully paired before in this group
    const payerKey = normalizeName(payerName);
    if (payerKey) {
      const recent = await this.prisma.deposit.findMany({
        where: {
          cycle: { groupId },
          verificationStatus: 'VERIFIED',
          senderName: { not: null },
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: {
          senderName: true,
          userId: true,
          user: { select: { name: true } },
        },
      });
      const hit = recent.find(
        (d) =>
          normalizeName(d.senderName ?? '') === payerKey &&
          memberByUserId.has(d.userId),
      );
      if (hit) {
        const user = memberByUserId.get(hit.userId)!;
        const match = {
          userId: hit.userId,
          name: user.name,
          phone: user.phone,
          photoUrl: user.photoUrl ?? undefined,
          score: 1,
          matchedVia: 'history' as const,
          autoPaired: true,
        };
        return { payerName, suggestions: [match], bestMatch: match };
      }
    }

    // 2) Fuzzy name / bank-account-name / authorized-payer-alias matching
    const suggestions = rankMembersByPayerName(
      payerName,
      memberships.map((m) => ({
        userId: m.user.id,
        name: m.user.name,
        phone: m.user.phone,
        photoUrl: m.user.photoUrl ?? undefined,
        bankAccountName: m.user.bankAccountName ?? undefined,
        aliases: (m.user.payerAliases ?? []).map((a) => a.name),
        membershipStatus: m.status,
      })),
    );

    // Strict tiering — wrong pairings are worse than no pairing.
    // AUTO requires TRUE normalized equality against exactly one identity
    // (member name, bank-account-holder name, or registered alias) — a
    // perfect similarity SCORE is not enough, since the scorer hands out
    // 1.0 for near-identical spellings. Everything else is human-decided.
    const exactCandidates: MemberMatchCandidate[] = [];
    if (payerKey) {
      for (const m of memberships) {
        const u = m.user;
        const base = {
          userId: u.id,
          name: u.name,
          phone: u.phone,
          photoUrl: u.photoUrl ?? undefined,
          score: 1,
        };
        if (normalizeName(u.name) === payerKey) {
          exactCandidates.push({ ...base, matchedVia: 'name' });
          continue;
        }
        if (u.bankAccountName && normalizeName(u.bankAccountName) === payerKey) {
          exactCandidates.push({ ...base, matchedVia: 'bankAccountName' });
          continue;
        }
        const alias = (u.payerAliases ?? []).find(
          (a) => normalizeName(a.name) === payerKey,
        );
        if (alias) {
          exactCandidates.push({
            ...base,
            matchedVia: 'payerAlias',
            matchedAlias: alias.name,
          });
        }
      }
    }

    let tier: 'AUTO' | 'SUGGEST' | 'UNKNOWN' = 'UNKNOWN';
    let bestMatch: (MemberMatchCandidate & { autoPaired: boolean; suggested: boolean }) | null = null;

    if (exactCandidates.length === 1) {
      // Deterministic identity: one member matches exactly
      tier = 'AUTO';
      bestMatch = { ...exactCandidates[0], autoPaired: true, suggested: false };
    } else if (exactCandidates.length > 1) {
      // Two members share this identity — never guess
      tier = 'UNKNOWN';
    } else {
      const top = suggestions[0];
      const runnerUp = suggestions[1];
      const margin = runnerUp ? top.score - runnerUp.score : 1;
      if (top && top.score >= MEMBER_MATCH_THRESHOLD && margin >= AMBIGUITY_MARGIN) {
        // Confident but not exact — one-click suggestion for the admin
        tier = 'SUGGEST';
        bestMatch = { ...top, autoPaired: false, suggested: true };
      } else {
        // Weak or ambiguous — Unknown Sender territory
        tier = 'UNKNOWN';
      }
    }

    return { payerName, tier, suggestions, bestMatch };
  }
}
