'use client';

import React from 'react';

function Pulse({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-gray-200 rounded ${className || ''}`} />
  );
}

export function CardSkeleton() {
  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <Pulse className="h-4 w-32" />
        <Pulse className="h-5 w-16 rounded-full" />
      </div>
      <Pulse className="h-6 w-24" />
      <Pulse className="h-3 w-full" />
      <Pulse className="h-3 w-3/4" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="card overflow-hidden p-0">
      <div className="p-4 border-b border-gray-100">
        <Pulse className="h-4 w-48" />
      </div>
      <div className="divide-y divide-gray-50">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            <Pulse className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Pulse className="h-3 w-1/3" />
              <Pulse className="h-3 w-1/4" />
            </div>
            <Pulse className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="card">
          <div className="flex items-center justify-between mb-3">
            <Pulse className="h-3 w-24" />
            <Pulse className="h-8 w-8 rounded-lg" />
          </div>
          <Pulse className="h-7 w-16" />
        </div>
      ))}
    </div>
  );
}

export function GridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export default function LoadingSkeleton({ type = 'table' }: { type?: 'table' | 'grid' | 'stats' | 'card' }) {
  switch (type) {
    case 'stats':
      return <StatsSkeleton />;
    case 'grid':
      return <GridSkeleton />;
    case 'card':
      return <CardSkeleton />;
    case 'table':
    default:
      return <TableSkeleton />;
  }
}
