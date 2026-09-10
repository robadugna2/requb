import { Module } from '@nestjs/common';
import { DepositsController } from './deposits.controller';
import { DepositsService } from './deposits.service';
import { CbeVerificationService } from './cbe-verification.service';
import { RulesModule } from '../groups/rules.module';
import { OcrModule } from '../ocr/ocr.module';

@Module({
  imports: [RulesModule, OcrModule],
  controllers: [DepositsController],
  providers: [DepositsService, CbeVerificationService],
  exports: [DepositsService, CbeVerificationService],
})
export class DepositsModule {}
