import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DisputeStatus, DisputeType } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class DisputesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async fileDispute(data: {
    groupId: string;
    filedByUserId: string;
    againstUserId?: string;
    type: DisputeType;
    description: string;
  }) {
    const { groupId, filedByUserId, againstUserId, type, description } = data;

    // Verify group exists
    const group = await this.prisma.equbGroup.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      throw new NotFoundException(`Group with ID ${groupId} not found`);
    }

    const dispute = await this.prisma.dispute.create({
      data: {
        groupId,
        filedByUserId,
        againstUserId,
        type,
        description,
        status: DisputeStatus.OPEN,
      },
      include: {
        group: { select: { name: true, createdById: true } },
        filedBy: { select: { name: true } },
        againstUser: { select: { name: true } },
      },
    });

    // Notify group admin (creator)
    await this.notificationsService.create({
      type: 'DISPUTE_FILED',
      title: 'New Dispute Filed',
      message: `A dispute of type ${type.toLowerCase().replace('_', ' ')} has been filed by ${dispute.filedBy.name} in group "${dispute.group.name}".`,
      groupId,
      userId: dispute.group.createdById, // Send notification to group creator/admin
    });

    // Notify target user if applicable
    if (againstUserId) {
      await this.notificationsService.create({
        type: 'DISPUTE_FILED',
        title: 'Dispute Filed Against You',
        message: `A dispute has been filed against you by ${dispute.filedBy.name} in group "${dispute.group.name}": "${description.substring(0, 100)}..."`,
        groupId,
        userId: againstUserId,
      });
    }

    return dispute;
  }

  async resolveDispute(
    disputeId: string,
    adminId: string,
    data: { resolution: string; status?: DisputeStatus },
  ) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        group: { select: { name: true } },
        filedBy: { select: { name: true } },
      },
    });

    if (!dispute) {
      throw new NotFoundException(`Dispute with ID ${disputeId} not found`);
    }

    const status = data.status || DisputeStatus.RESOLVED;

    const updated = await this.prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status,
        resolution: data.resolution,
        resolvedBy: adminId,
        resolvedAt: new Date(),
      },
    });

    // Notify filer
    await this.notificationsService.create({
      type: 'DISPUTE_RESOLVED',
      title: 'Dispute Resolved',
      message: `Your dispute filed in group "${dispute.group.name}" has been marked as ${status.toLowerCase()}. Resolution: ${data.resolution}`,
      groupId: dispute.groupId,
      userId: dispute.filedByUserId,
    });

    // Notify target user if applicable
    if (dispute.againstUserId) {
      await this.notificationsService.create({
        type: 'DISPUTE_RESOLVED',
        title: 'Dispute Resolved',
        message: `The dispute filed against you in group "${dispute.group.name}" has been marked as ${status.toLowerCase()}. Resolution: ${data.resolution}`,
        groupId: dispute.groupId,
        userId: dispute.againstUserId,
      });
    }

    return updated;
  }

  async getGroupDisputes(groupId: string) {
    return this.prisma.dispute.findMany({
      where: { groupId },
      include: {
        filedBy: { select: { id: true, name: true, phone: true } },
        againstUser: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getUserDisputes(userId: string) {
    return this.prisma.dispute.findMany({
      where: {
        OR: [{ filedByUserId: userId }, { againstUserId: userId }],
      },
      include: {
        group: { select: { id: true, name: true } },
        filedBy: { select: { id: true, name: true } },
        againstUser: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
