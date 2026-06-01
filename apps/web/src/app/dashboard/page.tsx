'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  UserCheck,
  Receipt,
  CircleDollarSign,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatsCard from '@/components/ui/StatsCard';
import { getDashboardStats, getRecentActivity, getDepositChart } from '@/lib/api';
import type { DashboardStats, ActivityItem, ChartDataItem } from '@/lib/api';
import { useLanguage } from '@/components/layout/LanguageContext';

export default function DashboardPage() {
  const { t } = useLanguage();
  const [stats, setStats] = useState<DashboardStats>({
    totalGroups: 0,
    activeMembers: 0,
    pendingReceipts: 0,
    totalCollected: 'ETB 0',
  });
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [chartData, setChartData] = useState<ChartDataItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [statsData, activityData, chartDataRes] = await Promise.allSettled([
          getDashboardStats(),
          getRecentActivity(),
          getDepositChart(),
        ]);

        if (statsData.status === 'fulfilled') setStats(statsData.value);
        if (activityData.status === 'fulfilled') setActivity(activityData.value);
        if (chartDataRes.status === 'fulfilled') setChartData(chartDataRes.value);

        if (statsData.status === 'rejected' && activityData.status === 'rejected') {
          setError('Failed to load dashboard data. Please check your connection and try again.');
        }
      } catch (err) {
        setError('Failed to load dashboard data. Please check your connection and try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
            <p className="text-sm text-gray-500">{t('db.loading')}</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Error Banner */}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 text-red-700 text-sm font-medium border border-red-100 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700 font-bold text-lg">×</button>
        </div>
      )}

      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{t('db.title')}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {t('db.subtitle')}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatsCard
          title={t('db.stat_groups')}
          value={stats.totalGroups}
          icon={<Users className="h-6 w-6 text-primary-600" />}
        />
        <StatsCard
          title={t('db.stat_members')}
          value={stats.activeMembers}
          icon={<UserCheck className="h-6 w-6 text-primary-600" />}
        />
        <StatsCard
          title={t('db.stat_receipts')}
          value={stats.pendingReceipts}
          icon={<Receipt className="h-6 w-6 text-primary-600" />}
        />
        <StatsCard
          title={t('db.stat_collected')}
          value={stats.totalCollected}
          icon={<CircleDollarSign className="h-6 w-6 text-primary-600" />}
        />
      </div>

      {/* Chart and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Deposits Chart */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {t('db.chart_title')}
              </h3>
              <p className="text-sm text-gray-500">
                {t('db.chart_subtitle')}
              </p>
            </div>
          </div>
          <div className="h-72">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorDeposits" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorVerified" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="date"
                    stroke="#94a3b8"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                    }}
                    formatter={(value: number) => [`ETB ${value.toLocaleString()}`, '']}
                  />
                  <Area
                    type="monotone"
                    dataKey="deposits"
                    stroke="#4f46e5"
                    strokeWidth={2}
                    fill="url(#colorDeposits)"
                    name={t('db.chart_total')}
                  />
                  <Area
                    type="monotone"
                    dataKey="verified"
                    stroke="#10b981"
                    strokeWidth={2}
                    fill="url(#colorVerified)"
                    name={t('db.chart_verified')}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                <p className="text-sm">{t('db.chart_no_data')}</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">
              {t('db.activity_title')}
            </h3>
            <button className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
              {t('db.activity_view_all')} <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="space-y-4">
            {activity.length > 0 ? (
              activity.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div
                    className={`w-2 h-2 mt-2 rounded-full flex-shrink-0 ${
                      item.type === 'deposit'
                        ? 'bg-green-500'
                        : item.type === 'verification'
                        ? 'bg-blue-500'
                        : item.type === 'lottery'
                        ? 'bg-purple-500'
                        : 'bg-orange-500'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {item.message}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{item.time}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-400">
                <p className="text-sm">{t('db.activity_no_data')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
