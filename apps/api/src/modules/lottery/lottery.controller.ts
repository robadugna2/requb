import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { LotteryService } from './lottery.service';

@Controller('lottery')
@UseGuards(JwtAuthGuard)
export class LotteryController {
  constructor(private readonly lotteryService: LotteryService) {}

  @Post('draw/:cycleId')
  draw(@Param('cycleId') cycleId: string, @Request() req: any) {
    return this.lotteryService.drawWinner(cycleId, req.user.id);
  }

  @Get('results')
  getResults(@Query('groupId') groupId?: string) {
    return this.lotteryService.getResults(groupId);
  }
}
