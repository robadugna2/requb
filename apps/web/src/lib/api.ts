import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getMediaUrl = (url?: string): string => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
  const rootUrl = baseUrl.replace(/\/api$/, '');
  return `${rootUrl}${url.startsWith('/') ? '' : '/'}${url}`;
};

// Request interceptor to add JWT token
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('equb_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('equb_token');
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }
    }
    if (error.response?.status === 403) {
      if (typeof window !== 'undefined') {
        const message = error.response?.data?.message || 'You do not have permission to perform this action.';
        window.dispatchEvent(new CustomEvent('equb-permission-denied', { detail: { message } }));
      }
    }
    return Promise.reject(error);
  }
);

// ─── UI Types ────────────────────────────────────────────────────────────────

export interface GroupListItem {
  id: string;
  name: string;
  photoUrl?: string;
  membersCount: number;
  maxMembers: number;
  contributionAmount: number;
  status: 'active' | 'inactive' | 'completed';
  cycleDuration: string;
  currentCycle: number;
  totalCycles: number;
  createdAt: string;
  cbeAccountNumbers?: string[];
}

export interface GroupDetail {
  id: string;
  name: string;
  description?: string;
  photoUrl?: string;
  endDate?: string;
  physicalAddress?: string;
  latitude?: number;
  longitude?: number;
  membersCount: number;
  maxMembers: number;
  contributionAmount: number;
  status: 'active' | 'inactive' | 'completed';
  cycleDuration: string;
  currentCycle: number;
  totalCycles: number;
  members: GroupMember[];
  nextDrawDate?: string;
  createdById?: string;
  cbeAccountNumbers?: string[];
  cycles?: GroupCycleInfo[];
}

export interface GroupCycleInfo {
  id: string;
  cycleNumber: number;
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED';
  startDate?: string;
  endDate?: string;
}

export interface GroupMember {
  id: string;
  name: string;
  phone: string;
  photoUrl?: string;
  telegramId?: string;
  hasWon: boolean;
  cycleWon?: number;
  bankAccountName?: string;
}

export interface MemberListItem {
  id: string;
  name: string;
  phone: string;
  telegramId?: string;
  photoUrl?: string;
  employmentType?: string;
  city?: string;
  governmentId?: string;
  groups: string[];
  joinedAt: string;
  totalDeposits: number;
}

export interface UserDepositRecord {
  id: string;
  groupName: string;
  cycleNumber: number;
  amount: number;
  status: 'verified' | 'pending' | 'rejected';
  date: string;
  transferDate: string;
  ftNumber?: string;
  narrative?: string;
  senderName?: string;
  imageUrl?: string;
}

export interface UserLotteryWin {
  id: string;
  groupName: string;
  cycleNumber: number;
  amountWon: number;
  date: string;
}

export interface UserGroupMembership {
  id: string;
  groupId: string;
  groupName: string;
  status: string;
  joinedAt: string;
  shares: number;
  contributionAmount: number;
}

export interface PayerAlias {
  id: string;
  name: string;
  note?: string | null;
  createdAt: string;
}

export interface UserDetail {
  id: string;
  name: string;
  phone: string;
  telegramId?: string;
  governmentId?: string;
  bankAccountName?: string;
  photoUrl?: string;
  employmentType?: string;
  employerName?: string;
  maritalStatus?: string;
  country?: string;
  city?: string;
  subCity?: string;
  woreda?: string;
  houseNumber?: string;
  createdAt: string;
  updatedAt: string;
  groups: UserGroupMembership[];
  deposits: UserDepositRecord[];
  lotteryWins: UserLotteryWin[];
  totalDeposits: number;
  payerAliases?: PayerAlias[];
}

export interface GroupRules {
  id: string;
  groupId: string;
  latePenaltyType: 'NONE' | 'FIXED' | 'PERCENTAGE';
  latePenaltyAmount?: number;
  latePenaltyPercent?: number;
  gracePeriodDays: number;
  maxMissedPayments: number;
  requireExactAmount: boolean;
  allowPartialPayments: boolean;
  allowOverpayment: boolean;
  createdAt?: string;
  updatedAt?: string;
  depositDeadlineDay?: number;
  minVerificationHours: number;
  allowSkipRound: boolean;
  maxSkipsAllowed: number;
  requireGuarantor: boolean;
  minMembersToStart: number;
  allowMidCycleJoin: boolean;
  requireGovernmentId: boolean;
  postWinContributionRequired: boolean;
  autoCompleteGroup: boolean;
  adminFeeType: 'NONE' | 'FIXED' | 'PERCENTAGE';
  adminFeeAmount?: number;
  adminFeePercent?: number;
  payoutSchedule: 'IMMEDIATE' | 'NEXT_DAY' | 'END_OF_CYCLE' | 'CUSTOM';
  payoutDelayDays: number;
  earlyWithdrawalPolicy: 'NOT_ALLOWED' | 'WITH_FEE' | 'ALLOWED';
  earlyWithdrawalFee?: number;
  disputeResolution: 'ADMIN_DECISION' | 'MEMBER_VOTE' | 'THIRD_PARTY';
  customRules?: string;
}

export interface RuleTemplate {
  id: string;
  name: string;
  description?: string;
  latePenaltyType: 'NONE' | 'FIXED' | 'PERCENTAGE';
  latePenaltyAmount?: number;
  latePenaltyPercent?: number;
  gracePeriodDays: number;
  maxMissedPayments: number;
  requireExactAmount: boolean;
  allowPartialPayments: boolean;
  allowOverpayment: boolean;
  depositDeadlineDay?: number;
  minVerificationHours: number;
  allowSkipRound: boolean;
  maxSkipsAllowed: number;
  requireGuarantor: boolean;
  minMembersToStart: number;
  allowMidCycleJoin: boolean;
  requireGovernmentId: boolean;
  postWinContributionRequired: boolean;
  autoCompleteGroup: boolean;
  adminFeeType: 'NONE' | 'FIXED' | 'PERCENTAGE';
  adminFeeAmount?: number;
  adminFeePercent?: number;
  payoutSchedule: 'IMMEDIATE' | 'NEXT_DAY' | 'END_OF_CYCLE' | 'CUSTOM';
  payoutDelayDays: number;
  earlyWithdrawalPolicy: 'NOT_ALLOWED' | 'WITH_FEE' | 'ALLOWED';
  earlyWithdrawalFee?: number;
  disputeResolution: 'ADMIN_DECISION' | 'MEMBER_VOTE' | 'THIRD_PARTY';
  customRules?: string;
  createdBy: { id: string; name: string; email: string };
  createdAt: string;
  updatedAt: string;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  groupId?: string;
  userId?: string;
  depositId?: string;
  createdAt: string;
}

export interface ReceiptItem {
  id: string;
  memberName: string;
  groupName: string;
  groupId: string;
  amount: number;
  status: 'verified' | 'pending' | 'rejected';
  date: string;
  ftNumber?: string;
  receiptImageUrl?: string;
  autoVerified?: boolean;
  ocrData?: {
    bankName: string;
    transactionRef: string;
    extractedAmount: number;
    extractedDate: string;
  };
}

export interface CbeTransactionData {
  ftNumber: string;
  amount?: number;
  payer?: string;
  payerAccount?: string;
  receiver?: string;
  receiverAccount?: string;
  date?: string;
  reference?: string;
  reason?: string;
  branch?: string;
  commission?: string;
  vatOnCommission?: string;
  totalDebited?: string;
  amountInWords?: string;
  rawText: string;
}

export interface DepositItem {
  id: string;
  userId: string;
  memberName: string;
  amount: number;
  status: 'verified' | 'pending' | 'rejected';
  date: string;
  transferDate: string;
  createdAt?: string;
  ftNumber?: string;
  narrative?: string;
  receiptUrl?: string;
  cycleNumber?: number;
  bankName?: string;
  senderName?: string;
  senderAccount?: string;
  branch?: string;
  rejectionReason?: string;
  isLate: boolean;
  penaltyApplied: boolean;
  confidence?: number;
  autoVerified?: boolean;
  cbeVerificationData?: CbeTransactionData;
}

export type LotteryDrawStatus = 'PENDING' | 'CONFIRMED' | 'VOID';

