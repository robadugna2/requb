import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsInt,
  Min,
  MinLength,
} from 'class-validator';

export enum CycleType {
  WEEKLY = 'weekly',
  BIWEEKLY = 'biweekly',
  MONTHLY = 'monthly',
  CUSTOM = 'custom',
}

export enum LotteryMethodDto {
  RANDOM = 'RANDOM',
  LIVE_DRAW = 'LIVE_DRAW',
}

export class CreateGroupDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(1)
  contributionAmount: number;

  @IsEnum(CycleType)
  cycleType: CycleType;

  @IsOptional()
  @IsInt()
  @Min(1)
  cycleDays?: number;

  @IsInt()
  @Min(2)
  maxMembers: number;

  @IsEnum(LotteryMethodDto)
  lotteryMethod: LotteryMethodDto;

  @IsOptional()
  @IsString()
  bankAccount?: string;

  @IsOptional()
  @IsString()
  bankName?: string;
}
