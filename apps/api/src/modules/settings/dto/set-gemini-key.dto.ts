import { IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class SetGeminiKeyDto {
  // Format is intentionally NOT constrained beyond length: Google key formats
  // vary and change, and a strict regex here previously 400'd valid keys on
  // save while the (unvalidated) Test endpoint accepted them. The "Test Key"
  // action is the real validator — it calls Google with the key.
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(10, { message: 'That does not look like a Gemini API key (too short)' })
  @MaxLength(300)
  apiKey!: string;
}
