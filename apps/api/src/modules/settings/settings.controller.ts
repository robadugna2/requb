import { Controller, Get, Put, Delete, Post, Body, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { SettingsService } from './settings.service';
import { SetOpenAiKeyDto } from './dto/set-openai-key.dto';

@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

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
}
