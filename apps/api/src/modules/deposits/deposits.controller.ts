import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  Request,
  BadRequestException,
  HttpCode,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Prisma } from '@prisma/client';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GroupPermissionsGuard } from '../../common/guards/group-permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { DepositsService } from './deposits.service';
import { CbeVerificationService } from './cbe-verification.service';
import { FtDetectionService } from '../ocr/ft-detection.service';
import { UnknownSenderService } from './unknown-sender.service';
import { CreateDepositDto } from './dto/create-deposit.dto';
import { BatchCreateDepositDto } from './dto/batch-create-deposit.dto';
import {
  QueueUnknownSenderDto,
  ResolveUnknownSenderDto,
  DismissUnknownSenderDto,
} from './dto/unknown-sender.dto';

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

@Controller('deposits')
@UseGuards(JwtAuthGuard, GroupPermissionsGuard)
export class DepositsController {
  constructor(
    private readonly depositsService: DepositsService,
    private readonly cbeVerificationService: CbeVerificationService,
    private readonly ftDetectionService: FtDetectionService,
    private readonly unknownSenderService: UnknownSenderService,
  ) {}

  /**
   * POST /deposits
   * Admin-facing deposit creation (camera FT scanner / manual entry).
   * Requires canManageDeposits for the group supplied in the body.
   */
  @Post()
  @HttpCode(201)
  @RequirePermission('canManageDeposits')
  create(@Body() dto: CreateDepositDto) {
    return this.depositsService.create({
      cycleId: dto.cycleId,
      userId: dto.userId,
      groupId: dto.groupId,
      imageUrl: dto.imageUrl,
      ftNumber: dto.ftNumber?.toUpperCase(),
      amount: dto.amount,
      bankName: dto.bankName,
      depositDate: dto.depositDate ? new Date(dto.depositDate) : undefined,
      senderName: dto.senderName,
      senderAccount: dto.senderAccount,
      receiverAccount: dto.receiverAccount,
      branch: dto.branch,
      narrative: dto.narrative,
      confidence: dto.confidence,
    });
  }

  /**
   * POST /deposits/batch
   * Starts a background job that creates + CBE-verifies many deposits
   * (scanner "Confirm & create"). Returns a jobId immediately; the work
   * continues server-side even if the admin closes the browser. Progress is
   * polled via GET /deposits/batch/:jobId.
   */
  @Post('batch')
  @HttpCode(201)
  @RequirePermission('canManageDeposits')
  startBatch(@Request() req: { user: { id: string } }, @Body() dto: BatchCreateDepositDto) {
    return this.depositsService.startBatch(req.user.id, {
      groupId: dto.groupId,
      accountNumber: dto.accountNumber,
      items: dto.items,
    });
  }

  /** GET /deposits/batch/:jobId — live progress + per-item outcomes. */
  @Get('batch/:jobId')
  @RequirePermission('canManageDeposits')
  getBatch(@Request() req: { user: { id: string } }, @Param('jobId') jobId: string) {
    return this.depositsService.getBatch(jobId, req.user.id);
  }

