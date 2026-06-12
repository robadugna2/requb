import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminFeeType } from '@prisma/client';

export interface MemberDueCalculation {
  userId: string;
  userName: string;
  contributionDue: number;
  adminFeeDue: number;
  totalDue: number;
  shares: number;
  isMerged: boolean;
  mergedGroupName?: string;
}

@Injectable()
export class SharesCalculationService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Admin Fee Calculation ────────────────────────────────────────

  /**
   * Get the admin fee amount per share for a group.
   * For FIXED type, returns the fixed amount directly.
   * For PERCENTAGE type, calculates fee based on contribution amount.
   * For NONE, returns 0.
   */
  async getAdminFeePerShare(groupId: string): Promise<number> {
    const group = await this.prisma.equbGroup.findUnique({
      where: { id: groupId },
      include: { rules: true },
    });

    if (!group) {
      throw new NotFoundException(`Group with ID ${groupId} not found`);
    }

    if (!group.rules || group.rules.adminFeeType === 'NONE') {
      return 0;
    }

    switch (group.rules.adminFeeType) {
      case 'FIXED':
        return group.rules.adminFeeAmount ?? 0;
      case 'PERCENTAGE':
        const percent = group.rules.adminFeePercent ?? 0;
        return (group.contributionAmount * percent) / 100;
      default:
        return 0;
    }
  }

  // ─── Fee Waiver Check ─────────────────────────────────────────────

  /**
   * Check if a member has an active admin fee waiver for the group
   */
  async hasFeeWaiver(groupId: string, userId: string): Promise<boolean> {
    const activeWaiver = await this.prisma.adminFeeWaiver.findFirst({
      where: {
        groupId,
        userId,
        status: 'ACTIVE',
      },
    });

    return !!activeWaiver;
  }

  // ─── Single Member Due Calculation ────────────────────────────────

  /**
   * Calculate the total amount due for a specific member in a group.
   * Takes into account shares, merged member status, and admin fee waivers.
   *
   * Formula (regular member):
   *   Total Due = (contributionAmount × shares) + (adminFeePerShare × shares)
   *
   * Formula (merged member):
   *   portion = contributionAmount × mergedGroup.totalShares × slot.sharePercentage
   *   feePortion = adminFeePerShare × mergedGroup.totalShares × slot.sharePercentage
   *   Total Due = portion + feePortion
   */
  async calculateMemberDue(
    groupId: string,
    userId: string,
  ): Promise<MemberDueCalculation> {
    const group = await this.prisma.equbGroup.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      throw new NotFoundException(`Group with ID ${groupId} not found`);
    }

    const membership = await this.prisma.groupMembership.findFirst({
      where: { groupId, userId, status: 'ACTIVE' },
      include: {
        user: { select: { id: true, name: true } },
        mergedGroup: {
          include: {
            slots: {
              where: { userId, status: 'ACTIVE' },
            },
          },
        },
      },
    });

    if (!membership) {
      throw new NotFoundException(
        `Active membership not found for user ${userId} in group ${groupId}`,
      );
    }

    const adminFeePerShare = await this.getAdminFeePerShare(groupId);
    const hasWaiver = await this.hasFeeWaiver(groupId, userId);

    const isMerged = !!membership.mergedGroupId && !!membership.mergedGroup;

    let contributionDue: number;
    let adminFeeDue: number;
    let shares: number;
    let mergedGroupName: string | undefined;

    if (isMerged && membership.mergedGroup) {
      // Merged member calculation
      const slot = membership.mergedGroup.slots[0];
      const sharePercentage = slot?.sharePercentage ?? 0;
      const totalShares = membership.mergedGroup.totalShares;

      contributionDue =
        group.contributionAmount * totalShares * sharePercentage;
      adminFeeDue = hasWaiver
        ? 0
        : adminFeePerShare * totalShares * sharePercentage;
      shares = totalShares;
      mergedGroupName = membership.mergedGroup.name;
    } else {
      // Regular member calculation
      shares = membership.shares;
      contributionDue = group.contributionAmount * shares;
      adminFeeDue = hasWaiver ? 0 : adminFeePerShare * shares;
    }

    const totalDue = contributionDue + adminFeeDue;

    return {
      userId: membership.user.id,
      userName: membership.user.name,
      contributionDue,
      adminFeeDue,
      totalDue,
      shares,
      isMerged,
      mergedGroupName,
    };
  }

  // ─── All Members Due Calculation ──────────────────────────────────

  /**
   * Calculate dues for all active members in a group.
   * Returns an array of due calculations for each member.
   */
  async calculateAllMemberDues(
    groupId: string,
  ): Promise<MemberDueCalculation[]> {
    const group = await this.prisma.equbGroup.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      throw new NotFoundException(`Group with ID ${groupId} not found`);
    }

    const memberships = await this.prisma.groupMembership.findMany({
      where: { groupId, status: 'ACTIVE' },
      include: {
        user: { select: { id: true, name: true } },
        mergedGroup: {
          include: {
            slots: { where: { status: 'ACTIVE' } },
          },
        },
      },
    });

    if (memberships.length === 0) {
      return [];
    }

    const adminFeePerShare = await this.getAdminFeePerShare(groupId);

    // Batch fetch all active fee waivers for this group
    const activeWaivers = await this.prisma.adminFeeWaiver.findMany({
      where: {
        groupId,
        status: 'ACTIVE',
      },
      select: { userId: true },
    });

    const waivedUserIds = new Set(activeWaivers.map((w) => w.userId));

    const dues: MemberDueCalculation[] = [];

    for (const membership of memberships) {
      const hasWaiver = waivedUserIds.has(membership.userId);
      const isMerged =
        !!membership.mergedGroupId && !!membership.mergedGroup;

      let contributionDue: number;
      let adminFeeDue: number;
      let shares: number;
      let mergedGroupName: string | undefined;

      if (isMerged && membership.mergedGroup) {
        // Find this user's slot in the merged group
        const slot = membership.mergedGroup.slots.find(
          (s) => s.userId === membership.userId,
        );
        const sharePercentage = slot?.sharePercentage ?? 0;
        const totalShares = membership.mergedGroup.totalShares;

        contributionDue =
          group.contributionAmount * totalShares * sharePercentage;
        adminFeeDue = hasWaiver
          ? 0
          : adminFeePerShare * totalShares * sharePercentage;
        shares = totalShares;
        mergedGroupName = membership.mergedGroup.name;
      } else {
        // Regular member calculation
        shares = membership.shares;
        contributionDue = group.contributionAmount * shares;
        adminFeeDue = hasWaiver ? 0 : adminFeePerShare * shares;
      }

      const totalDue = contributionDue + adminFeeDue;

      dues.push({
        userId: membership.user.id,
        userName: membership.user.name,
        contributionDue,
        adminFeeDue,
        totalDue,
        shares,
        isMerged,
        mergedGroupName,
      });
    }

    return dues;
  }
}
