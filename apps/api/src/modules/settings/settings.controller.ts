import { Controller, Get, Put, Delete, Post, Body, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { SettingsService } from './settings.service';
import { SetGeminiKeyDto } from './dto/set-gemini-key.dto';
import { SetGeminiWebDto } from './dto/set-gemini-web.dto';

@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('ai')
  @Roles(Role.SUPER_ADMIN)
  async getAiStatus() {
    return {
      gemini: await this.settingsService.getStatusGemini(),
      geminiWeb: await this.settingsService.getGeminiWebStatus(),
    };
  }

  @Put('gemini')
  @Roles(Role.SUPER_ADMIN)
  async setGeminiKey(@Request() req: any, @Body() dto: SetGeminiKeyDto) {
    await this.settingsService.setGeminiKey(dto.apiKey, req.user.id);
    return { success: true, gemini: await this.settingsService.getStatusGemini() };
  }

  @Delete('gemini')
  @Roles(Role.SUPER_ADMIN)
  async clearGeminiKey() {
    await this.settingsService.clearGeminiKey();
    return { success: true, gemini: await this.settingsService.getStatusGemini() };
  }

  @Post('gemini/test')
  @Roles(Role.SUPER_ADMIN)
  async testGeminiKey(@Body('apiKey') apiKey?: string) {
    // Tests the typed (not yet saved) key when provided, else the saved one
    return this.settingsService.testGeminiKey(apiKey);
  }

  // ---- Gemini Web proxy (self-hosted OpenAI-compatible endpoint) ------------

  @Put('gemini-web')
  @Roles(Role.SUPER_ADMIN)
  async setGeminiWeb(@Request() req: any, @Body() dto: SetGeminiWebDto) {
    await this.settingsService.setGeminiWeb(
      { baseUrl: dto.baseUrl, apiKey: dto.apiKey, model: dto.model, enabled: dto.enabled },
      req.user.id,
    );
    return { success: true, geminiWeb: await this.settingsService.getGeminiWebStatus() };
  }

  @Delete('gemini-web')
  @Roles(Role.SUPER_ADMIN)
  async clearGeminiWeb() {
    await this.settingsService.clearGeminiWeb();
    return { success: true, geminiWeb: await this.settingsService.getGeminiWebStatus() };
  }

  @Post('gemini-web/test')
  @Roles(Role.SUPER_ADMIN)
  async testGeminiWeb() {
    return this.settingsService.testGeminiWeb();
  }
}
