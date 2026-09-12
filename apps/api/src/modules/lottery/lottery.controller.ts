import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  UseGuards,
  Request,
  Body,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GroupPermissionsGuard } from '../../common/guards/group-permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { LotteryService } from './lottery.service';
import { TurnSwapService } from './turn-swap.service';

@Controller('lottery')
@UseGuards(JwtAuthGuard)
export class LotteryController {
  constructor(
    private readonly lotteryService: LotteryService,
    private readonly turnSwapService: TurnSwapService,
  ) {}

  /** Eligibility board for a group's active cycle — same pool the draw uses. */
  @Get('eligibility/:groupId')
  @UseGuards(GroupPermissionsGuard)
  @RequirePermission('canTriggerLottery')
  getEligibility(@Param('groupId') groupId: string) {
    return this.lotteryService.getEligibility(groupId);
  }

  /** Phase 1 — spin. Creates a PENDING result awaiting admin confirmation. */
  @Post('draw/:cycleId')
  @UseGuards(GroupPermissionsGuard)
  @RequirePermission('canTriggerLottery')
  draw(
    @Param('cycleId') cycleId: string,
    @Request() req: { user: { id: string } },
    @Body() body: { method?: string },
  ) {
    return this.lotteryService.drawWinner(cycleId, req.user.id, body?.method);
  }

  /** Phase 2a — admin confirms the lucky member (completes cycle + payout). */
  @Post(':id/confirm')
  @UseGuards(GroupPermissionsGuard)
  @RequirePermission('canTriggerLottery')
  confirm(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.lotteryService.confirmDraw(id, req.user.id);
  }

  /** Phase 2b — admin voids the pending draw and re-runs it. */
  @Post(':id/redraw')
  @UseGuards(GroupPermissionsGuard)
  @RequirePermission('canTriggerLottery')
  redraw(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.lotteryService.redrawDraw(id, req.user.id);
  }

  @Get('results')
  getResults(@Query('groupId') groupId?: string, @Request() req?: any) {
    return this.lotteryService.getResults(groupId, req?.user?.id, req?.user?.role);
  }

  // ─── Turn Swap Endpoints ────────────────────────────────────────

  @Post('swap')
  requestSwap(
    @Request() req: { user: { id: string } },
    @Body() body: { groupId: string; targetId: string; reason?: string },
  ) {
    return this.turnSwapService.createRequest({
      groupId: body.groupId,
      requesterId: req.user.id,
      targetId: body.targetId,
      reason: body.reason,
    });
  }

  @Post('swap/:id/respond')
  respondSwap(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
    @Body('approve') approve: boolean,
  ) {
    return this.turnSwapService.respondToRequest(id, req.user.id, approve);
  }

  @Get('swap/group/:groupId')
  getGroupSwaps(@Param('groupId') groupId: string) {
    return this.turnSwapService.getGroupRequests(groupId);
  }

  @Get('swap/user')
  getUserSwaps(@Request() req: { user: { id: string } }) {
    return this.turnSwapService.getUserRequests(req.user.id);
  }
}
