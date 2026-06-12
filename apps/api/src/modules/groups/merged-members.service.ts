import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MergedGroupStatus, MergedSlotStatus, PenaltyReason } from '@prisma/client';

export type MergedMemberPaymentStatus = 'PAID' | 'PARTIAL' | 'UNPAID' | 'LATE';

export interface MergedMemberDepositStatus {
  userId: string;
  userName: string;
  expectedContribution: number;
  expectedAdminFee: number;
  expectedTotal: number;
  paidAmount: number;
  status: MergedMemberPaymentStatus;
}

export interface MemberCycleDeposit {
  userId: string;
  userName: string;
  expectedContribution: number;
  expectedAdminFee: number;
  expectedTotal: number;
  paidAmount: number;
  status: MergedMemberPaymentStatus;
}

export interface CycleDepositRecord {
  cycleId: string;
  cycleNumber: number;
  startDate: string;
  endDate: string;
  cycleStatus: string;
  members: MemberCycleDeposit[];
  totalExpected: number;
  totalPaid: number;
}

export interface MergedGroupDepositHistory {
  mergedGroupId: string;
  mergedGroupName: string;
  groupName: string;
  currency: string;
  totalShares: number;
  cycles: CycleDepositRecord[];
}

export interface CreateMergedGroupDto {
  groupId: string;
  name?: string;
  userIds: string[];
  totalShares?: number;
}

