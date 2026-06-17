import { IsOptional, IsString } from 'class-validator';

export class RejectResetRequestDto {
  @IsOptional()
  @IsString()
  rejectionNote?: string;
}
