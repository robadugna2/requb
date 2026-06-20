import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, VerificationStatus, PenaltyReason } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RulesEnforcementService } from '../groups/rules-enforcement.service';
import { PenaltiesService } from '../groups/penalties.service';

export interface CreateDepositData {
  cycleId: string;
  userId: string;
  imageUrl: string;
  ocrData?: Prisma.InputJsonValue;
  ftNumber?: string;
  amount?: number;
  bankName?: string;
  depositDate?: Date;
  senderName?: string;
  senderAccount?: string;
  receiverAccount?: string;
  branch?: string;
  confidence?: number;
}

@Injectable()
export class DepositsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rulesEnforcement: RulesEnforcementService,
    private readonly penaltiesService: PenaltiesService,
  ) {}

  async findAll(
    filters?: {
      cycleId?: string;
      userId?: string;
      groupId?: string;
      verificationStatus?: string;
    },
    requesterId?: string,
    requesterRole?: string,
  ) {
    const where: Prisma.DepositWhereInput = {};

    if (filters?.cycleId) {
      where.cycleId = filters.cycleId;
    }

    if (filters?.userId) {
      where.userId = filters.userId;
    }

    if (filters?.groupId) {
      where.cycle = {
        groupId: filters.groupId,
      };
    }

    if (requesterRole === 'ADMIN' && requesterId) {
      where.cycle = {
        ...(where.cycle as Prisma.CycleWhereInput),
        group: {
          is: {
            createdById: requesterId,
          },
        },
      };
    } else if (requesterRole === 'SUB_ADMIN' && requesterId) {
      where.cycle = {
        ...(where.cycle as Prisma.CycleWhereInput),
        group: {
          is: {
            leaders: {
              some: {
                adminId: requesterId,
              },
            },
          },
        },
      };
    }

    if (filters?.verificationStatus) {
      where.verificationStatus = filters.verificationStatus as VerificationStatus;
    }

    return this.prisma.deposit.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, phone: true },
        },
        cycle: {
          include: {
            group: {
              select: { id: true, name: true, contributionAmount: true },
            },
          },
        },
      },
      orderBy: [
        { cycle: { cycleNumber: 'asc' } },
        { depositDate: 'asc' },
        { createdAt: 'asc' },
      ],
    });
  }

  async findOne(id: string) {
    const deposit = await this.prisma.deposit.findUnique({
      where: { id },
      include: {
        user: true,
        cycle: {
          include: {
            group: true,
          },
        },
      },
    });

    if (!deposit) {
      throw new NotFoundException(`Deposit with ID ${id} not found`);
    }

    return deposit;
  }

  async verify(id: string, adminId: string) {
    const deposit = await this.findOne(id);

    if (deposit.verificationStatus !== 'PENDING') {
      throw new BadRequestException(
        `Deposit has already been ${deposit.verificationStatus.toLowerCase()}`,
      );
    }

    const result = await this.prisma.deposit.update({
      where: { id },
      data: {
        verificationStatus: 'VERIFIED',
        verifiedById: adminId,
      },
      include: {
        user: true,
        cycle: {
          include: { group: true },
        },
      },
    });

    // Check rules for lateness and apply penalties
    if (result.depositDate) {
      const isLateInfo = await this.rulesEnforcement.isDepositLate(
        result.cycle.groupId,
        result.depositDate,
      );

      if (isLateInfo.isLate) {
        await this.prisma.deposit.update({
          where: { id },
          data: { isLate: true },
        });

        if (isLateInfo.isPastGrace) {
          const penaltyCalc = await this.rulesEnforcement.calculatePenalty(
            result.cycle.groupId,
          );

          if (penaltyCalc) {
            await this.penaltiesService.createPenalty({
              groupId: result.cycle.groupId,
              userId: result.userId,
              cycleId: result.cycleId,
              reason: PenaltyReason.LATE_PAYMENT,
              amount: penaltyCalc.amount,
              notes: `Auto-generated: ${penaltyCalc.reason} for deposit ${result.ftNumber || result.id}.`,
            });

            await this.prisma.deposit.update({
              where: { id },
              data: { penaltyApplied: true },
            });
          }
        }
      }
    }

    // Trigger update of user reliability score
    await this.rulesEnforcement.updateReliabilityScore(result.userId);

    // If max missed payments is exceeded, check and auto-suspend member
    const suspendCheck = await this.rulesEnforcement.shouldAutoSuspendMember(
      result.cycle.groupId,
      result.userId,
    );

    if (suspendCheck.shouldSuspend) {
      await this.prisma.groupMembership.update({
        where: {
          groupId_userId: {
            groupId: result.cycle.groupId,
            userId: result.userId,
          },
        },
        data: { status: 'SUSPENDED' },
      });
    }

    return result;
  }

  async reject(id: string, adminId: string, reason?: string) {
    const deposit = await this.findOne(id);

    if (deposit.verificationStatus !== 'PENDING') {
      throw new BadRequestException(
        `Deposit has already been ${deposit.verificationStatus.toLowerCase()}`,
      );
    }

    const result = await this.prisma.deposit.update({
      where: { id },
      data: {
        verificationStatus: 'REJECTED',
        verifiedById: adminId,
        rejectionReason: reason || 'Rejected by admin',
      },
      include: {
        user: true,
        cycle: {
          include: { group: true },
        },
      },
    });

    // Update user reliability score
    await this.rulesEnforcement.updateReliabilityScore(result.userId);

    return result;
  }

  async create(data: CreateDepositData) {
    // Verify the cycle exists
    const cycle = await this.prisma.cycle.findUnique({
      where: { id: data.cycleId },
    });

    if (!cycle) {
      throw new NotFoundException(`Cycle with ID ${data.cycleId} not found`);
    }

    // Verify the user exists
    const user = await this.prisma.user.findUnique({
      where: { id: data.userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${data.userId} not found`);
    }

    // Validate deposit details against rules
    const violations = await this.rulesEnforcement.validateDeposit(
      cycle.groupId,
      data.userId,
      data.amount,
      data.depositDate || new Date(),
    );

    const errorViolations = violations.filter(v => v.severity === 'ERROR');
    if (errorViolations.length > 0) {
      throw new BadRequestException(
        `Deposit violates rules: ${errorViolations.map(v => v.message).join(', ')}`
      );
    }

    // Check for duplicate FT number
    if (data.ftNumber) {
      const existingDeposit = await this.prisma.deposit.findUnique({
        where: { ftNumber: data.ftNumber },
      });

      if (existingDeposit) {
        throw new BadRequestException(
          `A deposit with FT number ${data.ftNumber} already exists`,
        );
      }
    }

    return this.prisma.deposit.create({
      data: {
        cycleId: data.cycleId,
        userId: data.userId,
        imageUrl: data.imageUrl,
        ocrData: data.ocrData,
        ftNumber: data.ftNumber,
        amount: data.amount,
        bankName: data.bankName,
        depositDate: data.depositDate,
        senderName: data.senderName,
        senderAccount: data.senderAccount,
        receiverAccount: data.receiverAccount,
        branch: data.branch,
        confidence: data.confidence,
      },
      include: {
        user: true,
        cycle: {
          include: { group: true },
        },
      },
    });
  }

  async getDepositsByCycle(cycleId: string) {
    return this.prisma.deposit.findMany({
      where: { cycleId, verificationStatus: 'VERIFIED' },
      include: { user: true },
    });
  }
}
