'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  UserCheck,
  Receipt,
  CircleDollarSign,
  ArrowRight,
} from 'lucide-react';
import {
  LineChart,
  Line,
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
import Badge from '@/components/ui/Badge';
import { getDashboardStats, getRecentActivity, getDepositChart } from '@/lib/api';
import { format } from 'date-fns';

// Mock data for when API is not connected
const mockStats = {
  totalGroups: 12,
  activeMembers: 156,
  pendingReceipts: 23,
  totalCollected: 'ETB 1.2M',
};

const mockActivity = [
  {
    id: '1',
    type: 'deposit',
    message: 'Abebe Kebede deposited ETB 5,000 to Weekly Equb #3',
    time: '2 minutes ago',
  },
  {
    id: '2',
    type: 'verification',
    message: 'Receipt verified for Meron Tadesse in Monthly Equb #1',
    time: '15 minutes ago',
  },
  {
    id: '3',
    type: 'lottery',
    message: 'Lottery draw completed for Bi-Weekly Equb #5 - Winner: Dawit Haile',
    time: '1 hour ago',
  },
  {
    id: '4',
    type: 'member',
    message: 'New member Sara Tekle joined Weekly Equb #2',
    time: '2 hours ago',
  },
  {
    id: '5',
    type: 'deposit',
    message: 'Yohannes Gebre deposited ETB 10,000 to Monthly Equb #1',
    time: '3 hours ago',
  },
];

const mockChartData = [
  { date: 'Jan', deposits: 45000, verified: 42000 },
  { date: 'Feb', deposits: 52000, verified: 48000 },
  { date: 'Mar', deposits: 61000, verified: 58000 },
  { date: 'Apr', deposits: 58000, verified: 55000 },
  { date: 'May', deposits: 72000, verified: 69000 },
  { date: 'Jun', deposits: 85000, verified: 80000 },
  { date: 'Jul', deposits: 91000, verified: 88000 },
];

export default function DashboardPage() {
  const [stats, setStats] = useState(mockStats);
  const [activity, setActivity] = useState(mockActivity);
  const [chartData, setChartData] = useState(mockChartData);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsData, activityData, chartDataRes] = await Promise.allSettled([
          getDashboardStats(),
          getRecentActivity(),
          getDepositChart(),
        ]);

        if (statsData.status === 'fulfilled') setStats(statsData.value);
        if (activityData.status === 'fulfilled') setActivity(activityData.value);
        if (chartDataRes.status === 'fulfilled') setChartData(chartDataRes.value);
      } catch (error) {
        // Use mock data if API is not available
        console.log('Using mock data - API not connected');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <DashboardLayout>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Overview of your Equb platform activity
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatsCard
          title="Total Groups"
          value={stats.totalGroups}
          icon={<Users className="h-6 w-6 text-primary-600" />}
          trend={{ value: 12, label: 'vs last month' }}
        />
        <StatsCard
          title="Active Members"
          value={stats.activeMembers}
          icon={<UserCheck className="h-6 w-6 text-primary-600" />}
          trend={{ value: 8, label: 'vs last month' }}
        />
        <StatsCard
          title="Pending Receipts"
          value={stats.pendingReceipts}
          icon={<Receipt className="h-6 w-6 text-primary-600" />}
          trend={{ value: -5, label: 'vs last week' }}
        />
        <StatsCard
          title="Total Collected"
          value={stats.totalCollected}
          icon={<CircleDollarSign className="h-6 w-6 text-primary-600" />}
          trend={{ value: 23, label: 'vs last month' }}
        />
      </div>

      {/* Chart and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Deposits Chart */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Deposits Over Time
              </h3>
              <p className="text-sm text-gray-500">
                Monthly deposit and verification trends
              </p>
            </div>
          </div>
          <div className="h-72">
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
                  name="Total Deposits"
                />
                <Area
                  type="monotone"
                  dataKey="verified"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#colorVerified)"
                  name="Verified"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">
              Recent Activity
            </h3>
            <button className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="space-y-4">
            {activity.map((item) => (
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
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
