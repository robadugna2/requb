'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Receipt,
  Ticket,
  BookTemplate,
  Bell,
  Settings,
  CircleDollarSign,
  Shield,
} from 'lucide-react';
import { getUnreadNotificationCount } from '@/lib/api';
import { useLanguage } from './LanguageContext';

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuBadge,
} from '@/components/ui/sidebar';

const navigation = [
  { name: 'Dashboard', key: 'nav.dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['SUPER_ADMIN', 'ADMIN', 'SUB_ADMIN'] },
  { name: 'Groups', key: 'nav.groups', href: '/groups', icon: Users, roles: ['SUPER_ADMIN', 'ADMIN', 'SUB_ADMIN'] },
  { name: 'Members', key: 'nav.members', href: '/members', icon: Users, roles: ['SUPER_ADMIN', 'ADMIN'] },
  { name: 'Receipts', key: 'nav.receipts', href: '/receipts', icon: Receipt, roles: ['SUPER_ADMIN', 'ADMIN', 'SUB_ADMIN'] },
  { name: 'Lottery', key: 'nav.lottery', href: '/lottery', icon: Ticket, roles: ['SUPER_ADMIN', 'ADMIN', 'SUB_ADMIN'] },
  { name: 'Rule Templates', key: 'nav.rules', href: '/rule-templates', icon: BookTemplate, roles: ['SUPER_ADMIN', 'ADMIN'] },
  { name: 'Notifications', key: 'nav.notifications', href: '/notifications', icon: Bell, roles: ['SUPER_ADMIN', 'ADMIN', 'SUB_ADMIN'] },
  { name: 'Admins', key: 'nav.admins', href: '/admins', icon: Shield, roles: ['SUPER_ADMIN', 'ADMIN'] },
];

export function AppSidebar() {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = React.useState(0);
  const { t } = useLanguage();
  
  const [userContext] = React.useState<{name: string, email: string, role: string} | null>(() => {
    if (typeof window === 'undefined') return null;
    const token = localStorage.getItem('equb_token');
    if (!token) return null;
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      const payload = JSON.parse(jsonPayload);
      return {
        name: payload.name || 'Admin',
        email: payload.email || '',
        role: payload.role || 'ADMIN'
      };
    } catch {
      return null;
    }
  });

  React.useEffect(() => {
    const fetchCount = () => {
      getUnreadNotificationCount()
        .then((data) => setUnreadCount(data.count))
        .catch(() => {});
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const filteredNavigation = navigation.filter(item => !userContext || item.roles.includes(userContext.role));

  return (
    <Sidebar variant="inset" className="border-r border-gray-200">
      <SidebarHeader className="border-b border-gray-200 py-4 px-4 bg-gray-50/50">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-600 shadow-sm">
            <CircleDollarSign className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-gray-900 leading-tight">Equb</span>
            <span className="text-[10px] uppercase font-semibold text-gray-500 tracking-wider">{t('nav.admin_panel')}</span>
          </div>
        </Link>
      </SidebarHeader>
      
      <SidebarContent className="px-2 py-4">
        <SidebarGroup>
          <SidebarMenu>
            {filteredNavigation.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
              const displayName = t(item.key);
              return (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={isActive} 
                    tooltip={displayName}
                    className={isActive ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-600 hover:text-gray-900'}
                  >
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{displayName}</span>
                    </Link>
                  </SidebarMenuButton>
                  {item.name === 'Notifications' && unreadCount > 0 && (
                    <SidebarMenuBadge className="bg-primary-600 text-white border-0">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
