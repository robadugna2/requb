import { IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class SetGeminiKeyDto {
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  @Matches(/^AIza[A-Za-z0-9_-]{10,}$/, {
    message: 'Gemini API keys start with "AIza"',
  })
  apiKey!: string;
}
