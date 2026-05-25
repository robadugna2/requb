import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createGroupDto: CreateGroupDto, adminId: string) {
    return this.prisma.equbGroup.create({
      data: {
        ...createGroupDto,
        createdById: adminId,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        memberships: {
          include: { user: true },
        },
      },
    });
  }

  async findAll() {
    return this.prisma.equbGroup.findMany({
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        memberships: {
          include: { user: true },
          where: { status: 'ACTIVE' },
        },
        cycles: {
          orderBy: { cycleNumber: 'desc' },
          take: 1,
        },
        _count: {
          select: {
            memberships: { where: { status: 'ACTIVE' } },
            cycles: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const group = await this.prisma.equbGroup.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        memberships: {
          include: { user: true },
        },
        cycles: {
          orderBy: { cycleNumber: 'desc' },
          include: {
            lotteryResult: {
              include: { winner: true },
            },
          },
        },
      },
    });

    if (!group) {
      throw new NotFoundException(`Group with ID ${id} not found`);
    }

    return group;
  }

  async update(id: string, updateGroupDto: UpdateGroupDto) {
    await this.findOne(id);

    return this.prisma.equbGroup.update({
      where: { id },
      data: updateGroupDto,
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        memberships: {
          include: { user: true },
        },
      },
    });
  }

  async addMember(groupId: string, userId: string) {
    const group = await this.findOne(groupId);

    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Check max members
    const activeMembers = await this.prisma.groupMembership.count({
      where: { groupId, status: 'ACTIVE' },
    });

    if (activeMembers >= group.maxMembers) {
      throw new BadRequestException('Group has reached maximum member capacity');
    }

    // Check if already a member
    const existingMembership = await this.prisma.groupMembership.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });

    if (existingMembership) {
      if (existingMembership.status === 'ACTIVE') {
        throw new ConflictException('User is already an active member of this group');
      }
      // Reactivate membership
      return this.prisma.groupMembership.update({
        where: { id: existingMembership.id },
        data: { status: 'ACTIVE' },
        include: { user: true, group: true },
      });
    }

    return this.prisma.groupMembership.create({
      data: {
        groupId,
        userId,
      },
      include: { user: true, group: true },
    });
  }

  async removeMember(groupId: string, userId: string) {
    const membership = await this.prisma.groupMembership.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    return this.prisma.groupMembership.update({
      where: { id: membership.id },
      data: { status: 'REMOVED' },
      include: { user: true },
    });
  }

  async createCycle(groupId: string) {
    const group = await this.findOne(groupId);

    if (group.status !== 'ACTIVE') {
      throw new BadRequestException('Cannot create cycle for inactive group');
    }

    // Get the last cycle number
    const lastCycle = await this.prisma.cycle.findFirst({
      where: { groupId },
      orderBy: { cycleNumber: 'desc' },
    });

    const newCycleNumber = lastCycle ? lastCycle.cycleNumber + 1 : 1;

    // Check if there's an active cycle already
    const activeCycle = await this.prisma.cycle.findFirst({
      where: { groupId, status: 'ACTIVE' },
    });

    if (activeCycle) {
      throw new BadRequestException(
        'There is already an active cycle. Complete it before creating a new one.',
      );
    }

    // Calculate start and end dates based on cycle type
    const startDate = new Date();
    const endDate = new Date();

    switch (group.cycleType) {
      case 'weekly':
        endDate.setDate(endDate.getDate() + 7);
        break;
      case 'biweekly':
        endDate.setDate(endDate.getDate() + 14);
        break;
      case 'monthly':
        endDate.setMonth(endDate.getMonth() + 1);
        break;
      case 'custom':
        endDate.setDate(endDate.getDate() + (group.cycleDays || 30));
        break;
      default:
        endDate.setMonth(endDate.getMonth() + 1);
    }

    // Complete the previous cycle if it's still pending
    if (lastCycle && lastCycle.status === 'PENDING') {
      await this.prisma.cycle.update({
        where: { id: lastCycle.id },
        data: { status: 'COMPLETED' },
      });
    }

    return this.prisma.cycle.create({
      data: {
        groupId,
        cycleNumber: newCycleNumber,
        startDate,
        endDate,
        status: 'ACTIVE',
      },
      include: {
        group: true,
        deposits: true,
      },
    });
  }
}
