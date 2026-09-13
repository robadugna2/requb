'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { LayoutDashboard, Users, ScanLine, Receipt, Menu } from 'lucide-react';
import { useSidebar } from '@/components/layout/SidebarContext';
import { useUnknownSenderCount } from '@/lib/useUnknownSenderCount';

interface BottomNavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  raised?: boolean;
}

// Lean hardcoded set for the mobile bar; the full nav (incl. role-gated items)
// stays in the sidebar, opened via the "More" action below.
const items: BottomNavItem[] = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Groups', url: '/groups', icon: Users },
  { title: 'Scan', url: '/scan', icon: ScanLine, raised: true },
  { title: 'Receipts', url: '/receipts', icon: Receipt },
];

// Mobile-only bottom app bar; self-hides at lg+ where the sidebar takes over
export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { toggleMobileSidebar } = useSidebar();
  const unknownSenderCount = useUnknownSenderCount();

  const isActive = (url: string) =>
    pathname === url || pathname.startsWith(url + '/');

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed bottom-0 inset-x-0 z-40 lg:hidden border-t border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:supports-[backdrop-filter]:bg-gray-900/80"
    >
      <div className="grid grid-cols-5 pb-[max(env(safe-area-inset-bottom),6px)]">
        {items.map((item) => {
          const active = isActive(item.url);
          const Icon = item.icon;
          return (
            <button
              key={item.url}
              type="button"
              onClick={() => router.push(item.url)}
              aria-current={active ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center gap-1 min-h-[48px] pt-1.5 text-[10px] font-medium transition-colors duration-200 active:scale-95 ${
                active
                  ? 'text-brand-600 dark:text-brand-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {item.title === 'Receipts' && unknownSenderCount > 0 && (
                <span className="absolute top-1 right-1/2 translate-x-5 min-w-[16px] h-4 px-1 inline-flex items-center justify-center text-[9px] font-bold text-amber-900 bg-warning-400 rounded-full border-2 border-white dark:border-gray-900">
                  {unknownSenderCount > 9 ? '9+' : unknownSenderCount}
                </span>
              )}
              {item.raised ? (
                <span
                  className={`w-12 h-12 -mt-5 rounded-full bg-brand-500 text-white shadow-lg shadow-brand-500/30 flex items-center justify-center mx-auto ${
                    active ? 'ring-4 ring-brand-500/20' : ''
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </span>
              ) : (
                <Icon className="w-5 h-5" />
              )}
              {item.title}
            </button>
          );
        })}
        <button
          type="button"
          onClick={toggleMobileSidebar}
          aria-label="Open menu"
          className="flex flex-col items-center justify-center gap-1 min-h-[48px] pt-1.5 text-[10px] font-medium text-gray-500 dark:text-gray-400 transition-colors duration-200 active:scale-95"
        >
          <Menu className="w-5 h-5" />
          More
        </button>
      </div>
    </nav>
  );
}