export interface LotteryResultItem {
  id: string;
  groupName: string;
  groupId: string;
  cycle: number;
  cycleId: string;
  winnerName: string;
  winnerId: string;
  method: 'RANDOM' | 'WEIGHTED' | 'LIVE_DRAW' | 'FIXED_ORDER';
  status: LotteryDrawStatus;
  attempt: number;
  amount: number;
  adminFee: number | null;
  net: number | null;
  seed: string | null;
  resultHash: string | null;
  date: string;
  drawnAt: string;
  drawnByName: string | null;
  confirmedByName: string | null;
  confirmedAt: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  payout: {
    status: 'PENDING' | 'COMPLETED';
    amount: number | null;
    payoutDate: string | null;
  } | null;
}

export interface LotteryEligibilityMember {
  userId: string;
  name: string;
  phone?: string;
  photoUrl?: string;
  shares: number;
  confirmedWins: number;
  rotationLeft: number;
  verifiedAmount: number;
  eligible: boolean;
  reason: string;
}

export interface LotteryEligibility {
  groupId: string;
  groupName: string;
  cycleId: string;
  cycleNumber: number;
  defaultMethod: 'RANDOM' | 'WEIGHTED' | 'LIVE_DRAW' | 'FIXED_ORDER';
  members: LotteryEligibilityMember[];
  eligibleCount: number;
  totalPool: number;
  violations: { rule: string; message: string; severity: 'ERROR' | 'WARNING' }[];
  pendingResultId: string | null;
}

export interface LotteryDrawPending {
  id: string;
  cycleId: string;
  winnerId: string;
  winnerName: string;
  method: LotteryResultItem['method'];
  attempt: number;
  status: LotteryDrawStatus;
  gross: number;
  adminFee: number;
  net: number;
  eligibleCount: number;
  amount: number;
  seed: string | null;
  resultHash: string | null;
  awaitingConfirmation: boolean;
}

export interface PenaltyRecord {
  id: string;
  groupId: string;
  userId: string;
  cycleId?: string;
  reason: string;
  amount: number;
  status: 'PENDING' | 'PAID' | 'WAIVED';
  notes?: string;
  user?: { id: string; name: string; phone?: string };
  createdAt: string;
  updatedAt: string;
}

export interface DisputeItem {
  id: string;
  groupId: string;
  filedByUserId: string;
  againstUserId?: string;
  type: string;
  description: string;
  status: 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED';
  resolution?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  filedBy?: { id: string; name: string; phone?: string };
  againstUser?: { id: string; name: string; phone?: string };
  group?: { id: string; name: string };
  createdAt: string;
}

export interface TurnSwapRequest {
  id: string;
  groupId: string;
  requesterId: string;
  targetId: string;
  requesterTurn: number;
  targetTurn: number;
  reason?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requester?: { id: string; name: string };
  target?: { id: string; name: string };
  group?: { id: string; name: string };
  createdAt: string;
}

export interface DashboardStats {
  totalGroups: number;
  activeMembers: number;
  pendingReceipts: number;
  totalCollected: string;
  /** Raw verified sum in ETB — preferred over parsing totalCollected */
  totalCollectedValue?: number;
  activeGuarantees?: number;
  pendingSwapRequests?: number;
  completedDraws?: number;
  totalDisbursed?: number;
  user?: {
    name: string;
    role: string;
    creator?: string;
  };
}

export interface ActivityItem {
  id: string;
  type: string;
  message: string;
  time: string;
}

export interface ChartDataItem {
  date: string;
  deposits: number;
  verified: number;
}

// ─── Mapper Functions ────────────────────────────────────────────────────────

function mapCycleTypeToDisplay(cycleType: string): string {
  switch (cycleType?.toLowerCase()) {
    case 'weekly': return 'Weekly';
    case 'biweekly': return 'Bi-Weekly';
    case 'monthly': return 'Monthly';
    case 'custom': return 'Custom';
    default: return cycleType || 'Monthly';
  }
}

function mapStatusToLower(status: string): 'active' | 'inactive' | 'completed' {
  const lower = status?.toLowerCase();
  if (lower === 'active') return 'active';
  if (lower === 'completed') return 'completed';
  if (lower === 'paused') return 'inactive';
  return 'inactive';
}

function mapVerificationStatus(status: string): 'verified' | 'pending' | 'rejected' {
  const lower = status?.toLowerCase();
  if (lower === 'verified') return 'verified';
  if (lower === 'rejected') return 'rejected';
  return 'pending';
}

function mapGroupListItem(raw: Record<string, unknown>): GroupListItem {
  const memberships = raw.memberships as Array<Record<string, unknown>> | undefined;
  const count = raw._count as Record<string, number> | undefined;
  const cycles = raw.cycles as Array<Record<string, unknown>> | undefined;

  const membersCount = count?.memberships ?? memberships?.length ?? 0;
  const latestCycle = cycles?.[0];
  const currentCycle = (latestCycle?.cycleNumber as number) ?? 0;

  return {
    id: raw.id as string,
    name: raw.name as string,
    photoUrl: (raw.photoUrl as string) || undefined,
    membersCount,
    maxMembers: raw.maxMembers as number,
    contributionAmount: raw.contributionAmount as number,
    status: mapStatusToLower(raw.status as string),
    cycleDuration: mapCycleTypeToDisplay(raw.cycleType as string),
    currentCycle,
    totalCycles: raw.maxMembers as number,
    createdAt: raw.createdAt as string,
    cbeAccountNumbers: (raw.cbeAccountNumbers as string[]) || [],
  };
}

function mapGroupDetail(raw: Record<string, unknown>): GroupDetail {
  const memberships = raw.memberships as Array<Record<string, unknown>> | undefined;
  const cycles = raw.cycles as Array<Record<string, unknown>> | undefined;

  const latestCycle = cycles?.[0];
  const currentCycle = (latestCycle?.cycleNumber as number) ?? 0;

  // Build winner set from confirmed lottery results across all cycles
  const winnerMap = new Map<string, number>();
  if (cycles) {
    for (const cycle of cycles) {
      const results = (cycle.lotteryResults as Array<Record<string, unknown>> | undefined) || [];
      const confirmed = results.find((r) => r.status === 'CONFIRMED') || results[0];
      if (confirmed) {
        const winner = confirmed.winner as Record<string, unknown> | undefined;
        const winnerId = (confirmed.winnerId as string) || (winner?.id as string);
        if (winnerId && confirmed.status === 'CONFIRMED') {
          winnerMap.set(winnerId, cycle.cycleNumber as number);
        }
      }
    }
  }

  const members: GroupMember[] = (memberships || [])
    .filter((m) => (m.status as string) === 'ACTIVE')
    .map((m) => {
      const user = m.user as Record<string, unknown>;
      const userId = user.id as string;
      const hasWon = winnerMap.has(userId);
      return {
        id: userId,
        name: user.name as string,
        phone: user.phone as string,
        photoUrl: user.photoUrl as string | undefined,
        telegramId: user.telegramId as string | undefined,
        hasWon,
        cycleWon: hasWon ? winnerMap.get(userId) : undefined,
        bankAccountName: user.bankAccountName as string | undefined,
      };
    });

  const cycleInfos: GroupCycleInfo[] = (cycles || [])
    .map((c) => ({
      id: c.id as string,
      cycleNumber: c.cycleNumber as number,
      status: (c.status as GroupCycleInfo['status']) || 'PENDING',
      startDate: c.startDate as string | undefined,
      endDate: c.endDate as string | undefined,
    }))
    .sort((a, b) => a.cycleNumber - b.cycleNumber);

  // Calculate next draw date from latest active cycle's end date
  let nextDrawDate: string | undefined;
  if (latestCycle && (latestCycle.status as string) === 'ACTIVE') {
    nextDrawDate = (latestCycle.endDate as string)?.split('T')[0];
  }

  const createdBy = raw.createdBy as Record<string, unknown> | undefined;

  return {
    id: raw.id as string,
    name: raw.name as string,
    description: raw.description as string | undefined,
    photoUrl: raw.photoUrl as string | undefined,
    endDate: raw.endDate as string | undefined,
    physicalAddress: raw.physicalAddress as string | undefined,
    latitude: raw.latitude as number | undefined,
    longitude: raw.longitude as number | undefined,
    membersCount: members.length,
    maxMembers: raw.maxMembers as number,
    contributionAmount: raw.contributionAmount as number,
    status: mapStatusToLower(raw.status as string),
    cycleDuration: mapCycleTypeToDisplay(raw.cycleType as string),
    currentCycle,
    totalCycles: raw.maxMembers as number,
    members,
    nextDrawDate,
    createdById: (raw.createdById as string) || (createdBy?.id as string) || undefined,
    cbeAccountNumbers: (raw.cbeAccountNumbers as string[]) || [],
    cycles: cycleInfos,
  };
}

