import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateDepositData {
  cycleId: string;
  userId: string;
  imageUrl: string;
  ocrData?: any;
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
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters?: {
    cycleId?: string;
    userId?: string;
    groupId?: string;
    verificationStatus?: string;
  }) {
    const where: any = {};

    if (filters?.cycleId) {
      where.cycleId = filters.cycleId;
    }

    if (filters?.userId) {
      where.userId = filters.userId;
    }

    if (filters?.groupId) {
      where.cycle = { groupId: filters.groupId };
    }

    if (filters?.verificationStatus) {
      where.verificationStatus = filters.verificationStatus;
    }

    return this.prisma.deposit.findMany({
      where,
      include: {
        user: true,
        cycle: {
          include: {
            group: {
              select: { id: true, name: true, contributionAmount: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
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

    return this.prisma.deposit.update({
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
  }

  async reject(id: string, adminId: string, reason?: string) {
    const deposit = await this.findOne(id);

    if (deposit.verificationStatus !== 'PENDING') {
      throw new BadRequestException(
        `Deposit has already been ${deposit.verificationStatus.toLowerCase()}`,
      );
    }

    return this.prisma.deposit.update({
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
