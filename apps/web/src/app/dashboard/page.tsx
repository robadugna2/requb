'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Users, UserCheck, Receipt, CircleDollarSign, AlertCircle,
  RefreshCw, Trophy, ShieldAlert, Gavel, CheckCircle, XCircle,
  Activity, BarChart2, Sparkles,
} from 'lucide-react';
import { motion } from 'framer-motion';
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
import { Stagger, StaggerItem } from '@/components/ui/motion';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/Badge';
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
    verification: { icon: <CheckCircle className="h-4 w-4" />, bg: 'bg-blue-100 dark:bg-blue-light-500/20', text: 'text-blue-600 dark:text-blue-light-400' },
    lottery: { icon: <Trophy className="h-4 w-4" />, bg: 'bg-amber-100 dark:bg-warning-500/20', text: 'text-amber-600 dark:text-warning-400' },
    penalty: { icon: <ShieldAlert className="h-4 w-4" />, bg: 'bg-rose-100', text: 'text-rose-600' },
    dispute: { icon: <Gavel className="h-4 w-4" />, bg: 'bg-violet-100', text: 'text-violet-600 dark:text-theme-purple-500' },
  };
  return map[type] ?? { icon: <Activity className="h-4 w-4" />, bg: 'bg-gray-100 dark:bg-white/[0.08]', text: 'text-gray-500 dark:text-gray-400' };
}