function mapUserDetail(raw: Record<string, unknown>): UserDetail {
  const memberships = raw.memberships as Array<Record<string, unknown>> | undefined;
  const deposits = raw.deposits as Array<Record<string, unknown>> | undefined;
  const lotteryWins = raw.lotteryWins as Array<Record<string, unknown>> | undefined;

  const groups: UserGroupMembership[] = (memberships || []).map((m) => {
    const group = m.group as Record<string, unknown> | undefined;
    return {
      id: m.id as string,
      groupId: (group?.id as string) || '',
      groupName: (group?.name as string) || 'Unknown',
      status: (m.status as string) || 'ACTIVE',
      joinedAt: m.joinedAt ? new Date(m.joinedAt as string).toLocaleDateString() : 'N/A',
      shares: (m.shares as number) || 1,
      contributionAmount: (group?.contributionAmount as number) || 0,
    };
  });

  const depositRecords: UserDepositRecord[] = (deposits || []).map((d) => {
    const cycle = d.cycle as Record<string, unknown> | undefined;
    const group = cycle?.group as Record<string, unknown> | undefined;
    const depositDateRaw = d.depositDate as string | undefined;
    const transferDate = depositDateRaw
      ? new Date(depositDateRaw).toLocaleDateString('en-CA')
      : (d.createdAt ? new Date(d.createdAt as string).toLocaleDateString('en-CA') : 'N/A');
    return {
      id: d.id as string,
      groupName: (group?.name as string) || 'Unknown',
      cycleNumber: (cycle?.cycleNumber as number) || 0,
      amount: (d.amount as number) || 0,
      status: mapVerificationStatus(d.verificationStatus as string),
      date: d.createdAt ? new Date(d.createdAt as string).toLocaleDateString('en-CA') : 'N/A',
      transferDate,
      ftNumber: (d.ftNumber as string) || undefined,
      narrative: (d.narrative as string) || undefined,
      senderName: (d.senderName as string) || undefined,
      imageUrl: d.imageUrl as string | undefined,
    };
  }).sort((a, b) => a.cycleNumber - b.cycleNumber);

  const lotteryWinRecords: UserLotteryWin[] = (lotteryWins || []).map((l) => {
    const cycle = l.cycle as Record<string, unknown> | undefined;
    const group = cycle?.group as Record<string, unknown> | undefined;
    return {
      id: l.id as string,
      groupName: (group?.name as string) || 'Unknown',
      cycleNumber: (cycle?.cycleNumber as number) || 0,
      amountWon: (l.amountWon as number) || 0,
      date: l.drawnAt ? new Date(l.drawnAt as string).toLocaleDateString('en-CA') : 'N/A',
    };
  });

  const totalDeposits = depositRecords.reduce((sum, d) => sum + d.amount, 0);

  return {
    id: raw.id as string,
    name: raw.name as string,
    phone: raw.phone as string,
    telegramId: raw.telegramId as string | undefined,
    governmentId: raw.governmentId as string | undefined,
    bankAccountName: raw.bankAccountName as string | undefined,
    photoUrl: raw.photoUrl as string | undefined,
    employmentType: raw.employmentType as string | undefined,
    employerName: raw.employerName as string | undefined,
    maritalStatus: raw.maritalStatus as string | undefined,
    country: raw.country as string | undefined,
    city: raw.city as string | undefined,
    subCity: raw.subCity as string | undefined,
    woreda: raw.woreda as string | undefined,
    houseNumber: raw.houseNumber as string | undefined,
    createdAt: raw.createdAt ? new Date(raw.createdAt as string).toLocaleDateString() : 'N/A',
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt as string).toLocaleDateString() : 'N/A',
    groups,
    deposits: depositRecords,
    lotteryWins: lotteryWinRecords,
    totalDeposits,
    payerAliases: ((raw.payerAliases as Array<Record<string, unknown>> | undefined) ?? []).map(
      (a) => ({
        id: a.id as string,
        name: a.name as string,
        note: (a.note as string | null | undefined) ?? null,
        createdAt: a.createdAt ? new Date(a.createdAt as string).toISOString() : '',
      }),
    ),
  };
}

function mapMemberListItem(raw: Record<string, unknown>): MemberListItem {
  const memberships = raw.memberships as Array<Record<string, unknown>> | undefined;
  const deposits = raw.deposits as Array<Record<string, unknown>> | undefined;

  const groups = (memberships || [])
    .map((m) => {
      const group = m.group as Record<string, unknown> | undefined;
      return group?.name as string;
    })
    .filter(Boolean);

  const totalDeposits = (deposits || []).reduce((sum, d) => {
    return sum + ((d.amount as number) || 0);
  }, 0);

  return {
    id: raw.id as string,
    name: raw.name as string,
    phone: raw.phone as string,
    telegramId: raw.telegramId as string | undefined,
    photoUrl: raw.photoUrl as string | undefined,
    employmentType: raw.employmentType as string | undefined,
    city: raw.city as string | undefined,
    governmentId: raw.governmentId as string | undefined,
    groups,
    joinedAt: raw.createdAt ? new Date(raw.createdAt as string).toLocaleDateString() : 'N/A',
    totalDeposits,
  };
}

function mapReceiptItem(raw: Record<string, unknown>): ReceiptItem {
  const user = raw.user as Record<string, unknown> | undefined;
  const cycle = raw.cycle as Record<string, unknown> | undefined;
  const group = cycle?.group as Record<string, unknown> | undefined;
  const ocrDataRaw = raw.ocrData as Record<string, unknown> | null;

  let ocrData: ReceiptItem['ocrData'] | undefined;
  if (ocrDataRaw) {
    ocrData = {
      bankName: (ocrDataRaw.bankName as string) || (raw.bankName as string) || 'Unknown',
      transactionRef: (ocrDataRaw.ftNumber as string) || (raw.ftNumber as string) || 'N/A',
      extractedAmount: (ocrDataRaw.amount as number) || (raw.amount as number) || 0,
      extractedDate: (ocrDataRaw.transactionDate as string) || (raw.depositDate as string)?.split('T')[0] || 'N/A',
    };
  } else if (raw.bankName || raw.ftNumber) {
    ocrData = {
      bankName: (raw.bankName as string) || 'Unknown',
      transactionRef: (raw.ftNumber as string) || 'N/A',
      extractedAmount: (raw.amount as number) || 0,
      extractedDate: (raw.depositDate as string)?.split('T')[0] || 'N/A',
    };
  }

  return {
    id: raw.id as string,
    memberName: (user?.name as string) || 'Unknown',
    groupName: (group?.name as string) || 'Unknown',
    groupId: (group?.id as string) || '',
    amount: (raw.amount as number) || (group?.contributionAmount as number) || 0,
    status: mapVerificationStatus(raw.verificationStatus as string),
    date: raw.createdAt ? new Date(raw.createdAt as string).toLocaleDateString('en-CA') : 'N/A',
    ftNumber: (raw.ftNumber as string) || undefined,
    receiptImageUrl: raw.imageUrl as string | undefined,
    autoVerified: (raw.autoVerified as boolean) || false,
    ocrData,
  };
}

function mapDepositItem(raw: Record<string, unknown>): DepositItem {
  const user = raw.user as Record<string, unknown> | undefined;
  const cycle = raw.cycle as Record<string, unknown> | undefined;
  const depositDateRaw = raw.depositDate as string | undefined;
  const transferDate = depositDateRaw
    ? new Date(depositDateRaw).toLocaleDateString('en-CA')
    : (raw.createdAt ? new Date(raw.createdAt as string).toLocaleDateString('en-CA') : 'N/A');

  return {
    id: raw.id as string,
    userId: (user?.id as string) || '',
    memberName: (user?.name as string) || 'Unknown',
    amount: (raw.amount as number) || 0,
    status: mapVerificationStatus(raw.verificationStatus as string),
    date: raw.createdAt ? new Date(raw.createdAt as string).toLocaleDateString('en-CA') : 'N/A',
    transferDate,
    ftNumber: (raw.ftNumber as string) || undefined,
    narrative: (raw.narrative as string) || undefined,
    receiptUrl: raw.imageUrl as string | undefined,
    createdAt: raw.createdAt ? new Date(raw.createdAt as string).toISOString() : undefined,
    cycleNumber: (cycle?.cycleNumber as number) || undefined,
    bankName: (raw.bankName as string) || undefined,
    senderName: (raw.senderName as string) || undefined,
    senderAccount: (raw.senderAccount as string) || undefined,
    branch: (raw.branch as string) || undefined,
    rejectionReason: (raw.rejectionReason as string) || undefined,
    isLate: (raw.isLate as boolean) || false,
    penaltyApplied: (raw.penaltyApplied as boolean) || false,
    confidence: (raw.confidence as number) || undefined,
    autoVerified: (raw.autoVerified as boolean) || false,
    cbeVerificationData: raw.cbeVerificationData as CbeTransactionData | undefined,
  };
}

