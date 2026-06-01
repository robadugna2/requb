import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, InlineKeyboard } from 'grammy';
import { DisputeType, PenaltyReason, Prisma, PenaltyStatus, DisputeStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DepositsService } from '../deposits/deposits.service';
import { OcrService } from '../ocr/ocr.service';
import { GroupsService } from '../groups/groups.service';
import { LotteryService } from '../lottery/lottery.service';
import { PenaltiesService } from '../groups/penalties.service';
import { DisputesService } from '../groups/disputes.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TurnSwapService } from '../lottery/turn-swap.service';
import { TelegramKeyboards } from './telegram-keyboards';
import { TelegramMessages } from './telegram-messages';

@Injectable()
export class TelegramService implements OnModuleInit {
  private bot?: Bot;
  private readonly logger = new Logger(TelegramService.name);

  // States: Map<telegramId, { type: 'AWAITING_RECEIPT' | 'AWAITING_DISPUTE_DESC', data: any }>
  private userStates = new Map<string, { type: string; data: any }>();

  // Temp deposits storage: Map<tempId, { userId: string, cycleId: string, fileUrl: string, ocrResult: any }>
  private tempDeposits = new Map<string, { userId: string; cycleId: string; fileUrl: string; ocrResult: any }>();

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly depositsService: DepositsService,
    private readonly ocrService: OcrService,
    private readonly groupsService: GroupsService,
    private readonly lotteryService: LotteryService,
    private readonly penaltiesService: PenaltiesService,
    private readonly disputesService: DisputesService,
    private readonly notificationsService: NotificationsService,
    private readonly turnSwapService: TurnSwapService,
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
      
