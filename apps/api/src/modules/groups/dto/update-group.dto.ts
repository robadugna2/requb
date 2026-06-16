import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsInt,
  Min,
  MinLength,
} from 'class-validator';
import { CycleType, LotteryMethodDto } from './create-group.dto';

export enum GroupStatusDto {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  PAUSED = 'PAUSED',
}

export class UpdateGroupDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  contributionAmount?: number;

  @IsOptional()
  @IsEnum(CycleType)
  cycleType?: CycleType;

  @IsOptional()
  @IsInt()
  @Min(1)
  cycleDays?: number;

  @IsOptional()
  @IsInt()
  @Min(2)
  maxMembers?: number;

  @IsOptional()
  @IsEnum(LotteryMethodDto)
  lotteryMethod?: LotteryMethodDto;

  @IsOptional()
  @IsEnum(GroupStatusDto)
  status?: GroupStatusDto;

  @IsOptional()
  @IsString()
  bankAccount?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  physicalAddress?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;
}
