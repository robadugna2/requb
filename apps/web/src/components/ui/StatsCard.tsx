'use client';

import React from 'react';
import clsx from 'clsx';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: { value: number; label: string };
  className?: string;
  accentColor?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'violet';
  gradient?: boolean;
}

const accentMap = {
  indigo: {
    border: 'border-l-indigo-500',
    iconBg: 'bg-indigo-50',
    trendPos: 'text-indigo-600',
    glow: 'shadow-indigo-100',
  },
  emerald: {
    border: 'border-l-emerald-500',
    iconBg: 'bg-emerald-50',
    trendPos: 'text-emerald-600',
    glow: 'shadow-emerald-100',
  },
  amber: {
    border: 'border-l-amber-500',
    iconBg: 'bg-amber-50',
    trendPos: 'text-amber-600',
    glow: 'shadow-amber-100',
  },
  rose: {
    border: 'border-l-rose-500',
    iconBg: 'bg-rose-50',
    trendPos: 'text-rose-600',
    glow: 'shadow-rose-100',
  },
  violet: {
    border: 'border-l-violet-500',
    iconBg: 'bg-violet-50',
    trendPos: 'text-violet-600',
    glow: 'shadow-violet-100',
  },
};

export default function StatsCard({
  title,
  value,
  icon,
  trend,
  className,
  accentColor = 'indigo',
  gradient = false,
}: StatsCardProps) {
  const accent = accentMap[accentColor];

  return (
    <div
      className={clsx(
        'relative bg-white rounded-2xl border border-gray-100 border-l-4 p-5 transition-all duration-200',
        'hover:shadow-lg hover:-translate-y-0.5',
        accent.border,
        accent.glow,
        'shadow-sm',
        className
      )}
    >
      {/* Subtle gradient overlay */}
      {gradient && (
        <div className="absolute inset-0 rounded-2xl opacity-[0.03] bg-gradient-to-br from-gray-900 to-transparent pointer-events-none" />
      )}

      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider truncate">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900 leading-none">{value}</p>

          {trend && (
            <div className="mt-2.5 flex items-center gap-1.5">
              <span
                className={clsx(
                  'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-semibold',
                  trend.value >= 0
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-red-50 text-red-700'
                )}
              >
                {trend.value >= 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {trend.value >= 0 ? '+' : ''}{trend.value}%
              </span>
              <span className="text-[11px] text-gray-400">{trend.label}</span>
            </div>
          )}
        </div>

        <div className={clsx('p-3 rounded-xl flex-shrink-0', accent.iconBg)}>
          {icon}
        </div>
      </div>
    </div>
  );
}
