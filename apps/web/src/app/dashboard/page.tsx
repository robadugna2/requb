'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, UserCheck, Receipt, CircleDollarSign, ArrowRight, AlertCircle,
  RefreshCw, Plus, Trophy, ShieldAlert, Gavel, CheckCircle, XCircle,
  TrendingUp, Activity, Zap, BarChart2,
} from 'lucide-react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, BarChart, Bar, Legend,
} from 'recharts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatsCard from '@/components/ui/StatsCard';
import {
  getDashboardStats, getRecentActivity, getDepositChart,
  getDeposits, getLotteryResults, getGroups,
  verifyDeposit, rejectDeposit,
} from '@/lib/api';
import type { DashboardStats, ActivityItem, ChartDataItem, ReceiptItem, LotteryResultItem, GroupListItem } from '@/lib/api';
import { useLanguage } from '@/components/layout/LanguageContext';

function getEthiopianDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const etMonths = [
    'Meskerem (መስከረም)', 'Tekemt (ጥቅምት)', 'Hidar (ህዳር)', 'Tahsas (ታኅሣሥ)',
    'Ter (ጥር)', 'Yekatit (የካቲት)', 'Megabit (መጋቢት)', 'Miazia (ሚያዝያ)',
    'Ginbot (ግንቦት)', 'Sene (ሰኔ)', 'Hamle (ሐምሌ)', 'Nehase (ነሐሴ)', 'Pagumen (ጳጉሜን)'
  ];
  
  const referenceMs = new Date(2023, 8, 12).getTime(); // Meskerem 1, 2016
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

