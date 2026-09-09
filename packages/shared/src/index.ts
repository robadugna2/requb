export interface OcrResult {
  ftNumber?: string;
  amount?: number;
  bankName?: string;
  depositDate?: string;
  senderName?: string;
  senderAccount?: string;
  receiverAccount?: string;
  branch?: string;
  confidence: number;
  rawText?: string;
  errors?: string[];
}

export type VerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';
export type GroupStatus = 'ACTIVE' | 'COMPLETED' | 'PAUSED';
export type CycleStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED';
export type LotteryMethod = 'RANDOM' | 'LIVE_DRAW';
export type PayoutStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

export const SUPPORTED_BANKS = [
  'Commercial Bank of Ethiopia (CBE)',
  'Telebirr',
  'CBE Birr',
  'Awash Bank',
  'Bank of Abyssinia (BOA)',
  'Dashen Bank',
  'Cooperative Bank of Oromia',
  'Abyssinia Bank',
  'Zemen Bank',
  'Bunna Bank',
  'Nib International Bank',
  'United Bank',
  'Wegagen Bank',
] as const;

export type SupportedBank = (typeof SUPPORTED_BANKS)[number];
