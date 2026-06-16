import { IsEmail, IsString, MinLength, IsOptional, IsArray, ValidateNested, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class AssignGroupDto {
  @IsString()
  groupId: string;

  @IsBoolean()
  @IsOptional()
  canManageMembers?: boolean;

  @IsBoolean()
  @IsOptional()
  canManageDeposits?: boolean;

  @IsBoolean()
  @IsOptional()
  canTriggerLottery?: boolean;

  @IsBoolean()
  @IsOptional()
  canManageRules?: boolean;
}

export class CreateAdminDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssignGroupDto)
  @IsOptional()
  assignedGroups?: AssignGroupDto[];
}
