import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class LotteryService {
  constructor(private readonly prisma: PrismaService) {}

  async drawWinner(cycleId: string, adminId: string) {
    // Get the cycle with group info
    const cycle = await this.prisma.cycle.findUnique({
      where: { id: cycleId },
      include: {
        group: true,
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

    // Get previous winners in this group's current rotation
    // A rotation is complete when all members have won once
    const previousWinners = await this.prisma.lotteryResult.findMany({
      where: {
        cycle: {
          groupId: cycle.groupId,
        },
      },
      select: { winnerId: true },
    });

    const previousWinnerIds = new Set(previousWinners.map((w) => w.winnerId));

    // Filter out members who have already won in this rotation
    let eligibleMembers = eligiblePaidMembers.filter(
      (m) => !previousWinnerIds.has(m.userId),
    );

    // If all members have won, start a new rotation (everyone is eligible again)
    if (eligibleMembers.length === 0) {
      eligibleMembers = eligiblePaidMembers;
    }

    // Random selection
    const randomIndex = Math.floor(Math.random() * eligibleMembers.length);
    const winner = eligibleMembers[randomIndex];

    // Calculate amount won (contribution * number of active members)
    const amountWon = cycle.group.contributionAmount * activeMembers.length;

    // Create lottery result
    const lotteryResult = await this.prisma.lotteryResult.create({
      data: {
        cycleId,
        winnerId: winner.userId,
        method: cycle.group.lotteryMethod,
        amountWon,
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

    // Create a pending payout record
    await this.prisma.payout.create({
      data: {
        lotteryResultId: lotteryResult.id,
        status: 'PENDING',
      },
    });

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
