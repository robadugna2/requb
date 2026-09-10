import { Controller, Get, Put, Delete, Post, Body, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { SettingsService } from './settings.service';
import { SetOpenAiKeyDto } from './dto/set-openai-key.dto';
import { SetGeminiKeyDto } from './dto/set-gemini-key.dto';

@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('ai')
  @Roles(Role.SUPER_ADMIN)
  async getAiStatus() {
    return {
      openai: await this.settingsService.getStatus(),
      gemini: await this.settingsService.getStatusGemini(),
    };
  }

  @Get('openai')
  @Roles(Role.SUPER_ADMIN)
  async getStatus() {
    return this.settingsService.getStatus();
  }

  @Put('openai')
  @Roles(Role.SUPER_ADMIN)
  async setOpenAiKey(@Request() req: any, @Body() dto: SetOpenAiKeyDto) {
    await this.settingsService.setOpenAiKey(dto.apiKey, req.user.id);
    return { success: true, ...(await this.settingsService.getStatus()) };
  }

  @Delete('openai')
  @Roles(Role.SUPER_ADMIN)
  async clearOpenAiKey() {
    await this.settingsService.clearOpenAiKey();
    return { success: true, ...(await this.settingsService.getStatus()) };
  }

  @Post('openai/test')
  @Roles(Role.SUPER_ADMIN)
  async testOpenAiKey() {
    return this.settingsService.testOpenAiKey();
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
  async testGeminiKey() {
    return this.settingsService.testGeminiKey();
  }
}
