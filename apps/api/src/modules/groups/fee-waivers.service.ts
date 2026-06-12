import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PenaltyReason } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PenaltiesService } from './penalties.service';

@Injectable()
export class FeeWaiversService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly penaltiesService: PenaltiesService,
  ) {}

  /**
   * Grant a new admin fee waiver to a member.
   */
  async grantWaiver(data: {
    groupId: string;
    userId: string;
    reason: string;
    durationCycles: number;
    grantedBy: string;
  }) {
    // Check if user already has an active waiver in this group
    const existingWaiver = await this.prisma.adminFeeWaiver.findFirst({
      where: {
        groupId: data.groupId,
        userId: data.userId,
        status: 'ACTIVE',
      },
    });

    if (existingWaiver) {
      throw new BadRequestException(
        'User already has an active fee waiver in this group',
      );
    }

    // Verify the membership exists
    const membership = await this.prisma.groupMembership.findUnique({
      where: {
        groupId_userId: {
          groupId: data.groupId,
          userId: data.userId,
        },
      },
      include: { group: true, user: true },
    });

    if (!membership) {
      throw new NotFoundException(
        'User is not a member of this group',
      );
    }

    const waiver = await this.prisma.adminFeeWaiver.create({
      data: {
        groupId: data.groupId,
        userId: data.userId,
        reason: data.reason,
        durationCycles: data.durationCycles,
        grantedBy: data.grantedBy,
      },
      include: {
        group: true,
        user: true,
      },
    });

    // Notify the member about the waiver
    await this.notificationsService.create({
      type: 'GENERAL',
      title: 'Admin Fee Waiver Granted',
      message: `You have been granted an admin fee waiver for ${data.durationCycles} cycle(s) in "${waiver.group.name}". Reason: ${data.reason}`,
      groupId: data.groupId,
      userId: data.userId,
    });

    return waiver;
  }

  /**
   * Cancel an active waiver.
   */
  async cancelWaiver(waiverId: string, adminId: string) {
    const waiver = await this.prisma.adminFeeWaiver.findUnique({
      where: { id: waiverId },
      include: { group: true, user: true },
    });

    if (!waiver) {
      throw new NotFoundException(
        `Fee waiver with ID ${waiverId} not found`,
      );
    }

    if (waiver.status !== 'ACTIVE') {
      throw new BadRequestException(
        `Cannot cancel a waiver that is already ${waiver.status.toLowerCase()}`,
      );
    }

    const updated = await this.prisma.adminFeeWaiver.update({
      where: { id: waiverId },
      data: { status: 'CANCELLED' },
      include: { group: true, user: true },
    });

    // Notify the member about the cancellation
    await this.notificationsService.create({
      type: 'GENERAL',
      title: 'Admin Fee Waiver Cancelled',
      message: `Your admin fee waiver in "${waiver.group.name}" has been cancelled by an administrator. Admin fees are now due.`,
      groupId: waiver.groupId,
      userId: waiver.userId,
    });

    return updated;
  }

  /**
   * Get all waivers for a group.
   */
  async getGroupWaivers(groupId: string) {
    return this.prisma.adminFeeWaiver.findMany({
      where: { groupId },
      include: {
        user: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get waivers for a specific user in a group.
   */
  async getUserWaivers(groupId: string, userId: string) {
    return this.prisma.adminFeeWaiver.findMany({
      where: { groupId, userId },
      include: {
        group: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Check if a user has an active waiver in a group.
   */
  async hasActiveWaiver(groupId: string, userId: string): Promise<boolean> {
    const waiver = await this.prisma.adminFeeWaiver.findFirst({
      where: {
        groupId,
        userId,
        status: 'ACTIVE',
      },
    });

    return !!waiver;
  }

  /**
   * Process cycle advance for all active waivers in a group.
   * Called when a new cycle starts. Increments cyclesUsed,
   * checks for expiration, and triggers escalation if needed.
   */
  async processWaiverCycleAdvance(groupId: string) {
    const activeWaivers = await this.prisma.adminFeeWaiver.findMany({
      where: {
        groupId,
        status: 'ACTIVE',
      },
      include: { group: true, user: true },
    });

    const results: { expired: string[]; advanced: string[] } = {
      expired: [],
      advanced: [],
    };

    for (const waiver of activeWaivers) {
      const newCyclesUsed = waiver.cyclesUsed + 1;

      if (newCyclesUsed >= waiver.durationCycles) {
        // Waiver has expired
        await this.prisma.adminFeeWaiver.update({
          where: { id: waiver.id },
          data: {
            cyclesUsed: newCyclesUsed,
            status: 'EXPIRED',
          },
        });

        results.expired.push(waiver.id);

        // Trigger Step 1 escalation: notify member & admin
        await this.handleExpiredWaiverEscalation(waiver.id);
      } else {
        // Advance cycle count
        await this.prisma.adminFeeWaiver.update({
          where: { id: waiver.id },
          data: { cyclesUsed: newCyclesUsed },
        });

        results.advanced.push(waiver.id);
      }
    }

    return results;
  }

  /**
   * Handle escalation steps for an expired waiver based on missedAfterExpiry count.
   *
   * Step 1: Notify member & admin (waiver expired, fee now due)
   * Step 2: If fee still not paid after grace period → auto-create penalty
   * Step 3: If 2nd consecutive miss → auto-suspend member
   */
  async handleExpiredWaiverEscalation(waiverId: string) {
    const waiver = await this.prisma.adminFeeWaiver.findUnique({
      where: { id: waiverId },
      include: { group: true, user: true },
    });

    if (!waiver) {
      throw new NotFoundException(
        `Fee waiver with ID ${waiverId} not found`,
      );
    }

    // Get group rules for grace period configuration
    const groupRules = await this.prisma.groupRules.findUnique({
      where: { groupId: waiver.groupId },
    });

    const gracePeriodDays = groupRules?.feeWaiverGracePeriodDays ?? 7;

    // Increment missedAfterExpiry counter
    const updatedWaiver = await this.prisma.adminFeeWaiver.update({
      where: { id: waiverId },
      data: {
        missedAfterExpiry: { increment: 1 },
      },
    });

    const missedCount = updatedWaiver.missedAfterExpiry;

    // Step 1: Notify member & admin (first occurrence or always)
    await this.notificationsService.create({
      type: 'GENERAL',
      title: 'Fee Waiver Expired – Admin Fee Now Due',
      message: `Your admin fee waiver in "${waiver.group.name}" has expired. The admin fee is now due. You have ${gracePeriodDays} day(s) to make the payment.`,
      groupId: waiver.groupId,
      userId: waiver.userId,
    });

    // Also notify the admin who granted the waiver
    await this.notificationsService.create({
      type: 'GENERAL',
      title: 'Fee Waiver Expired for Member',
      message: `Fee waiver for ${waiver.user.name} in "${waiver.group.name}" has expired. Missed payments after expiry: ${missedCount}.`,
      groupId: waiver.groupId,
      userId: waiver.grantedBy,
    });

    // Step 2: If fee still not paid after grace period → auto-create penalty
    if (missedCount >= 1) {
      const adminFeeAmount = this.calculateAdminFeeAmount(groupRules, waiver.group.contributionAmount);

      if (adminFeeAmount > 0) {
        await this.penaltiesService.createPenalty({
          groupId: waiver.groupId,
          userId: waiver.userId,
          reason: PenaltyReason.MISSED_PAYMENT,
          amount: adminFeeAmount,
          notes: `Auto-penalty: Admin fee not paid after waiver expiry (grace period: ${gracePeriodDays} days). Miss count: ${missedCount}.`,
        });
      }
    }

    // Step 3: If 2nd consecutive miss → auto-suspend member
    if (missedCount >= 2) {
      await this.prisma.groupMembership.update({
        where: {
          groupId_userId: {
            groupId: waiver.groupId,
            userId: waiver.userId,
          },
        },
        data: { status: 'SUSPENDED' },
      });

      await this.notificationsService.create({
        type: 'MEMBER_SUSPENDED',
        title: 'Membership Suspended',
        message: `Your membership in "${waiver.group.name}" has been suspended due to repeated failure to pay admin fees after waiver expiry.`,
        groupId: waiver.groupId,
        userId: waiver.userId,
      });

      // Notify admin about the suspension
      await this.notificationsService.create({
        type: 'MEMBER_SUSPENDED',
        title: 'Member Auto-Suspended',
        message: `${waiver.user.name} has been auto-suspended from "${waiver.group.name}" due to ${missedCount} consecutive missed admin fee payments after waiver expiry.`,
        groupId: waiver.groupId,
        userId: waiver.grantedBy,
      });
    }

    return updatedWaiver;
  }

  /**
   * Calculate the admin fee amount based on group rules.
   */
  private calculateAdminFeeAmount(
    groupRules: { adminFeeType: string; adminFeeAmount?: number | null; adminFeePercent?: number | null } | null,
    contributionAmount: number,
  ): number {
    if (!groupRules) return 0;

    switch (groupRules.adminFeeType) {
      case 'FIXED':
        return groupRules.adminFeeAmount ?? 0;
      case 'PERCENTAGE':
        return contributionAmount * ((groupRules.adminFeePercent ?? 0) / 100);
      case 'NONE':
      default:
        return 0;
    }
  }
}
