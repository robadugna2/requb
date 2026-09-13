import { Module } from '@nestjs/common';
import { DepositsController } from './deposits.controller';
import { DepositsService } from './deposits.service';
import { CbeVerificationService } from './cbe-verification.service';
import { UnknownSenderService } from './unknown-sender.service';
import { RulesModule } from '../groups/rules.module';
import { OcrModule } from '../ocr/ocr.module';

@Module({
  imports: [RulesModule, OcrModule],
  controllers: [DepositsController],
  providers: [DepositsService, CbeVerificationService, UnknownSenderService],
  exports: [DepositsService, CbeVerificationService],
})
export class DepositsModule {}
