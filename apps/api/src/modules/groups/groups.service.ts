import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { UpdateGroupRulesDto } from './dto/group-rules.dto';
import { RulesEnforcementService } from './rules-enforcement.service';
import { MergedMembersService } from './merged-members.service';
import { FeeWaiversService } from './fee-waivers.service';

@Injectable()
export class GroupsService {
  private readonly logger = new Logger(GroupsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rulesEnforcement: RulesEnforcementService,
    private readonly mergedMembersService: MergedMembersService,
    private readonly feeWaiversService: FeeWaiversService,
  ) {}

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
        rules: true,
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

    // Enforce group rules on member addition
    const violations = await this.rulesEnforcement.validateMemberAddition(groupId, userId);
    const errorViolations = violations.filter(v => v.severity === 'ERROR');
    if (errorViolations.length > 0) {
      throw new BadRequestException(
        `Failed to add member due to rule violations: ${errorViolations.map(v => v.message).join(', ')}`
      );
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

    // Enforce rules on member removal (could return warnings, we block if they are severe or just log/notify them)
    const violations = await this.rulesEnforcement.validateMemberRemoval(groupId, userId);
    const errorViolations = violations.filter(v => v.severity === 'ERROR');
    if (errorViolations.length > 0) {
      throw new BadRequestException(
        `Cannot remove member: ${errorViolations.map(v => v.message).join(', ')}`
      );
    }

    return this.prisma.groupMembership.update({
      where: { id: membership.id },
      data: { status: 'REMOVED' },
      include: { user: true },
    });
  }

  async getGroupRules(groupId: string) {
    await this.findOne(groupId);

    return this.prisma.groupRules.upsert({
      where: { groupId },
      create: { groupId },
      update: {},
    });
  }

  async updateGroupRules(groupId: string, dto: UpdateGroupRulesDto) {
    await this.findOne(groupId);

    return this.prisma.groupRules.upsert({
      where: { groupId },
      create: { groupId, ...dto },
      update: dto,
    });
  }

  async createCycle(groupId: string) {
    const group = await this.findOne(groupId);

    if (group.status !== 'ACTIVE') {
      throw new BadRequestException('Cannot create cycle for inactive group');
    }

    // Enforce minMembersToStart
    const rules = await this.prisma.groupRules.findUnique({ where: { groupId } });
    const activeMembersCount = await this.prisma.groupMembership.count({
      where: { groupId, status: 'ACTIVE' },
    });

    if (rules && activeMembersCount < rules.minMembersToStart) {
      throw new BadRequestException(
        `Cannot start cycle. The group has ${activeMembersCount} active members, but rules require at least ${rules.minMembersToStart} to start.`
      );
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

    const newCycle = await this.prisma.cycle.create({
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

    // Run compliance enforcement asynchronously for the previous cycle
    const previousCycleId = lastCycle?.id;
    void (async () => {
      try {
        // Advance fee waivers (expire/increment counters)
        await this.feeWaiversService.processWaiverCycleAdvance(groupId);

        // Enforce merged member compliance for the previous cycle
        if (previousCycleId) {
          const mergedGroups = await this.mergedMembersService.getMergedGroupsByGroup(groupId);
          const activeGroups = mergedGroups.filter((mg) => mg.status === 'ACTIVE');
          for (const mg of activeGroups) {
            await this.mergedMembersService.enforceMergedMemberCompliance(mg.id, previousCycleId);
          }
        }
      } catch (err) {
        this.logger.error(`Cycle advance enforcement failed for group ${groupId}: ${err}`);
      }
    })();

    return newCycle;
  }
}
