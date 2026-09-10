import { IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class SetOpenAiKeyDto {
  @IsString()
  @MinLength(20)
  @MaxLength(300)
  @Matches(/^sk-[A-Za-z0-9_-]+$/, {
    message: 'OpenAI API keys start with "sk-"',
  })
  apiKey!: string;
}
