import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum NotificationTypeDto {
  DEADLINE_APPROACHING = 'DEADLINE_APPROACHING',
  PAYMENT_OVERDUE = 'PAYMENT_OVERDUE',
  DEPOSIT_VERIFIED = 'DEPOSIT_VERIFIED',
  DEPOSIT_REJECTED = 'DEPOSIT_REJECTED',
  LOTTERY_WIN = 'LOTTERY_WIN',
  MEMBER_JOINED = 'MEMBER_JOINED',
  MEMBER_REMOVED = 'MEMBER_REMOVED',
  MEMBER_SUSPENDED = 'MEMBER_SUSPENDED',
  RULE_VIOLATION = 'RULE_VIOLATION',
  PENALTY_CREATED = 'PENALTY_CREATED',
  PENALTY_PAID = 'PENALTY_PAID',
  CYCLE_STARTED = 'CYCLE_STARTED',
  CYCLE_COMPLETED = 'CYCLE_COMPLETED',
  GROUP_COMPLETED = 'GROUP_COMPLETED',
  TURN_SWAP_REQUEST = 'TURN_SWAP_REQUEST',
  TURN_SWAP_APPROVED = 'TURN_SWAP_APPROVED',
  TURN_SWAP_REJECTED = 'TURN_SWAP_REJECTED',
  DISPUTE_FILED = 'DISPUTE_FILED',
  DISPUTE_RESOLVED = 'DISPUTE_RESOLVED',
  GENERAL = 'GENERAL',
}

export class CreateNotificationDto {
  @IsEnum(NotificationTypeDto)
  type: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsOptional()
  @IsString()
  groupId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  depositId?: string;
}