      // Run bot.start() asynchronously
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
        { command: 'start', description: 'Start the bot and open main menu' },
        { command: 'menu', description: 'Open the main interactive menu hub' },
        { command: 'groups', description: 'View and browse your active groups' },
        { command: 'status', description: 'Check payment status of current cycles' },
        { command: 'pay', description: 'Submit a new deposit receipt photo' },
        { command: 'lottery', description: 'View lottery results & winners history' },
        { command: 'penalties', description: 'View details of your penalties' },
        { command: 'disputes', description: 'File or view active disputes' },
        { command: 'profile', description: 'Show profile and reliability score' },
        { command: 'notifications', description: 'View your recent notifications' },
        { command: 'help', description: 'Get detailed guidelines & bot help' },
      ]);
    } catch (error) {
      this.logger.error('Failed to set bot commands', error);
    }
  }

  private async getUserLang(telegramId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { telegramId },
      select: { language: true },
    });
    return user?.language || 'en';
  }

  private async getUserByTelegramId(telegramId: string) {
    return this.prisma.user.findUnique({
      where: { telegramId },
      include: {
        memberships: {
          where: { status: 'ACTIVE' },
          include: {
            group: {
              include: {
                memberships: {
                  include: { user: true }
                },
                cycles: true,
                rules: true,
              },
            },
          },
        },
      },
    });
  }

  private setupHandlers() {
    // Commands register
    this.bot!.command('start', async (ctx) => {
      const telegramId = ctx.from?.id?.toString();
      if (!telegramId) return;

      const user = await this.getUserByTelegramId(telegramId);
      if (user) {
        await ctx.reply(TelegramMessages.buildMainMenu(user.name, user.language), {
          parse_mode: 'HTML',
          reply_markup: TelegramKeyboards.mainMenu(user.language),
        });
      } else {
        await ctx.reply(TelegramMessages.buildWelcomeNewUser(telegramId, 'en'), {
          parse_mode: 'HTML',
        });
      }
    });

    this.bot!.command('menu', async (ctx) => {
      const telegramId = ctx.from?.id?.toString();
      if (!telegramId) return;

      const user = await this.getUserByTelegramId(telegramId);
      if (!user) {
        await ctx.reply('You are not registered. Please contact your Equb admin.');
        return;
      }

      await ctx.reply(TelegramMessages.buildMainMenu(user.name, user.language), {
        parse_mode: 'HTML',
        reply_markup: TelegramKeyboards.mainMenu(user.language),
      });
    });

    this.bot!.command('groups', async (ctx) => {
      const telegramId = ctx.from?.id?.toString();
      if (!telegramId) return;

      const user = await this.getUserByTelegramId(telegramId);
      if (!user) {
        await ctx.reply('You are not registered.');
        return;
      }

      const groups = user.memberships.map((m) => m.group);
      await ctx.reply(`📋 <b>My Active Groups</b>\nSelect a group to view details:`, {
        parse_mode: 'HTML',
        reply_markup: TelegramKeyboards.groupList(groups, user.language),
      });
    });

    this.bot!.command('status', async (ctx) => {
      const telegramId = ctx.from?.id?.toString();
      if (!telegramId) return;

      const user = await this.getUserByTelegramId(telegramId);
      if (!user) return ctx.reply(TelegramMessages.translate('en', 'welcome.not_registered'));

      // Fetch user deposits for active cycles
      const activeCycleIds = user.memberships
        .map((m) => m.group.cycles.find((c) => c.status === 'ACTIVE')?.id)
        .filter(Boolean) as string[];

      const userDeposits = await this.prisma.deposit.findMany({
        where: {
          userId: user.id,
          cycleId: { in: activeCycleIds },
        },
      });

      // Prepare memberships with embedded active cycle deposits
      const enrichedMemberships = user.memberships.map((m) => {
        const activeCycle = m.group.cycles.find((c) => c.status === 'ACTIVE');
        const deposits = activeCycle 
          ? userDeposits.filter((d) => d.cycleId === activeCycle.id)
          : [];
        return {
          ...m,
          group: {
            ...m.group,
            cycles: activeCycle ? [{ ...activeCycle, deposits }] : []
          }
        };
      });

      await ctx.reply(TelegramMessages.buildStatusDashboard(user, enrichedMemberships, user.language), {
        parse_mode: 'HTML',
        reply_markup: TelegramKeyboards.backToMain(user.language),
      });
    });

    this.bot!.command('pay', async (ctx) => {
      const telegramId = ctx.from?.id?.toString();
      if (!telegramId) return;

      const user = await this.getUserByTelegramId(telegramId);
      if (!user) return ctx.reply(TelegramMessages.translate('en', 'welcome.not_registered'));

      const activeGroups = user.memberships.map((m) => m.group);
      await ctx.reply('💳 <b>Submit Deposit Receipt</b>\nSelect the group you want to pay for:', {
        parse_mode: 'HTML',
        reply_markup: TelegramKeyboards.depositGroupSelector(activeGroups, user.language),
      });
    });

    this.bot!.command('lottery', async (ctx) => {
      const telegramId = ctx.from?.id?.toString();
      if (!telegramId) return;

      const user = await this.getUserByTelegramId(telegramId);
      if (!user) return ctx.reply(TelegramMessages.translate('en', 'welcome.not_registered'));

      const groups = user.memberships.map((m) => m.group);
      const keyboard = new InlineKeyboard();
      groups.forEach((g) => {
        keyboard.text(`🏆 ${g.name} Results`, `lot:view:${g.id}`).row();
      });
      keyboard.text(TelegramMessages.translate(user.language, 'btn.back_menu'), 'nav:main');

      await ctx.reply('🎰 <b>Lottery draws & Winner lists</b>\nChoose a group to view results:', {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    });

    this.bot!.command('penalties', async (ctx) => {
      const telegramId = ctx.from?.id?.toString();
      if (!telegramId) return;

      const user = await this.getUserByTelegramId(telegramId);
      if (!user) return ctx.reply(TelegramMessages.translate('en', 'welcome.not_registered'));

      const penalties = await this.prisma.penaltyRecord.findMany({
        where: { userId: user.id },
        include: { group: true },
        orderBy: { createdAt: 'desc' },
      });

      const listPenalties = penalties.map((p) => ({
        id: p.id,
        amount: p.amount,
        groupName: p.group.name,
        status: p.status,
      }));

      await ctx.reply(TelegramMessages.buildPenaltyList(penalties, user.language), {
        parse_mode: 'HTML',
        reply_markup: TelegramKeyboards.penaltyList(listPenalties, user.language),
      });
    });

    this.bot!.command('disputes', async (ctx) => {
      const telegramId = ctx.from?.id?.toString();
      if (!telegramId) return;

      const user = await this.getUserByTelegramId(telegramId);
      if (!user) return ctx.reply(TelegramMessages.translate('en', 'welcome.not_registered'));

      await ctx.reply('⚖️ <b>Disputes Hub</b>\nFile a dispute or view filed disputes:', {
        parse_mode: 'HTML',
        reply_markup: TelegramKeyboards.disputeMainMenu(user.language),
      });
    });

    this.bot!.command('profile', async (ctx) => {
      const telegramId = ctx.from?.id?.toString();
      if (!telegramId) return;

      const user = await this.getUserByTelegramId(telegramId);
      if (!user) return ctx.reply(TelegramMessages.translate('en', 'welcome.not_registered'));

      const depositsCount = await this.prisma.deposit.count({
        where: { userId: user.id, verificationStatus: 'VERIFIED' },
      });
      const penaltiesCount = await this.prisma.penaltyRecord.count({
        where: { userId: user.id, status: 'PENDING' },
      });
      const disputesCount = await this.prisma.dispute.count({
        where: { filedByUserId: user.id, status: 'OPEN' },
      });

      await ctx.reply(
        TelegramMessages.buildProfileCard(user, user.memberships, depositsCount, penaltiesCount, disputesCount, user.language),
        {
          parse_mode: 'HTML',
          reply_markup: TelegramKeyboards.backToMain(user.language),
        },
      );
    });

    this.bot!.command('notifications', async (ctx) => {
      const telegramId = ctx.from?.id?.toString();
      if (!telegramId) return;

      const user = await this.getUserByTelegramId(telegramId);
      if (!user) return ctx.reply(TelegramMessages.translate('en', 'welcome.not_registered'));

      const notifications = await this.prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      await ctx.reply(TelegramMessages.translate(user.language, 'msg.recent_notifications'), {
        parse_mode: 'HTML',
        reply_markup: TelegramKeyboards.notificationsList(notifications, user.language),
      });
    });

    this.bot!.command('help', async (ctx) => {
      const telegramId = ctx.from?.id?.toString();
      let lang = 'en';
      if (telegramId) {
        lang = await this.getUserLang(telegramId);
      }
      await ctx.reply(TelegramMessages.buildHelp('general', lang), {
        parse_mode: 'HTML',
        reply_markup: TelegramKeyboards.backToMain(lang),
      });
    });

    this.bot!.command('language', async (ctx) => {
      const telegramId = ctx.from?.id?.toString();
      let lang = 'en';
      if (telegramId) {
        lang = await this.getUserLang(telegramId);
      }
      await ctx.reply('🌐 <b>Select Language / ቋንቋ ይምረጡ / Afaan Filadhaa / ቋንቋ ይምረጹ</b>', {
        parse_mode: 'HTML',
        reply_markup: TelegramKeyboards.languageSelect(lang),
      });
    });

    // Callback queries dispatcher
    this.bot!.on('callback_query:data', async (ctx) => {
      const telegramId = ctx.from?.id?.toString();
      if (!telegramId) return;

      const user = await this.getUserByTelegramId(telegramId);
      if (!user) {
        await ctx.answerCallbackQuery(TelegramMessages.translate('en', 'welcome.not_registered'));
        return;
      }

      const data = ctx.callbackQuery.data;
      const parts = data.split(':');
      const action = parts[0];

      try {
        if (action === 'nav') {
          const dest = parts[1];
          if (dest === 'main') {
            await ctx.editMessageText(TelegramMessages.buildMainMenu(user.name, user.language), {
              parse_mode: 'HTML',
              reply_markup: TelegramKeyboards.mainMenu(user.language),
            });
          }
        } 
        
        else if (action === 'lang') {
          const subAction = parts[1];
          const selectedLang = parts[2];
          if (subAction === 'select') {
            const updatedUser = await this.prisma.user.update({
              where: { id: user.id },
              data: { language: selectedLang },
            });
            await ctx.answerCallbackQuery('Language updated / ቋንቋ ተቀይሯል');
            await ctx.editMessageText(TelegramMessages.buildMainMenu(updatedUser.name, selectedLang), {
              parse_mode: 'HTML',
              reply_markup: TelegramKeyboards.mainMenu(user.language),
            });
            return;
          }
        }

        else if (action === 'menu') {
          const feature = parts[1];
          if (feature === 'groups') {
            const groups = user.memberships.map((m) => m.group);
            await ctx.editMessageText(`📋 <b>My Active Groups</b>\nSelect a group to view details:`, {
              parse_mode: 'HTML',
              reply_markup: TelegramKeyboards.groupList(groups, user.language),
            });
          } else if (feature === 'status') {
            // Re-use status cmd logic
            const activeCycleIds = user.memberships
              .map((m) => m.group.cycles.find((c) => c.status === 'ACTIVE')?.id)
              .filter(Boolean) as string[];

            const userDeposits = await this.prisma.deposit.findMany({
              where: {
                userId: user.id,
                cycleId: { in: activeCycleIds },
              },
            });

            const enrichedMemberships = user.memberships.map((m) => {
              const activeCycle = m.group.cycles.find((c) => c.status === 'ACTIVE');
              const deposits = activeCycle 
                ? userDeposits.filter((d) => d.cycleId === activeCycle.id)
                : [];
              return {
                ...m,
                group: {
                  ...m.group,
                  cycles: activeCycle ? [{ ...activeCycle, deposits }] : []
                }
              };
            });

            await ctx.editMessageText(TelegramMessages.buildStatusDashboard(user, enrichedMemberships, user.language), {
              parse_mode: 'HTML',
              reply_markup: TelegramKeyboards.backToMain(user.language),
            });
          } else if (feature === 'pay') {
            const activeGroups = user.memberships.map((m) => m.group);
            await ctx.editMessageText(TelegramMessages.translate(user.language, 'msg.deposit_pay'), {
              parse_mode: 'HTML',
              reply_markup: TelegramKeyboards.depositGroupSelector(activeGroups, user.language),
            });
          } else if (feature === 'lottery') {
            const groups = user.memberships.map((m) => m.group);
            const keyboard = new InlineKeyboard();
            groups.forEach((g) => {
              keyboard.text(`🏆 ${g.name} Results`, `lot:view:${g.id}`).row();
            });
            keyboard.text(TelegramMessages.translate(user.language, 'btn.back_menu'), 'nav:main');

            await ctx.editMessageText(TelegramMessages.translate(user.language, 'msg.lottery_draws'), {
              parse_mode: 'HTML',
              reply_markup: keyboard,
            });
          } else if (feature === 'penalties') {
            const penalties = await this.prisma.penaltyRecord.findMany({
              where: { userId: user.id },
              include: { group: true },
              orderBy: { createdAt: 'desc' },
            });

            const listPenalties = penalties.map((p) => ({
              id: p.id,
              amount: p.amount,
              groupName: p.group.name,
              status: p.status,
            }));

            await ctx.editMessageText(TelegramMessages.buildPenaltyList(penalties, user.language), {
              parse_mode: 'HTML',
              reply_markup: TelegramKeyboards.penaltyList(listPenalties, user.language),
            });
          } else if (feature === 'disputes') {
            await ctx.editMessageText(TelegramMessages.translate(user.language, 'msg.disputes_hub'), {
              parse_mode: 'HTML',
              reply_markup: TelegramKeyboards.disputeMainMenu(user.language),
            });
          } else if (feature === 'profile') {
            const depositsCount = await this.prisma.deposit.count({
              where: { userId: user.id, verificationStatus: 'VERIFIED' },
            });
            const penaltiesCount = await this.prisma.penaltyRecord.count({
              where: { userId: user.id, status: 'PENDING' },
            });
            const disputesCount = await this.prisma.dispute.count({
              where: { filedByUserId: user.id, status: 'OPEN' },
            });

            await ctx.editMessageText(
              TelegramMessages.buildProfileCard(user, user.memberships, depositsCount, penaltiesCount, disputesCount, user.language),
              {
                parse_mode: 'HTML',
                reply_markup: TelegramKeyboards.backToMain(user.language),
              },
            );
          } else if (feature === 'language') {
            await ctx.editMessageText('🌐 <b>Select Language / ቋንቋ ይምረጡ / Afaan Filadhaa / ቋንቋ ይምረጹ</b>', {
              parse_mode: 'HTML',
              reply_markup: TelegramKeyboards.languageSelect(user.language),
            });
          } else if (feature === 'notifications') {
            const notifications = await this.prisma.notification.findMany({
              where: { userId: user.id },
              orderBy: { createdAt: 'desc' },
              take: 10,
            });

            await ctx.editMessageText(TelegramMessages.translate(user.language, 'msg.recent_notifications'), {
              parse_mode: 'HTML',
              reply_markup: TelegramKeyboards.notificationsList(notifications, user.language),
            });
          } else if (feature === 'help') {
            await ctx.editMessageText(TelegramMessages.buildHelp('general', user.language), {
              parse_mode: 'HTML',
              reply_markup: TelegramKeyboards.backToMain(user.language),
            });
          }
        } 
        
        else if (action === 'grp') {
          const subAction = parts[1];
          const groupId = parts[2];

          // Authorization Check: Does the user belong to this group?
          const membership = user.memberships.find((m) => m.groupId === groupId);
          if (!membership) {
            await ctx.answerCallbackQuery('Unauthorized. You are not a member of this group.');
            return;
          }

          if (subAction === 'detail') {
            const group = membership.group;
            const activeCycle = group.cycles.find((c) => c.status === 'ACTIVE');
            await ctx.editMessageText(TelegramMessages.buildGroupDetail(group, membership, activeCycle, user.language), {
              parse_mode: 'HTML',
              reply_markup: TelegramKeyboards.groupDetail(groupId, user.language),
            });
          } else if (subAction === 'cycle') {
            const group = membership.group;
            const activeCycle = group.cycles.find((c) => c.status === 'ACTIVE');
            if (!activeCycle) {
              await ctx.editMessageText(TelegramMessages.translate(user.language, 'msg.no_active_cycle'), {
                parse_mode: 'HTML',
                reply_markup: TelegramKeyboards.backToGroup(groupId, user.language),
              });
              return;
            }

            const deposits = await this.prisma.deposit.findMany({
              where: { cycleId: activeCycle.id },
              include: { user: true }
            });

            await ctx.editMessageText(TelegramMessages.buildActiveCycleInfo(activeCycle, group, deposits, user.language), {
              parse_mode: 'HTML',
              reply_markup: TelegramKeyboards.backToGroup(groupId, user.language),
            });
          } else if (subAction === 'members') {
            const members = membership.group.memberships;
            await ctx.editMessageText(TelegramMessages.buildMemberList(members, user.language), {
              parse_mode: 'HTML',
              reply_markup: TelegramKeyboards.backToGroup(groupId, user.language),
            });
          } else if (subAction === 'rules') {
            const rules = membership.group.rules;
            await ctx.editMessageText(TelegramMessages.buildGroupRules(rules, user.language), {
              parse_mode: 'HTML',
              reply_markup: TelegramKeyboards.backToGroup(groupId, user.language),
            });
          }
        } 
        
        else if (action === 'dep') {
          const subAction = parts[1];
          
          if (subAction === 'select') {
            const groupId = parts[2];
            const membership = user.memberships.find((m) => m.groupId === groupId);
            if (!membership) {
              await ctx.answerCallbackQuery('Unauthorized.');
              return;
            }

            const activeCycle = membership.group.cycles.find((c) => c.status === 'ACTIVE');
            if (!activeCycle) {
              await ctx.editMessageText(TelegramMessages.translate(user.language, 'msg.no_active_cycle_deposit'), {
                reply_markup: TelegramKeyboards.backToGroup(groupId, user.language)
              });
              return;
            }

            // Set state to await photo receipt upload
            this.userStates.set(telegramId, {
              type: 'AWAITING_RECEIPT',
              data: { groupId, cycleId: activeCycle.id },
            });

            await ctx.editMessageText(TelegramMessages.buildDepositPrompt(membership.group, activeCycle, user.language), {
              parse_mode: 'HTML',
              reply_markup: TelegramKeyboards.backToGroup(groupId, user.language),
            });
          } else if (subAction === 'confirm') {
            const tempId = parts[2];
            const tempDep = this.tempDeposits.get(tempId);
            if (!tempDep) {
              await ctx.editMessageText(TelegramMessages.translate(user.language, 'msg.deposit_expired'));
              return;
            }

            // Confirming - create in DB
            await ctx.editMessageText(TelegramMessages.translate(user.language, 'msg.deposit_submitting'));
            try {
              const deposit = await this.depositsService.create({
                cycleId: tempDep.cycleId,
                userId: tempDep.userId,
                imageUrl: tempDep.fileUrl,
                ocrData: tempDep.ocrResult as unknown as Prisma.InputJsonValue,
                ftNumber: tempDep.ocrResult?.ftNumber,
                amount: tempDep.ocrResult?.amount,
                bankName: tempDep.ocrResult?.bankName,
                depositDate: tempDep.ocrResult?.depositDate ? new Date(tempDep.ocrResult.depositDate) : undefined,
                senderName: tempDep.ocrResult?.senderName,
                senderAccount: tempDep.ocrResult?.senderAccount,
                receiverAccount: tempDep.ocrResult?.receiverAccount,
                branch: tempDep.ocrResult?.branch,
                confidence: tempDep.ocrResult?.confidence,
              });

              this.tempDeposits.delete(tempId);

              let successMsg = `✅ <b>Deposit Submitted Successfully!</b>\n\n`;
              if (deposit.amount) successMsg += `💰 Amount: ${TelegramMessages.formatETB(deposit.amount)}\n`;
              if (deposit.ftNumber) successMsg += `🔢 FT Ref: <code>${deposit.ftNumber}</code>\n`;
              successMsg += `⏳ Status: <b>Pending Admin Verification</b>`;

              await ctx.reply(successMsg, {
                parse_mode: 'HTML',
                reply_markup: TelegramKeyboards.mainMenu(user.language),
              });
            } catch (err: any) {
              this.tempDeposits.delete(tempId);
              await ctx.reply(`❌ <b>Submission Failed:</b> ${err.message || 'Unknown error'}`);
            }
          } else if (subAction === 'cancel') {
            const tempId = parts[2];
            this.tempDeposits.delete(tempId);
            await ctx.editMessageText(TelegramMessages.translate(user.language, 'msg.deposit_cancelled'), {
              reply_markup: TelegramKeyboards.mainMenu(user.language),
            });
          }
        } 
        
        else if (action === 'lot') {
          const subAction = parts[1];
          const groupId = parts[2];

          const membership = user.memberships.find((m) => m.groupId === groupId);
          if (!membership) {
            await ctx.answerCallbackQuery('Unauthorized.');
            return;
          }

          if (subAction === 'view') {
            const results = await this.prisma.lotteryResult.findMany({
              where: { cycle: { groupId } },
              include: { winner: true, cycle: true },
              orderBy: { cycle: { cycleNumber: 'desc' } },
            });

            const activeCycle = membership.group.cycles.find((c) => c.status === 'ACTIVE');

            await ctx.editMessageText(TelegramMessages.buildLotteryDashboard(membership.group.name, activeCycle, results, user.language), {
              parse_mode: 'HTML',
              reply_markup: TelegramKeyboards.backToGroup(groupId, user.language),
            });
          }
        } 
        
        else if (action === 'pen') {
          const subAction = parts[1];
          const penaltyId = parts[2];

          if (subAction === 'detail') {
            const penalty = await this.prisma.penaltyRecord.findUnique({
              where: { id: penaltyId },
              include: { group: true, cycle: true },
            });

            if (!penalty || penalty.userId !== user.id) {
              await ctx.answerCallbackQuery('Unauthorized or Penalty not found.');
              return;
            }

            await ctx.editMessageText(TelegramMessages.buildPenaltyDetail(penalty, user.language), {
              parse_mode: 'HTML',
              reply_markup: TelegramKeyboards.penaltyDetail(penaltyId, user.language),
            });
          }
        } 
        
        else if (action === 'dis') {
          const subAction = parts[1];

          if (subAction === 'file_start') {
            const activeGroups = user.memberships.map((m) => m.group);
            await ctx.editMessageText(TelegramMessages.translate(user.language, 'msg.select_group_dispute'), {
              parse_mode: 'HTML',
              reply_markup: TelegramKeyboards.disputeGroupSelector(activeGroups, user.language),
            });
          } else if (subAction === 'group') {
            const groupId = parts[2];
            const membership = user.memberships.find((m) => m.groupId === groupId);
            if (!membership) return ctx.answerCallbackQuery('Unauthorized.');

            await ctx.editMessageText(TelegramMessages.translate(user.language, 'msg.select_dispute_type'), {
              parse_mode: 'HTML',
              reply_markup: TelegramKeyboards.disputeTypeSelector(groupId, user.language),
            });
          } else if (subAction === 'type') {
            const groupId = parts[2];
            const disputeType = parts[3];

            this.userStates.set(telegramId, {
              type: 'AWAITING_DISPUTE_DESC',
              data: { groupId, disputeType },
            });

            await ctx.editMessageText(
              TelegramMessages.translate(user.language, 'msg.dispute_nature').replace('{type}', disputeType.replace('_', ' ')),
              { parse_mode: 'HTML' }
            );
          } else if (subAction === 'list') {
            const disputes = await this.prisma.dispute.findMany({
              where: { filedByUserId: user.id },
              include: { group: true },
              orderBy: { createdAt: 'desc' },
            });

            await ctx.editMessageText(TelegramMessages.buildDisputeList(disputes, user.language), {
              parse_mode: 'HTML',
              reply_markup: TelegramKeyboards.backToMain(user.language),
            });
          }
        } 
        
        else if (action === 'not') {
          const subAction = parts[1];
          if (subAction === 'detail') {
            const notifId = parts[2];
            const notif = await this.prisma.notification.findUnique({
              where: { id: notifId },
            });

            if (!notif || notif.userId !== user.id) {
              return ctx.answerCallbackQuery('Unauthorized or notification not found.');
            }

            // Mark as read when details are viewed
            await this.prisma.notification.update({
              where: { id: notifId },
              data: { read: true },
            });

            await ctx.editMessageText(
              `🔔 <b>${notif.title}</b>\n` +
              `─────────────────────────\n` +
              `${notif.message}\n\n` +
              `📅 Received: <code>${new Date(notif.createdAt).toLocaleString()}</code>`,
              {
                parse_mode: 'HTML',
                reply_markup: TelegramKeyboards.notificationDetail(notifId, user.language),
              }
            );
          } else if (subAction === 'read_all') {
            await this.prisma.notification.updateMany({
              where: { userId: user.id, read: false },
              data: { read: true },
            });
            await ctx.answerCallbackQuery('🧹 All notifications marked as read.');
            // Refresh list
            const notifications = await this.prisma.notification.findMany({
              where: { userId: user.id },
              orderBy: { createdAt: 'desc' },
              take: 10,
            });
            await ctx.editMessageText(TelegramMessages.translate(user.language, 'msg.recent_notifications'), {
              parse_mode: 'HTML',
              reply_markup: TelegramKeyboards.notificationsList(notifications, user.language),
            });
          } else if (subAction === 'delete') {
            const notifId = parts[2];
            await this.prisma.notification.delete({
              where: { id: notifId, userId: user.id },
            });
            await ctx.answerCallbackQuery('🗑️ Notification deleted.');
            // Go back
            const notifications = await this.prisma.notification.findMany({
              where: { userId: user.id },
              orderBy: { createdAt: 'desc' },
              take: 10,
            });
            await ctx.editMessageText(TelegramMessages.translate(user.language, 'msg.recent_notifications'), {
              parse_mode: 'HTML',
              reply_markup: TelegramKeyboards.notificationsList(notifications, user.language),
            });
          }
        }

        await ctx.answerCallbackQuery();
      } catch (err: any) {
        this.logger.error('Callback error', err);
        await ctx.answerCallbackQuery('An error occurred while processing.');
      }
    });

    // Handle generic text entries (e.g. for description prompts)
    this.bot!.on('message:text', async (ctx) => {
      const telegramId = ctx.from?.id?.toString();
      if (!telegramId) return;

      const state = this.userStates.get(telegramId);
      if (!state) return;

      const user = await this.getUserByTelegramId(telegramId);
      if (!user) return;

      if (state.type === 'AWAITING_DISPUTE_DESC') {
        const text = ctx.message.text.trim();
        if (text.length < 10) {
          await ctx.reply(TelegramMessages.translate(user.language, 'msg.dispute_min_len'));
          return;
        }

        const { groupId, disputeType } = state.data;
        this.userStates.delete(telegramId);

        try {
          const dispute = await this.disputesService.fileDispute({
            groupId,
            filedByUserId: user.id,
            type: disputeType as DisputeType,
            description: text,
          });

          await ctx.reply(
            `✅ <b>Dispute Filed Successfully!</b>\n` +
            `• Group: <code>${dispute.group.name}</code>\n` +
            `• Type: <code>${dispute.type}</code>\n\n` +
            `The administrator will review your dispute details and contact you.`,
            {
              parse_mode: 'HTML',
              reply_markup: TelegramKeyboards.mainMenu(user.language),
            }
          );
        } catch (err: any) {
          await ctx.reply(`❌ Failed to file dispute: ${err.message}`);
        }
      }
    });

    // Photo receipt handler
    this.bot!.on('message:photo', async (ctx) => {
      const telegramId = ctx.from?.id?.toString();
      if (!telegramId) return;

      const state = this.userStates.get(telegramId);
      const user = await this.getUserByTelegramId(telegramId);

      if (!user) {
        await ctx.reply('You are not registered. Please contact your Equb admin.');
        return;
      }

      let activeCycle: any = null;
      let targetGroupId = '';

      if (state?.type === 'AWAITING_RECEIPT') {
        targetGroupId = state.data.groupId;
        activeCycle = await this.prisma.cycle.findUnique({
          where: { id: state.data.cycleId }
        });
        this.userStates.delete(telegramId);
      } else {
        // Fallback: use first active group cycle
        const activeMembership = user.memberships.find((m) => m.group.cycles.length > 0);
        if (!activeMembership) {
          await ctx.reply('No active cycle found for any of your groups. Please navigate via the menu.');
          return;
        }
        targetGroupId = activeMembership.groupId;
        activeCycle = activeMembership.group.cycles[0];
      }

      await ctx.reply(TelegramMessages.translate(user.language, 'msg.ocr_photo_received'), { parse_mode: 'HTML' });

      try {
        const photos = ctx.message.photo;
        const largestPhoto = photos[photos.length - 1];
        const file = await ctx.api.getFile(largestPhoto.file_id);
        const fileUrl = `https://api.telegram.org/file/bot${this.configService.get('TELEGRAM_BOT_TOKEN')}/${file.file_path}`;

        const ocrResult = await this.ocrService.processReceipt(fileUrl);
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

        this.tempDeposits.set(tempId, {
          userId: user.id,
          cycleId: activeCycle.id,
          fileUrl,
          ocrResult,
        });

        await ctx.reply(TelegramMessages.buildOCRConfirmation(ocrResult), {
          parse_mode: 'HTML',
          reply_markup: TelegramKeyboards.confirmDeposit(tempId, user.language),
        });
      } catch (error: any) {
        this.logger.error('Error processing receipt', error);
        await ctx.reply(
          TelegramMessages.translate(user.language, 'msg.ocr_processing_error').replace('{error}', error.message || 'Unknown error'),
          { parse_mode: 'HTML' }
        );
      }
    });
  }

  async sendMessage(telegramId: string, message: string) {
    if (!this.bot) return;
    try {
      await this.bot.api.sendMessage(telegramId, message, { parse_mode: 'HTML' });
    } catch (error) {
      this.logger.error(`Failed to send message to ${telegramId}`, error);
    }
  }

  async notifyWinner(telegramId: string, groupName: string, amount: number) {
    const lang = await this.getUserLang(telegramId);
    const message = TelegramMessages.translate(lang, 'notif.winner')
      .replace('{groupName}', groupName)
      .replace('{amount}', TelegramMessages.formatETB(amount));

    await this.sendMessage(telegramId, message);
  }

  async notifyDepositVerified(telegramId: string, groupName: string) {
    const lang = await this.getUserLang(telegramId);
    const message = TelegramMessages.translate(lang, 'notif.deposit_verified')
      .replace('{groupName}', groupName);

    await this.sendMessage(telegramId, message);
  }

  async notifyDepositRejected(telegramId: string, groupName: string, reason?: string) {
    const lang = await this.getUserLang(telegramId);
    const reasonText = reason ? `⚠️ <b>Reason:</b> <i>${reason}</i>\n` : '';
    const message = TelegramMessages.translate(lang, 'notif.deposit_rejected')
      .replace('{groupName}', groupName)
      .replace('{reason}', reasonText);

    await this.sendMessage(telegramId, message);
  }
}
