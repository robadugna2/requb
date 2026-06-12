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
    return Promise.reject(error);
  }
);

// ─── UI Types ────────────────────────────────────────────────────────────────

export interface GroupListItem {
  id: string;
  name: string;
  membersCount: number;
  maxMembers: number;
  contributionAmount: number;
  status: 'active' | 'inactive' | 'completed';
  cycleDuration: string;
  currentCycle: number;
  totalCycles: number;
  createdAt: string;
}

export interface GroupDetail {
  id: string;
  name: string;
  description?: string;
  membersCount: number;
  maxMembers: number;
  contributionAmount: number;
  status: 'active' | 'inactive' | 'completed';
  cycleDuration: string;
  currentCycle: number;
  totalCycles: number;
  members: GroupMember[];
  nextDrawDate?: string;
}

export interface GroupMember {
  id: string;
  name: string;
  phone: string;
  photoUrl?: string;
  telegramId?: string;
  hasWon: boolean;
  cycleWon?: number;
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
}

export interface UserDetail {
  id: string;
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
  createdAt: string;
  updatedAt: string;
  groups: UserGroupMembership[];
  deposits: UserDepositRecord[];
  lotteryWins: UserLotteryWin[];
  totalDeposits: number;
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
  amount: number;
  status: 'verified' | 'pending' | 'rejected';
  date: string;
  receiptImageUrl?: string;
  ocrData?: {
    bankName: string;
    transactionRef: string;
    extractedAmount: number;
    extractedDate: string;
  };
}

export interface DepositItem {
  id: string;
  memberName: string;
  amount: number;
  status: 'verified' | 'pending' | 'rejected';
  date: string;
  receiptUrl?: string;
}

export interface LotteryResultItem {
  id: string;
  groupName: string;
  groupId: string;
  cycle: number;
  winnerName: string;
  amount: number;
  date: string;
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
    membersCount,
    maxMembers: raw.maxMembers as number,
    contributionAmount: raw.contributionAmount as number,
    status: mapStatusToLower(raw.status as string),
    cycleDuration: mapCycleTypeToDisplay(raw.cycleType as string),
    currentCycle,
    totalCycles: raw.maxMembers as number,
    createdAt: raw.createdAt as string,
  };
}

function mapGroupDetail(raw: Record<string, unknown>): GroupDetail {
  const memberships = raw.memberships as Array<Record<string, unknown>> | undefined;
  const cycles = raw.cycles as Array<Record<string, unknown>> | undefined;

  const latestCycle = cycles?.[0];
  const currentCycle = (latestCycle?.cycleNumber as number) ?? 0;

  // Build winner set from lottery results across all cycles
  const winnerMap = new Map<string, number>();
  if (cycles) {
    for (const cycle of cycles) {
      const lr = cycle.lotteryResult as Record<string, unknown> | undefined;
      if (lr) {
        const winner = lr.winner as Record<string, unknown> | undefined;
        const winnerId = (lr.winnerId as string) || (winner?.id as string);
        if (winnerId) {
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
      };
    });

  // Calculate next draw date from latest active cycle's end date
  let nextDrawDate: string | undefined;
  if (latestCycle && (latestCycle.status as string) === 'ACTIVE') {
    nextDrawDate = (latestCycle.endDate as string)?.split('T')[0];
  }

  return {
    id: raw.id as string,
    name: raw.name as string,
    description: raw.description as string | undefined,
    membersCount: members.length,
    maxMembers: raw.maxMembers as number,
    contributionAmount: raw.contributionAmount as number,
    status: mapStatusToLower(raw.status as string),
    cycleDuration: mapCycleTypeToDisplay(raw.cycleType as string),
    currentCycle,
    totalCycles: raw.maxMembers as number,
    members,
    nextDrawDate,
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
    };
  });

  const depositRecords: UserDepositRecord[] = (deposits || []).map((d) => {
    const cycle = d.cycle as Record<string, unknown> | undefined;
    const group = cycle?.group as Record<string, unknown> | undefined;
    return {
      id: d.id as string,
      groupName: (group?.name as string) || 'Unknown',
      cycleNumber: (cycle?.cycleNumber as number) || 0,
      amount: (d.amount as number) || 0,
      status: mapVerificationStatus(d.verificationStatus as string),
      date: d.createdAt ? new Date(d.createdAt as string).toLocaleDateString('en-CA') : 'N/A',
      imageUrl: d.imageUrl as string | undefined,
    };
  });

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
    amount: (raw.amount as number) || (group?.contributionAmount as number) || 0,
    status: mapVerificationStatus(raw.verificationStatus as string),
    date: raw.createdAt ? new Date(raw.createdAt as string).toLocaleDateString('en-CA') : 'N/A',
    receiptImageUrl: raw.imageUrl as string | undefined,
    ocrData,
  };
}

function mapDepositItem(raw: Record<string, unknown>): DepositItem {
  const user = raw.user as Record<string, unknown> | undefined;

  return {
    id: raw.id as string,
    memberName: (user?.name as string) || 'Unknown',
    amount: (raw.amount as number) || 0,
    status: mapVerificationStatus(raw.verificationStatus as string),
    date: raw.createdAt ? new Date(raw.createdAt as string).toLocaleDateString('en-CA') : 'N/A',
    receiptUrl: raw.imageUrl as string | undefined,
  };
}

function mapLotteryResult(raw: Record<string, unknown>): LotteryResultItem {
  const winner = raw.winner as Record<string, unknown> | undefined;
  const cycle = raw.cycle as Record<string, unknown> | undefined;
  const group = cycle?.group as Record<string, unknown> | undefined;

  return {
    id: raw.id as string,
    groupName: (group?.name as string) || 'Unknown',
    groupId: (group?.id as string) || '',
    cycle: (cycle?.cycleNumber as number) || 0,
    winnerName: (winner?.name as string) || 'Unknown',
    amount: (raw.amountWon as number) || 0,
    date: raw.drawnAt ? new Date(raw.drawnAt as string).toLocaleDateString('en-CA') : 'N/A',
  };
}

// ─── API Functions ───────────────────────────────────────────────────────────

// Auth
export const login = async (email: string, password: string) => {
  const response = await api.post('/auth/login', { email, password });
  return response.data;
};

export const register = async (email: string, password: string, name: string) => {
  const response = await api.post('/auth/register', { email, password, name });
  return response.data;
};

export const changePassword = async (currentPassword: string, newPassword: string) => {
  const response = await api.post('/auth/change-password', { currentPassword, newPassword });
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
  });
  return response.data;
};

export const updateGroup = async (id: string, data: Record<string, unknown>) => {
  const response = await api.patch(`/groups/${id}`, data);
  return response.data;
};

export const addMemberToGroup = async (groupId: string, userId: string) => {
  const response = await api.post(`/groups/${groupId}/members`, { userId });
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
  const { id: _id, createdBy: _cb, createdAt: _ca, updatedAt: _ua, ...payload } = data as RuleTemplate;
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

// Lottery
export const triggerLottery = async (groupId: string): Promise<{ winner: { name: string }; amount: number }> => {
  const response = await api.post(`/groups/${groupId}/lottery`);
  const data = response.data as Record<string, unknown>;
  const winner = data.winner as Record<string, unknown> | undefined;
  return {
    winner: { name: (winner?.name as string) || 'Winner' },
    amount: (data.amountWon as number) || 0,
  };
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

export default api;