function mapLotteryResult(raw: Record<string, unknown>): LotteryResultItem {
  const winner = raw.winner as Record<string, unknown> | undefined;
  const cycle = raw.cycle as Record<string, unknown> | undefined;
  const group = cycle?.group as Record<string, unknown> | undefined;
  const payout = raw.payout as Record<string, unknown> | undefined;
  const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);

  return {
    id: raw.id as string,
    groupName: (group?.name as string) || 'Unknown',
    groupId: (group?.id as string) || '',
    cycle: (cycle?.cycleNumber as number) || 0,
    cycleId: (cycle?.id as string) || '',
    winnerName: (winner?.name as string) || 'Unknown',
    winnerId: (raw.winnerId as string) || (winner?.id as string) || '',
    method: (raw.method as LotteryResultItem['method']) || 'RANDOM',
    status: (raw.status as LotteryDrawStatus) || 'CONFIRMED',
    attempt: (raw.attempt as number) ?? 1,
    amount: (raw.amountWon as number) || 0,
    adminFee: (raw.adminFeeAmount as number) ?? null,
    net: (raw.netAmount as number) ?? null,
    seed: (raw.seed as string) || null,
    resultHash: (raw.resultHash as string) || null,
    date: raw.drawnAt ? new Date(raw.drawnAt as string).toLocaleDateString('en-CA') : 'N/A',
    drawnAt: iso(raw.drawnAt) || '',
    drawnByName: (raw.drawnByName as string) || null,
    confirmedByName: (raw.confirmedByName as string) || null,
    confirmedAt: iso(raw.confirmedAt),
    voidedAt: iso(raw.voidedAt),
    voidReason: (raw.voidReason as string) || null,
    payout: payout
      ? {
          status: (payout.status as 'PENDING' | 'COMPLETED') || 'PENDING',
          amount: (payout.amount as number) ?? null,
          payoutDate: payout.payoutDate
            ? new Date(payout.payoutDate as string).toLocaleDateString('en-CA')
            : null,
        }
      : null,
  };
}

// ─── API Functions ───────────────────────────────────────────────────────────

// Auth
export const login = async (email: string, password: string) => {
  const response = await api.post('/auth/login', { email, password });
  return response.data;
};



export const changePassword = async (currentPassword: string, newPassword: string) => {
  const response = await api.post('/auth/change-password', { currentPassword, newPassword });
  return response.data;
};

export const forgotPasswordRequest = async (email: string) => {
  const response = await api.post('/auth/forgot-password-request', { email });
  return response.data as { message: string };
};

