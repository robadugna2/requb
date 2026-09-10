import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { OcrService } from './ocr.service';
import { FtDetectionService } from './ft-detection.service';

@Module({
  imports: [SettingsModule],
  providers: [OcrService, FtDetectionService],
  exports: [OcrService, FtDetectionService],
})
export class OcrModule {}
