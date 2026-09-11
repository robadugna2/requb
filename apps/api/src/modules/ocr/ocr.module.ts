import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { OcrService } from './ocr.service';
import { GeminiService } from './gemini.service';
import { GeminiWebService } from './gemini-web.service';
import { FtDetectionService } from './ft-detection.service';

@Module({
  imports: [SettingsModule],
  providers: [OcrService, GeminiService, GeminiWebService, FtDetectionService],
  exports: [OcrService, GeminiService, GeminiWebService, FtDetectionService],
})
export class OcrModule {}