  /**
   * POST /deposits/ft-scan
   * Detects all CBE FT numbers (and their payer names) visible on an
   * uploaded bank statement / receipt photo (multipart field "image") via
   * Gemini. Touches no deposit records.
   */
  @Post('ft-scan')
  @UseInterceptors(
    FilesInterceptor('images', 8, {
      storage: memoryStorage(),
      fileFilter: (_req, file, cb) => {
        if (IMAGE_MIME_TYPES.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only image files (JPEG, PNG, WebP, GIF) are allowed'), false);
        }
      },
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB each
    }),
  )
  async scanFtNumbers(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No image uploaded');
    }
    // All photos are sent together in a single (batched) provider call.
    return this.ftDetectionService.detectAll(files.map((f) => f.buffer));
  }

  /**
   * POST /deposits/suggest-members
   * Fuzzy-matches a bank-transaction payer name against the members of a
   * group. Body: { groupId, payerName, senderAccount? } — a known sender
   * account is the strongest identity signal and is tried first.
   */
  @Post('suggest-members')
  @RequirePermission('canManageDeposits')
  suggestMembers(
    @Body('groupId') groupId: string,
    @Body('payerName') payerName: string,
    @Body('senderAccount') senderAccount?: string,
  ) {
    if (!groupId) throw new BadRequestException('groupId is required');
    if (!payerName && !senderAccount) {
      throw new BadRequestException('payerName or senderAccount is required');
    }
    return this.depositsService.suggestMembersForPayer(
      groupId,
      payerName,
      senderAccount,
    );
  }

  // ─── Unknown Senders queue ──────────────────────────────────────────────

  /**
   * POST /deposits/unknown-senders
   * Park a CBE-verified transaction whose payer could not be paired
   * confidently. Kept with full evidence until the admin resolves it.
   */
  @Post('unknown-senders')
  @HttpCode(201)
  @RequirePermission('canManageDeposits')
  queueUnknownSender(@Request() req: { user: { id: string } }, @Body() dto: QueueUnknownSenderDto) {
    return this.unknownSenderService.queue(
      {
        groupId: dto.groupId,
        payerName: dto.payerName,
        ftNumber: dto.ftNumber,
        amount: dto.amount,
        transferDate: dto.transferDate ? new Date(dto.transferDate) : undefined,
        senderAccount: dto.senderAccount,
        bankName: dto.bankName,
        imageUrl: dto.imageUrl,
        reason: dto.reason,
        cbeData: dto.cbeData as Prisma.InputJsonValue,
      },
    );
  }

  /** GET /deposits/unknown-senders — unresolved queue (admin-scoped). */
  @Get('unknown-senders')
  listUnknownSenders(
    @Request() req: { user: { id: string; role: string } },
    @Query('groupId') groupId?: string,
  ) {
    return this.unknownSenderService.list(groupId, req.user.id, req.user.role);
  }

  /** GET /deposits/unknown-senders/count — live nav badge. */
  @Get('unknown-senders/count')
  countUnknownSenders(@Request() req: { user: { id: string; role: string } }) {
    return this.unknownSenderService.count(req.user.id, req.user.role);
  }

  /**
   * POST /deposits/unknown-senders/:id/resolve
   * Pair to an existing member ({ userId }) or quick-create a new member
   * ({ createMember: { name, phone, shares } }); creates the deposit from the
   * stored CBE data and registers the payer as an authorized alias.
   */
  @Post('unknown-senders/:id/resolve')
  @RequirePermission('canManageDeposits')
  resolveUnknownSender(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
    @Body() dto: ResolveUnknownSenderDto,
  ) {
    return this.unknownSenderService.resolve(id, req.user.id, dto);
  }

  /** POST /deposits/unknown-senders/:id/dismiss — close with an audit note. */
  @Post('unknown-senders/:id/dismiss')
  @RequirePermission('canManageDeposits')
  dismissUnknownSender(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
    @Body() dto: DismissUnknownSenderDto,
  ) {
    return this.unknownSenderService.dismiss(id, req.user.id, dto.note);
  }

  @Get()
  findAll(
    @Request() req: any,
    @Query('cycleId') cycleId?: string,
    @Query('userId') userId?: string,
    @Query('groupId') groupId?: string,
    @Query('verificationStatus') verificationStatus?: string,
  ) {
    return this.depositsService.findAll({
      cycleId,
      userId,
      groupId,
      verificationStatus,
    }, req.user.id, req.user.role);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.depositsService.findOne(id);
  }

  @Patch(':id/verify')
  @RequirePermission('canManageDeposits')
  verify(@Param('id') id: string, @Request() req: { user: { id: string } }) {
    return this.depositsService.verify(id, req.user.id);
  }

  @Patch(':id/reject')
  @RequirePermission('canManageDeposits')
  reject(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
    @Body('reason') reason?: string,
  ) {
    return this.depositsService.reject(id, req.user.id, reason);
  }

  // ─── CBE Auto-Verification Endpoints ──────────────────────────────

  /**
   * POST /deposits/:id/auto-verify-cbe
   * Automatically verifies a deposit using CBE Direct API.
   * Uses the group's configured CBE account number(s).
   * Optionally accepts a specific accountNumber in the body.
   */
  @Post(':id/auto-verify-cbe')
  @RequirePermission('canManageDeposits')
  async autoVerifyCbe(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
    @Body('accountNumber') accountNumber?: string,
  ) {
    return this.cbeVerificationService.autoVerifyDeposit(id, req.user.id, accountNumber);
  }

  /**
   * POST /deposits/cbe-lookup
   * Standalone FT number lookup — does NOT touch any deposit record.
   * Returns raw transaction data from CBE Direct API.
   * Used for manual FT number verification or admin bulk lookups.
   *
   * Body: { ftNumber: string, accountNumber: string }
   */
  @Post('cbe-lookup')
  async cbeLookup(
    @Body('ftNumber') ftNumber: string,
    @Body('accountNumber') accountNumber: string,
  ) {
    if (!ftNumber) throw new BadRequestException('ftNumber is required');
    if (!accountNumber) throw new BadRequestException('accountNumber is required');
    return this.cbeVerificationService.verifyByFtNumber(ftNumber, accountNumber);
  }
}
