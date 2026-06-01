import { Module } from '@nestjs/common';
import { LotteryController } from './lottery.controller';
import { LotteryService } from './lottery.service';
import { TurnSwapService } from './turn-swap.service';
import { RulesModule } from '../groups/rules.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [RulesModule, NotificationsModule],
  controllers: [LotteryController],
  providers: [LotteryService, TurnSwapService],
  exports: [LotteryService, TurnSwapService],
})
export class LotteryModule {}
