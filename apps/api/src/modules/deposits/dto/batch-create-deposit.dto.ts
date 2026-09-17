import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * One deposit to create inside a background batch job. Mirrors the scanner's
 * per-FT payload — the server picks the cycle (by bank date) when cycleId is
 * omitted.
 */
export class BatchDepositItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  ftNumber?: string;

  @IsString()
  userId!: string;

  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsString()
  cycleId?: string;

  /** ISO date — the bank transaction date, drives cycle placement */
  @IsOptional()
  @IsString()
  depositDate?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  senderName?: string;

  @IsOptional()
  @IsString()
  senderAccount?: string;

  @IsOptional()
  @IsString()
  receiverAccount?: string;

  @IsOptional()
  @IsString()
  branch?: string;

  @IsOptional()
  @IsString()
  narrative?: string;
}

export class BatchCreateDepositDto {
  @IsString()
  groupId!: string;

  /** Receiver account to verify against; the job also falls back to the
   *  deposit's recorded receiver and every configured group account. */
  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => BatchDepositItemDto)
  items!: BatchDepositItemDto[];
}
