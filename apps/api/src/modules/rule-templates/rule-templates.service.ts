import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateRuleTemplateDto,
  UpdateRuleTemplateDto,
} from './dto/create-rule-template.dto';

const RULE_FIELDS = [
  'latePenaltyType',
  'latePenaltyAmount',
  'latePenaltyPercent',
  'gracePeriodDays',
  'maxMissedPayments',
  'requireExactAmount',
  'depositDeadlineDay',
  'minVerificationHours',
  'allowSkipRound',
  'maxSkipsAllowed',
  'requireGuarantor',
  'minMembersToStart',
  'allowMidCycleJoin',
  'requireGovernmentId',
  'postWinContributionRequired',
  'autoCompleteGroup',
  'adminFeeType',
  'adminFeeAmount',
  'adminFeePercent',
  'payoutSchedule',
  'payoutDelayDays',
  'earlyWithdrawalPolicy',
  'earlyWithdrawalFee',
  'disputeResolution',
  'customRules',
] as const;

@Injectable()
export class RuleTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRuleTemplateDto, adminId: string) {
    return this.prisma.ruleTemplate.create({
      data: {
        ...dto,
        createdById: adminId,
      },
    });
  }

  async findAll(adminId?: string, role?: string) {
    const where: any = role && role !== 'SUPER_ADMIN' && adminId
      ? { createdById: adminId }
      : {};

    return this.prisma.ruleTemplate.findMany({
      where,
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const template = await this.prisma.ruleTemplate.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!template) {
      throw new NotFoundException(`Rule template with ID ${id} not found`);
    }

    return template;
  }

  async update(id: string, dto: UpdateRuleTemplateDto) {
    await this.findOne(id);

    return this.prisma.ruleTemplate.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.ruleTemplate.delete({
      where: { id },
    });
  }

  async applyToGroup(templateId: string, groupId: string) {
    const template = await this.findOne(templateId);

    const group = await this.prisma.equbGroup.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      throw new NotFoundException(`Group with ID ${groupId} not found`);
    }

    const ruleData: Record<string, unknown> = {};
    for (const field of RULE_FIELDS) {
      const value = template[field];
      if (value !== null && value !== undefined) {
        ruleData[field] = value;
      }
    }

    return this.prisma.groupRules.upsert({
      where: { groupId },
      create: { groupId, ...ruleData },
      update: ruleData,
    });
  }
}
