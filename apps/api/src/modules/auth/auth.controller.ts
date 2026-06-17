import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordRequestDto } from './dto/forgot-password-request.dto';
import { ApproveResetRequestDto } from './dto/approve-reset-request.dto';
import { RejectResetRequestDto } from './dto/reject-reset-request.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ─── Public endpoints ──────────────────────────────────────────────────────

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  /**
   * Forgot Password – anyone (no JWT required) can submit their email.
   * The system auto-detects role and routes to the correct superior admin.
   */
  @Post('forgot-password-request')
  @HttpCode(HttpStatus.OK)
  async forgotPasswordRequest(@Body() dto: ForgotPasswordRequestDto) {
    return this.authService.requestPasswordReset(dto);
  }

  // ─── Protected endpoints (must be logged in) ───────────────────────────────

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.authService.changePassword(req.user.id, dto);
  }

  /**
   * Get the password reset request inbox for the currently logged-in admin.
   * ADMIN sees requests from their SUB_ADMINs.
   * SUPER_ADMIN sees requests from all ADMINs.
   */
  @Get('reset-password-requests')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  async getResetRequestInbox(@Request() req: { user: { id: string } }) {
    return this.authService.getResetRequestInbox(req.user.id);
  }

  /**
   * Approve a reset request – sets a temporary password on the requester's account.
   */
  @Patch('reset-password-requests/:id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async approveResetRequest(
    @Param('id') id: string,
    @Body() dto: ApproveResetRequestDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.authService.approveResetRequest(id, req.user.id, dto);
  }

  /**
   * Reject a reset request – with an optional rejection note.
   */
  @Patch('reset-password-requests/:id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async rejectResetRequest(
    @Param('id') id: string,
    @Body() dto: RejectResetRequestDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.authService.rejectResetRequest(id, req.user.id, dto);
  }
}
