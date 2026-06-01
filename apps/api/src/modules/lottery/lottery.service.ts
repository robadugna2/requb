import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RulesEnforcementService } from '../groups/rules-enforcement.service';

@Injectable()
export class LotteryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rulesEnforcement: RulesEnforcementService,
  ) {}

  async drawWinner(cycleId: string, adminId: string) {
    // Get the cycle with group info
    const cycle = await this.prisma.cycle.findUnique({
      where: { id: cycleId },
      include: {
        group: {
          include: { rules: true },
        },
        lotteryResult: true,
      },
    });

    if (!cycle) {
      throw new NotFoundException(`Cycle with ID ${cycleId} not found`);
    }

    if (cycle.lotteryResult) {
      throw new BadRequestException('A winner has already been drawn for this cycle');
    }

    if (cycle.status !== 'ACTIVE') {
      throw new BadRequestException('Can only draw winner for active cycles');
    }

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
      where: {
        groupId: cycle.groupId,
        status: 'ACTIVE',
      },
      include: { user: true },
    });

    if (activeMembers.length === 0) {
      throw new BadRequestException('No active members in this group');
    }

    // Get members who have paid (verified deposits) for this cycle
    const paidDeposits = await this.prisma.deposit.findMany({
      where: {
        cycleId,
        verificationStatus: 'VERIFIED',
      },
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

    let winner: typeof activeMembers[0];

    // Handle FIXED_ORDER lottery method
    if (cycle.group.lotteryMethod === 'FIXED_ORDER') {
      const nextInOrder = await this.prisma.payoutOrder.findFirst({
        where: {
          groupId: cycle.groupId,
          status: 'PENDING',
        },
        orderBy: { position: 'asc' },
        include: { user: true },
      });

      if (!nextInOrder) {
        throw new BadRequestException('No pending rotation order found for this group.');
      }

      // Check if user is active and has paid
      const targetMembership = eligiblePaidMembers.find(
        (m) => m.userId === nextInOrder.userId,
      );

      if (!targetMembership) {
        throw new BadRequestException(
          `The scheduled winner (${nextInOrder.user.name}) is either not active or has not submitted/verified their deposit for this cycle.`,
        );
      }

      winner = targetMembership;

      // Update payout order position status
      await this.prisma.payoutOrder.update({
        where: { id: nextInOrder.id },
        data: { status: 'COMPLETED' },
      });
    } else {
      // RANDOM or LIVE_DRAW
      // Get previous winners in this group's current rotation
      const previousWinners = await this.prisma.lotteryResult.findMany({
        where: {
          cycle: {
            groupId: cycle.groupId,
          },
        },
        select: { winnerId: true },
      });

      // Count how many times each user has won
      const winCounts: Record<string, number> = {};
      for (const w of previousWinners) {
        winCounts[w.winnerId] = (winCounts[w.winnerId] || 0) + 1;
      }

      // Filter out members who have already won up to their share count
      let eligibleMembers = eligiblePaidMembers.filter(
        (m) => {
          const userWins = winCounts[m.userId] || 0;
          return userWins < m.shares;
        },
      );

      // If all shares have won once, start a new rotation (reset wins)
      if (eligibleMembers.length === 0) {
        eligibleMembers = eligiblePaidMembers;
      }

      const randomIndex = Math.floor(Math.random() * eligibleMembers.length);
      winner = eligibleMembers[randomIndex];
    }

    // Calculate contribution & payout values based on shares
    const totalActiveShares = activeMembers.reduce((sum, m) => sum + m.shares, 0);
    const grossAmountWon = cycle.group.contributionAmount * totalActiveShares;

    // Calculate admin fee if configured
    const adminFeeAmount = await this.rulesEnforcement.calculateAdminFee(
      cycle.groupId,
      grossAmountWon,
    );
    const netAmountWon = grossAmountWon - adminFeeAmount;

    // Calculate payout date based on schedule
    const payoutDate = await this.rulesEnforcement.calculatePayoutDate(
      cycle.groupId,
    );

    // Create lottery result
    const lotteryResult = await this.prisma.lotteryResult.create({
      data: {
        cycleId,
        winnerId: winner.userId,
        method: cycle.group.lotteryMethod,
        amountWon: grossAmountWon,
        drawnBy: adminId,
      },
      include: {
        winner: true,
        cycle: {
          include: { group: true },
        },
      },
    });

    // Update the cycle with the winner and mark as completed
    await this.prisma.cycle.update({
      where: { id: cycleId },
      data: {
        winnerId: winner.userId,
        status: 'COMPLETED',
      },
    });

    // Create a pending payout record with fee calculations
    await this.prisma.payout.create({
      data: {
        lotteryResultId: lotteryResult.id,
        amount: netAmountWon,
        adminFeeAmount: adminFeeAmount,
        payoutDate,
        status: 'PENDING',
      },
    });

    // Check if the group is now complete (all shares have won)
    const shouldCompleteGroup = await this.rulesEnforcement.shouldAutoCompleteGroup(
      cycle.groupId,
    );

    if (shouldCompleteGroup) {
      await this.prisma.equbGroup.update({
        where: { id: cycle.groupId },
        data: { status: 'COMPLETED' },
      });
    }

    return lotteryResult;
  }

  async getResults(groupId?: string) {
    if (groupId) {
      // Verify group exists
      const group = await this.prisma.equbGroup.findUnique({
        where: { id: groupId },
      });

      if (!group) {
        throw new NotFoundException(`Group with ID ${groupId} not found`);
      }
    }

    const where = groupId
      ? { cycle: { groupId } }
      : {};

    return this.prisma.lotteryResult.findMany({
      where,
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
  }
}
