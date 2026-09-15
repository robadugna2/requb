import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma, UnmatchedStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RulesEnforcementService } from '../groups/rules-enforcement.service';
import { DepositsService } from './deposits.service';
import { normalizeFtNumber } from '../../common/utils/ft-number';

export interface QueueUnknownSenderData {
  groupId: string;
  payerName: string;
  ftNumber?: string;
  amount: number;
  transferDate?: Date;
  senderAccount?: string;
  bankName?: string;
  imageUrl?: string;
  cycleId?: string;
  reason?: string;
  cbeData?: Prisma.InputJsonValue;
}

export interface ResolveUnknownSenderData {
  /** Pair to an existing member of the group */
  userId?: string;
  /** Or quick-create a brand-new member with this identity */
  createMember?: {
    name: string;
    phone: string;
    shares?: number;
    /** Groups requiring a government ID block members without one */
    governmentId?: string;
  };
}

/**
 * Unknown Senders queue — where CBE-verified transactions land when no member
 * pairing meets the strict confidence bar. Nothing is lost: every entry keeps
 * the full receipt evidence and can be paired, turned into a new member, or
 * dismissed with an audit note.
 */
@Injectable()
export class UnknownSenderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly depositsService: DepositsService,
    private readonly rulesEnforcement: RulesEnforcementService,
  ) {}

  private async groupScope(adminId?: string, role?: string) {
    const scope: Prisma.EqubGroupWhereInput = { deletedAt: null };
    if (role === 'ADMIN' && adminId) scope.createdById = adminId;
    else if (role === 'SUB_ADMIN' && adminId) scope.leaders = { some: { adminId } };
    return scope;
  }

  /** Park a CBE-verified transaction that could not be paired confidently. */
  async queue(data: QueueUnknownSenderData) {
    const group = await this.prisma.equbGroup.findFirst({
      where: { id: data.groupId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!group) throw new NotFoundException(`Group ${data.groupId} not found`);

    const ft = normalizeFtNumber(data.ftNumber);
    if (!ft) {
      throw new BadRequestException('An FT number is required to queue an unknown sender.');
    }

    // Idempotency + duplicate guards — never park (or double-park) an FT that
    // is already recorded or already waiting in the queue.
    {
      const alreadyDeposited = await this.prisma.deposit.findUnique({
        where: { ftNumber: ft },
        select: { id: true },
      });
      if (alreadyDeposited) {
        throw new ConflictException(
          `FT ${ft} is already recorded as a deposit.`,
        );
      }
      const alreadyQueued = await this.prisma.unmatchedDeposit.findFirst({
        where: { ftNumber: ft, status: 'PENDING' },
        select: { id: true },
      });
      if (alreadyQueued) {
        return alreadyQueued; // idempotent re-queue
      }
    }

    return this.prisma.unmatchedDeposit.create({
      data: {
        groupId: data.groupId,
        senderName: data.payerName,
        ftNumber: ft,
        amount: data.amount,
        bankName: data.bankName || null,
        transferDate: data.transferDate || null,
        senderAccount: data.senderAccount || null,
        cbeData: data.cbeData ?? undefined,
        imageUrl: data.imageUrl || null,
        reason: data.reason || 'No member matched the confident tier',
      },
      include: { group: { select: { id: true, name: true } } },
    });
  }

  /** Unresolved queue for the admin's visible groups. */
  async list(groupId: string | undefined, adminId?: string, role?: string) {
    const scope = await this.groupScope(adminId, role);
    if (groupId) scope.id = groupId;

    return this.prisma.unmatchedDeposit.findMany({
      where: { status: UnmatchedStatus.PENDING, group: scope },
      include: { group: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Live badge count for the nav. */
  async count(adminId?: string, role?: string) {
    const scope = await this.groupScope(adminId, role);
    const total = await this.prisma.unmatchedDeposit.count({
      where: { status: UnmatchedStatus.PENDING, group: scope },
    });
    return { count: total };
  }

  /**
   * Resolve a queued sender: pair it to an existing member OR quick-create a
   * brand-new member from the payer identity. Either way the stored CBE data
   * becomes a real deposit through the standard pipeline (duplicate-FT safe,
   * auto-verified by the caller) and the payer name is registered as an
   * authorized-payer alias so future payments pair automatically.
   */
  async resolve(id: string, adminId: string, data: ResolveUnknownSenderData) {
    const record = await this.prisma.unmatchedDeposit.findUnique({
      where: { id },
      include: { group: { select: { id: true, name: true, createdById: true } } },
    });
    if (!record) throw new NotFoundException(`Unknown sender ${id} not found`);
    if (record.status !== UnmatchedStatus.PENDING) {
      throw new BadRequestException('This unknown sender has already been resolved.');
    }

    let userId: string;
    let createdMember = false;
    /** Group rules overridden by this owner action (e.g. guarantor pending) */
    let ruleOverrides: string[] = [];

    if (data.createMember) {
      const { name, phone, shares = 1 } = data.createMember;

      if (shares < 0.25 || shares > 10) {
        throw new BadRequestException('Shares must be between 0.25 and 10');
      }

      const phoneOwner = await this.prisma.user.findUnique({
        where: { phone },
        select: { id: true, name: true },
      });
      if (phoneOwner) {
        throw new ConflictException(
          `Phone ${phone} is already registered${phoneOwner.name ? ` to ${phoneOwner.name}` : ''}.`,
        );
      }

      // The payer name on a bank receipt IS the account-holder name — store it
      // so future payments hit the exact-match AUTO tier.
      const user = await this.prisma.user.create({
        data: {
          name,
          phone,
          bankAccountName: record.senderName || name,
          governmentId: data.createMember.governmentId || undefined,
        },
        select: { id: true, name: true },
      });
      userId = user.id;
      createdMember = true;
    } else if (data.userId) {
      userId = data.userId;
    } else {
      throw new BadRequestException('Provide either userId or createMember.');
    }

    // The pair target must hold (or just received) an active membership
    let membership = await this.prisma.groupMembership.findUnique({
      where: { groupId_userId: { groupId: record.groupId, userId } },
    });

    if (!membership) {
      if (!createdMember) {
        throw new BadRequestException(
          'The selected user is not a member of this group.',
        );
      }

      // Same guardrails as GroupsService.addMember
      if (membership === null && createdMember) {
        const violations = await this.rulesEnforcement.validateMemberAddition(
          record.groupId,
          userId,
        );
        const errors = violations.filter((v) => v.severity === 'ERROR');
        if (errors.length > 0) {
          // The guarantor requirement cannot be satisfied inside a
          // quick-create (a guarantor must be another member). The owner's /
          // super-admin's explicit resolve overrides it — surfaced back to
          // the client as ruleOverrides so the UI can remind about follow-up.
          const admin = await this.prisma.admin.findUnique({
            where: { id: adminId },
            select: { role: true },
          });
          const isOwnerOrSuper =
            admin?.role === 'SUPER_ADMIN' || record.group.createdById === adminId;
          if (!isOwnerOrSuper) {
            throw new BadRequestException(
              `Cannot add member: ${errors.map((v) => v.message).join(', ')}`,
            );
          }
          const overridden = errors
            .filter((v) => v.rule === 'REQUIRE_GUARANTOR')
            .map((v) => v.rule);
          const blocking = errors.filter((v) => v.rule !== 'REQUIRE_GUARANTOR');
          if (blocking.length > 0) {
            throw new BadRequestException(
              `Cannot add member: ${blocking.map((v) => v.message).join(', ')}`,
            );
          }
          ruleOverrides = overridden;
        }
        const activeMembers = await this.prisma.groupMembership.count({
          where: { groupId: record.groupId, status: 'ACTIVE' },
        });
        const group = await this.prisma.equbGroup.findUnique({
          where: { id: record.groupId },
          select: { maxMembers: true, createdById: true },
        });
        if (group && activeMembers >= group.maxMembers) {
          // A full group must not dead-end member creation from a scan or the
          // unknown queue: the owner's / super-admin's resolve action raises
          // the limit by one and proceeds. Other admins get the explicit error.
          const admin = await this.prisma.admin.findUnique({
            where: { id: adminId },
            select: { role: true },
          });
          const isOwnerOrSuper =
            admin?.role === 'SUPER_ADMIN' || record.group.createdById === adminId;
          if (!isOwnerOrSuper) {
            throw new BadRequestException('Group has reached maximum member capacity');
          }
          const newMax = activeMembers + 1;
          await this.prisma.equbGroup.update({
            where: { id: record.groupId },
            data: { maxMembers: newMax },
          });
        }
        membership = await this.prisma.groupMembership.create({
          data: {
            groupId: record.groupId,
            userId,
            shares: data.createMember!.shares ?? 1,
            status: 'ACTIVE',
          },
        });
      }
    }

    // Deposits always attach to the group's current active cycle
    const cycle = await this.prisma.cycle.findFirst({
      where: { groupId: record.groupId, status: 'ACTIVE' },
      orderBy: { cycleNumber: 'desc' },
    });
    if (!cycle) {
      throw new BadRequestException(
        'No active cycle in this group — start the next cycle before resolving.',
      );
    }

    const deposit = await this.createDepositForUnknown(
      record,
      cycle,
      userId,
      adminId,
      createdMember ? 'created-member' : 'paired',
    );

    // Self-learning: register the payer name as an authorized alias so the
    // next payment from this person hits the exact-match tier.
    if (record.senderName) {
      await this.prisma.memberPayerAlias
        .upsert({
          where: {
            userId_name: { userId, name: record.senderName.trim() },
          },
          create: {
            userId,
            name: record.senderName.trim(),
            note: createdMember
              ? 'Payer identity — registered with the member'
              : 'Registered when an Unknown Sender was paired',
          },
          update: {},
        })
        .catch(() => undefined);
    }

    const updated = await this.prisma.unmatchedDeposit.update({
      where: { id },
      data: {
        status: UnmatchedStatus.PAIRED,
        resolvedBy: adminId,
        resolvedAt: new Date(),
        resolution: createdMember ? 'created-member' : 'paired',
        createdUserId: createdMember ? userId : null,
      },
    });

    // Retroactive learning: the admin just identified this sender, so every
    // OTHER pending queue entry from the same payer name or bank account in
    // this group is the same person — pair them through the standard pipeline
    // right now instead of making the admin repeat the action for each one.
    // Each entry is labeled 'auto-follow' for auditability.
    let autoFollowed = 0;
    const nameKey = record.senderName?.trim();
    const accountKey = record.senderAccount?.trim();
    if (nameKey || accountKey) {
      const siblings = await this.prisma.unmatchedDeposit.findMany({
        where: {
          id: { not: record.id },
          groupId: record.groupId,
          status: UnmatchedStatus.PENDING,
          OR: [
            ...(nameKey ? [{ senderName: nameKey }] : []),
            ...(accountKey ? [{ senderAccount: accountKey }] : []),
          ],
        },
        orderBy: { createdAt: 'asc' },
        take: 50,
      });
      for (const sib of siblings) {
        try {
          await this.createDepositForUnknown(sib, cycle, userId, adminId, 'auto-follow');
          autoFollowed += 1;
        } catch {
          // Duplicate FT / rule violation — leave it pending for manual review.
        }
      }
    }

    return { unknownSender: updated, deposit, userId, createdMember, autoFollowed, ruleOverrides };
  }

  /**
   * Turn a queued unknown-sender record into a real deposit for `userId`
   * through the standard pipeline, and mark the queue row resolved.
   * `resolution` distinguishes the admin's manual action from the automatic
   * same-sender follow-up for audit purposes.
   */
  private async createDepositForUnknown(
    record: {
      id: string;
      groupId: string;
      ftNumber: string | null;
      amount: number | null;
      bankName: string | null;
      transferDate: Date | null;
      senderName: string | null;
      senderAccount: string | null;
      imageUrl: string | null;
      cbeData: Prisma.JsonValue;
    },
    cycle: { id: string },
    userId: string,
    adminId: string,
    resolution: string,
  ) {
    const deposit = await this.depositsService.create({
      cycleId: cycle.id,
      groupId: record.groupId,
      userId,
      ftNumber: record.ftNumber || undefined,
      amount: record.amount ?? undefined,
      bankName: record.bankName || undefined,
      depositDate: record.transferDate || undefined,
      senderName: record.senderName || undefined,
      senderAccount: record.senderAccount || undefined,
      imageUrl: record.imageUrl || undefined,
      ocrData: (record.cbeData as Prisma.InputJsonValue) || undefined,
      // Queue entries only exist because the CBE lookup already confirmed the
      // transaction against the bank — the admin's pairing decision above IS
      // the verification. Creating these PENDING forced a second manual
      // confirmation for information the system already had.
      verificationStatus: 'VERIFIED',
      verifiedById: adminId,
      autoVerified: true,
    });

    await this.prisma.unmatchedDeposit.update({
      where: { id: record.id },
      data: {
        status: UnmatchedStatus.PAIRED,
        resolvedBy: adminId,
        resolvedAt: new Date(),
        resolution,
        createdUserId: null,
      },
    });

    return deposit;
  }

  /** Dismiss with an audit note — e.g. duplicate, spam, or non-member transfer. */
  async dismiss(id: string, adminId: string, note?: string) {
    const record = await this.prisma.unmatchedDeposit.findUnique({
      where: { id },
      select: { id: true, status: true, reason: true },
    });
    if (!record) throw new NotFoundException(`Unknown sender ${id} not found`);
    if (record.status !== UnmatchedStatus.PENDING) {
      throw new BadRequestException('This unknown sender has already been resolved.');
    }

    return this.prisma.unmatchedDeposit.update({
      where: { id },
      data: {
        status: UnmatchedStatus.DISMISSED,
        resolvedBy: adminId,
        resolvedAt: new Date(),
        resolution: 'dismissed',
        reason: note
          ? [record.reason, `dismissed: ${note}`].filter(Boolean).join(' — ')
          : record.reason,
      },
    });
  }
}
