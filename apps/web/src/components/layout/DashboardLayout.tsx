'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppSidebar } from '@/components/layout/app-sidebar';
import Header from '@/components/layout/header';
import { ToastProvider } from '@/components/ui/Toast';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';

import PageContainer from '@/components/layout/page-container';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [defaultOpen, setDefaultOpen] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('equb_token');
    if (!token) {
      router.push('/login');
    } else {
      setIsAuthenticated(true);
    }
    
    const sidebarState = localStorage.getItem('sidebar:state');
    if (sidebarState === 'false') {
      setDefaultOpen(false);
    }
    
    setIsLoading(false);
  }, [router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <ToastProvider>
      <SidebarProvider defaultOpen={defaultOpen}>
        <AppSidebar />
        <SidebarInset>
          <Header />
          <PageContainer>
            {children}
          </PageContainer>
        </SidebarInset>
      </SidebarProvider>
    </ToastProvider>
  );
}
