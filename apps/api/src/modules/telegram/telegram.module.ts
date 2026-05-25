import { Module } from '@nestjs/common';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';
import { DepositsModule } from '../deposits/deposits.module';
import { OcrModule } from '../ocr/ocr.module';

@Module({
  imports: [DepositsModule, OcrModule],
  controllers: [TelegramController],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
