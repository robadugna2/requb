import { IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class SetOpenAiKeyDto {
  // Format is intentionally loose (key prefixes vary: sk-, sk-proj-, ...)
  // — the "Test Key" action validates the key against the live OpenAI API.
  @IsString()
  @MinLength(20, { message: 'That does not look like an OpenAI API key (too short)' })
  @MaxLength(300)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: 'API keys contain only letters, numbers, dashes and underscores',
  })
  apiKey!: string;
}
