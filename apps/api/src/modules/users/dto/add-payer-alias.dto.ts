import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class AddPayerAliasDto {
  @IsString()
  @IsNotEmpty({ message: 'Payer name is required' })
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  note?: string;
}
