import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { OcrService } from './ocr.service';

@Module({
  imports: [SettingsModule],
  providers: [OcrService],
  exports: [OcrService],
})
export class OcrModule {}
