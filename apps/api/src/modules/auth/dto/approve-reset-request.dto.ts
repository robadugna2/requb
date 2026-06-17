import { IsString, MinLength } from 'class-validator';

export class ApproveResetRequestDto {
  @IsString()
  @MinLength(6)
  tempPassword: string;
}
