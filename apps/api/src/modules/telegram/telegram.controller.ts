import { Controller, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';

@Controller('telegram')
export class TelegramController {
  @Post('webhook')
  async handleWebhook(@Req() req: Request, @Res() res: Response) {
    // In production, the bot framework handles webhook updates
    // This endpoint receives updates from Telegram's webhook
    res.status(200).send('OK');
  }
}