export interface PasswordResetRequest {
  id: string;
  requesterId: string;
  recipientId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionNote?: string;
  createdAt: string;
  updatedAt: string;
  requester: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

export const getPasswordResetRequests = async (): Promise<PasswordResetRequest[]> => {
  const response = await api.get('/auth/reset-password-requests');
  return response.data as PasswordResetRequest[];
};

export const approvePasswordReset = async (id: string, tempPassword: string): Promise<PasswordResetRequest> => {
  const response = await api.patch(`/auth/reset-password-requests/${id}/approve`, { tempPassword });
  return response.data as PasswordResetRequest;
};

export const rejectPasswordReset = async (id: string, rejectionNote?: string): Promise<PasswordResetRequest> => {
  const response = await api.patch(`/auth/reset-password-requests/${id}/reject`, { rejectionNote });
  return response.data as PasswordResetRequest;
};

// Admins
export const getAdmins = async () => {
  const response = await api.get('/admins');
  return response.data;
};

export const getAdminById = async (id: string) => {
  const response = await api.get(`/admins/${id}`);
  return response.data;
};

export const createAdmin = async (data: any) => {
  const response = await api.post('/admins', data);
  return response.data;
};

export const updateAdmin = async (id: string, data: any) => {
  const response = await api.patch(`/admins/${id}`, data);
  return response.data;
};

export const suspendAdmin = async (id: string) => {
  const response = await api.post(`/admins/${id}/suspend`);
  return response.data;
};

export const reactivateAdmin = async (id: string) => {
  const response = await api.post(`/admins/${id}/reactivate`);
  return response.data;
};

export const deleteAdmin = async (id: string) => {
  const response = await api.delete(`/admins/${id}`);
  return response.data;
};

export const assignAdminToGroup = async (id: string, data: any) => {
  const response = await api.post(`/admins/${id}/groups`, data);
  return response.data;
};

export const removeAdminFromGroup = async (id: string, groupId: string) => {
  const response = await api.delete(`/admins/${id}/groups/${groupId}`);
  return response.data;
};

// Dashboard
export const getDashboardStats = async (): Promise<DashboardStats> => {
  const response = await api.get('/dashboard/stats');
  return response.data;
};

export const getRecentActivity = async (): Promise<ActivityItem[]> => {
  const response = await api.get('/dashboard/activity');
  return response.data;
};

export const getDepositChart = async (): Promise<ChartDataItem[]> => {
  const response = await api.get('/dashboard/deposits-chart');
  return response.data;
};

// Groups
export const getGroups = async (): Promise<GroupListItem[]> => {
  const response = await api.get('/groups');
  return (response.data as Array<Record<string, unknown>>).map(mapGroupListItem);
};

export const getGroup = async (id: string): Promise<GroupDetail> => {
  const response = await api.get(`/groups/${id}`);
  return mapGroupDetail(response.data);
};

export const createGroup = async (data: {
  name: string;
  contributionAmount: number;
  cycleDuration: string;
  maxMembers: number;
  description?: string;
  lotteryMethod?: string;
  bankAccount?: string;
  bankName?: string;
  photoUrl?: string;
  endDate?: string;
  physicalAddress?: string;
  latitude?: number;
  longitude?: number;
  templateId?: string;
}) => {
  // Map frontend form values to backend DTO
  let cycleType: string;
  switch (data.cycleDuration?.toLowerCase()) {
    case 'weekly': cycleType = 'weekly'; break;
    case 'bi-weekly': cycleType = 'biweekly'; break;
    case 'monthly': cycleType = 'monthly'; break;
    default: cycleType = 'monthly';
  }

  const response = await api.post('/groups', {
    name: data.name,
    contributionAmount: data.contributionAmount,
    cycleType,
    maxMembers: data.maxMembers,
    lotteryMethod: data.lotteryMethod || 'RANDOM',
    description: data.description || undefined,
    bankAccount: data.bankAccount || undefined,
    bankName: data.bankName || undefined,
    photoUrl: data.photoUrl || undefined,
    endDate: data.endDate || undefined,
    physicalAddress: data.physicalAddress || undefined,
    latitude: data.latitude,
    longitude: data.longitude,
    templateId: data.templateId || undefined,
  });
  return response.data;
};

export const updateGroup = async (id: string, data: Record<string, unknown>) => {
  const response = await api.patch(`/groups/${id}`, data);
  return response.data;
};

export const addMemberToGroup = async (groupId: string, userId: string, shares?: number) => {
  const response = await api.post(`/groups/${groupId}/members`, { userId, shares });
  return response.data;
};


export const removeMemberFromGroup = async (groupId: string, userId: string) => {
  const response = await api.delete(`/groups/${groupId}/members/${userId}`);
  return response.data;
};

export const createCycle = async (groupId: string) => {
  const response = await api.post(`/groups/${groupId}/cycles`);
  return response.data;
};

// Group Rules
export const getGroupRules = async (groupId: string): Promise<GroupRules> => {
  const response = await api.get(`/groups/${groupId}/rules`);
  return response.data as GroupRules;
};

export const updateGroupRules = async (groupId: string, rules: Partial<GroupRules>): Promise<GroupRules> => {
  const response = await api.put(`/groups/${groupId}/rules`, rules);
  return response.data as GroupRules;
};

// Rule Templates
export const getRuleTemplates = async (): Promise<RuleTemplate[]> => {
  const response = await api.get('/rule-templates');
  return response.data as RuleTemplate[];
};

export const createRuleTemplate = async (data: Partial<RuleTemplate> & { name: string }): Promise<RuleTemplate> => {
  // Send only fields the template model persists — the loaded GroupRules row
  // also carries Prisma-only fields (allowMergedMembers, …) the backend would
  // otherwise reject.
  const {
    id: _id,
    groupId: _g,
    createdBy: _cb,
    createdAt: _ca,
    updatedAt: _ua,
    allowMergedMembers: _am,
    maxMergedMembersPerSlot: _mm,
    feeWaiverGracePeriodDays: _fw,
    ...payload
  } = data as RuleTemplate & {
    groupId?: string;
    allowMergedMembers?: boolean;
    maxMergedMembersPerSlot?: number;
    feeWaiverGracePeriodDays?: number;
  };
  const response = await api.post('/rule-templates', payload);
  return response.data as RuleTemplate;
};

export const deleteRuleTemplate = async (id: string) => {
  const response = await api.delete(`/rule-templates/${id}`);
  return response.data;
};

export const applyRuleTemplate = async (templateId: string, groupId: string) => {
  const response = await api.post(`/rule-templates/${templateId}/apply/${groupId}`);
  return response.data;
};

export const updateRuleTemplate = async (id: string, data: Partial<RuleTemplate>): Promise<RuleTemplate> => {
  const { id: _id, createdBy: _cb, createdAt: _ca, updatedAt: _ua, ...payload } = data as RuleTemplate;
  const response = await api.patch(`/rule-templates/${id}`, payload);
  return response.data as RuleTemplate;
};

// Notifications
export const getNotifications = async (filters?: { read?: string; type?: string }): Promise<NotificationItem[]> => {
  const params: Record<string, string> = {};
  if (filters?.read) params.read = filters.read;
  if (filters?.type) params.type = filters.type;
  const response = await api.get('/notifications', { params });
  return response.data as NotificationItem[];
};

export const getUnreadNotificationCount = async (): Promise<{ count: number }> => {
  const response = await api.get('/notifications/unread-count');
  return response.data as { count: number };
};

export const markNotificationRead = async (id: string) => {
  const response = await api.patch(`/notifications/${id}/read`);
  return response.data;
};

export const markAllNotificationsRead = async () => {
  const response = await api.patch('/notifications/read-all');
  return response.data;
};

export const deleteNotification = async (id: string) => {
  const response = await api.delete(`/notifications/${id}`);
  return response.data;
};

// Members
export const getMembers = async (): Promise<MemberListItem[]> => {
  const response = await api.get('/users');
  return (response.data as Array<Record<string, unknown>>).map(mapMemberListItem);
};

export const createMember = async (data: {
  name: string;
  phone: string;
  telegramId?: string;
  governmentId?: string;
  photoUrl?: string;
  employmentType?: string;
  employerName?: string;
  maritalStatus?: string;
  country?: string;
  city?: string;
  subCity?: string;
  woreda?: string;
  houseNumber?: string;
}) => {
  const payload: Record<string, unknown> = {
    name: data.name,
    phone: data.phone,
  };
  if (data.telegramId) payload.telegramId = data.telegramId;
  if (data.governmentId) payload.governmentId = data.governmentId;
  if (data.photoUrl) payload.photoUrl = data.photoUrl;
  if (data.employmentType) payload.employmentType = data.employmentType;
  if (data.employerName) payload.employerName = data.employerName;
  if (data.maritalStatus) payload.maritalStatus = data.maritalStatus;
  if (data.country) payload.country = data.country;
  if (data.city) payload.city = data.city;
  if (data.subCity) payload.subCity = data.subCity;
  if (data.woreda) payload.woreda = data.woreda;
  if (data.houseNumber) payload.houseNumber = data.houseNumber;

  const response = await api.post('/users', payload);
  return response.data;
};

export const getMember = async (id: string): Promise<UserDetail> => {
  const response = await api.get(`/users/${id}`);
  return mapUserDetail(response.data as Record<string, unknown>);
};

// ─── Authorized payer aliases (proxy payers: spouse, sibling, relative) ──────

export const getPayerAliases = async (userId: string): Promise<PayerAlias[]> => {
  const response = await api.get(`/users/${userId}/payer-aliases`);
  return (response.data as Array<Record<string, unknown>>).map((a) => ({
    id: a.id as string,
    name: a.name as string,
    note: (a.note as string | null | undefined) ?? null,
    createdAt: a.createdAt ? new Date(a.createdAt as string).toISOString() : '',
  }));
};

export const addPayerAlias = async (
  userId: string,
  name: string,
  note?: string,
): Promise<PayerAlias> => {
  const response = await api.post(`/users/${userId}/payer-aliases`, { name, note });
  const a = response.data as Record<string, unknown>;
  return {
    id: a.id as string,
    name: a.name as string,
    note: (a.note as string | null | undefined) ?? null,
    createdAt: a.createdAt ? new Date(a.createdAt as string).toISOString() : '',
  };
};

export const removePayerAlias = async (userId: string, aliasId: string): Promise<void> => {
  await api.delete(`/users/${userId}/payer-aliases/${aliasId}`);
};

export const updateMember = async (id: string, data: Record<string, unknown>) => {
  const response = await api.patch(`/users/${id}`, data);
  return response.data;
};

export const deleteUserWithPassword = async (id: string, password: string) => {
  const response = await api.post(`/users/${id}/delete`, { password });
  return response.data;
};

// Deposits / Receipts
export const getDeposits = async (filters?: {
  status?: string;
  groupId?: string;
}): Promise<ReceiptItem[]> => {
  const params: Record<string, string> = {};
  if (filters?.status) params.verificationStatus = filters.status.toUpperCase();
  if (filters?.groupId) params.groupId = filters.groupId;

  const response = await api.get('/deposits', { params });
  return (response.data as Array<Record<string, unknown>>).map(mapReceiptItem);
};

export const getGroupDeposits = async (groupId: string): Promise<DepositItem[]> => {
  const response = await api.get(`/groups/${groupId}/deposits`);
  return (response.data as Array<Record<string, unknown>>).map(mapDepositItem);
};

export const verifyDeposit = async (id: string) => {
  const response = await api.patch(`/deposits/${id}/verify`);
  return response.data;
};

export const rejectDeposit = async (id: string, reason?: string) => {
  const response = await api.patch(`/deposits/${id}/reject`, { reason });
  return response.data;
};

export interface CbeAutoVerifyResult {
  verified: boolean;
  result: {
    success: boolean;
    transaction?: CbeTransactionData;
    error?: string;
    accountMatched?: boolean;
    amountMatched?: boolean;
  };
  deposit: Record<string, unknown>;
}

/**
 * Auto-verify a deposit using CBE Direct API.
 * Uses the group's configured CBE receiver account number.
 */
export const autoVerifyDepositCbe = async (
  depositId: string,
  accountNumber?: string,
): Promise<CbeAutoVerifyResult> => {
  const response = await api.post(`/deposits/${depositId}/auto-verify-cbe`, {
    accountNumber,
  });
  return response.data as CbeAutoVerifyResult;
};

/**
 * Standalone CBE FT number lookup — does not modify any deposit.
 * Returns raw transaction data from CBE Direct.
 */
export const cbeLookup = async (
  ftNumber: string,
  accountNumber: string,
): Promise<CbeTransactionData> => {
  const response = await api.post('/deposits/cbe-lookup', { ftNumber, accountNumber });
  return response.data as CbeTransactionData;
};

// ─── Camera FT Scanner ────────────────────────────────────────────────────────

/**
 * Strips extended identifiers printed on some statements:
 * "FT24AB123456\BNK" -> "FT24AB123456". The suffix after the last "\",
 * "/" or "|" is never part of a real FT reference.
 */
export const normalizeFtNumber = (ft?: string | null): string | undefined => {
  if (!ft) return undefined;
  const trimmed = String(ft).trim().toUpperCase();
  if (!trimmed) return undefined;
  const lastSeparator = Math.max(
    trimmed.lastIndexOf('\\'),
    trimmed.lastIndexOf('/'),
    trimmed.lastIndexOf('|'),
  );
  const base = lastSeparator >= 0 ? trimmed.slice(0, lastSeparator) : trimmed;
  const clean = base.trim();
  return clean || undefined;
};

export interface FtScanResult {
  ftNumbers: string[];
  /** Payer / sender name per FT, read from the statement (pairing input) */
  senders?: Record<string, string>;
  /** Normalized (0–1) [x, y, w, h] location of each FT on the first photo,
   *  when the model reports them — powers the focus-box overlay */
  regions?: Record<string, [number, number, number, number]>;
  bankName?: string;
  confidence: number;
  detectedVia?: 'gemini-web' | 'gemini' | 'none';
  errors?: string[];
}

export type PairingTier = 'AUTO' | 'SUGGEST' | 'UNKNOWN';

export interface MemberSuggestion {
  userId: string;
  name: string;
  phone?: string;
  photoUrl?: string;
  membershipStatus?: string;
  score: number;
  matchedVia?: 'name' | 'bankAccountName' | 'history' | 'payerAlias';
  /** Strict tier: only deterministic identities (exact name/account/alias/history) */
  autoPaired?: boolean;
  /** Confident-but-not-exact: offered as a one-click accept chip, never applied */
  suggested?: boolean;
}

export interface SuggestMembersResult {
  payerName: string;
  tier: PairingTier;
  suggestions: MemberSuggestion[];
  bestMatch: MemberSuggestion | null;
}

// ─── Unknown Senders queue ──────────────────────────────────────────────────

export interface UnknownSenderItem {
  id: string;
  groupId: string;
  groupName: string;
  payerName: string;
  ftNumber: string | null;
  amount: number;
  bankName: string | null;
  transferDate: string | null;
  imageUrl: string | null;
  senderAccount?: string | null;
  reason: string | null;
  createdAt: string;
}

export interface QueueUnknownSenderPayload {
  groupId: string;
  payerName: string;
  amount: number;
  ftNumber?: string;
  transferDate?: string;
  senderAccount?: string;
  bankName?: string;
  imageUrl?: string;
  reason?: string;
  cbeData?: Record<string, unknown>;
}

export const queueUnknownSender = async (
  payload: QueueUnknownSenderPayload,
): Promise<UnknownSenderItem> => {
  const response = await api.post('/deposits/unknown-senders', payload);
  return response.data as UnknownSenderItem;
};

export const getUnknownSenders = async (groupId?: string): Promise<UnknownSenderItem[]> => {
  const response = await api.get('/deposits/unknown-senders', { params: groupId ? { groupId } : {} });
  return (response.data as Array<Record<string, unknown>>).map((raw) => {
    const group = raw.group as Record<string, unknown> | undefined;
    return {
      id: raw.id as string,
      groupId: (raw.groupId as string) || (group?.id as string) || '',
      groupName: (group?.name as string) || 'Unknown group',
      payerName: (raw.senderName as string) || 'Unknown payer',
      ftNumber: (raw.ftNumber as string) || null,
      amount: (raw.amount as number) || 0,
      bankName: (raw.bankName as string) || null,
      transferDate: raw.transferDate
        ? new Date(raw.transferDate as string).toLocaleDateString('en-CA')
        : null,
      imageUrl: (raw.imageUrl as string) || null,
      reason: (raw.reason as string) || null,
      createdAt: raw.createdAt ? new Date(raw.createdAt as string).toISOString() : '',
    };
  });
};

export const getUnknownSenderCount = async (): Promise<{ count: number }> => {
  const response = await api.get('/deposits/unknown-senders/count');
  return response.data as { count: number };
};

/** Resolve a queued sender: pair to an existing member, or quick-create one. */
export const resolveUnknownSender = async (
  id: string,
  resolution:
    | { userId: string }
    | {
        createMember: {
          name: string;
          phone: string;
          shares?: number;
          governmentId?: string;
        };
      },
): Promise<{
  deposit: { id: string };
  userId: string;
  createdMember: boolean;
  /** Pending entries from the same sender auto-paired by this action */
  autoFollowed?: number;
  /** Group rules the owner action overrode (e.g. guarantor pending) */
  ruleOverrides?: string[];
}> => {
  const response = await api.post(`/deposits/unknown-senders/${id}/resolve`, resolution);
  return response.data as {
    deposit: { id: string };
    userId: string;
    createdMember: boolean;
    autoFollowed?: number;
    ruleOverrides?: string[];
  };
};

export const dismissUnknownSender = async (id: string, note?: string): Promise<void> => {
  await api.post(`/deposits/unknown-senders/${id}/dismiss`, note ? { note } : {});
};

export interface CreateDepositPayload {
  cycleId: string;
  userId: string;
  groupId: string;
  /** Optional: manually-entered FTs verified against CBE have no photo */
  imageUrl?: string;
  ftNumber?: string;
  amount?: number;
  bankName?: string;
  depositDate?: string;
  senderName?: string;
  senderAccount?: string;
  receiverAccount?: string;
  branch?: string;
  narrative?: string;
  confidence?: number;
}

/**
 * Detect all CBE FT numbers visible on a bank statement / receipt photo
 * (multipart field "image"). Free pipeline: QR → text OCR → optional AI
 * (Gemini vision model).
 * When `accountNumber` is given, misread FT tokens are repaired and verified
 * against CBE. Does not create or modify deposits.
 */
/**
 * Detect FT numbers + payer names from one or more statement photos. Multiple
 * photos are sent together and read in a single (batched) provider call.
 */
export const scanFtNumbers = async (
  files: File | File[],
  accountNumber?: string,
): Promise<FtScanResult> => {
  const list = Array.isArray(files) ? files : [files];
  const formData = new FormData();
  for (const file of list) formData.append('images', file);
  if (accountNumber) formData.append('account', accountNumber);
  const response = await api.post('/deposits/ft-scan', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  });
  return response.data as FtScanResult;
};

