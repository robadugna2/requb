import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GuarantorStatus } from '@prisma/client';

export interface CreateGuarantorDto {
  groupId: string;
  guarantorUserId: string;
  guaranteedUserId: string;
  notes?: string;
}

@Injectable()
export class GuarantorsService {
  constructor(private readonly prisma: PrismaService) {}

  async findGroupGuarantors(groupId: string) {
    return this.prisma.guarantor.findMany({
      where: { groupId },
      include: {
        guarantorUser: {
          select: { id: true, name: true, phone: true },
        },
        guaranteedUser: {
          select: { id: true, name: true, phone: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createGuarantor(dto: CreateGuarantorDto) {
    const { groupId, guarantorUserId, guaranteedUserId, notes } = dto;

    if (guarantorUserId === guaranteedUserId) {
      throw new BadRequestException('A member cannot guarantee themselves.');
    }

    // Verify memberships
    const memberships = await this.prisma.groupMembership.findMany({
      where: {
        groupId,
        userId: { in: [guarantorUserId, guaranteedUserId] },
        status: 'ACTIVE',
      },
    });

    if (memberships.length < 2) {
      throw new BadRequestException('Both members must be active in the group.');
    }

    // Check if guarantor has already won (traditionally, only members who haven't won can act as wase)
    const guarantorWins = await this.prisma.lotteryResult.count({
      where: {
        winnerId: guarantorUserId,
        cycle: { groupId },
      },
    });

    if (guarantorWins > 0) {
      throw new BadRequestException('The selected guarantor has already won in this group and cannot act as a guarantor.');
    }

    // Check existing guarantee
    const existing = await this.prisma.guarantor.findUnique({
      where: {
        groupId_guarantorUserId_guaranteedUserId: {
          groupId,
          guarantorUserId,
          guaranteedUserId,
        },
      },
    });

    if (existing) {
      if (existing.status === 'ACTIVE') {
        throw new BadRequestException('This guarantor arrangement is already active.');
      }
      // Re-activate if it was released
      return this.prisma.guarantor.update({
        where: { id: existing.id },
        data: { status: 'ACTIVE', notes: notes || null },
      });
    }

    return this.prisma.guarantor.create({
      data: {
        groupId,
        guarantorUserId,
        guaranteedUserId,
        status: 'ACTIVE',
        notes,
      },
      include: {
        guarantorUser: { select: { id: true, name: true } },
        guaranteedUser: { select: { id: true, name: true } },
      },
    });
  }

  async updateStatus(guarantorId: string, status: GuarantorStatus, notes?: string) {
    const guarantor = await this.prisma.guarantor.findUnique({
      where: { id: guarantorId },
    });

    if (!guarantor) {
      throw new NotFoundException(`Guarantor record with ID ${guarantorId} not found.`);
    }

    return this.prisma.guarantor.update({
      where: { id: guarantorId },
      data: {
        status,
        notes: notes !== undefined ? notes : guarantor.notes,
      },
    });
  }

  async deleteGuarantor(guarantorId: string) {
    const guarantor = await this.prisma.guarantor.findUnique({
      where: { id: guarantorId },
    });

    if (!guarantor) {
      throw new NotFoundException(`Guarantor record with ID ${guarantorId} not found.`);
    }

    await this.prisma.guarantor.delete({
      where: { id: guarantorId },
    });

    return { success: true };
  }
}
