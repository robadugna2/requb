'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, UserCheck, Receipt, CircleDollarSign, ArrowRight, AlertCircle,
  RefreshCw, Plus, Trophy, ShieldAlert, Gavel, CheckCircle, XCircle,
  Activity, Zap, BarChart2,
} from 'lucide-react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  AreaChart, Area, BarChart, Bar, Legend,
} from 'recharts';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  getDashboardStats, getRecentActivity, getDepositChart,
  getDeposits, getLotteryResults, getGroups,
  verifyDeposit, rejectDeposit,
} from '@/lib/api';
import type { DashboardStats, ActivityItem, ChartDataItem, ReceiptItem, LotteryResultItem, GroupListItem } from '@/lib/api';
import { useLanguage } from '@/components/layout/LanguageContext';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

function getEthiopianDateString() {
  const now = new Date();
  const etMonths = [
    'Meskerem (መስከረም)', 'Tekemt (ጥቅምት)', 'Hidar (ህዳር)', 'Tahsas (ታኅሣሥ)',
    'Ter (ጥር)', 'Yekatit (የካቲት)', 'Megabit (መጋቢት)', 'Miazia (ሚያዝያ)',
    'Ginbot (ግንቦት)', 'Sene (ሰኔ)', 'Hamle (ሐምሌ)', 'Nehase (ነሐሴ)', 'Pagumen (ጳጉሜን)'
  ];
  const referenceMs = new Date(2023, 8, 12).getTime();
  const diffDays = Math.floor((now.getTime() - referenceMs) / (24 * 60 * 60 * 1000));
  const cycleDays = 4 * 365 + 1;
  const cycleIndex = Math.floor(diffDays / cycleDays);
  const cycleRemainder = diffDays % cycleDays;
  let subYear = Math.floor(cycleRemainder / 365);
  if (subYear === 4) subYear = 3;
  const yearRemainder = cycleRemainder - (subYear * 365);
  let mIdx = Math.floor(yearRemainder / 30);
  let dVal = (yearRemainder % 30) + 1;
  if (mIdx > 12) {
    mIdx = 12;
    dVal = yearRemainder - (12 * 30) + 1;
  }
  const calculatedYear = 2016 + (cycleIndex * 4) + subYear;
  const monthName = etMonths[mIdx] || 'Sene (ሰኔ)';
  return `${monthName} ${dVal}, ${calculatedYear} ዓ.ም`;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function activityIcon(type: string) {
  const map: Record<string, { icon: React.ReactNode; bg: string; text: string }> = {
    deposit: { icon: <CircleDollarSign className="h-4 w-4" />, bg: 'bg-emerald-100', text: 'text-emerald-600' },
    verification: { icon: <CheckCircle className="h-4 w-4" />, bg: 'bg-blue-100', text: 'text-blue-600' },
    lottery: { icon: <Trophy className="h-4 w-4" />, bg: 'bg-amber-100', text: 'text-amber-600' },
    penalty: { icon: <ShieldAlert className="h-4 w-4" />, bg: 'bg-rose-100', text: 'text-rose-600' },
    dispute: { icon: <Gavel className="h-4 w-4" />, bg: 'bg-violet-100', text: 'text-violet-600' },
  };
  return map[type] ?? { icon: <Activity className="h-4 w-4" />, bg: 'bg-gray-100', text: 'text-gray-500' };
}

export default function DashboardPage() {
  const { t } = useLanguage();
  const [stats, setStats] = useState<DashboardStats>({ totalGroups: 0, activeMembers: 0, pendingReceipts: 0, totalCollected: 'ETB 0' });
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [chartData, setChartData] = useState<ChartDataItem[]>([]);
  const [pending, setPending] = useState<ReceiptItem[]>([]);
  const [winners, setWinners] = useState<LotteryResultItem[]>([]);
  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<Record<string, 'verifying' | 'rejecting'>>({});
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [s, a, c, p, w, g] = await Promise.allSettled([
        getDashboardStats(),
        getRecentActivity(),
        getDepositChart(),
        getDeposits({ status: 'pending' }),
        getLotteryResults(),
        getGroups(),
      ]);
      if (s.status === 'fulfilled') setStats(s.value);
      if (a.status === 'fulfilled') setActivity(a.value);
      if (c.status === 'fulfilled') setChartData(c.value);
      if (p.status === 'fulfilled') setPending(p.value.slice(0, 5));
      if (w.status === 'fulfilled') setWinners(w.value.slice(0, 5));
      if (g.status === 'fulfilled') setGroups(g.value);
      if (s.status === 'rejected' && a.status === 'rejected') {
        setError('Failed to load dashboard data. Please check your connection.');
      }
    } catch {
      setError('Failed to load dashboard data.');
    }
  }, []);

  useEffect(() => { fetchAll().finally(() => setLoading(false)); }, [fetchAll]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  };

  const handleVerify = async (id: string) => {
    setVerifying(v => ({ ...v, [id]: 'verifying' }));
    try { await verifyDeposit(id); setPending(p => p.filter(r => r.id !== id)); } finally { setVerifying(v => { const n = { ...v }; delete n[id]; return n; }); }
  };

  const handleReject = async (id: string) => {
    setVerifying(v => ({ ...v, [id]: 'rejecting' }));
    try { await rejectDeposit(id); setPending(p => p.filter(r => r.id !== id)); } finally { setVerifying(v => { const n = { ...v }; delete n[id]; return n; }); }
  };

  const activeGroups = groups.filter(g => g.status === 'active').length;
  const activeGroupsPct = groups.length ? Math.round((activeGroups / groups.length) * 100) : 0;
  const groupChartData = groups.slice(0, 8).map(g => ({
    name: g.name.length > 10 ? g.name.slice(0, 10) + '…' : g.name,
    members: g.membersCount,
    max: g.maxMembers,
  }));

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-8 w-24" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Skeleton className="lg:col-span-4 h-96 rounded-xl" />
            <Skeleton className="lg:col-span-3 h-96 rounded-xl" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {error && (
        <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="font-bold hover:text-red-900">×</button>
        </div>
      )}

      <div className="flex-1 space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between space-y-2 sm:space-y-0">
          <h2 className="text-3xl font-bold tracking-tight">{greeting()}, {stats.user?.name || 'Admin'} 👋</h2>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground mr-2 hidden md:inline-block">
              {getEthiopianDateString()}
            </span>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-4">
            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t('db.stat_groups')}</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalGroups}</div>
                  <p className="text-xs text-muted-foreground mt-1">Total Equb Groups</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t('db.stat_members')}</CardTitle>
                  <UserCheck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.activeMembers}</div>
                  <p className="text-xs text-muted-foreground mt-1">Active participants</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t('db.stat_receipts')}</CardTitle>
                  <Receipt className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.pendingReceipts}</div>
                  <p className="text-xs text-muted-foreground mt-1">Awaiting verification</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t('db.stat_collected')}</CardTitle>
                  <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalCollected}</div>
                  <p className="text-xs text-muted-foreground mt-1">Total deposits processed</p>
                </CardContent>
              </Card>
            </div>

            {/* Main Row: Chart + Recent Activity */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
              <Card className="lg:col-span-4">
                <CardHeader>
                  <CardTitle>{t('db.chart_title')}</CardTitle>
                  <CardDescription>{t('db.chart_subtitle')}</CardDescription>
                </CardHeader>
                <CardContent className="pl-2">
                  <div className="h-[300px] w-full">
                    {chartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorDeposits" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                          <RechartsTooltip contentStyle={{ borderRadius: '8px' }} />
                          <Area type="monotone" dataKey="deposits" stroke="#4f46e5" strokeWidth={2} fillOpacity={1} fill="url(#colorDeposits)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center flex-col text-muted-foreground">
                        <BarChart2 className="h-10 w-10 mb-2 opacity-50" />
                        <p>No data available</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle>{t('db.activity_title')}</CardTitle>
                  <CardDescription>Recent actions across the platform.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {activity.length > 0 ? activity.map(item => {
                      const { icon, bg, text } = activityIcon(item.type);
                      return (
                        <div key={item.id} className="flex items-center">
                          <span className={`relative flex h-9 w-9 items-center justify-center rounded-full ${bg} ${text} mr-4`}>
                            {icon}
                          </span>
                          <div className="ml-4 space-y-1">
                            <p className="text-sm font-medium leading-none">{item.message}</p>
                            <p className="text-sm text-muted-foreground">{item.time}</p>
                          </div>
                        </div>
                      );
                    }) : (
                      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                        <Activity className="h-8 w-8 mb-2 opacity-50" />
                        <p className="text-sm">No recent activity found.</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Second Row: Traditional Equb Insights & Pending Receipts */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
              {/* Traditional Equb Panel */}
              <Card className="lg:col-span-4 bg-zinc-950 text-white overflow-hidden border-zinc-800">
                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">Active System</Badge>
                  </div>
                  <CardTitle className="text-xl">{t('db.traditional_metrics_title')}</CardTitle>
                  <CardDescription className="text-zinc-400">
                    {t('db.traditional_metrics_desc')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-zinc-800">
                    <div>
                      <p className="text-xs text-zinc-400">{t('db.active_wase')}</p>
                      <p className="text-lg font-bold mt-1">{t('db.guarantees_value')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400">{t('db.emergency_skips')}</p>
                      <p className="text-lg font-bold mt-1">{t('db.requests_value')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400">{t('db.coffee_mode')}</p>
                      <p className="text-lg font-bold mt-1">{t('db.groups_value')}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400">{t('db.auction_equb')}</p>
                      <p className="text-lg font-bold mt-1">{t('db.disbursed_value')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Pending Receipts Card */}
              <Card className="lg:col-span-3">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="space-y-1">
                    <CardTitle>Pending Receipts</CardTitle>
                    <CardDescription>Awaiting verification</CardDescription>
                  </div>
                  <Link href="/receipts">
                    <Button variant="ghost" size="sm">View all</Button>
                  </Link>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {pending.length > 0 ? pending.map(r => (
                      <div key={r.id} className="flex items-center justify-between rounded-lg border p-3">
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-medium leading-none">{r.memberName}</p>
                          <p className="text-xs text-muted-foreground">{r.groupName} · ETB {r.amount.toLocaleString()}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="icon" variant="outline" className="h-8 w-8 text-emerald-600 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-700" onClick={() => handleVerify(r.id)} disabled={!!verifying[r.id]}>
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="outline" className="h-8 w-8 text-red-600 border-red-200 bg-red-50 hover:bg-red-100 hover:text-red-700" onClick={() => handleReject(r.id)} disabled={!!verifying[r.id]}>
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )) : (
                      <div className="flex items-center justify-center py-6 text-muted-foreground">
                        <p className="text-sm">No pending receipts.</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Group Utilization Analytics</CardTitle>
                <CardDescription>Members vs Capacity across groups</CardDescription>
              </CardHeader>
              <CardContent className="pl-2">
                <div className="h-[350px] w-full">
                  {groupChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={groupChartData} barGap={4}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                        <RechartsTooltip contentStyle={{ borderRadius: '8px' }} />
                        <Legend wrapperStyle={{ fontSize: 12, paddingTop: '20px' }} />
                        <Bar dataKey="members" fill="#4f46e5" radius={[4,4,0,0]} name="Members" />
                        <Bar dataKey="max" fill="#9ca3af" opacity={0.3} radius={[4,4,0,0]} name="Max Capacity" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">No group data</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
