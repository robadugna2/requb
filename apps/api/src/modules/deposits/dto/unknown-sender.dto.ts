import {
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class QueueUnknownSenderDto {
  @IsString()
  @IsNotEmpty()
  groupId: string;

  /** Payer name exactly as extracted from the CBE receipt */
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  payerName: string;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  ftNumber?: string;

  /** CBE transfer date as parsed from the receipt (ISO-ish) */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  transferDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  senderAccount?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  bankName?: string;

  /** Evidence photo URL (uploaded scan) */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;

  /** Full CBE verification payload, kept for the audit trail */
  @IsOptional()
  @IsObject()
  cbeData?: Record<string, unknown>;
}

/** Quick-create a brand-new member from an unknown payer identity. */
export class CreateMemberFromPayerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(9)
  @MaxLength(20)
  phone: string;

  @IsOptional()
  @IsNumber()
  @Min(0.25)
  @Max(10)
  shares?: number;

  /** Groups with requireGovernmentId block members without one — the
   *  quick-create modal collects it up front so creation never dead-ends. */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  governmentId?: string;
}

export class ResolveUnknownSenderDto {
  /** Pair the transaction to an existing group member */
  @IsOptional()
  @IsString()
  userId?: string;

  /** Or create a new member with this identity, then pair */
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateMemberFromPayerDto)
  createMember?: CreateMemberFromPayerDto;
}

export class DismissUnknownSenderDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
