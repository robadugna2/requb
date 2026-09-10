import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { OcrService } from './ocr.service';
import { GeminiService } from './gemini.service';
import { FtDetectionService } from './ft-detection.service';

@Module({
  imports: [SettingsModule],
  providers: [OcrService, GeminiService, FtDetectionService],
  exports: [OcrService, GeminiService, FtDetectionService],
})
export class OcrModule {}
