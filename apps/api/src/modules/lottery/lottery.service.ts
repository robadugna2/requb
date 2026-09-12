import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { LotteryMethod } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RulesEnforcementService } from '../groups/rules-enforcement.service';

const VALID_METHODS: LotteryMethod[] = ['RANDOM', 'WEIGHTED', 'LIVE_DRAW', 'FIXED_ORDER'];

@Injectable()
export class LotteryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rulesEnforcement: RulesEnforcementService,
  ) {}

  /** Deterministic pick from a hex seed — same seed always yields the same
   *  winner, giving every draw a verifiable audit trail (seed + hash stored). */
  private pickFromSeed<T>(seed: string, pool: T[]): T {
    const digest = createHash('sha256').update(seed).digest('hex');
    const index = BigInt('0x' + digest.slice(0, 16)) % BigInt(pool.length);
    return pool[Number(index)];
  }

  private async getActiveCycleWithGroup(cycleId: string) {
    const cycle = await this.prisma.cycle.findUnique({
      where: { id: cycleId },
      include: {
        group: { include: { rules: true } },
        lotteryResults: { where: { status: 'PENDING' }, take: 1 },
      },
    });
    if (!cycle) {
      throw new NotFoundException(`Cycle with ID ${cycleId} not found`);
    }
    return cycle;
  }

  /** Exact eligibility board the arena wheel is built from — paid status,
   *  rotation state and per-member reasons, matching the draw pool 1:1. */
  async getEligibility(groupId: string) {
    const cycle = await this.prisma.cycle.findFirst({
      where: { groupId, status: 'ACTIVE' },
      include: {
        group: { select: { id: true, name: true, lotteryMethod: true, contributionAmount: true, rules: true } },
        lotteryResults: { where: { status: 'PENDING' }, take: 1 },
      },
    });
    if (!cycle) {
      throw new NotFoundException('No active cycle found for this group');
    }

    const members = await this.prisma.groupMembership.findMany({
      where: { groupId, status: 'ACTIVE' },
      include: { user: { select: { id: true, name: true, phone: true, photoUrl: true } } },
    });
    members.sort((a, b) => a.user.name.localeCompare(b.user.name));

    const paid = await this.prisma.deposit.findMany({
      where: { cycleId: cycle.id, verificationStatus: 'VERIFIED' },
      select: { userId: true, amount: true },
    });
    const paidByUser = new Map<string, number>();
    for (const d of paid) {
      paidByUser.set(d.userId, (paidByUser.get(d.userId) || 0) + (d.amount || 0));
    }

    const wins = await this.prisma.lotteryResult.groupBy({
      by: ['winnerId'],
      where: { status: 'CONFIRMED', cycle: { groupId } },
      _count: { winnerId: true },
    });
    const winCount = new Map(wins.map((w) => [w.winnerId, w._count.winnerId]));

    const memberBoard = members.map((m) => {
      const verified = paidByUser.get(m.userId) || 0;
      const userWins = winCount.get(m.userId) || 0;
      const rotationLeft = Math.max(0, m.shares - userWins);
      let eligible = true;
      let reason = 'Eligible this cycle';
      if (verified <= 0) {
        eligible = false;
        reason = 'No verified deposit for this cycle';
      } else if (rotationLeft <= 0) {
        eligible = false;
        reason = 'Rotation complete (all shares already won)';
      }
      return {
        userId: m.userId,
        name: m.user.name,
        phone: m.user.phone,
        photoUrl: m.user.photoUrl || undefined,
        shares: m.shares,
        confirmedWins: userWins,
        rotationLeft,
        verifiedAmount: verified,
        eligible,
        reason,
      };
    });

    const pending = cycle.lotteryResults[0] ?? null;
    const violations = await this.rulesEnforcement.validateLotteryEligibility(
      groupId,
      cycle.id,
    );

    return {
      groupId,
      groupName: cycle.group.name,
      cycleId: cycle.id,
      cycleNumber: cycle.cycleNumber,
      defaultMethod: cycle.group.lotteryMethod,
      members: memberBoard,
      eligibleCount: memberBoard.filter((m) => m.eligible).length,
      totalPool: cycle.group.contributionAmount *
        members.reduce((s, m) => s + m.shares, 0),
      violations,
      pendingResultId: pending?.id ?? null,
    };
  }

  /** Phase 1 — run the draw. Creates a PENDING result (seeded, auditable) that
   *  awaits admin confirmation; the cycle and payouts are only touched in
   *  phase 2 (confirmDraw), so a re-draw is always possible until confirmed. */
  async drawWinner(cycleId: string, adminId: string, methodOverride?: string) {
    const cycle = await this.getActiveCycleWithGroup(cycleId);

    if (cycle.lotteryResults.length > 0) {
      throw new BadRequestException(
        'This cycle already has a draw awaiting confirmation. Confirm it or re-draw.',
      );
    }

    if (cycle.status !== 'ACTIVE') {
      throw new BadRequestException('Can only draw winner for active cycles');
    }

    const method: LotteryMethod =
      methodOverride && VALID_METHODS.includes(methodOverride as LotteryMethod)
        ? (methodOverride as LotteryMethod)
        : cycle.group.lotteryMethod;

    // Validate lottery eligibility against configured group rules
    const violations = await this.rulesEnforcement.validateLotteryEligibility(
      cycle.groupId,
      cycleId,
    );

    const errorViolations = violations.filter((v) => v.severity === 'ERROR');
    if (errorViolations.length > 0) {
      throw new BadRequestException(
        `Cannot draw winner: ${errorViolations.map((v) => v.message).join(', ')}`,
      );
    }

    // Get all active members of the group
    const activeMembers = await this.prisma.groupMembership.findMany({
      where: { groupId: cycle.groupId, status: 'ACTIVE' },
      include: { user: true },
    });

    if (activeMembers.length === 0) {
      throw new BadRequestException('No active members in this group');
    }

    // Get members who have paid (verified deposits) for this cycle
    const paidDeposits = await this.prisma.deposit.findMany({
      where: { cycleId, verificationStatus: 'VERIFIED' },
      select: { userId: true },
    });

    const paidUserIds = new Set(paidDeposits.map((d) => d.userId));

    // Filter to only members who have paid
    const eligiblePaidMembers = activeMembers.filter((m) =>
      paidUserIds.has(m.userId),
    );

    if (eligiblePaidMembers.length === 0) {
      throw new BadRequestException(
        'No eligible members found. Members must have a verified deposit for this cycle.',
      );
    }

    // Confirmed win counts feed the rotation filter for share-based draws
    const previousWinners = await this.prisma.lotteryResult.findMany({
      where: { status: 'CONFIRMED', cycle: { groupId: cycle.groupId } },
      select: { winnerId: true },
    });
    const winCounts: Record<string, number> = {};
    for (const w of previousWinners) {
      winCounts[w.winnerId] = (winCounts[w.winnerId] || 0) + 1;
    }

    let winner: typeof activeMembers[0];
    let seed: string | null = null;
    let resultHash: string | null = null;

    if (method === 'FIXED_ORDER') {
      // Rotation order wins — verify the scheduled member is eligible today
      const nextInOrder = await this.prisma.payoutOrder.findFirst({
        where: { groupId: cycle.groupId, status: 'PENDING' },
        orderBy: { position: 'asc' },
        include: { user: true },
      });

      if (!nextInOrder) {
        throw new BadRequestException(
          'No pending rotation order found for this group.',
        );
      }

      const targetMembership = eligiblePaidMembers.find(
        (m) => m.userId === nextInOrder.userId,
      );

      if (!targetMembership) {
        throw new BadRequestException(
          `The scheduled winner (${nextInOrder.user.name}) is either not active or has not submitted/verified their deposit for this cycle.`,
        );
      }

      winner = targetMembership;
      // The payout-order slot is only consumed when the draw is confirmed.
    } else {
      // Share rotation: members win once per share before the rotation resets
      let pool = eligiblePaidMembers.filter((m) => {
        const userWins = winCounts[m.userId] || 0;
        return userWins < m.shares;
      });
      // If all shares have won once, start a new rotation (reset wins)
      if (pool.length === 0) {
        pool = eligiblePaidMembers;
      }

      seed = randomBytes(8).toString('hex');

      if (method === 'WEIGHTED') {
        // Weighted by remaining rotation turns (min weight 1)
        const weighted: typeof pool = [];
        for (const m of pool) {
          const weight = Math.max(1, m.shares - (winCounts[m.userId] || 0));
          for (let i = 0; i < weight; i++) weighted.push(m);
        }
        winner = this.pickFromSeed(seed, weighted);
      } else {
        // RANDOM and LIVE_DRAW: uniform seeded pick
        winner = this.pickFromSeed(seed, pool);
      }

      resultHash = createHash('sha256')
        .update(`${cycleId}:${seed}:${winner.userId}`)
        .digest('hex');
    }

    // Calculate contribution & payout values based on shares
    const totalActiveShares = activeMembers.reduce((sum, m) => sum + m.shares, 0);
    const grossAmountWon = cycle.group.contributionAmount * totalActiveShares;

    // Preview-only fee calculation (fees are snapshotted at confirmation)
    const adminFeeAmount = await this.rulesEnforcement.calculateAdminFee(
      cycle.groupId,
      grossAmountWon,
    );
    const netAmountWon = grossAmountWon - adminFeeAmount;

    const attempt =
      ((await this.prisma.lotteryResult.aggregate({
        where: { cycleId },
        _max: { attempt: true },
      }))._max.attempt ?? 0) + 1;

    const lotteryResult = await this.prisma.lotteryResult.create({
      data: {
        cycleId,
        winnerId: winner.userId,
        method,
        status: 'PENDING',
        attempt,
        amountWon: grossAmountWon,
        seed,
        resultHash,
        drawnBy: adminId,
      },
      include: {
        winner: true,
        cycle: { include: { group: true } },
      },
    });

    return {
      ...lotteryResult,
      amount: lotteryResult.amountWon,
      gross: grossAmountWon,
      adminFee: adminFeeAmount,
      net: netAmountWon,
      eligibleCount: eligiblePaidMembers.length,
      awaitingConfirmation: true,
    };
  }

  /** Phase 2 — admin confirms the lucky member. This is the only step that
   *  completes the cycle, snapshots fees and creates the payout. */
  async confirmDraw(resultId: string, adminId: string) {
    const result = await this.prisma.lotteryResult.findUnique({
      where: { id: resultId },
      include: { cycle: { include: { group: true } } },
    });

    if (!result) {
      throw new NotFoundException(`Lottery result ${resultId} not found`);
    }
    if (result.status !== 'PENDING') {
      throw new BadRequestException(
        'Only a pending draw can be confirmed (it may already be confirmed or re-drawn).',
      );
    }
    if (result.cycle.status !== 'ACTIVE') {
      throw new BadRequestException('The cycle is no longer active');
    }

    const gross = result.amountWon;
    const adminFeeAmount = await this.rulesEnforcement.calculateAdminFee(
      result.cycle.groupId,
      gross,
    );
    const netAmount = gross - adminFeeAmount;
    const payoutDate = await this.rulesEnforcement.calculatePayoutDate(
      result.cycle.groupId,
    );

    const confirmed = await this.prisma.lotteryResult.update({
      where: { id: resultId },
      data: {
        status: 'CONFIRMED',
        confirmedBy: adminId,
        confirmedAt: new Date(),
        adminFeeAmount,
        netAmount,
      },
    });

    // Complete the cycle with the confirmed winner
    await this.prisma.cycle.update({
      where: { id: result.cycleId },
      data: { winnerId: result.winnerId, status: 'COMPLETED' },
    });

    // Consume the rotation slot for fixed-order groups
    if (result.method === 'FIXED_ORDER') {
      const slot = await this.prisma.payoutOrder.findFirst({
        where: { groupId: result.cycle.groupId, status: 'PENDING', userId: result.winnerId },
        orderBy: { position: 'asc' },
      });
      if (slot) {
        await this.prisma.payoutOrder.update({
          where: { id: slot.id },
          data: { status: 'COMPLETED' },
        });
      }
    }

    // Create a pending payout record with fee calculations
    const payout = await this.prisma.payout.create({
      data: {
        lotteryResultId: resultId,
        amount: netAmount,
        adminFeeAmount,
        payoutDate,
        status: 'PENDING',
      },
    });

    // Check if the group is now complete (all shares have won)
    const shouldCompleteGroup = await this.rulesEnforcement.shouldAutoCompleteGroup(
      result.cycle.groupId,
    );
    if (shouldCompleteGroup) {
      await this.prisma.equbGroup.update({
        where: { id: result.cycle.groupId },
        data: { status: 'COMPLETED' },
      });
    }

    return { ...confirmed, payout, awaitingConfirmation: false };
  }

  /** Void a pending draw (kept for history) and immediately run a fresh one —
   *  the admin's re-draw decision. */
  async redrawDraw(resultId: string, adminId: string) {
    const result = await this.prisma.lotteryResult.findUnique({
      where: { id: resultId },
    });

    if (!result) {
      throw new NotFoundException(`Lottery result ${resultId} not found`);
    }
    if (result.status !== 'PENDING') {
      throw new BadRequestException(
        'Only a pending draw can be re-drawn (confirmed winners are final).',
      );
    }

    await this.prisma.lotteryResult.update({
      where: { id: resultId },
      data: {
        status: 'VOID',
        voidedAt: new Date(),
        voidReason: 'Superseded by admin re-draw',
      },
    });

    return this.drawWinner(result.cycleId, adminId, result.method);
  }

  async getResults(groupId?: string, adminId?: string, role?: string) {
    let groupWhere: any = { deletedAt: null };

    if (role === 'ADMIN' && adminId) {
      groupWhere.createdById = adminId;
    } else if (role === 'SUB_ADMIN' && adminId) {
      groupWhere.leaders = { some: { adminId } };
    }

    if (groupId) {
      const group = await this.prisma.equbGroup.findUnique({
        where: { id: groupId },
      });
      if (!group) {
        throw new NotFoundException(`Group with ID ${groupId} not found`);
      }
      groupWhere.id = groupId;
    }

    const results = await this.prisma.lotteryResult.findMany({
      where: { cycle: { group: groupWhere } },
      include: {
        winner: true,
        cycle: {
          include: {
            group: {
              select: { id: true, name: true, contributionAmount: true },
            },
          },
        },
        payout: true,
      },
      orderBy: { drawnAt: 'desc' },
    });

    // Resolve the triggering/confirming admin names for the audit trail
    const adminIds = [
      ...new Set(
        results.flatMap((r) => [r.drawnBy, r.confirmedBy].filter(Boolean) as string[]),
      ),
    ];
    const admins = adminIds.length
      ? await this.prisma.admin.findMany({
          where: { id: { in: adminIds } },
          select: { id: true, name: true },
        })
      : [];
    const adminNames = new Map(admins.map((a) => [a.id, a.name]));

    return results.map((r) => ({
      ...r,
      drawnByName: r.drawnBy ? adminNames.get(r.drawnBy) ?? null : null,
      confirmedByName: r.confirmedBy ? adminNames.get(r.confirmedBy) ?? null : null,
    }));
  }
}
