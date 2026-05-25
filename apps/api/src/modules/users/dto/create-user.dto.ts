import { IsString, IsOptional, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @MinLength(9)
  phone: string;

  @IsOptional()
  @IsString()
  telegramId?: string;
}
