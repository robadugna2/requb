import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, Context, InputFile } from 'grammy';
import { PrismaService } from '../../prisma/prisma.service';
import { DepositsService } from '../deposits/deposits.service';
import { OcrService } from '../ocr/ocr.service';

@Injectable()
export class TelegramService implements OnModuleInit {
  private bot?: Bot;
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly depositsService: DepositsService,
    private readonly ocrService: OcrService,
  ) {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (token) {
      this.bot = new Bot(token);
    }
  }

  async onModuleInit() {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!this.bot || !token || token.includes('botfather')) {
      this.logger.warn(
        'TELEGRAM_BOT_TOKEN not configured or using placeholder. Telegram bot is disabled.',
      );
      this.bot = undefined;
      return;
    }

    try {
      await this.setupCommands();
      this.setupHandlers();
      // Run bot.start() asynchronously so it does not block the NestJS bootstrap sequence.
      this.bot!.start().catch((error) => {
        this.logger.error('Telegram bot runner failed', error);
      });
      this.logger.log('Telegram bot startup initiated');
    } catch (error) {
      this.logger.error('Failed to start Telegram bot', error);
    }
  }

  private async setupCommands() {
    try {
      await this.bot!.api.setMyCommands([
        { command: 'start', description: 'Start the bot and register' },
        { command: 'status', description: 'Check your payment status' },
        { command: 'groups', description: 'View your groups' },
        { command: 'help', description: 'Get help' },
      ]);
    } catch (error) {
      this.logger.error('Failed to set bot commands', error);
    }
  }

  private setupHandlers() {
    // /start command
    this.bot!.command('start', async (ctx) => {
      const telegramId = ctx.from?.id?.toString();
      if (!telegramId) return;

      const user = await this.prisma.user.findUnique({
        where: { telegramId },
      });

      if (user) {
        await ctx.reply(
          `Welcome back, ${user.name}! 👋\n\nUse /status to check your payment status or send a receipt photo to submit a deposit.`,
        );
      } else {
        await ctx.reply(
          `Welcome to Digital Equb! 🇪🇹\n\nYour Telegram ID is: ${telegramId}\n\nPlease ask your Equb admin to register you with this Telegram ID to get started.\n\nOnce registered, you can:\n• Send deposit receipt photos\n• Check your payment status\n• View your groups`,
        );
      }
    });

    // /status command
    this.bot!.command('status', async (ctx) => {
      const telegramId = ctx.from?.id?.toString();
      if (!telegramId) return;

      const user = await this.prisma.user.findUnique({
        where: { telegramId },
        include: {
          memberships: {
            where: { status: 'ACTIVE' },
            include: {
              group: {
                include: {
                  cycles: {
                    where: { status: 'ACTIVE' },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      });

      if (!user) {
        await ctx.reply('You are not registered. Please contact your Equb admin.');
        return;
      }

      let statusMessage = `📊 Status for ${user.name}:\n\n`;

      for (const membership of user.memberships) {
        const activeCycle = membership.group.cycles[0];
        statusMessage += `📌 ${membership.group.name}\n`;
        statusMessage += `   Contribution: ${membership.group.contributionAmount} ETB\n`;

        if (activeCycle) {
          const deposit = await this.prisma.deposit.findFirst({
            where: {
              cycleId: activeCycle.id,
              userId: user.id,
            },
            orderBy: { createdAt: 'desc' },
          });

          if (deposit) {
            const statusEmoji =
              deposit.verificationStatus === 'VERIFIED'
                ? '✅'
                : deposit.verificationStatus === 'REJECTED'
                  ? '❌'
                  : '⏳';
            statusMessage += `   Cycle ${activeCycle.cycleNumber}: ${statusEmoji} ${deposit.verificationStatus}\n`;
          } else {
            statusMessage += `   Cycle ${activeCycle.cycleNumber}: ❗ Not paid\n`;
          }
        }
        statusMessage += '\n';
      }

      await ctx.reply(statusMessage || 'No active groups found.');
    });

    // /groups command
    this.bot!.command('groups', async (ctx) => {
      const telegramId = ctx.from?.id?.toString();
      if (!telegramId) return;

      const user = await this.prisma.user.findUnique({
        where: { telegramId },
        include: {
          memberships: {
            where: { status: 'ACTIVE' },
            include: { group: true },
          },
        },
      });

      if (!user) {
        await ctx.reply('You are not registered. Please contact your Equb admin.');
        return;
      }

      if (user.memberships.length === 0) {
        await ctx.reply('You are not a member of any groups yet.');
        return;
      }

      let message = '📋 Your Groups:\n\n';
      for (const membership of user.memberships) {
        message += `• ${membership.group.name}\n`;
        message += `  Contribution: ${membership.group.contributionAmount} ETB (${membership.group.cycleType})\n\n`;
      }

      await ctx.reply(message);
    });

    // /help command
    this.bot!.command('help', async (ctx) => {
      await ctx.reply(
        `🆘 Help - Digital Equb Bot\n\n` +
          `Commands:\n` +
          `/start - Register or see welcome message\n` +
          `/status - Check payment status for current cycles\n` +
          `/groups - View your active groups\n` +
          `/help - Show this help message\n\n` +
          `To submit a deposit:\n` +
          `Simply send a photo of your bank transfer receipt. The bot will automatically process it using OCR.`,
      );
    });

    // Photo handler for deposit receipts
    this.bot!.on('message:photo', async (ctx) => {
      const telegramId = ctx.from?.id?.toString();
      if (!telegramId) return;

      const user = await this.prisma.user.findUnique({
        where: { telegramId },
        include: {
          memberships: {
            where: { status: 'ACTIVE' },
            include: {
              group: {
                include: {
                  cycles: {
                    where: { status: 'ACTIVE' },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      });

      if (!user) {
        await ctx.reply('You are not registered. Please contact your Equb admin.');
        return;
      }

      // Get the active cycle for the user's first group
      const activeMembership = user.memberships.find(
        (m) => m.group.cycles.length > 0,
      );

      if (!activeMembership) {
        await ctx.reply('No active cycle found for any of your groups.');
        return;
      }

      const activeCycle = activeMembership.group.cycles[0];

      await ctx.reply('📸 Receipt received! Processing with OCR...');

      try {
        // Get the largest photo
        const photos = ctx.message.photo;
        const largestPhoto = photos[photos.length - 1];
        const file = await ctx.api.getFile(largestPhoto.file_id);
        const fileUrl = `https://api.telegram.org/file/bot${this.configService.get('TELEGRAM_BOT_TOKEN')}/${file.file_path}`;

        // Process with OCR
        const ocrResult = await this.ocrService.processReceipt(fileUrl);

        // Create deposit
        const deposit = await this.depositsService.create({
          cycleId: activeCycle.id,
          userId: user.id,
          imageUrl: fileUrl,
          ocrData: ocrResult,
          ftNumber: ocrResult?.ftNumber,
          amount: ocrResult?.amount,
          bankName: ocrResult?.bankName,
          depositDate: ocrResult?.depositDate
            ? new Date(ocrResult.depositDate)
            : undefined,
          senderName: ocrResult?.senderName,
          senderAccount: ocrResult?.senderAccount,
          receiverAccount: ocrResult?.receiverAccount,
          branch: ocrResult?.branch,
          confidence: ocrResult?.confidence,
        });

        let responseMessage = `✅ Deposit submitted successfully!\n\n`;
        responseMessage += `Group: ${activeMembership.group.name}\n`;
        responseMessage += `Cycle: #${activeCycle.cycleNumber}\n`;

        if (ocrResult?.amount) {
          responseMessage += `Amount detected: ${ocrResult.amount} ETB\n`;
        }
        if (ocrResult?.ftNumber) {
          responseMessage += `FT Number: ${ocrResult.ftNumber}\n`;
        }
        if (ocrResult?.confidence) {
          responseMessage += `Confidence: ${Math.round(ocrResult.confidence * 100)}%\n`;
        }

        responseMessage += `\nStatus: ⏳ Pending verification`;

        await ctx.reply(responseMessage);
      } catch (error: any) {
        this.logger.error('Error processing receipt', error);
        await ctx.reply(
          `❌ Error processing receipt: ${error.message || 'Unknown error'}. Please try again or contact your admin.`,
        );
      }
    });
  }

  async sendMessage(telegramId: string, message: string) {
    if (!this.bot) return;

    try {
      await this.bot!.api.sendMessage(telegramId, message);
    } catch (error) {
      this.logger.error(`Failed to send message to ${telegramId}`, error);
    }
  }

  async notifyWinner(telegramId: string, groupName: string, amount: number) {
    const message =
      `🎉 Congratulations! You won the Equb draw!\n\n` +
      `Group: ${groupName}\n` +
      `Amount: ${amount} ETB\n\n` +
      `Your payout will be processed soon.`;

    await this.sendMessage(telegramId, message);
  }

  async notifyDepositVerified(telegramId: string, groupName: string) {
    const message =
      `✅ Your deposit for "${groupName}" has been verified!\n\n` +
      `You are now eligible for the lottery draw.`;

    await this.sendMessage(telegramId, message);
  }

  async notifyDepositRejected(
    telegramId: string,
    groupName: string,
    reason?: string,
  ) {
    let message = `❌ Your deposit for "${groupName}" was rejected.\n`;
    if (reason) {
      message += `Reason: ${reason}\n`;
    }
    message += `\nPlease submit a new receipt or contact your admin.`;

    await this.sendMessage(telegramId, message);
  }
}