/**
 * Fuzzy-match a bank-transaction payer name against a group's members.
 */
export const suggestMembers = async (
  groupId: string,
  payerName: string,
  senderAccount?: string,
): Promise<SuggestMembersResult> => {
  const response = await api.post('/deposits/suggest-members', {
    groupId,
    payerName,
    senderAccount: senderAccount || undefined,
  });
  return response.data as SuggestMembersResult;
};

/**
 * Create a deposit from the admin dashboard (e.g. camera FT scanner flow).
 * Returns the raw created deposit (with id) — call autoVerifyDepositCbe next.
 */
export const createDeposit = async (payload: CreateDepositPayload): Promise<{ id: string }> => {
  const response = await api.post('/deposits', payload);
  return response.data as { id: string };
};

/**
 * Update a group's CBE receiver account numbers.
 */
export const updateGroupCbeAccounts = async (
  groupId: string,
  cbeAccountNumbers: string[],
): Promise<unknown> => {
  const response = await api.patch(`/groups/${groupId}`, { cbeAccountNumbers });
  return response.data;
};

// Lottery
export const triggerLottery = async (
  groupId: string,
  method?: string,
): Promise<LotteryDrawPending> => {
  // Group-page quick draw: resolves the active cycle, then runs phase 1
  const group = await getGroup(groupId);
  const activeCycle = group.cycles?.find((c) => c.status === 'ACTIVE');
  if (!activeCycle) throw new Error('No active cycle found for this group');
  return drawLottery(activeCycle.id, method);
};

/** Phase 1 - spin the wheel server-side; returns a PENDING draw. */
export const drawLottery = async (
  cycleId: string,
  method?: string,
): Promise<LotteryDrawPending> => {
  const response = await api.post(`/lottery/draw/${cycleId}`, method ? { method } : {});
  return mapDrawPending(response.data as Record<string, unknown>);
};

/** Phase 2a - admin confirms the drawn winner (cycle completes, payout created). */
export const confirmLotteryDraw = async (resultId: string, groupId: string): Promise<void> => {
  await api.post(`/lottery/${resultId}/confirm`, { groupId });
};

/** Phase 2b - admin voids the pending draw and immediately re-runs it. */
export const redrawLotteryDraw = async (
  resultId: string,
  groupId: string,
): Promise<LotteryDrawPending> => {
  const response = await api.post(`/lottery/${resultId}/redraw`, { groupId });
  return mapDrawPending(response.data as Record<string, unknown>);
};

function mapDrawPending(d: Record<string, unknown>): LotteryDrawPending {
  const winner = d.winner as Record<string, unknown> | undefined;
  return {
    id: d.id as string,
    cycleId: d.cycleId as string,
    winnerId: d.winnerId as string,
    winnerName: (winner?.name as string) || 'Winner',
    method: (d.method as LotteryDrawPending['method']) || 'RANDOM',
    attempt: (d.attempt as number) ?? 1,
    status: 'PENDING',
    gross: (d.gross as number) ?? (d.amountWon as number) ?? 0,
    adminFee: (d.adminFee as number) ?? 0,
    net: (d.net as number) ?? 0,
    eligibleCount: (d.eligibleCount as number) ?? 0,
    amount: (d.amount as number) ?? (d.amountWon as number) ?? 0,
    seed: (d.seed as string) || null,
    resultHash: (d.resultHash as string) || null,
    awaitingConfirmation: true,
  };
}

