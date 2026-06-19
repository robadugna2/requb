import { IsString, IsOptional, MinLength, IsEnum } from 'class-validator';
import { MaritalStatus, EmploymentType } from '@prisma/client';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(9)
  phone?: string;

  @IsOptional()
  @IsString()
  telegramId?: string;

  @IsOptional()
  @IsString()
  governmentId?: string;

  @IsOptional()
  @IsString()
  bankAccountName?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @IsOptional()
  @IsString()
  employerName?: string;

  @IsOptional()
  @IsEnum(MaritalStatus)
  maritalStatus?: MaritalStatus;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  subCity?: string;

  @IsOptional()
  @IsString()
  woreda?: string;

  @IsOptional()
  @IsString()
  houseNumber?: string;
}
