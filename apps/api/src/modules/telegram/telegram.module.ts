import { Module } from '@nestjs/common';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';
import { DepositsModule } from '../deposits/deposits.module';
import { OcrModule } from '../ocr/ocr.module';
import { GroupsModule } from '../groups/groups.module';
import { LotteryModule } from '../lottery/lottery.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RulesModule } from '../groups/rules.module';

@Module({
  imports: [
    DepositsModule,
    OcrModule,
    GroupsModule,
    LotteryModule,
    NotificationsModule,
    RulesModule,
  ],
  controllers: [TelegramController],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
