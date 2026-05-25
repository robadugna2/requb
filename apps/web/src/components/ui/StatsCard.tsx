'use client';

import React from 'react';
import clsx from 'clsx';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: {
    value: number;
    label: string;
  };
  className?: string;
}

export default function StatsCard({
  title,
  value,
  icon,
  trend,
  className,
}: StatsCardProps) {
  return (
    <div className={clsx('card', className)}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
          {trend && (
            <div className="mt-2 flex items-center">
              {trend.value >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
              )}
              <span
                className={clsx(
                  'text-xs font-medium',
                  trend.value >= 0 ? 'text-green-600' : 'text-red-600'
                )}
              >
                {trend.value >= 0 ? '+' : ''}
                {trend.value}%
              </span>
              <span className="ml-1 text-xs text-gray-500">{trend.label}</span>
            </div>
          )}
        </div>
        <div className="flex-shrink-0 p-3 bg-primary-50 rounded-xl">
          {icon}
        </div>
      </div>
    </div>
  );
}