/** Eased count-up for headline numbers (respects reduced-motion by jumping). */
function useCountUp(target: number, duration = 1100) {
  const [value, setValue] = useState(0);
  const prevRef = useRef(0);
  useEffect(() => {
    const from = prevRef.current;
    prevRef.current = target;
    if (from === target) {
      setValue(target);
      return;
    }
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target);
      return;
    }
    let frame: number;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
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

  // Keep every number on this page live: silent refresh + 60s poll
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') void fetchAll();
    }, 60_000);
    const onVisible = () => { if (document.visibilityState === 'visible') void fetchAll(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, [fetchAll]);

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
  const groupChartData = useMemo(() => groups.slice(0, 8).map(g => ({
    name: g.name.length > 10 ? g.name.slice(0, 10) + '…' : g.name,
    members: g.membersCount,
    max: g.maxMembers,
  })), [groups]);

  // Raw value from the API drives the count-up; fall back to parsing the
  // legacy formatted string only when the raw field is absent.
  const collectedValue = useMemo(
    () =>
      stats.totalCollectedValue ??
      (parseInt(String(stats.totalCollected).replace(/[^0-9.]/g, ''), 10) || 0),
    [stats.totalCollected, stats.totalCollectedValue],
  );
  const collectedAnim = useCountUp(collectedValue);
  const membersAnim = useCountUp(stats.activeMembers, 900);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-8 w-24" />
          </div>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Skeleton className="lg:col-span-4 h-80 rounded-xl" />
            <Skeleton className="lg:col-span-3 h-80 rounded-xl" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {error && (
        <div className="mb-4 p-4 rounded-xl bg-red-50 dark:bg-error-500/10 border border-red-200 flex items-center gap-3 text-sm text-red-700 dark:text-error-400">
          <AlertCircle className="h-4 w-4" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="font-bold hover:text-red-900">×</button>
        </div>
      )}

      <div className="flex-1 space-y-4">
        {/* Compact greeting row */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center justify-between gap-3"
        >
          <div className="min-w-0">
            <h2 className="text-lg md:text-2xl font-bold tracking-tight truncate">
              {greeting()}, {stats.user?.name || 'Admin'} <span className="inline-block motion-safe:animate-bounce [animation-duration:2.4s]">👋</span>
            </h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">{getEthiopianDateString()}</p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh"
            className="shrink-0 p-2.5 rounded-lg border border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white/90 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </motion.div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {/* Overview card — one surface: gradient hero band + stats strip */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-theme-sm"
            >
              <div className="relative overflow-hidden bg-gradient-to-br from-brand-500 via-indigo-600 to-violet-600 p-4 md:p-5 text-white">
                <motion.div
                  className="pointer-events-none absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-[-18deg]"
                  animate={{ x: ['-180%', '360%'] }}
                  transition={{ repeat: Infinity, duration: 3.2, ease: 'easeInOut', repeatDelay: 2.6 }}
                />
                <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
                <div className="relative flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/80">
                      <Sparkles className="h-3 w-3" />
                      {t('db.stat_collected')}
                    </p>
                    <p className="mt-1 text-3xl md:text-4xl font-extrabold tabular-nums tracking-tight">
                      ETB {collectedAnim.toLocaleString()}
                    </p>
                    <p className="text-[11px] text-white/70 mt-0.5">Total deposits processed across all groups</p>
                  </div>
                  <span className="shrink-0 flex items-center gap-1.5 text-[10px] font-semibold bg-white/15 rounded-full px-2 py-0.5">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75 motion-safe:animate-ping" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-200" />
                    </span>
                    LIVE
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 divide-x divide-gray-100 dark:divide-gray-800">
                <div className="px-3 py-2.5 min-w-0">
                  <p className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500 font-medium truncate">
                    <Users className="h-3 w-3 shrink-0 text-blue-600 dark:text-blue-light-400" />
                    <span className="truncate">{t('db.stat_groups')}</span>
                  </p>
                  <p className="mt-0.5 text-lg font-bold text-gray-900 dark:text-white/90 tabular-nums">
                    {stats.totalGroups}
                    <span className="ml-1.5 text-[10px] font-medium text-gray-400 dark:text-gray-500">{activeGroupsPct}% active</span>
                  </p>
                </div>
                <div className="px-3 py-2.5 min-w-0">
                  <p className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500 font-medium truncate">
                    <UserCheck className="h-3 w-3 shrink-0 text-green-600 dark:text-success-400" />
                    <span className="truncate">{t('db.stat_members')}</span>
                  </p>
                  <p className="mt-0.5 text-lg font-bold text-gray-900 dark:text-white/90 tabular-nums">{membersAnim}</p>
                </div>
                <Link href="/receipts" className="px-3 py-2.5 min-w-0 block hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors">
                  <p className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500 font-medium truncate">
                    <Receipt className="h-3 w-3 shrink-0 text-amber-500" />
                    <span className="truncate">{t('db.stat_receipts')}</span>
                    {stats.pendingReceipts > 0 && (
                      <span className="relative flex h-1.5 w-1.5 shrink-0">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 motion-safe:animate-ping" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400" />
                      </span>
                    )}
                  </p>
                  <p className={`mt-0.5 text-lg font-bold tabular-nums ${stats.pendingReceipts > 0 ? 'text-amber-600 dark:text-warning-400' : 'text-gray-900 dark:text-white/90'}`}>
                    {stats.pendingReceipts}
                  </p>
                </Link>
              </div>
            </motion.div>

            {/* Main Row: Chart + Recent Activity */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
              <Card className="lg:col-span-4 min-w-0 overflow-hidden">
                <CardHeader>
                  <CardTitle>{t('db.chart_title')}</CardTitle>
                  <CardDescription>{t('db.chart_subtitle')}</CardDescription>
                </CardHeader>
                <CardContent className="pl-2">
                  <div className="h-[220px] md:h-[280px] w-full">
                    {chartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorDeposits" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#465fff" stopOpacity={0.35}/>
                              <stop offset="95%" stopColor="#465fff" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                          <RechartsTooltip contentStyle={{ borderRadius: '8px' }} />
                          <Area type="monotone" dataKey="deposits" stroke="#465fff" strokeWidth={2} fillOpacity={1} fill="url(#colorDeposits)" activeDot={{ r: 4 }} />
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

              <Card className="lg:col-span-3 min-w-0 overflow-hidden">
                <CardHeader>
                  <CardTitle>{t('db.activity_title')}</CardTitle>
                  <CardDescription>Recent actions across the platform.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {activity.length > 0 ? activity.map((item, i) => {
                      const { icon, bg, text } = activityIcon(item.type);
                      return (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.05 * i, duration: 0.3 }}
                          className="flex items-center gap-3"
                        >
                          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${bg} ${text}`}>
                            {icon}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium leading-tight truncate">{item.message}</p>
                            <p className="text-xs text-muted-foreground">{item.time}</p>
                          </div>
                        </motion.div>
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
                      <p className="text-lg font-bold mt-1 tabular-nums">{stats.activeGuarantees ?? 0} active</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400">{t('db.emergency_skips')}</p>
                      <p className="text-lg font-bold mt-1 tabular-nums">{stats.pendingSwapRequests ?? 0} pending</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400">{t('db.coffee_mode')}</p>
                      <p className="text-lg font-bold mt-1 tabular-nums">{stats.completedDraws ?? 0} draws held</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400">{t('db.auction_equb')}</p>
                      <p className="text-lg font-bold mt-1 tabular-nums">ETB {(stats.totalDisbursed ?? 0).toLocaleString()} disbursed</p>
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
                  <div className="space-y-3">
                    {pending.length > 0 ? pending.map(r => (
                      <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 dark:border-gray-800 p-2.5">
                        <div className="min-w-0">
                          <p className="text-sm font-medium leading-tight truncate">{r.memberName}</p>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{r.groupName} · ETB {r.amount.toLocaleString()}</p>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <Button size="icon" variant="outline" className="h-8 w-8 text-emerald-600 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-700 active:scale-95 transition-transform" onClick={() => handleVerify(r.id)} disabled={!!verifying[r.id]} title="Verify">
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="outline" className="h-8 w-8 text-red-600 dark:text-error-400 border-red-200 bg-red-50 dark:bg-error-500/10 hover:bg-red-100 hover:text-red-700 dark:hover:text-red-400 active:scale-95 transition-transform" onClick={() => handleReject(r.id)} disabled={!!verifying[r.id]} title="Reject">
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
            <Card className="min-w-0 overflow-hidden">
              <CardHeader>
                <CardTitle>Group Utilization Analytics</CardTitle>
                <CardDescription>Members vs Capacity across groups</CardDescription>
              </CardHeader>
              <CardContent className="pl-2">
                <div className="h-[260px] md:h-[320px] w-full">
                  {groupChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={groupChartData} barGap={4}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                        <RechartsTooltip contentStyle={{ borderRadius: '8px' }} />
                        <Legend wrapperStyle={{ fontSize: 12, paddingTop: '20px' }} />
                        <Bar dataKey="members" fill="#465fff" radius={[4,4,0,0]} name="Members" />
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
