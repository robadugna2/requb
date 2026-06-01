import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SwapRequestStatus, PayoutOrderStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class TurnSwapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createRequest(data: {
    groupId: string;
    requesterId: string;
    targetId: string;
    reason?: string;
  }) {
    const { groupId, requesterId, targetId, reason } = data;

    // Check that group exists and uses FIXED_ORDER
    const group = await this.prisma.equbGroup.findUnique({
      where: { id: groupId },
      include: { rules: true },
    });

    if (!group) {
      throw new NotFoundException(`Group with ID ${groupId} not found`);
    }

    if (group.lotteryMethod !== 'FIXED_ORDER') {
      throw new BadRequestException('Turn swap requests are only allowed for groups using pre-agreed FIXED_ORDER rotation.');
    }

    // Get requester and target payout order
    const requesterOrder = await this.prisma.payoutOrder.findUnique({
      where: { groupId_userId: { groupId, userId: requesterId } },
    });

    const targetOrder = await this.prisma.payoutOrder.findUnique({
      where: { groupId_userId: { groupId, userId: targetId } },
    });

    if (!requesterOrder || !targetOrder) {
      throw new BadRequestException('Both requester and target must have defined positions in the payout order.');
    }

    if (requesterOrder.status !== PayoutOrderStatus.PENDING || targetOrder.status !== PayoutOrderStatus.PENDING) {
      throw new BadRequestException('Cannot swap turns if one of the members has already won their payout.');
    }

    // Create the request
    const request = await this.prisma.turnSwapRequest.create({
      data: {
        groupId,
        requesterId,
        targetId,
        requesterTurn: requesterOrder.position,
        targetTurn: targetOrder.position,
        reason,
        status: SwapRequestStatus.PENDING,
      },
      include: {
        requester: { select: { name: true } },
        target: { select: { name: true } },
        group: { select: { name: true } },
      },
    });

    // Notify target user
    await this.notificationsService.create({
      type: 'TURN_SWAP_REQUEST',
      title: 'Payout Turn Swap Request',
      message: `${request.requester.name} has requested to swap their payout turn (position ${request.requesterTurn}) with yours (position ${request.targetTurn}) in group "${request.group.name}".`,
      groupId,
      userId: targetId,
    });

    return request;
  }

  async respondToRequest(requestId: string, userId: string, approve: boolean) {
    const request = await this.prisma.turnSwapRequest.findUnique({
      where: { id: requestId },
      include: {
        requester: { select: { name: true } },
        target: { select: { name: true } },
        group: { select: { name: true } },
      },
    });

    if (!request) {
      throw new NotFoundException(`Swap request with ID ${requestId} not found`);
    }

    if (request.targetId !== userId) {
      throw new BadRequestException('Only the requested target user can respond to this swap request.');
    }

    if (request.status !== SwapRequestStatus.PENDING) {
      throw new BadRequestException('This request has already been processed.');
    }

    if (!approve) {
      const updated = await this.prisma.turnSwapRequest.update({
        where: { id: requestId },
        data: { status: SwapRequestStatus.REJECTED },
      });

      // Notify requester
      await this.notificationsService.create({
        type: 'TURN_SWAP_REJECTED',
        title: 'Swap Request Rejected',
        message: `${request.target.name} has rejected your request to swap turns in group "${request.group.name}".`,
        groupId: request.groupId,
        userId: request.requesterId,
      });

      return updated;
    }

    // Verify positions haven't changed or been completed in the meantime
    const requesterOrder = await this.prisma.payoutOrder.findUnique({
      where: { groupId_userId: { groupId: request.groupId, userId: request.requesterId } },
    });

    const targetOrder = await this.prisma.payoutOrder.findUnique({
      where: { groupId_userId: { groupId: request.groupId, userId: request.targetId } },
    });

    if (!requesterOrder || !targetOrder) {
      throw new BadRequestException('Payout orders are no longer valid.');
    }

    if (requesterOrder.status !== PayoutOrderStatus.PENDING || targetOrder.status !== PayoutOrderStatus.PENDING) {
      throw new BadRequestException('Cannot swap turns because one of the members has already drawn a payout.');
    }

    // Perform the swap in database using transaction
    await this.prisma.$transaction([
      // Swap requester position
      this.prisma.payoutOrder.update({
        where: { id: requesterOrder.id },
        data: { position: targetOrder.position },
      }),
      // Swap target position
      this.prisma.payoutOrder.update({
        where: { id: targetOrder.id },
        data: { position: requesterOrder.position },
      }),
      // Mark request as approved
      this.prisma.turnSwapRequest.update({
        where: { id: requestId },
        data: { status: SwapRequestStatus.APPROVED },
      }),
    ]);

    // Notify requester
    await this.notificationsService.create({
      type: 'TURN_SWAP_APPROVED',
      title: 'Swap Request Approved',
      message: `${request.target.name} has approved your request to swap turns in group "${request.group.name}". Your new position is ${targetOrder.position}.`,
      groupId: request.groupId,
      userId: request.requesterId,
    });

    return { success: true };
  }

  async getGroupRequests(groupId: string) {
    return this.prisma.turnSwapRequest.findMany({
      where: { groupId },
      include: {
        requester: { select: { id: true, name: true } },
        target: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getUserRequests(userId: string) {
    return this.prisma.turnSwapRequest.findMany({
      where: {
        OR: [{ requesterId: userId }, { targetId: userId }],
      },
      include: {
        group: { select: { id: true, name: true } },
        requester: { select: { id: true, name: true } },
        target: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