/** Eligibility board - the exact member pool (with reasons) a draw uses. */
export const getLotteryEligibility = async (groupId: string): Promise<LotteryEligibility> => {
  const response = await api.get(`/lottery/eligibility/${groupId}`);
  return response.data as LotteryEligibility;
};

export const getLotteryResults = async (groupId?: string): Promise<LotteryResultItem[]> => {
  const params: Record<string, string> = {};
  if (groupId) params.groupId = groupId;

  const response = await api.get('/lottery/results', { params });
  return (response.data as Array<Record<string, unknown>>).map(mapLotteryResult);
};

// Penalties
export const getGroupPenalties = async (groupId: string): Promise<PenaltyRecord[]> => {
  const response = await api.get(`/groups/${groupId}/penalties`);
  return response.data as PenaltyRecord[];
};

export const payPenalty = async (penaltyId: string): Promise<PenaltyRecord> => {
  const response = await api.patch(`/groups/penalties/${penaltyId}/pay`);
  return response.data as PenaltyRecord;
};

export const waivePenalty = async (penaltyId: string, notes?: string): Promise<PenaltyRecord> => {
  const response = await api.patch(`/groups/penalties/${penaltyId}/waive`, { notes });
  return response.data as PenaltyRecord;
};

// Disputes
export const getGroupDisputes = async (groupId: string): Promise<DisputeItem[]> => {
  const response = await api.get(`/groups/${groupId}/disputes`);
  return response.data as DisputeItem[];
};

export const fileDispute = async (data: {
  groupId: string;
  againstUserId?: string;
  type: string;
  description: string;
}): Promise<DisputeItem> => {
  const response = await api.post(`/groups/${data.groupId}/disputes`, {
    againstUserId: data.againstUserId,
    type: data.type,
    description: data.description,
  });
  return response.data as DisputeItem;
};

export const resolveDispute = async (
  disputeId: string,
  resolution: string,
  status?: string,
): Promise<DisputeItem> => {
  const response = await api.patch(`/groups/disputes/${disputeId}/resolve`, {
    resolution,
    status,
  });
  return response.data as DisputeItem;
};

// Turn Swaps
export const requestTurnSwap = async (data: {
  groupId: string;
  targetId: string;
  reason?: string;
}): Promise<TurnSwapRequest> => {
  const response = await api.post('/lottery/swap', data);
  return response.data as TurnSwapRequest;
};

export const respondTurnSwap = async (
  swapId: string,
  approve: boolean,
): Promise<{ success: boolean }> => {
  const response = await api.post(`/lottery/swap/${swapId}/respond`, { approve });
  return response.data as { success: boolean };
};

export const getGroupTurnSwaps = async (groupId: string): Promise<TurnSwapRequest[]> => {
  const response = await api.get(`/lottery/swap/group/${groupId}`);
  return response.data as TurnSwapRequest[];
};

export const getUserTurnSwaps = async (): Promise<TurnSwapRequest[]> => {
  const response = await api.get('/lottery/swap/user');
  return response.data as TurnSwapRequest[];
};

export const uploadPhoto = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/uploads/photo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return (response.data as { url: string }).url;
};

// ─── Member Dues & Shares ─────────────────────────────────────────────────────

export interface MemberDueCalculation {
  userId: string;
  userName: string;
  contributionDue: number;
  adminFeeDue: number;
  totalDue: number;
  shares: number;
  isMerged: boolean;
  mergedGroupName?: string;
}

export const getGroupMemberDues = async (groupId: string): Promise<MemberDueCalculation[]> => {
  const response = await api.get(`/groups/${groupId}/member-dues`);
  return response.data as MemberDueCalculation[];
};

export const getMemberDue = async (groupId: string, userId: string): Promise<MemberDueCalculation> => {
  const response = await api.get(`/groups/${groupId}/member-dues/${userId}`);
  return response.data as MemberDueCalculation;
};

export const updateMemberShares = async (groupId: string, userId: string, shares: number) => {
  const response = await api.patch(`/groups/${groupId}/members/${userId}/shares`, { shares });
  return response.data;
};

// ─── Merged Member Groups (ድርሻ ማጣመር) ────────────────────────────────────────

export interface MergedMemberSlotItem {
  id: string;
  userId: string;
  sharePercentage: number;
  status: 'ACTIVE' | 'LEFT' | 'REMOVED';
  joinedAt: string;
  leftAt?: string;
  user: { id: string; name: string; phone: string };
}

export interface MergedGroupItem {
  id: string;
  groupId: string;
  name: string;
  totalShares: number;
  maxMembers: number;
  status: 'ACTIVE' | 'DISSOLVED';
  createdAt: string;
  updatedAt: string;
  slots: MergedMemberSlotItem[];
}

export const getMergedGroups = async (groupId: string): Promise<MergedGroupItem[]> => {
  const response = await api.get(`/groups/${groupId}/merged-groups`);
  return response.data as MergedGroupItem[];
};

export const createMergedGroup = async (data: {
  groupId: string;
  name?: string;
  userIds: string[];
  totalShares?: number;
}): Promise<MergedGroupItem> => {
  const response = await api.post(`/groups/${data.groupId}/merged-groups`, {
    name: data.name,
    userIds: data.userIds,
    totalShares: data.totalShares,
  });
  return response.data as MergedGroupItem;
};

export const addMergedGroupMember = async (mergedGroupId: string, userId: string): Promise<MergedGroupItem> => {
  const response = await api.post(`/groups/merged-groups/${mergedGroupId}/members`, { userId });
  return response.data as MergedGroupItem;
};

export const removeMergedGroupMember = async (mergedGroupId: string, userId: string): Promise<MergedGroupItem> => {
  const response = await api.delete(`/groups/merged-groups/${mergedGroupId}/members/${userId}`);
  return response.data as MergedGroupItem;
};

export const dissolveMergedGroup = async (mergedGroupId: string): Promise<MergedGroupItem> => {
  const response = await api.post(`/groups/merged-groups/${mergedGroupId}/dissolve`);
  return response.data as MergedGroupItem;
};

export const updateMergedGroupPercentages = async (
  mergedGroupId: string,
  percentages: Array<{ userId: string; sharePercentage: number }>,
): Promise<MergedGroupItem> => {
  const response = await api.patch(`/groups/merged-groups/${mergedGroupId}/percentages`, { percentages });
  return response.data as MergedGroupItem;
};

// ─── Merged Group Deposit Tracking ────────────────────────────────────────────

export interface MergedMemberDepositStatusItem {
  userId: string;
  userName: string;
  expectedContribution: number;
  expectedAdminFee: number;
  expectedTotal: number;
  paidAmount: number;
  status: 'PAID' | 'PARTIAL' | 'UNPAID' | 'LATE';
}

export interface ComplianceResult {
  penaltiesCreated: Array<{ userId: string; userName: string; amount: number }>;
  alreadyCompliant: string[];
}

export const getMergedGroupDepositStatus = async (mergedGroupId: string): Promise<MergedMemberDepositStatusItem[]> => {
  const response = await api.get(`/groups/merged-groups/${mergedGroupId}/deposit-status`);
  return response.data as MergedMemberDepositStatusItem[];
};

export const enforceMergedMemberCompliance = async (mergedGroupId: string): Promise<ComplianceResult> => {
  const response = await api.post(`/groups/merged-groups/${mergedGroupId}/enforce-compliance`);
  return response.data as ComplianceResult;
};

// ─── Merged Group Deposit History ─────────────────────────────────────────────

export interface MemberCycleDepositItem {
  userId: string;
  userName: string;
  expectedContribution: number;
  expectedAdminFee: number;
  expectedTotal: number;
  paidAmount: number;
  status: 'PAID' | 'PARTIAL' | 'UNPAID' | 'LATE';
}

export interface CycleDepositRecordItem {
  cycleId: string;
  cycleNumber: number;
  startDate: string;
  endDate: string;
  cycleStatus: string;
  members: MemberCycleDepositItem[];
  totalExpected: number;
  totalPaid: number;
}

export interface MergedGroupDepositHistoryItem {
  mergedGroupId: string;
  mergedGroupName: string;
  groupName: string;
  currency: string;
  totalShares: number;
  cycles: CycleDepositRecordItem[];
}

