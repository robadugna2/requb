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
  UploadedFile,
  Request,
  BadRequestException,
  HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GroupPermissionsGuard } from '../../common/guards/group-permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { DepositsService } from './deposits.service';
import { CbeVerificationService } from './cbe-verification.service';
import { OcrService } from '../ocr/ocr.service';
import { CreateDepositDto } from './dto/create-deposit.dto';

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

@Controller('deposits')
@UseGuards(JwtAuthGuard, GroupPermissionsGuard)
export class DepositsController {
  constructor(
    private readonly depositsService: DepositsService,
    private readonly cbeVerificationService: CbeVerificationService,
    private readonly ocrService: OcrService,
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
   * POST /deposits/ft-scan
   * Detects all CBE FT numbers visible on an uploaded bank statement /
   * receipt photo (multipart field "image"). Touches no deposit records.
   */
  @Post('ft-scan')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      fileFilter: (_req, file, cb) => {
        if (IMAGE_MIME_TYPES.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only image files (JPEG, PNG, WebP, GIF) are allowed'), false);
        }
      },
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  )
  async scanFtNumbers(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No image uploaded');
    }
    const dataUrl = `data:${file.mimetype || 'image/jpeg'};base64,${file.buffer.toString('base64')}`;
    return this.ocrService.extractFtNumbers(dataUrl);
  }

  /**
   * POST /deposits/suggest-members
   * Fuzzy-matches a bank-transaction payer name against the members of a
   * group. Body: { groupId, payerName }
   */
  @Post('suggest-members')
  @RequirePermission('canManageDeposits')
  suggestMembers(
    @Body('groupId') groupId: string,
    @Body('payerName') payerName: string,
  ) {
    if (!groupId) throw new BadRequestException('groupId is required');
    if (!payerName) throw new BadRequestException('payerName is required');
    return this.depositsService.suggestMembersForPayer(groupId, payerName);
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
