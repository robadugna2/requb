import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GroupPermissionsGuard } from '../../common/guards/group-permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { DepositsService } from './deposits.service';
import { CbeVerificationService } from './cbe-verification.service';

@Controller('deposits')
@UseGuards(JwtAuthGuard, GroupPermissionsGuard)
export class DepositsController {
  constructor(
    private readonly depositsService: DepositsService,
    private readonly cbeVerificationService: CbeVerificationService,
  ) {}

  @Get()
  findAll(
    @Request() req: any,
    @Query('cycleId') cycleId?: string,
    @Query('userId') userId?: string,
    @Query('groupId') groupId?: string,
    @Query('verificationStatus') verificationStatus?: string,
  ) {
    return this.depositsService.findAll({
      cycleId,
      userId,
      groupId,
      verificationStatus,
    }, req.user.id, req.user.role);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.depositsService.findOne(id);
  }

  @Patch(':id/verify')
  @RequirePermission('canManageDeposits')
  verify(@Param('id') id: string, @Request() req: { user: { id: string } }) {
    return this.depositsService.verify(id, req.user.id);
  }

  @Patch(':id/reject')
  @RequirePermission('canManageDeposits')
  reject(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
    @Body('reason') reason?: string,
  ) {
    return this.depositsService.reject(id, req.user.id, reason);
  }

  // ─── CBE Auto-Verification Endpoints ──────────────────────────────

  /**
   * POST /deposits/:id/auto-verify-cbe
   * Automatically verifies a deposit using CBE Direct API.
   * Uses the group's configured CBE account number(s).
   * Optionally accepts a specific accountNumber in the body.
   */
  @Post(':id/auto-verify-cbe')
  @RequirePermission('canManageDeposits')
  async autoVerifyCbe(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
    @Body('accountNumber') accountNumber?: string,
  ) {
    return this.cbeVerificationService.autoVerifyDeposit(id, req.user.id, accountNumber);
  }

  /**
   * POST /deposits/cbe-lookup
   * Standalone FT number lookup — does NOT touch any deposit record.
   * Returns raw transaction data from CBE Direct API.
   * Used for manual FT number verification or admin bulk lookups.
   *
   * Body: { ftNumber: string, accountNumber: string }
   */
  @Post('cbe-lookup')
  async cbeLookup(
    @Body('ftNumber') ftNumber: string,
    @Body('accountNumber') accountNumber: string,
  ) {
    if (!ftNumber) throw new BadRequestException('ftNumber is required');
    if (!accountNumber) throw new BadRequestException('accountNumber is required');
    return this.cbeVerificationService.verifyByFtNumber(ftNumber, accountNumber);
  }
}
