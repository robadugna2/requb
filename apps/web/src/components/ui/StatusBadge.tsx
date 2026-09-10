'use client';

import React from 'react';
import clsx from 'clsx';

interface BadgeProps {
  status: 'verified' | 'pending' | 'rejected' | 'active' | 'inactive' | 'completed';
  children?: React.ReactNode;
}

// TailAdmin badge palette (success / warning / error / blue-light / gray)
const statusConfig = {
  verified: {
    bg: 'bg-success-50',
    text: 'text-success-700',
    dot: 'bg-success-500',
    label: 'Verified',
  },
  pending: {
    bg: 'bg-warning-50',
    text: 'text-warning-700',
    dot: 'bg-warning-500',
    label: 'Pending',
  },
  rejected: {
    bg: 'bg-error-50',
    text: 'text-error-700',
    dot: 'bg-error-500',
    label: 'Rejected',
  },
  active: {
    bg: 'bg-success-50',
    text: 'text-success-700',
    dot: 'bg-success-500',
    label: 'Active',
  },
  inactive: {
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    dot: 'bg-gray-400',
    label: 'Inactive',
  },
  completed: {
    bg: 'bg-blue-light-50',
    text: 'text-blue-light-700',
    dot: 'bg-blue-light-500',
    label: 'Completed',
  },
};

export default function StatusBadge({ status, children }: BadgeProps) {
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
