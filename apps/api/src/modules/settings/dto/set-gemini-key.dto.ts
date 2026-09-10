import { IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class SetGeminiKeyDto {
  // Format is intentionally loose (Google key formats have changed before) —
  // the "Test Key" action validates the key against the live Gemini API.
  @IsString()
  @MinLength(20, { message: 'That does not look like a Gemini API key (too short)' })
  @MaxLength(200)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'API keys contain only letters, numbers, dashes and underscores',
  })
  apiKey!: string;
}
