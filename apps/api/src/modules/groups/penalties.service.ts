import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PenaltyReason, PenaltyStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PenaltiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createPenalty(data: {
    groupId: string;
    userId: string;
    cycleId?: string;
    reason: PenaltyReason;
    amount: number;
    notes?: string;
  }) {
    const penalty = await this.prisma.penaltyRecord.create({
      data: {
        groupId: data.groupId,
        userId: data.userId,
        cycleId: data.cycleId,
        reason: data.reason,
        amount: data.amount,
        status: PenaltyStatus.PENDING,
        notes: data.notes,
      },
      include: {
        group: true,
        user: true,
      },
    });

    // Notify user about penalty
    await this.notificationsService.create({
      type: 'PENALTY_CREATED',
      title: 'New Penalty Issued',
      message: `A penalty of ETB ${data.amount} has been issued in group "${penalty.group.name}" due to ${data.reason.toLowerCase().replace('_', ' ')}.`,
      groupId: data.groupId,
      userId: data.userId,
    });

    // Update user reliability score
    await this.updateUserReliability(data.userId);

    return penalty;
  }

  async payPenalty(penaltyId: string) {
    const penalty = await this.prisma.penaltyRecord.findUnique({
      where: { id: penaltyId },
      include: { group: true },
    });

    if (!penalty) {
      throw new NotFoundException(`Penalty record with ID ${penaltyId} not found`);
    }

    const updated = await this.prisma.penaltyRecord.update({
      where: { id: penaltyId },
      data: {
        status: PenaltyStatus.PAID,
        paidAt: new Date(),
      },
    });

    await this.notificationsService.create({
      type: 'PENALTY_PAID',
      title: 'Penalty Paid',
      message: `Your penalty of ETB ${penalty.amount} in group "${penalty.group.name}" has been marked as paid.`,
      groupId: penalty.groupId,
      userId: penalty.userId,
    });

    // Update user reliability score
    await this.updateUserReliability(penalty.userId);

    return updated;
  }

  async waivePenalty(penaltyId: string, adminId: string, notes?: string) {
    const penalty = await this.prisma.penaltyRecord.findUnique({
      where: { id: penaltyId },
      include: { group: true },
    });

    if (!penalty) {
      throw new NotFoundException(`Penalty record with ID ${penaltyId} not found`);
    }

    const updated = await this.prisma.penaltyRecord.update({
      where: { id: penaltyId },
      data: {
        status: PenaltyStatus.WAIVED,
        waivedBy: adminId,
        notes: notes ? `${penalty.notes || ''}\nWaived notes: ${notes}` : penalty.notes,
      },
    });

    await this.notificationsService.create({
      type: 'GENERAL',
      title: 'Penalty Waived',
      message: `Your penalty of ETB ${penalty.amount} in group "${penalty.group.name}" has been waived by admin.`,
      groupId: penalty.groupId,
      userId: penalty.userId,
    });

    // Update user reliability score
    await this.updateUserReliability(penalty.userId);

    return updated;
  }

  async findGroupPenalties(groupId: string) {
    return this.prisma.penaltyRecord.findMany({
      where: { groupId },
      include: {
        user: { select: { id: true, name: true, phone: true } },
        cycle: { select: { id: true, cycleNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findUserPenalties(userId: string) {
    return this.prisma.penaltyRecord.findMany({
      where: { userId },
      include: {
        group: { select: { id: true, name: true } },
        cycle: { select: { id: true, cycleNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async updateUserReliability(userId: string) {
    // Basic calculation for reliability score
    const totalCycles = await this.prisma.deposit.count({
      where: { userId, verificationStatus: 'VERIFIED' },
    });
    
    const unpaidPenalties = await this.prisma.penaltyRecord.count({
      where: { userId, status: PenaltyStatus.PENDING },
    });

    let score = 100;
    
    // Deduct score for unpaid penalties
    score -= unpaidPenalties * 10;
    
    // Safety boundaries
    score = Math.max(0, Math.min(100, score));

    await this.prisma.user.update({
      where: { id: userId },
      data: { reliabilityScore: score },
    });
  }
}
