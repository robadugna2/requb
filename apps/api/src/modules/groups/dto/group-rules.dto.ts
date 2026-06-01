import {
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsInt,
  IsString,
  Min,
  Max,
} from 'class-validator';

export enum PenaltyTypeDto {
  NONE = 'NONE',
  FIXED = 'FIXED',
  PERCENTAGE = 'PERCENTAGE',
}

export enum PayoutScheduleDto {
  IMMEDIATE = 'IMMEDIATE',
  NEXT_DAY = 'NEXT_DAY',
  END_OF_CYCLE = 'END_OF_CYCLE',
  CUSTOM = 'CUSTOM',
}

export enum EarlyWithdrawalPolicyDto {
  NOT_ALLOWED = 'NOT_ALLOWED',
  WITH_FEE = 'WITH_FEE',
  ALLOWED = 'ALLOWED',
}

export enum DisputeResolutionDto {
  ADMIN_DECISION = 'ADMIN_DECISION',
  MEMBER_VOTE = 'MEMBER_VOTE',
  THIRD_PARTY = 'THIRD_PARTY',
}

export enum AdminFeeTypeDto {
  NONE = 'NONE',
  FIXED = 'FIXED',
  PERCENTAGE = 'PERCENTAGE',
}

export class UpdateGroupRulesDto {
  @IsOptional()
  @IsEnum(PenaltyTypeDto)
  latePenaltyType?: PenaltyTypeDto;

  @IsOptional()
  @IsNumber()
  @Min(0)
  latePenaltyAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  latePenaltyPercent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  gracePeriodDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxMissedPayments?: number;

  @IsOptional()
  @IsBoolean()
  requireExactAmount?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  depositDeadlineDay?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  minVerificationHours?: number;

  @IsOptional()
  @IsBoolean()
  allowSkipRound?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxSkipsAllowed?: number;

  @IsOptional()
  @IsBoolean()
  requireGuarantor?: boolean;

  @IsOptional()
  @IsInt()
  @Min(2)
  minMembersToStart?: number;

  @IsOptional()
  @IsBoolean()
  allowMidCycleJoin?: boolean;

  @IsOptional()
  @IsBoolean()
  requireGovernmentId?: boolean;

  @IsOptional()
  @IsBoolean()
  postWinContributionRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  autoCompleteGroup?: boolean;

  @IsOptional()
  @IsEnum(AdminFeeTypeDto)
  adminFeeType?: AdminFeeTypeDto;

  @IsOptional()
  @IsNumber()
  @Min(0)
  adminFeeAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  adminFeePercent?: number;

  @IsOptional()
  @IsEnum(PayoutScheduleDto)
  payoutSchedule?: PayoutScheduleDto;

  @IsOptional()
  @IsInt()
  @Min(0)
  payoutDelayDays?: number;

  @IsOptional()
  @IsEnum(EarlyWithdrawalPolicyDto)
  earlyWithdrawalPolicy?: EarlyWithdrawalPolicyDto;

  @IsOptional()
  @IsNumber()
  @Min(0)
  earlyWithdrawalFee?: number;

  @IsOptional()
  @IsEnum(DisputeResolutionDto)
  disputeResolution?: DisputeResolutionDto;

  @IsOptional()
  @IsString()
  customRules?: string;
}
