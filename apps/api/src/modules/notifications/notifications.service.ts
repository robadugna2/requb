import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateNotificationDto, NotificationTypeDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters?: { type?: string; read?: string }) {
    const where: Prisma.NotificationWhereInput = {};

    if (filters?.type) {
      where.type = filters.type as NotificationType;
    }

    if (filters?.read === 'true') {
      where.read = true;
    } else if (filters?.read === 'false') {
      where.read = false;
    }

    return this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async create(dto: CreateNotificationDto) {
    return this.prisma.notification.create({
      data: {
        type: dto.type as NotificationType,
        title: dto.title,
        message: dto.message,
        groupId: dto.groupId,
        userId: dto.userId,
        depositId: dto.depositId,
      },
    });
  }

  async getUnreadCount() {
    const count = await this.prisma.notification.count({
      where: { read: false },
    });
    return { count };
  }

  async markAsRead(id: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }

    return this.prisma.notification.update({
      where: { id },
      data: { read: true },
    });
  }

  async markAllAsRead() {
    const result = await this.prisma.notification.updateMany({
      where: { read: false },
      data: { read: true },
    });
    return { updated: result.count };
  }

  async remove(id: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }

    return this.prisma.notification.delete({
      where: { id },
    });
  }

  // Convenience methods for creating typed notifications

  async notifyDeadlineApproaching(groupId: string, groupName: string, daysLeft: number) {
    return this.create({
      type: NotificationTypeDto.DEADLINE_APPROACHING,
      title: 'Payment Deadline Approaching',
      message: `Deposit deadline for "${groupName}" is in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}.`,
      groupId,
    });
  }

  async notifyPaymentOverdue(groupId: string, groupName: string, memberName: string, userId: string) {
    return this.create({
      type: NotificationTypeDto.PAYMENT_OVERDUE,
      title: 'Payment Overdue',
      message: `${memberName} has an overdue payment for "${groupName}".`,
      groupId,
      userId,
    });
  }

  async notifyDepositVerified(groupId: string, groupName: string, memberName: string, userId: string, depositId: string) {
    return this.create({
      type: NotificationTypeDto.DEPOSIT_VERIFIED,
      title: 'Deposit Verified',
      message: `${memberName}'s deposit for "${groupName}" has been verified.`,
      groupId,
      userId,
      depositId,
    });
  }

  async notifyDepositRejected(groupId: string, groupName: string, memberName: string, userId: string, depositId: string) {
    return this.create({
      type: NotificationTypeDto.DEPOSIT_REJECTED,
      title: 'Deposit Rejected',
      message: `${memberName}'s deposit for "${groupName}" was rejected.`,
      groupId,
      userId,
      depositId,
    });
  }

  async notifyLotteryWin(groupId: string, groupName: string, winnerName: string, userId: string, amount: number) {
    return this.create({
      type: NotificationTypeDto.LOTTERY_WIN,
      title: 'Lottery Winner!',
      message: `${winnerName} won ETB ${amount.toLocaleString()} in "${groupName}"!`,
      groupId,
      userId,
    });
  }

  async notifyMemberJoined(groupId: string, groupName: string, memberName: string, userId: string) {
    return this.create({
      type: NotificationTypeDto.MEMBER_JOINED,
      title: 'New Member Joined',
      message: `${memberName} joined "${groupName}".`,
      groupId,
      userId,
    });
  }

  async notifyMemberRemoved(groupId: string, groupName: string, memberName: string, userId: string) {
    return this.create({
      type: NotificationTypeDto.MEMBER_REMOVED,
      title: 'Member Removed',
      message: `${memberName} was removed from "${groupName}".`,
      groupId,
      userId,
    });
  }

  async notifyRuleViolation(groupId: string, groupName: string, memberName: string, userId: string, violation: string) {
    return this.create({
      type: NotificationTypeDto.RULE_VIOLATION,
      title: 'Rule Violation',
      message: `${memberName} in "${groupName}": ${violation}`,
      groupId,
      userId,
    });
  }

  async notifyCycleStarted(groupId: string, groupName: string, cycleNumber: number) {
    return this.create({
      type: NotificationTypeDto.CYCLE_STARTED,
      title: 'New Cycle Started',
      message: `Cycle #${cycleNumber} has started for "${groupName}".`,
      groupId,
    });
  }
}
