'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppSidebar } from '@/components/layout/app-sidebar';
import Header from '@/components/layout/header';
import { ToastProvider } from '@/components/ui/Toast';
import { SidebarProvider, useSidebar } from '@/components/layout/SidebarContext';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

// Backdrop closes the sidebar on mobile when tapping outside
function Backdrop() {
  const { isMobileOpen, toggleMobileSidebar } = useSidebar();
  if (!isMobileOpen) return null;
  return (
    <div
      className="fixed inset-0 z-40 bg-gray-900/50 lg:hidden"
      onClick={toggleMobileSidebar}
    />
  );
}

// Main shell: fixed sidebar + margin-transitioning content area
function ShellInner({ children }: { children: React.ReactNode }) {
  const { isExpanded, isMobileOpen, isHovered } = useSidebar();

  const mainContentMargin = isMobileOpen
    ? 'ml-0'
    : isExpanded || isHovered
    ? 'lg:ml-[290px]'
    : 'lg:ml-[90px]';

  return (
    <div className="min-h-screen xl:flex">
      <AppSidebar />
      <Backdrop />
      <div className={`flex-1 transition-all duration-300 ease-in-out ${mainContentMargin}`}>
        <Header />
        <div className="p-4 mx-auto max-w-7xl md:p-6">{children}</div>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('equb_token');
    if (!token) {
      router.push('/login');
    } else {
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, [router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-white/[0.04]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-brand-100 border-t-brand-500 rounded-full animate-spin" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <ToastProvider>
      <SidebarProvider>
        <ShellInner>{children}</ShellInner>
      </SidebarProvider>
    </ToastProvider>
  );
}
