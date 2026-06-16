import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GroupPermissionsGuard } from '../../common/guards/group-permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { DepositsService } from './deposits.service';

@Controller('deposits')
@UseGuards(JwtAuthGuard, GroupPermissionsGuard)
export class DepositsController {
  constructor(private readonly depositsService: DepositsService) {}

  @Get()
  findAll(
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
    });
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
}