// ── Helpers ──────────────────────────────────────────────────────────────────
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
function todayLabel() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}
function activityIcon(type: string) {
  const map: Record<string, { icon: React.ReactNode; bg: string }> = {
    deposit: { icon: <CircleDollarSign className="h-3.5 w-3.5 text-emerald-600" />, bg: 'bg-emerald-50' },
    verification: { icon: <CheckCircle className="h-3.5 w-3.5 text-blue-600" />, bg: 'bg-blue-50' },
    lottery: { icon: <Trophy className="h-3.5 w-3.5 text-amber-600" />, bg: 'bg-amber-50' },
    penalty: { icon: <ShieldAlert className="h-3.5 w-3.5 text-rose-600" />, bg: 'bg-rose-50' },
    dispute: { icon: <Gavel className="h-3.5 w-3.5 text-violet-600" />, bg: 'bg-violet-50' },
  };
  return map[type] ?? { icon: <Activity className="h-3.5 w-3.5 text-gray-500" />, bg: 'bg-gray-100' };
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-100 rounded-xl ${className ?? ''}`} />;
}

// ── Quick Action Button ───────────────────────────────────────────────────────
function QuickAction({ icon, label, href, color }: { icon: React.ReactNode; label: string; href: string; color: string }) {
  return (
    <Link href={href} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-150 hover:scale-105 hover:shadow-lg ${color}`}>
      {icon}
      {label}
    </Link>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({ totalGroups: 0, activeMembers: 0, pendingReceipts: 0, totalCollected: 'ETB 0' });
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [chartData, setChartData] = useState<ChartDataItem[]>([]);
  const [pending, setPending] = useState<ReceiptItem[]>([]);
  const [winners, setWinners] = useState<LotteryResultItem[]>([]);
  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartTab, setChartTab] = useState<'deposits' | 'groups'>('deposits');
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

  // Derived health metrics
  const activeGroups = groups.filter(g => g.status === 'active').length;
  const activeGroupsPct = groups.length ? Math.round((activeGroups / groups.length) * 100) : 0;

  // Group chart data derived from groups list
  const groupChartData = groups.slice(0, 8).map(g => ({
    name: g.name.length > 10 ? g.name.slice(0, 10) + '…' : g.name,
    members: g.membersCount,
    max: g.maxMembers,
  }));

  // Loading skeleton
  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2"><Skeleton className="h-7 w-52" /><Skeleton className="h-4 w-40" /></div>
            <Skeleton className="h-9 w-28" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="lg:col-span-2 h-80" />
            <Skeleton className="h-80" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Error banner */}
      {error && (
        <div className="mb-5 p-4 rounded-xl bg-red-50 border border-red-100 flex items-center gap-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="font-bold text-lg leading-none text-red-400 hover:text-red-600">×</button>
        </div>
      )}

      {/* ── Header ── */}
      <div className="mb-7 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{greeting()}, {stats.user?.name || 'Admin'} 👋</h1>
          <div className="mt-1 flex items-center gap-2 flex-wrap text-sm">
            <span className="text-gray-400">{todayLabel()} (Ge'ez: {getEthiopianDateString()})</span>
            {stats.user?.role && (
              <>
                <span className="text-gray-300">·</span>
                <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold tracking-wide uppercase ${
                  stats.user.role === 'SUPER_ADMIN' ? 'bg-primary-50 text-primary-600 border border-primary-100' :
                  stats.user.role === 'ADMIN' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                  'bg-amber-50 text-amber-600 border border-amber-100'
                }`}>
                  {stats.user.role.replace('_', ' ')}
                </span>
              </>
            )}
            {stats.user?.creator && (
              <>
                <span className="text-gray-300">·</span>
                <span className="text-gray-500 flex items-center gap-1">
                  Managed by <span className="font-semibold text-gray-700">{stats.user.creator}</span>
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all hover:shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <div className="mb-7 flex flex-wrap gap-3">
        <QuickAction href="/groups?action=create" icon={<Plus className="h-4 w-4" />} label="New Group" color="bg-indigo-600 hover:bg-indigo-700" />
        <QuickAction href="/members?action=create" icon={<UserCheck className="h-4 w-4" />} label="Add Member" color="bg-emerald-600 hover:bg-emerald-700" />
        <QuickAction href="/receipts" icon={<Receipt className="h-4 w-4" />} label="Verify Receipts" color="bg-amber-500 hover:bg-amber-600" />
        <QuickAction href="/lottery" icon={<Trophy className="h-4 w-4" />} label="Run Lottery" color="bg-violet-600 hover:bg-violet-700" />
      </div>

      {/* ── KPI Stats ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        <StatsCard
          title={t('db.stat_groups')}
          value={stats.totalGroups}
          icon={<Users className="h-5 w-5 text-indigo-600" />}
          accentColor="indigo"
          trend={{ value: 0, label: 'total' }}
        />
        <StatsCard
          title={t('db.stat_members')}
          value={stats.activeMembers}
          icon={<UserCheck className="h-5 w-5 text-emerald-600" />}
          accentColor="emerald"
          trend={{ value: 0, label: 'active' }}
        />
        <StatsCard
          title={t('db.stat_receipts')}
          value={stats.pendingReceipts}
          icon={<Receipt className="h-5 w-5 text-amber-600" />}
          accentColor="amber"
          trend={{ value: stats.pendingReceipts > 0 ? -1 : 0, label: 'pending' }}
        />
        <StatsCard
          title={t('db.stat_collected')}
          value={stats.totalCollected}
          icon={<CircleDollarSign className="h-5 w-5 text-rose-600" />}
          accentColor="rose"
          trend={{ value: 0, label: 'total ETB' }}
        />
      </div>

      {/* ── System Health Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-7">
        {[
          {
            label: 'Active Groups',
            value: `${activeGroups} / ${groups.length}`,
            sub: `${activeGroupsPct}% utilization`,
            icon: <Zap className="h-4 w-4 text-indigo-500" />,
            bar: activeGroupsPct,
            barColor: 'bg-indigo-500',
          },
          {
            label: 'Pending Deposits',
            value: pending.length,
            sub: 'awaiting verification',
            icon: <Receipt className="h-4 w-4 text-amber-500" />,
            bar: Math.min(pending.length * 20, 100),
            barColor: 'bg-amber-400',
          },
          {
            label: 'Recent Winners',
            value: winners.length,
            sub: 'lottery draws completed',
            icon: <Trophy className="h-4 w-4 text-emerald-500" />,
            bar: Math.min(winners.length * 20, 100),
            barColor: 'bg-emerald-500',
          },
        ].map(m => (
          <div key={m.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{m.label}</p>
              {m.icon}
            </div>
            <p className="text-2xl font-bold text-gray-900">{m.value}</p>
            <p className="text-xs text-gray-400 mt-0.5 mb-3">{m.sub}</p>
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700 ${m.barColor}`} style={{ width: `${m.bar}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* ── Chart + Activity ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

        {/* Chart Panel */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-semibold text-gray-900">{t('db.chart_title')}</h3>
              <p className="text-xs text-gray-400 mt-0.5">{t('db.chart_subtitle')}</p>
            </div>
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
              {(['deposits', 'groups'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setChartTab(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    chartTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {tab === 'deposits' ? 'Deposits' : 'Groups'}
                </button>
              ))}
            </div>
          </div>

          <div className="h-64">
            {chartTab === 'deposits' ? (
              chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="gDep" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.12} />
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gVer" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.12} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ backgroundColor:'#fff', border:'1px solid #e2e8f0', borderRadius:'12px', boxShadow:'0 4px 12px rgba(0,0,0,0.08)', fontSize:12 }} formatter={(v: number) => [`ETB ${v.toLocaleString()}`, '']} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                    <Area type="monotone" dataKey="deposits" stroke="#4f46e5" strokeWidth={2} fill="url(#gDep)" name={t('db.chart_total')} />
                    <Area type="monotone" dataKey="verified" stroke="#10b981" strokeWidth={2} fill="url(#gVer)" name={t('db.chart_verified')} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <BarChart2 className="h-10 w-10 text-gray-200 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">{t('db.chart_no_data')}</p>
                  </div>
                </div>
              )
            ) : (
              groupChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={groupChartData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ backgroundColor:'#fff', border:'1px solid #e2e8f0', borderRadius:'12px', fontSize:12 }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="members" fill="#4f46e5" radius={[4,4,0,0]} name="Members" />
                    <Bar dataKey="max" fill="#e0e7ff" radius={[4,4,0,0]} name="Max Capacity" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400 text-sm">No group data</div>
              )
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-semibold text-gray-900">{t('db.activity_title')}</h3>
            <Link href="/notifications" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-0.5">
              {t('db.activity_view_all')} <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="flex-1 space-y-1 overflow-y-auto max-h-56">
            {activity.length > 0 ? activity.map(item => {
              const { icon, bg } = activityIcon(item.type);
              return (
                <div key={item.id} className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                  <div className={`mt-0.5 p-1.5 rounded-lg flex-shrink-0 ${bg}`}>{icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-700 leading-relaxed">{item.message}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{item.time}</p>
                  </div>
                </div>
              );
            }) : (
              <div className="flex flex-col items-center justify-center py-10 text-gray-300">
                <Activity className="h-8 w-8 mb-2" />
                <p className="text-sm">{t('db.activity_no_data')}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Traditional Ethiopian Equb Insights & Analytics ── */}
      <div className="mb-6 bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 rounded-3xl border border-indigo-950 shadow-xl overflow-hidden p-6 md:p-8 text-white relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl -ml-32 -mb-32 pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">{t('db.traditional_experience')}</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">{t('db.active_system')}</span>
            </div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight">{t('db.traditional_metrics_title')}</h2>
            <p className="text-sm text-indigo-200 mt-1 max-w-xl">
              {t('db.traditional_metrics_desc')}
            </p>
          </div>
          
          <div className="flex flex-wrap gap-4 md:self-center">
            <div className="px-4 py-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <p className="text-[10px] uppercase font-bold text-indigo-300 tracking-wider">{t('db.geez_calendar')}</p>
              <p className="text-base font-bold mt-0.5 text-white">{getEthiopianDateString()}</p>
            </div>
            <div className="px-4 py-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <p className="text-[10px] uppercase font-bold text-indigo-300 tracking-wider">{t('db.reliability_score')}</p>
              <p className="text-base font-bold mt-0.5 text-emerald-400">96.8% ({t('db.excellent')})</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8 pt-6 border-t border-white/10 relative z-10">
          <div>
            <p className="text-xs text-indigo-300">{t('db.active_wase')}</p>
            <p className="text-lg font-bold mt-1 text-white">{t('db.guarantees_value')}</p>
            <p className="text-xs text-emerald-400 mt-0.5 font-medium">{t('db.guarantees_desc')}</p>
          </div>
          <div>
            <p className="text-xs text-indigo-300">{t('db.emergency_skips')}</p>
            <p className="text-lg font-bold mt-1 text-white">{t('db.requests_value')}</p>
            <p className="text-xs text-indigo-200 mt-0.5 font-medium">{t('db.requests_desc')}</p>
          </div>
          <div>
            <p className="text-xs text-indigo-300">{t('db.coffee_mode')}</p>
            <p className="text-lg font-bold mt-1 text-white">{t('db.groups_value')}</p>
            <p className="text-xs text-amber-400 mt-0.5 font-medium">{t('db.coffee_desc')}</p>
          </div>
          <div>
            <p className="text-xs text-indigo-300">{t('db.auction_equb')}</p>
            <p className="text-lg font-bold mt-1 text-white">{t('db.disbursed_value')}</p>
            <p className="text-xs text-emerald-400 mt-0.5 font-medium">{t('db.bidding_desc')}</p>
          </div>
        </div>
      </div>

      {/* ── Bottom 2-col: Pending Receipts + Lottery Winners ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Pending Receipts */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-amber-50 rounded-lg"><Receipt className="h-4 w-4 text-amber-600" /></div>
              <h3 className="text-base font-semibold text-gray-900">Pending Receipts</h3>
              {pending.length > 0 && (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold bg-amber-500 text-white rounded-full">{pending.length}</span>
              )}
            </div>
            <Link href="/receipts" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-0.5">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {pending.length > 0 ? (
            <div className="space-y-2">
              {pending.map(r => (
                <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl bg-amber-50/60 border border-amber-100">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{r.memberName}</p>
                    <p className="text-xs text-gray-500 truncate">{r.groupName} · ETB {r.amount.toLocaleString()}</p>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleVerify(r.id)}
                      disabled={!!verifying[r.id]}
                      className="p-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-700 transition-colors disabled:opacity-50"
                      title="Verify"
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleReject(r.id)}
                      disabled={!!verifying[r.id]}
                      className="p-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-600 transition-colors disabled:opacity-50"
                      title="Reject"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-gray-300">
              <CheckCircle className="h-10 w-10 mb-2 text-emerald-200" />
              <p className="text-sm text-gray-400">All caught up! No pending receipts.</p>
            </div>
          )}
        </div>

        {/* Lottery Winners */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-amber-50 rounded-lg"><Trophy className="h-4 w-4 text-amber-600" /></div>
              <h3 className="text-base font-semibold text-gray-900">Recent Lottery Winners</h3>
            </div>
            <Link href="/lottery" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-0.5">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {winners.length > 0 ? (
            <div className="space-y-2">
              {winners.map((w, i) => (
                <div key={w.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors border border-gray-50">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{w.winnerName}</p>
                    <p className="text-xs text-gray-500 truncate">{w.groupName} · Cycle {w.cycle}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-emerald-700">ETB {w.amount.toLocaleString()}</p>
                    <p className="text-[11px] text-gray-400">{w.date}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-gray-300">
              <Trophy className="h-10 w-10 mb-2" />
              <p className="text-sm text-gray-400">No lottery draws yet.</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
