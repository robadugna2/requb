import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';

@Injectable()
export class GroupPermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    // Main Admins (Role = ADMIN) bypass checks
    if (user.role === 'ADMIN') {
      return true;
    }

    // Sub admins are checked. Fetch the groupId from params, query, or body.
    const params = request.params;
    const query = request.query;
    const body = request.body;
    const path = request.path;
    let groupId = params.groupId || body.groupId || query.groupId;

    if (!groupId && params.id) {
      if (path.includes('/groups/')) {
        groupId = params.id;
      } else if (path.includes('/deposits/')) {
        const deposit = await this.prisma.deposit.findUnique({
          where: { id: params.id },
          include: { cycle: { select: { groupId: true } } },
        });
        groupId = deposit?.cycle?.groupId;
      }
    }

    // Extract groupId based on other parameters if not directly present
    if (!groupId) {
      if (params.penaltyId) {
        const penalty = await this.prisma.penaltyRecord.findUnique({
          where: { id: params.penaltyId },
          select: { groupId: true },
        });
        groupId = penalty?.groupId;
      } else if (params.disputeId) {
        const dispute = await this.prisma.dispute.findUnique({
          where: { id: params.disputeId },
          select: { groupId: true },
        });
        groupId = dispute?.groupId;
      } else if (params.guarantorId) {
        const guarantor = await this.prisma.guarantor.findUnique({
          where: { id: params.guarantorId },
          select: { groupId: true },
        });
        groupId = guarantor?.groupId;
      } else if (params.waiverId) {
        const waiver = await this.prisma.adminFeeWaiver.findUnique({
          where: { id: params.waiverId },
          select: { groupId: true },
        });
        groupId = waiver?.groupId;
      } else if (params.mergedGroupId) {
        const mergedGroup = await this.prisma.mergedMemberGroup.findUnique({
          where: { id: params.mergedGroupId },
          select: { groupId: true },
        });
        groupId = mergedGroup?.groupId;
      }
    }

    if (!groupId) {
      // If no groupId can be determined, allow access (e.g. for global listings without group filter, but wait, those should be scoped inside services)
      return true;
    }

    // Verify group exists and is not soft deleted
    const group = await this.prisma.equbGroup.findUnique({
      where: { id: groupId },
    });

    if (!group || group.deletedAt) {
      throw new NotFoundException('Group not found');
    }

    // Check if user is assigned as a leader to this group
    const leader = await this.prisma.groupLeader.findUnique({
      where: {
        groupId_adminId: {
          groupId,
          adminId: user.id,
        },
      },
    });

    if (!leader) {
      throw new ForbiddenException('You do not have access to this group');
    }

    // Check handler-specific permissions if defined
    const requiredPermission = this.reflector.getAllAndOverride<
      'canManageMembers' | 'canManageDeposits' | 'canTriggerLottery' | 'canManageRules'
    >(PERMISSION_KEY, [context.getHandler(), context.getClass()]);

    if (requiredPermission) {
      const hasPermission = leader[requiredPermission];
      if (!hasPermission) {
        throw new ForbiddenException(
          `You do not have permission to perform this action (${requiredPermission})`,
        );
      }
    }

    return true;
  }
}
