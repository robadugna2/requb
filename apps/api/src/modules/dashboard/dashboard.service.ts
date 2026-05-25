import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    const [totalGroups, activeMembers, pendingReceipts, totalCollectedRaw] =
      await Promise.all([
        this.prisma.equbGroup.count({
          where: { status: 'ACTIVE' },
        }),
        this.prisma.groupMembership.findMany({
          where: { status: 'ACTIVE' },
          select: { userId: true },
          distinct: ['userId'],
        }),
        this.prisma.deposit.count({
          where: { verificationStatus: 'PENDING' },
        }),
        this.prisma.deposit.aggregate({
          where: { verificationStatus: 'VERIFIED' },
          _sum: { amount: true },
        }),
      ]);

    const sum = totalCollectedRaw._sum.amount || 0;
    const totalCollected = this.formatCurrency(sum);

    return {
      totalGroups,
      activeMembers: activeMembers.length,
      pendingReceipts,
      totalCollected,
    };
  }

  async getActivity() {
    const [recentDeposits, recentVerifications, recentLotteries] =
      await Promise.all([
        this.prisma.deposit.findMany({
          where: { verificationStatus: 'PENDING' },
          orderBy: { createdAt: 'desc' },
          take: 15,
          include: {
            user: { select: { name: true } },
            cycle: { include: { group: { select: { name: true } } } },
          },
        }),
        this.prisma.deposit.findMany({
          where: {
            verificationStatus: { in: ['VERIFIED', 'REJECTED'] },
          },
          orderBy: { createdAt: 'desc' },
          take: 15,
          include: {
            user: { select: { name: true } },
            cycle: { include: { group: { select: { name: true } } } },
          },
        }),
        this.prisma.lotteryResult.findMany({
          orderBy: { drawnAt: 'desc' },
          take: 15,
          include: {
            winner: { select: { name: true } },
            cycle: { include: { group: { select: { name: true } } } },
          },
        }),
      ]);

    const activities: {
      id: string;
      type: string;
      message: string;
      time: string;
      timestamp: Date;
    }[] = [];

    for (const deposit of recentDeposits) {
      activities.push({
        id: deposit.id,
        type: 'deposit',
        message: `${deposit.user.name} submitted a deposit for ${deposit.cycle.group.name}`,
        time: this.getRelativeTime(deposit.createdAt),
        timestamp: deposit.createdAt,
      });
    }

    for (const deposit of recentVerifications) {
      const status =
        deposit.verificationStatus === 'VERIFIED' ? 'verified' : 'rejected';
      activities.push({
        id: deposit.id,
        type: 'verification',
        message: `${deposit.user.name}'s deposit was ${status} for ${deposit.cycle.group.name}`,
        time: this.getRelativeTime(deposit.createdAt),
        timestamp: deposit.createdAt,
      });
    }

    for (const lottery of recentLotteries) {
      activities.push({
        id: lottery.id,
        type: 'lottery',
        message: `${lottery.winner.name} won ETB ${lottery.amountWon.toLocaleString()} in ${lottery.cycle.group.name}`,
        time: this.getRelativeTime(lottery.drawnAt),
        timestamp: lottery.drawnAt,
      });
    }

    // Sort by timestamp descending and take first 15
    activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return activities.slice(0, 15).map(({ timestamp, ...rest }) => rest);
  }

  async getDepositsChart() {
    const months: { date: string; deposits: number; verified: number }[] = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

      const monthLabel = start.toLocaleString('en-US', { month: 'short' });

      const [allDeposits, verifiedDeposits] = await Promise.all([
        this.prisma.deposit.aggregate({
          where: {
            createdAt: { gte: start, lt: end },
          },
          _sum: { amount: true },
        }),
        this.prisma.deposit.aggregate({
          where: {
            createdAt: { gte: start, lt: end },
            verificationStatus: 'VERIFIED',
          },
          _sum: { amount: true },
        }),
      ]);

      months.push({
        date: monthLabel,
        deposits: allDeposits._sum.amount || 0,
        verified: verifiedDeposits._sum.amount || 0,
      });
    }

    return months;
  }

  private formatCurrency(amount: number): string {
    if (amount >= 1_000_000) {
      return `ETB ${(amount / 1_000_000).toFixed(1)}M`;
    }
    return `ETB ${amount.toLocaleString()}`;
  }

  private getRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 60) {
      return 'just now';
    } else if (diffMinutes === 1) {
      return '1 minute ago';
    } else if (diffMinutes < 60) {
      return `${diffMinutes} minutes ago`;
    } else if (diffHours === 1) {
      return '1 hour ago';
    } else if (diffHours < 24) {
      return `${diffHours} hours ago`;
    } else if (diffDays === 1) {
      return '1 day ago';
    } else {
      return `${diffDays} days ago`;
    }
  }
}
