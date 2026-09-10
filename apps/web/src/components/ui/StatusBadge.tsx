'use client';

import React from 'react';
import clsx from 'clsx';

interface BadgeProps {
  status: 'verified' | 'pending' | 'rejected' | 'active' | 'inactive' | 'completed';
  children?: React.ReactNode;
}

// TailAdmin badge palette (success / warning / error / blue-light / gray) with dark variants
const statusConfig = {
  verified: {
    bg: 'bg-success-50 dark:bg-success-500/15',
    text: 'text-success-700 dark:text-success-400',
    dot: 'bg-success-500',
    label: 'Verified',
  },
  pending: {
    bg: 'bg-warning-50 dark:bg-warning-500/15',
    text: 'text-warning-700 dark:text-warning-400',
    dot: 'bg-warning-500',
    label: 'Pending',
  },
  rejected: {
    bg: 'bg-error-50 dark:bg-error-500/15',
    text: 'text-error-700 dark:text-error-400',
    dot: 'bg-error-500',
    label: 'Rejected',
  },
  active: {
    bg: 'bg-success-50 dark:bg-success-500/15',
    text: 'text-success-700 dark:text-success-400',
    dot: 'bg-success-500',
    label: 'Active',
  },
  inactive: {
    bg: 'bg-gray-100 dark:bg-gray-800',
    text: 'text-gray-600 dark:text-gray-400',
    dot: 'bg-gray-400',
    label: 'Inactive',
  },
  completed: {
    bg: 'bg-blue-light-50 dark:bg-blue-light-500/15',
    text: 'text-blue-light-700 dark:text-blue-light-400',
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