@Injectable()
export class MergedMembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ─── Create Merged Group ────────────────────────────────────────

  /**
   * Creates a merged member group with users, auto-calculates equal share percentages.
   * Validates group rules (allowMergedMembers, maxMergedMembersPerSlot).
   */
  async createMergedGroup(data: CreateMergedGroupDto) {
    const { groupId, userIds, totalShares = 1 } = data;

    if (userIds.length < 2) {
      throw new BadRequestException(
        'A merged group requires at least 2 members.',
      );
    }

    // Validate group rules
    const rules = await this.prisma.groupRules.findUnique({
      where: { groupId },
    });

    if (rules && !rules.allowMergedMembers) {
      throw new BadRequestException(
        'This group does not allow merged members (ድርሻ ማጣመር).',
      );
    }

    const maxMembers = rules?.maxMergedMembersPerSlot ?? 4;

    if (userIds.length > maxMembers) {
      throw new BadRequestException(
        `Cannot have more than ${maxMembers} members in a merged group. Attempted: ${userIds.length}.`,
      );
    }

    // Verify all users exist
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
    });

    if (users.length !== userIds.length) {
      const foundIds = users.map((u) => u.id);
      const missingIds = userIds.filter((id) => !foundIds.includes(id));
      throw new NotFoundException(
        `Users not found: ${missingIds.join(', ')}`,
      );
    }

    // Verify all users are active members of the group
    const memberships = await this.prisma.groupMembership.findMany({
      where: {
        groupId,
        userId: { in: userIds },
        status: 'ACTIVE',
      },
    });

    if (memberships.length !== userIds.length) {
      throw new BadRequestException(
        'All users must be active members of the group to form a merged group.',
      );
    }

    // Check that none of these users are already in another active merged group for this group
    const existingSlots = await this.prisma.mergedMemberSlot.findMany({
      where: {
        userId: { in: userIds },
        status: 'ACTIVE',
        mergedGroup: {
          groupId,
          status: 'ACTIVE',
        },
      },
      include: { user: { select: { name: true } } },
    });

    if (existingSlots.length > 0) {
      const names = existingSlots.map((s) => s.user.name).join(', ');
      throw new BadRequestException(
        `The following members are already in an active merged group: ${names}`,
      );
    }

    // Auto-generate name from first letters of member names if not provided
    const name =
      data.name || this.generateMergedGroupName(users.map((u) => u.name));

    // Calculate equal share percentage
    const sharePercentage = 1 / userIds.length;

    // Create the merged group with slots in a transaction
    const mergedGroup = await this.prisma.$transaction(async (tx) => {
      const group = await tx.mergedMemberGroup.create({
        data: {
          groupId,
          name,
          totalShares,
          maxMembers,
          status: 'ACTIVE',
          slots: {
            create: userIds.map((userId) => ({
              userId,
              sharePercentage,
              status: 'ACTIVE',
            })),
          },
        },
        include: {
          slots: {
            include: {
              user: { select: { id: true, name: true, phone: true } },
            },
          },
        },
      });

      // Update group memberships to link to the merged group
      await tx.groupMembership.updateMany({
        where: {
          groupId,
          userId: { in: userIds },
          status: 'ACTIVE',
        },
        data: {
          mergedGroupId: group.id,
        },
      });

      return group;
    });

    return mergedGroup;
  }

  // ─── Add Member to Merged Group ─────────────────────────────────

  /**
   * Adds a member to an existing merged group and recalculates equal percentages.
   */
  async addMemberToMergedGroup(mergedGroupId: string, userId: string) {
    const mergedGroup = await this.prisma.mergedMemberGroup.findUnique({
      where: { id: mergedGroupId },
      include: {
        slots: { where: { status: 'ACTIVE' } },
      },
    });

    if (!mergedGroup) {
      throw new NotFoundException(
        `Merged group with ID ${mergedGroupId} not found.`,
      );
    }

    if (mergedGroup.status !== 'ACTIVE') {
      throw new BadRequestException('Cannot add members to a dissolved group.');
    }

    // Check max members limit
    const activeSlotCount = mergedGroup.slots.length;
    if (activeSlotCount >= mergedGroup.maxMembers) {
      throw new BadRequestException(
        `Merged group already has the maximum of ${mergedGroup.maxMembers} members.`,
      );
    }

    // Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found.`);
    }

    // Verify user is an active member of the group
    const membership = await this.prisma.groupMembership.findFirst({
      where: {
        groupId: mergedGroup.groupId,
        userId,
        status: 'ACTIVE',
      },
    });

    if (!membership) {
      throw new BadRequestException(
        'User must be an active member of the group.',
      );
    }

    // Check user isn't already in another active merged group for this group
    const existingSlot = await this.prisma.mergedMemberSlot.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        mergedGroup: {
          groupId: mergedGroup.groupId,
          status: 'ACTIVE',
        },
      },
    });

    if (existingSlot) {
      throw new BadRequestException(
        'User is already in an active merged group for this equb group.',
      );
    }

    // Calculate new equal share percentage
    const newMemberCount = activeSlotCount + 1;
    const newSharePercentage = 1 / newMemberCount;

    // Add the new member and recalculate all percentages in a transaction
    const updatedGroup = await this.prisma.$transaction(async (tx) => {
      // Update existing slot percentages
      await tx.mergedMemberSlot.updateMany({
        where: {
          mergedGroupId,
          status: 'ACTIVE',
        },
        data: {
          sharePercentage: newSharePercentage,
        },
      });

      // Create new slot
      await tx.mergedMemberSlot.create({
        data: {
          mergedGroupId,
          userId,
          sharePercentage: newSharePercentage,
          status: 'ACTIVE',
        },
      });

      // Update the user's group membership to reference the merged group
      await tx.groupMembership.updateMany({
        where: {
          groupId: mergedGroup.groupId,
          userId,
          status: 'ACTIVE',
        },
        data: {
          mergedGroupId,
        },
      });

      return tx.mergedMemberGroup.findUnique({
        where: { id: mergedGroupId },
        include: {
          slots: {
            where: { status: 'ACTIVE' },
            include: {
              user: { select: { id: true, name: true, phone: true } },
            },
          },
        },
      });
    });

    return updatedGroup;
  }

  // ─── Remove Member from Merged Group ────────────────────────────

  /**
   * Removes a member from a merged group. Requires admin approval.
   * Recalculates remaining members' percentages equally.
   * If only 1 member remains after removal, the group is dissolved.
   */
  async removeMemberFromMergedGroup(
    mergedGroupId: string,
    userId: string,
    adminApproved: boolean,
  ) {
    if (!adminApproved) {
      throw new BadRequestException(
        'Admin approval is required to remove a member from a merged group.',
      );
    }

    const mergedGroup = await this.prisma.mergedMemberGroup.findUnique({
      where: { id: mergedGroupId },
      include: {
        slots: { where: { status: 'ACTIVE' } },
      },
    });

    if (!mergedGroup) {
      throw new NotFoundException(
        `Merged group with ID ${mergedGroupId} not found.`,
      );
    }

    if (mergedGroup.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Cannot remove members from a dissolved group.',
      );
    }

    // Find the member's slot
    const slot = mergedGroup.slots.find((s) => s.userId === userId);
    if (!slot) {
      throw new NotFoundException(
        'User is not an active member of this merged group.',
      );
    }

    const remainingCount = mergedGroup.slots.length - 1;

    // If only 1 member would remain, dissolve the group instead
    if (remainingCount < 2) {
      return this.dissolveMergedGroup(mergedGroupId);
    }

    // Recalculate percentage for remaining members
    const newSharePercentage = 1 / remainingCount;

    const updatedGroup = await this.prisma.$transaction(async (tx) => {
      // Mark the member's slot as LEFT
      await tx.mergedMemberSlot.update({
        where: { id: slot.id },
        data: {
          status: 'REMOVED',
          leftAt: new Date(),
        },
      });

      // Recalculate remaining members' percentages
      await tx.mergedMemberSlot.updateMany({
        where: {
          mergedGroupId,
          status: 'ACTIVE',
          userId: { not: userId },
        },
        data: {
          sharePercentage: newSharePercentage,
        },
      });

      // Remove merged group reference from the user's membership
      await tx.groupMembership.updateMany({
        where: {
          groupId: mergedGroup.groupId,
          userId,
          status: 'ACTIVE',
        },
        data: {
          mergedGroupId: null,
        },
      });

      return tx.mergedMemberGroup.findUnique({
        where: { id: mergedGroupId },
        include: {
          slots: {
            include: {
              user: { select: { id: true, name: true, phone: true } },
            },
          },
        },
      });
    });

    return updatedGroup;
  }

  // ─── Update Slot Percentages (Unequal Split) ────────────────────

  /**
   * Updates individual share percentages for members in a merged group.
   * Allows unequal splits (e.g., 50%/25%/25% instead of equal 33%/33%/33%).
   * Validates that percentages sum to 1.0 (with floating point tolerance).
   */
  async updateSlotPercentages(
    mergedGroupId: string,
    percentages: Array<{ userId: string; sharePercentage: number }>,
  ) {
    // Validate no duplicate userIds
    const uniqueUserIds = new Set(percentages.map((p) => p.userId));
    if (uniqueUserIds.size !== percentages.length) {
      throw new BadRequestException('Duplicate userIds in percentages array.');
    }

    const mergedGroup = await this.prisma.mergedMemberGroup.findUnique({
      where: { id: mergedGroupId },
      include: {
        slots: { where: { status: 'ACTIVE' } },
      },
    });

    if (!mergedGroup) {
      throw new NotFoundException(
        `Merged group with ID ${mergedGroupId} not found.`,
      );
    }

    if (mergedGroup.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Cannot update percentages on a dissolved group.',
      );
    }

    // Validate all userIds correspond to active slots
    const activeSlotUserIds = new Set(mergedGroup.slots.map((s) => s.userId));

    for (const entry of percentages) {
      if (!activeSlotUserIds.has(entry.userId)) {
        throw new BadRequestException(
          `User ${entry.userId} is not an active member of this merged group.`,
        );
      }
      if (entry.sharePercentage <= 0 || entry.sharePercentage > 1) {
        throw new BadRequestException(
          `Share percentage for user ${entry.userId} must be between 0 (exclusive) and 1 (inclusive).`,
        );
      }
    }

    // Validate all active slots are covered
    if (percentages.length !== mergedGroup.slots.length) {
      throw new BadRequestException(
        `Must provide percentages for all ${mergedGroup.slots.length} active members. Received ${percentages.length}.`,
      );
    }

    // Validate percentages sum to ~1.0 (tolerance for floating point)
    const sum = percentages.reduce((acc, p) => acc + p.sharePercentage, 0);
    if (Math.abs(sum - 1.0) > 0.01) {
      throw new BadRequestException(
        `Share percentages must sum to 1.0 (100%). Current sum: ${sum.toFixed(4)}.`,
      );
    }

    // Update all slot percentages in a transaction
    const updatedGroup = await this.prisma.$transaction(async (tx) => {
      for (const entry of percentages) {
        const slot = mergedGroup.slots.find((s) => s.userId === entry.userId);
        if (slot) {
          await tx.mergedMemberSlot.update({
            where: { id: slot.id },
            data: { sharePercentage: entry.sharePercentage },
          });
        }
      }

      return tx.mergedMemberGroup.findUnique({
        where: { id: mergedGroupId },
        include: {
          slots: {
            include: {
              user: { select: { id: true, name: true, phone: true } },
            },
            orderBy: { joinedAt: 'asc' },
          },
        },
      });
    });

    return updatedGroup;
  }

  // ─── Dissolve Merged Group ──────────────────────────────────────

  /**
   * Dissolves a merged group, marking all slots as LEFT and
   * removing merged group references from memberships.
   */
  async dissolveMergedGroup(mergedGroupId: string) {
    const mergedGroup = await this.prisma.mergedMemberGroup.findUnique({
      where: { id: mergedGroupId },
      include: {
        slots: { where: { status: 'ACTIVE' } },
      },
    });

    if (!mergedGroup) {
      throw new NotFoundException(
        `Merged group with ID ${mergedGroupId} not found.`,
      );
    }

    if (mergedGroup.status === 'DISSOLVED') {
      throw new BadRequestException('Merged group is already dissolved.');
    }

    const activeUserIds = mergedGroup.slots.map((s) => s.userId);

    const dissolvedGroup = await this.prisma.$transaction(async (tx) => {
      // Mark all active slots as LEFT
      await tx.mergedMemberSlot.updateMany({
        where: {
          mergedGroupId,
          status: 'ACTIVE',
        },
        data: {
          status: 'LEFT',
          leftAt: new Date(),
        },
      });

      // Update group status to DISSOLVED
      const updated = await tx.mergedMemberGroup.update({
        where: { id: mergedGroupId },
        data: { status: 'DISSOLVED' },
        include: {
          slots: {
            include: {
              user: { select: { id: true, name: true, phone: true } },
            },
          },
        },
      });

      // Remove merged group references from memberships
      if (activeUserIds.length > 0) {
        await tx.groupMembership.updateMany({
          where: {
            groupId: mergedGroup.groupId,
            userId: { in: activeUserIds },
            mergedGroupId,
          },
          data: {
            mergedGroupId: null,
          },
        });
      }

      return updated;
    });

    return dissolvedGroup;
  }

  // ─── Query Methods ──────────────────────────────────────────────

  /**
   * Get all merged groups for a given equb group, with their slots.
   */
  async getMergedGroupsByGroup(groupId: string) {
    const group = await this.prisma.equbGroup.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      throw new NotFoundException(`Group with ID ${groupId} not found.`);
    }

    return this.prisma.mergedMemberGroup.findMany({
      where: { groupId },
      include: {
        slots: {
          include: {
            user: { select: { id: true, name: true, phone: true } },
          },
          orderBy: { joinedAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get a single merged group with full details.
   */
  async getMergedGroupDetail(mergedGroupId: string) {
    const mergedGroup = await this.prisma.mergedMemberGroup.findUnique({
      where: { id: mergedGroupId },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            contributionAmount: true,
            currency: true,
          },
        },
        slots: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                phone: true,
                reliabilityScore: true,
              },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });

    if (!mergedGroup) {
      throw new NotFoundException(
        `Merged group with ID ${mergedGroupId} not found.`,
      );
    }

    return mergedGroup;
  }

  // ─── Financial Calculations ─────────────────────────────────────

  /**
   * Calculate what a single merged member owes for their portion of the contribution.
   * Based on the group's contribution amount × total shares × their share percentage.
   */
  async calculateMergedMemberPortion(
    mergedGroupId: string,
    userId: string,
  ): Promise<{
    totalContribution: number;
    memberPortion: number;
    sharePercentage: number;
    currency: string;
  }> {
    const mergedGroup = await this.prisma.mergedMemberGroup.findUnique({
      where: { id: mergedGroupId },
      include: {
        group: {
          select: { contributionAmount: true, currency: true },
        },
        slots: {
          where: { userId, status: 'ACTIVE' },
        },
      },
    });

    if (!mergedGroup) {
      throw new NotFoundException(
        `Merged group with ID ${mergedGroupId} not found.`,
      );
    }

    const slot = mergedGroup.slots[0];
    if (!slot) {
      throw new NotFoundException(
        'User is not an active member of this merged group.',
      );
    }

    const totalContribution =
      mergedGroup.group.contributionAmount * mergedGroup.totalShares;
    const memberPortion = totalContribution * slot.sharePercentage;

    return {
      totalContribution,
      memberPortion: Math.round(memberPortion * 100) / 100, // round to 2 decimal places
      sharePercentage: slot.sharePercentage,
      currency: mergedGroup.group.currency,
    };
  }

  // ─── Individual Deposit Tracking ─────────────────────────────────

  /**
   * Get the deposit compliance status for each member in a merged group.
   * Auto-detects the current active cycle if cycleId is not provided.
   */
  async getMergedGroupDepositStatus(
    mergedGroupId: string,
    cycleId?: string,
  ): Promise<MergedMemberDepositStatus[]> {
    const mergedGroup = await this.prisma.mergedMemberGroup.findUnique({
      where: { id: mergedGroupId },
      include: {
        group: {
          include: { rules: true },
        },
        slots: {
          where: { status: 'ACTIVE' },
          include: {
            user: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!mergedGroup) {
      throw new NotFoundException(
        `Merged group with ID ${mergedGroupId} not found.`,
      );
    }

    // Resolve cycle
    let resolvedCycleId = cycleId;
    if (!resolvedCycleId) {
      const activeCycle = await this.prisma.cycle.findFirst({
        where: { groupId: mergedGroup.groupId, status: 'ACTIVE' },
        orderBy: { cycleNumber: 'desc' },
      });
      if (!activeCycle) {
        // No active cycle — everyone is compliant by default
        return mergedGroup.slots.map((slot) => ({
          userId: slot.user.id,
          userName: slot.user.name,
          expectedContribution: 0,
          expectedAdminFee: 0,
          expectedTotal: 0,
          paidAmount: 0,
          status: 'PAID' as MergedMemberPaymentStatus,
        }));
      }
      resolvedCycleId = activeCycle.id;
    }

    // Calculate admin fee per share
    const adminFeePerShare = this.calculateAdminFeePerShare(
      mergedGroup.group.rules,
      mergedGroup.group.contributionAmount,
    );

    // Query deposits for all slot members in this cycle
    const slotUserIds = mergedGroup.slots.map((s) => s.userId);
    const deposits = await this.prisma.deposit.findMany({
      where: {
        cycleId: resolvedCycleId,
        userId: { in: slotUserIds },
        verificationStatus: { in: ['VERIFIED', 'PENDING'] },
      },
      select: { userId: true, amount: true, verificationStatus: true, isLate: true },
    });

    // Check if we're past the deadline
    const rules = mergedGroup.group.rules;
    const isPastDeadline = this.isPastDepositDeadline(rules?.depositDeadlineDay ?? null);

    // Build status per member
    const results: MergedMemberDepositStatus[] = mergedGroup.slots.map((slot) => {
      const expectedContribution =
        mergedGroup.group.contributionAmount * mergedGroup.totalShares * slot.sharePercentage;
      const expectedAdminFee =
        adminFeePerShare * mergedGroup.totalShares * slot.sharePercentage;
      const expectedTotal = expectedContribution + expectedAdminFee;

      // Sum verified/pending deposits for this member
      const memberDeposits = deposits.filter((d) => d.userId === slot.userId);
      const paidAmount = memberDeposits.reduce((sum, d) => sum + (d.amount ?? 0), 0);
      const hasLateDeposit = memberDeposits.some((d) => d.isLate);

      let status: MergedMemberPaymentStatus;
      if (paidAmount >= expectedTotal * 0.99) {
        // Allow 1% tolerance for rounding
        status = hasLateDeposit ? 'LATE' : 'PAID';
      } else if (paidAmount > 0) {
        status = 'PARTIAL';
      } else if (isPastDeadline) {
        status = 'LATE';
      } else {
        status = 'UNPAID';
      }

      return {
        userId: slot.user.id,
        userName: slot.user.name,
        expectedContribution: Math.round(expectedContribution * 100) / 100,
        expectedAdminFee: Math.round(expectedAdminFee * 100) / 100,
        expectedTotal: Math.round(expectedTotal * 100) / 100,
        paidAmount: Math.round(paidAmount * 100) / 100,
        status,
      };
    });

    return results;
  }

  // ─── Merged Member Compliance Enforcement ───────────────────────

  /**
   * Enforce payment compliance for merged group members.
   * Creates penalties for members who haven't paid their portion past the deadline.
   * Returns a summary of penalties created and members already compliant.
   */
  async enforceMergedMemberCompliance(
    mergedGroupId: string,
    cycleId?: string,
  ): Promise<{
    penaltiesCreated: Array<{ userId: string; userName: string; amount: number }>;
    alreadyCompliant: string[];
  }> {
    const mergedGroup = await this.prisma.mergedMemberGroup.findUnique({
      where: { id: mergedGroupId },
      include: {
        group: {
          include: { rules: true },
        },
      },
    });

    if (!mergedGroup) {
      throw new NotFoundException(
        `Merged group with ID ${mergedGroupId} not found.`,
      );
    }

    if (mergedGroup.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Cannot enforce compliance on a dissolved merged group.',
      );
    }

    // Resolve cycle
    let resolvedCycleId = cycleId;
    if (!resolvedCycleId) {
      const activeCycle = await this.prisma.cycle.findFirst({
        where: { groupId: mergedGroup.groupId, status: 'ACTIVE' },
        orderBy: { cycleNumber: 'desc' },
      });
      if (!activeCycle) {
        return { penaltiesCreated: [], alreadyCompliant: [] };
      }
      resolvedCycleId = activeCycle.id;
    }

    // Get deposit status for each member
    const statuses = await this.getMergedGroupDepositStatus(mergedGroupId, resolvedCycleId);

    const penaltiesCreated: Array<{ userId: string; userName: string; amount: number }> = [];
    const alreadyCompliant: string[] = [];

    // Penalty amount from group rules
    const rules = mergedGroup.group.rules;
    const penaltyAmount = this.calculatePenaltyAmount(
      rules,
      mergedGroup.group.contributionAmount,
    );

    for (const memberStatus of statuses) {
      if (memberStatus.status === 'PAID') {
        alreadyCompliant.push(memberStatus.userName);
        continue;
      }

      // Only penalize if past deadline and status is LATE or UNPAID with zero payment
      if (memberStatus.status !== 'LATE' && memberStatus.status !== 'UNPAID') {
        continue;
      }

      // Check if a penalty already exists for this user in this cycle for this reason
      const existingPenalty = await this.prisma.penaltyRecord.findFirst({
        where: {
          groupId: mergedGroup.groupId,
          userId: memberStatus.userId,
          cycleId: resolvedCycleId,
          reason: PenaltyReason.MISSED_PAYMENT,
          notes: { contains: `merged group "${mergedGroup.name}"` },
        },
      });

      if (existingPenalty) {
        // Already penalized this cycle
        continue;
      }

      // Calculate penalty proportional to member's share
      const memberPenaltyAmount = penaltyAmount > 0
        ? penaltyAmount
        : memberStatus.expectedTotal * 0.05; // Default 5% if no rule configured

      // Create the penalty
      await this.prisma.penaltyRecord.create({
        data: {
          groupId: mergedGroup.groupId,
          userId: memberStatus.userId,
          cycleId: resolvedCycleId,
          reason: PenaltyReason.MISSED_PAYMENT,
          amount: Math.round(memberPenaltyAmount * 100) / 100,
          notes: `Auto-penalty: Missed portion payment in merged group "${mergedGroup.name}". Expected: ETB ${memberStatus.expectedTotal.toLocaleString()}, Paid: ETB ${memberStatus.paidAmount.toLocaleString()}.`,
        },
      });

      // Notify the member
      await this.notificationsService.create({
        type: 'PENALTY_CREATED',
        title: 'Merged Group Payment Penalty',
        message: `You have been penalized for not paying your portion (ETB ${memberStatus.expectedTotal.toLocaleString()}) in merged group "${mergedGroup.name}" for group "${mergedGroup.group.name}". Please settle your dues promptly.`,
        groupId: mergedGroup.groupId,
        userId: memberStatus.userId,
      });

      penaltiesCreated.push({
        userId: memberStatus.userId,
        userName: memberStatus.userName,
        amount: Math.round(memberPenaltyAmount * 100) / 100,
      });
    }

    return { penaltiesCreated, alreadyCompliant };
  }

  // ─── Deposit History ─────────────────────────────────────────────

  /**
   * Get the full deposit payment history across all past cycles for a merged group.
   * Returns cycle-by-cycle breakdown with per-member payment status.
   */
  async getMergedGroupDepositHistory(
    mergedGroupId: string,
  ): Promise<MergedGroupDepositHistory> {
    const mergedGroup = await this.prisma.mergedMemberGroup.findUnique({
      where: { id: mergedGroupId },
      include: {
        group: {
          include: { rules: true },
        },
        slots: {
          include: {
            user: { select: { id: true, name: true } },
          },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });

    if (!mergedGroup) {
      throw new NotFoundException(
        `Merged group with ID ${mergedGroupId} not found.`,
      );
    }

    // Load all completed + active cycles for the group
    const cycles = await this.prisma.cycle.findMany({
      where: {
        groupId: mergedGroup.groupId,
        status: { in: ['ACTIVE', 'COMPLETED'] },
      },
      orderBy: { cycleNumber: 'desc' },
      select: {
        id: true,
        cycleNumber: true,
        startDate: true,
        endDate: true,
        status: true,
      },
    });

    if (cycles.length === 0) {
      return {
        mergedGroupId: mergedGroup.id,
        mergedGroupName: mergedGroup.name,
        groupName: mergedGroup.group.name,
        currency: mergedGroup.group.currency,
        totalShares: mergedGroup.totalShares,
        cycles: [],
      };
    }

    // Single query for all deposits across all cycles for all slot members
    const allSlotUserIds = mergedGroup.slots.map((s) => s.userId);
    const allCycleIds = cycles.map((c) => c.id);

    const allDeposits = await this.prisma.deposit.findMany({
      where: {
        cycleId: { in: allCycleIds },
        userId: { in: allSlotUserIds },
        verificationStatus: { in: ['VERIFIED', 'PENDING'] },
      },
      select: {
        cycleId: true,
        userId: true,
        amount: true,
        verificationStatus: true,
        isLate: true,
      },
    });

    // Group deposits by cycleId and userId
    const depositsByCycleUser = new Map<string, Map<string, { total: number; hasLate: boolean }>>();
    for (const deposit of allDeposits) {
      if (!depositsByCycleUser.has(deposit.cycleId)) {
        depositsByCycleUser.set(deposit.cycleId, new Map());
      }
      const cycleMap = depositsByCycleUser.get(deposit.cycleId)!;
      const existing = cycleMap.get(deposit.userId) || { total: 0, hasLate: false };
      existing.total += deposit.amount ?? 0;
      if (deposit.isLate) existing.hasLate = true;
      cycleMap.set(deposit.userId, existing);
    }

    // Calculate admin fee
    const adminFeePerShare = this.calculateAdminFeePerShare(
      mergedGroup.group.rules,
      mergedGroup.group.contributionAmount,
    );

    // Build cycle records
    const cycleRecords: CycleDepositRecord[] = cycles.map((cycle) => {
      const cycleDeposits = depositsByCycleUser.get(cycle.id) || new Map();

      // Only include slots that were active during this cycle
      const relevantSlots = mergedGroup.slots.filter((slot) => {
        const joinedAt = new Date(slot.joinedAt);
        const cycleEnd = new Date(cycle.endDate);
        const cycleStart = new Date(cycle.startDate);
        const leftAt = slot.leftAt ? new Date(slot.leftAt) : null;
        // Include if they joined before/during this cycle AND hadn't left before it started
        return joinedAt <= cycleEnd && (!leftAt || leftAt >= cycleStart);
      });

      const members: MemberCycleDeposit[] = relevantSlots.map((slot) => {
        const expectedContribution =
          mergedGroup.group.contributionAmount * mergedGroup.totalShares * slot.sharePercentage;
        const expectedAdminFee =
          adminFeePerShare * mergedGroup.totalShares * slot.sharePercentage;
        const expectedTotal = expectedContribution + expectedAdminFee;

        const userDeposit = cycleDeposits.get(slot.userId);
        const paidAmount = userDeposit?.total ?? 0;
        const hasLate = userDeposit?.hasLate ?? false;

        let status: MergedMemberPaymentStatus;
        if (paidAmount >= expectedTotal * 0.99) {
          status = hasLate ? 'LATE' : 'PAID';
        } else if (paidAmount > 0) {
          status = 'PARTIAL';
        } else if (cycle.status === 'COMPLETED') {
          status = 'LATE';
        } else {
          status = 'UNPAID';
        }

        return {
          userId: slot.user.id,
          userName: slot.user.name,
          expectedContribution: Math.round(expectedContribution * 100) / 100,
          expectedAdminFee: Math.round(expectedAdminFee * 100) / 100,
          expectedTotal: Math.round(expectedTotal * 100) / 100,
          paidAmount: Math.round(paidAmount * 100) / 100,
          status,
        };
      });

      const totalExpected = members.reduce((sum, m) => sum + m.expectedTotal, 0);
      const totalPaid = members.reduce((sum, m) => sum + m.paidAmount, 0);

      return {
        cycleId: cycle.id,
        cycleNumber: cycle.cycleNumber,
        startDate: cycle.startDate.toISOString(),
        endDate: cycle.endDate.toISOString(),
        cycleStatus: cycle.status,
        members,
        totalExpected: Math.round(totalExpected * 100) / 100,
        totalPaid: Math.round(totalPaid * 100) / 100,
      };
    });

    return {
      mergedGroupId: mergedGroup.id,
      mergedGroupName: mergedGroup.name,
      groupName: mergedGroup.group.name,
      currency: mergedGroup.group.currency,
      totalShares: mergedGroup.totalShares,
      cycles: cycleRecords,
    };
  }

  // ─── Helpers ────────────────────────────────────────────────────

  /**
   * Auto-generate a merged group name from the first letters of member names.
   * E.g. ["Abebe Kebede", "Fatima Ali", "Robel Tesfaye"] → "AFK"
   */
  private generateMergedGroupName(names: string[]): string {
    return names
      .map((name) => name.charAt(0).toUpperCase())
      .join('');
  }

  /**
   * Calculate admin fee per share from group rules.
   */
  private calculateAdminFeePerShare(
    rules: { adminFeeType: string; adminFeeAmount?: number | null; adminFeePercent?: number | null } | null,
    contributionAmount: number,
  ): number {
    if (!rules || rules.adminFeeType === 'NONE') return 0;
    switch (rules.adminFeeType) {
      case 'FIXED':
        return rules.adminFeeAmount ?? 0;
      case 'PERCENTAGE':
        return (contributionAmount * (rules.adminFeePercent ?? 0)) / 100;
      default:
        return 0;
    }
  }

  /**
   * Calculate penalty amount from group rules.
   */
  private calculatePenaltyAmount(
    rules: { latePenaltyType: string; latePenaltyAmount?: number | null; latePenaltyPercent?: number | null } | null,
    contributionAmount: number,
  ): number {
    if (!rules || rules.latePenaltyType === 'NONE') return 0;
    switch (rules.latePenaltyType) {
      case 'FIXED':
        return rules.latePenaltyAmount ?? 0;
      case 'PERCENTAGE':
        return (contributionAmount * (rules.latePenaltyPercent ?? 0)) / 100;
      default:
        return 0;
    }
  }

  /**
   * Check if the current date is past the deposit deadline day for the month.
   */
  private isPastDepositDeadline(depositDeadlineDay: number | null): boolean {
    if (!depositDeadlineDay) return false;
    const today = new Date();
    return today.getDate() > depositDeadlineDay;
  }
}
