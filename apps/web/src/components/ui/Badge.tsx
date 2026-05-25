'use client';

import React from 'react';
import clsx from 'clsx';

interface BadgeProps {
  status: 'verified' | 'pending' | 'rejected' | 'active' | 'inactive' | 'completed';
  children?: React.ReactNode;
}

const statusConfig = {
  verified: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    dot: 'bg-green-500',
    label: 'Verified',
  },
  pending: {
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    dot: 'bg-yellow-500',
    label: 'Pending',
  },
  rejected: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    dot: 'bg-red-500',
    label: 'Rejected',
  },
  active: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    dot: 'bg-green-500',
    label: 'Active',
  },
  inactive: {
    bg: 'bg-gray-50',
    text: 'text-gray-700',
    dot: 'bg-gray-500',
    label: 'Inactive',
  },
  completed: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    dot: 'bg-blue-500',
    label: 'Completed',
  },
};

export default function Badge({ status, children }: BadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
        config.bg,
        config.text
      )}
    >
      <span className={clsx('h-1.5 w-1.5 rounded-full', config.dot)} />
      {children || config.label}
    </span>
  );
}
