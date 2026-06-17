import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordRequestDto } from './dto/forgot-password-request.dto';
import { ApproveResetRequestDto } from './dto/approve-reset-request.dto';
import { RejectResetRequestDto } from './dto/reject-reset-request.dto';
import { Role } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const admin = await this.prisma.admin.findUnique({
      where: { email },
    });

    if (!admin) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (admin.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is suspended');
    }

    const isPasswordValid = await bcrypt.compare(password, admin.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // If mustChangePass flag is set, clear it only after a real password-change
    // Here we just surface the flag to the frontend
    const payload = {
      sub: admin.id,
      email: admin.email,
      role: admin.role,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        mustChangePassword: admin.mustChangePass,
      },
    };
  }

  async changePassword(adminId: string, dto: ChangePasswordDto) {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new UnauthorizedException('Admin not found');
    }

    const isCurrentValid = await bcrypt.compare(
      dto.currentPassword,
      admin.passwordHash,
    );

    if (!isCurrentValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const saltRounds = 10;
    const newHash = await bcrypt.hash(dto.newPassword, saltRounds);

    await this.prisma.admin.update({
      where: { id: adminId },
      data: {
        passwordHash: newHash,
        mustChangePass: false, // clear the flag after a real password change
      },
    });

    return { message: 'Password changed successfully' };
  }

  // ─── Forgot Password Request ─────────────────────────────────────────────

  async requestPasswordReset(dto: ForgotPasswordRequestDto) {
    const { email } = dto;

    // Always return a generic message to prevent email enumeration
    const admin = await this.prisma.admin.findUnique({ where: { email } });
    if (!admin) {
      return { message: 'If that email exists, a reset request has been sent to your administrator.' };
    }

    // Determine recipient based on requester's role
    let recipientId: string | null = null;

    if (admin.role === Role.ADMIN) {
      // Standard admin → request goes to SUPER_ADMIN
      const superAdmin = await this.prisma.admin.findFirst({
        where: { role: Role.SUPER_ADMIN, status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
      });
      if (!superAdmin) {
        return { message: 'If that email exists, a reset request has been sent to your administrator.' };
      }
      recipientId = superAdmin.id;
    } else if (admin.role === Role.SUB_ADMIN) {
      // Sub-admin → request goes to their specific creator (ADMIN)
      if (!admin.createdById) {
        return { message: 'If that email exists, a reset request has been sent to your administrator.' };
      }
      recipientId = admin.createdById;
    } else if (admin.role === Role.SUPER_ADMIN) {
      // Super admin cannot request a reset through this flow
      return { message: 'If that email exists, a reset request has been sent to your administrator.' };
    }

    if (!recipientId) {
      return { message: 'If that email exists, a reset request has been sent to your administrator.' };
    }

    // Check if there is already a PENDING request from this admin
    const existing = await this.prisma.passwordResetRequest.findFirst({
      where: { requesterId: admin.id, status: 'PENDING' },
    });

    if (existing) {
      // Already has a pending request — don't create duplicate, return same generic message
      return { message: 'If that email exists, a reset request has been sent to your administrator.' };
    }

    await this.prisma.passwordResetRequest.create({
      data: {
        requesterId: admin.id,
        recipientId,
      },
    });

    return { message: 'If that email exists, a reset request has been sent to your administrator.' };
  }

  // ─── Get Inbox (for SUPER_ADMIN / ADMIN) ─────────────────────────────────

  async getResetRequestInbox(adminId: string) {
    return this.prisma.passwordResetRequest.findMany({
      where: { recipientId: adminId },
      include: {
        requester: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  }

  // ─── Approve Request ──────────────────────────────────────────────────────

  async approveResetRequest(
    requestId: string,
    adminId: string,
    dto: ApproveResetRequestDto,
  ) {
    const resetRequest = await this.prisma.passwordResetRequest.findUnique({
      where: { id: requestId },
    });

    if (!resetRequest) {
      throw new NotFoundException('Reset request not found');
    }

    if (resetRequest.recipientId !== adminId) {
      throw new ForbiddenException('You are not authorized to process this request');
    }

    if (resetRequest.status !== 'PENDING') {
      throw new BadRequestException(`Request has already been ${resetRequest.status.toLowerCase()}`);
    }

    const saltRounds = 10;
    const newHash = await bcrypt.hash(dto.tempPassword, saltRounds);

    // Update the requester's password and set mustChangePass flag
    await this.prisma.admin.update({
      where: { id: resetRequest.requesterId },
      data: {
        passwordHash: newHash,
        mustChangePass: true,
      },
    });

    // Mark request as approved
    return this.prisma.passwordResetRequest.update({
      where: { id: requestId },
      data: { status: 'APPROVED' },
      include: {
        requester: { select: { id: true, name: true, email: true, role: true } },
      },
    });
  }

  // ─── Reject Request ───────────────────────────────────────────────────────

  async rejectResetRequest(
    requestId: string,
    adminId: string,
    dto: RejectResetRequestDto,
  ) {
    const resetRequest = await this.prisma.passwordResetRequest.findUnique({
      where: { id: requestId },
    });

    if (!resetRequest) {
      throw new NotFoundException('Reset request not found');
    }

    if (resetRequest.recipientId !== adminId) {
      throw new ForbiddenException('You are not authorized to process this request');
    }

    if (resetRequest.status !== 'PENDING') {
      throw new BadRequestException(`Request has already been ${resetRequest.status.toLowerCase()}`);
    }

    return this.prisma.passwordResetRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        rejectionNote: dto.rejectionNote,
      },
      include: {
        requester: { select: { id: true, name: true, email: true, role: true } },
      },
    });
  }
}
