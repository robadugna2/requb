import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

/**
 * Admin-facing deposit creation (e.g. from the camera FT scanner).
 * `groupId` is required so GroupPermissionsGuard can enforce
 * canManageDeposits for the selected group; the service also validates
 * it against the cycle's actual group.
 */
export class CreateDepositDto {
  @IsString()
  @IsNotEmpty()
  cycleId!: string;

  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  groupId!: string;

  @IsString()
  @IsNotEmpty()
  imageUrl!: string;

  @IsOptional()
  @IsString()
  @Matches(/^FT\w{10}([\\/|]\w{1,10})?$/i, {
    message:
      'FT number must be "FT" followed by 10 alphanumeric characters (e.g. FT24AB123456). An extended identifier after "\\", "/" or "|" is allowed and will be stripped.',
  })
  ftNumber?: string;

  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsDateString()
  depositDate?: string;

  @IsOptional()
  @IsString()
  senderName?: string;

  @IsOptional()
  @IsString()
  senderAccount?: string;

  @IsOptional()
  @IsString()
  receiverAccount?: string;

  @IsOptional()
  @IsString()
  branch?: string;

  /** Transfer method / description, e.g. "via Mobile banking" */
  @IsOptional()
  @IsString()
  narrative?: string;

  @IsOptional()
  @IsNumber()
  confidence?: number;
}
