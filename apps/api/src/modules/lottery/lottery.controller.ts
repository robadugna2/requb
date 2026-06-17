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

  @Post('draw/:cycleId')
  @UseGuards(GroupPermissionsGuard)
  @RequirePermission('canTriggerLottery')
  draw(@Param('cycleId') cycleId: string, @Request() req: { user: { id: string } }) {
    return this.lotteryService.drawWinner(cycleId, req.user.id);
  }

  @Get('results')
  getResults(@Query('groupId') groupId?: string) {
    return this.lotteryService.getResults(groupId);
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