export const getMergedGroupDepositHistory = async (mergedGroupId: string): Promise<MergedGroupDepositHistoryItem> => {
  const response = await api.get(`/groups/merged-groups/${mergedGroupId}/deposit-history`);
  return response.data as MergedGroupDepositHistoryItem;
};

// ─── Admin Fee Waivers ────────────────────────────────────────────────────────

export interface FeeWaiverItem {
  id: string;
  groupId: string;
  userId: string;
  reason: string;
  durationCycles: number;
  cyclesUsed: number;
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
  missedAfterExpiry: number;
  grantedBy: string;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; name: string; phone: string };
}

export const getGroupFeeWaivers = async (groupId: string): Promise<FeeWaiverItem[]> => {
  const response = await api.get(`/groups/${groupId}/fee-waivers`);
  return response.data as FeeWaiverItem[];
};

export const grantFeeWaiver = async (data: {
  groupId: string;
  userId: string;
  reason: string;
  durationCycles: number;
}): Promise<FeeWaiverItem> => {
  const response = await api.post(`/groups/${data.groupId}/fee-waivers`, {
    userId: data.userId,
    reason: data.reason,
    durationCycles: data.durationCycles,
  });
  return response.data as FeeWaiverItem;
};

export const cancelFeeWaiver = async (waiverId: string): Promise<FeeWaiverItem> => {
  const response = await api.patch(`/groups/fee-waivers/${waiverId}/cancel`);
  return response.data as FeeWaiverItem;
};

// ─── Guarantors (Wase / ዋስ) ──────────────────────────────────────────────────

export interface GuarantorItem {
  id: string;
  groupId: string;
  guarantorUserId: string;
  guaranteedUserId: string;
  status: 'ACTIVE' | 'RELEASED' | 'CALLED';
  notes?: string;
  createdAt: string;
  updatedAt: string;
  guarantorUser: { id: string; name: string; phone: string };
  guaranteedUser: { id: string; name: string; phone: string };
}

export const getGroupGuarantors = async (groupId: string): Promise<GuarantorItem[]> => {
  const response = await api.get(`/groups/${groupId}/guarantors`);
  return response.data as GuarantorItem[];
};

export const addGuarantor = async (data: {
  groupId: string;
  guarantorUserId: string;
  guaranteedUserId: string;
  notes?: string;
}): Promise<GuarantorItem> => {
  const response = await api.post(`/groups/${data.groupId}/guarantors`, {
    guarantorUserId: data.guarantorUserId,
    guaranteedUserId: data.guaranteedUserId,
    notes: data.notes,
  });
  return response.data as GuarantorItem;
};

export const updateGuarantorStatus = async (
  guarantorId: string,
  status: 'ACTIVE' | 'RELEASED' | 'CALLED',
  notes?: string,
): Promise<GuarantorItem> => {
  const response = await api.patch(`/groups/guarantors/${guarantorId}/status`, { status, notes });
  return response.data as GuarantorItem;
};

export const deleteGuarantor = async (guarantorId: string): Promise<{ success: boolean }> => {
  const response = await api.delete(`/groups/guarantors/${guarantorId}`);
  return response.data as { success: boolean };
};

// ─── Trash / Recycle Bin ─────────────────────────────────────────────────────

export const getTrashGroups = async (): Promise<GroupListItem[]> => {
  const response = await api.get('/groups/trash');
  return (response.data as Array<Record<string, unknown>>).map(mapGroupListItem);
};

export const softDeleteGroup = async (id: string): Promise<{ success: boolean }> => {
  const response = await api.delete(`/groups/${id}`);
  return response.data;
};

export const restoreGroup = async (id: string): Promise<{ success: boolean }> => {
  const response = await api.post(`/groups/${id}/restore`);
  return response.data;
};

export const permanentDeleteGroup = async (id: string): Promise<{ success: boolean }> => {
  const response = await api.delete(`/groups/${id}/permanent`);
  return response.data;
};

// ─── Group Leaders ───────────────────────────────────────────────────────────

export interface GroupLeaderItem {
  id: string;
  groupId: string;
  adminId: string;
  canManageMembers: boolean;
  canManageDeposits: boolean;
  canTriggerLottery: boolean;
  canManageRules: boolean;
  admin: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

export const getGroupLeaders = async (groupId: string): Promise<GroupLeaderItem[]> => {
  const response = await api.get(`/groups/${groupId}/leaders`);
  return response.data as GroupLeaderItem[];
};

export const assignGroupLeader = async (
  groupId: string,
  data: {
    adminId: string;
    canManageMembers?: boolean;
    canManageDeposits?: boolean;
    canTriggerLottery?: boolean;
    canManageRules?: boolean;
  }
): Promise<GroupLeaderItem> => {
  const response = await api.post(`/groups/${groupId}/leaders`, data);
  return response.data as GroupLeaderItem;
};

export const updateGroupLeader = async (
  groupId: string,
  leaderId: string,
  data: {
    canManageMembers?: boolean;
    canManageDeposits?: boolean;
    canTriggerLottery?: boolean;
    canManageRules?: boolean;
  }
): Promise<GroupLeaderItem> => {
  const response = await api.patch(`/groups/${groupId}/leaders/${leaderId}`, data);
  return response.data as GroupLeaderItem;
};

export const removeGroupLeader = async (groupId: string, leaderId: string): Promise<{ success: boolean }> => {
  const response = await api.delete(`/groups/${groupId}/leaders/${leaderId}`);
  return response.data as { success: boolean };
};

// ─── Admin Users ─────────────────────────────────────────────────────────────

export interface AdminUserItem {
  id: string;
  name: string;
  email: string;
  role: string;
}

export const getAdminUsers = async (): Promise<AdminUserItem[]> => {
  const response = await api.get('/auth/admins');
  return response.data as AdminUserItem[];
};

// ─── System Settings (super admin) ────────────────────────────────────────────

export interface GeminiSettingStatus {
  configured: boolean;
  source: 'database' | 'environment' | null;
  keyHint: string | null;   // masked, e.g. "AIza…abc4" (first key)
  keyHints?: string[];      // masked hints for every key in the pool
  keysCount?: number;       // pool size — requests round-robin across them
  updatedAt: string | null; // ISO string
}

export interface GeminiWebStatus {
  configured: boolean;
  baseUrl: string | null;
  model: string;
  enabled: boolean;
  hasKey: boolean;
}

export interface AiSettingsStatus {
  gemini: GeminiSettingStatus;
  geminiWeb: GeminiWebStatus;
}

export const getAiSettings = async (): Promise<AiSettingsStatus> => {
  const response = await api.get('/settings/ai');
  return response.data as AiSettingsStatus;
};

export const setGeminiKey = async (apiKey: string): Promise<GeminiSettingStatus & { success: boolean }> => {
  const response = await api.put('/settings/gemini', { apiKey });
  return response.data as GeminiSettingStatus & { success: boolean };
};

export const clearGeminiKey = async (): Promise<GeminiSettingStatus & { success: boolean }> => {
  const response = await api.delete('/settings/gemini');
  return response.data as GeminiSettingStatus & { success: boolean };
};

/** Tests the typed key when given (before saving), otherwise the saved one. */
export const testGeminiKey = async (apiKey?: string): Promise<{ ok: boolean; message: string }> => {
  const response = await api.post('/settings/gemini/test', { apiKey });
  return response.data as { ok: boolean; message: string };
};

// ---- Gemini Web proxy (self-hosted OpenAI-compatible endpoint) --------------

export interface GeminiWebConfig {
  baseUrl: string;
  apiKey?: string;
  model?: string;
  enabled?: boolean;
}

export const setGeminiWeb = async (
  cfg: GeminiWebConfig,
): Promise<{ success: boolean; geminiWeb: GeminiWebStatus }> => {
  const response = await api.put('/settings/gemini-web', cfg);
  return response.data as { success: boolean; geminiWeb: GeminiWebStatus };
};

export const clearGeminiWeb = async (): Promise<{ success: boolean; geminiWeb: GeminiWebStatus }> => {
  const response = await api.delete('/settings/gemini-web');
  return response.data as { success: boolean; geminiWeb: GeminiWebStatus };
};

export const testGeminiWeb = async (): Promise<{ ok: boolean; message: string }> => {
  const response = await api.post('/settings/gemini-web/test', {});
  return response.data as { ok: boolean; message: string };
};

export default api;
