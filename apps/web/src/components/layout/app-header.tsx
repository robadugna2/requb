'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Globe, LogOut, Settings } from 'lucide-react';
import { useLanguage, Language } from './LanguageContext';

export function AppHeader() {
  const router = useRouter();
  const { language, setLanguage, t } = useLanguage();
  
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

  const handleLogout = () => {
    localStorage.removeItem('equb_token');
    router.push('/login');
  };

  const initials = userContext?.name ? userContext.name.substring(0, 2).toUpperCase() : 'AD';

  return (
    <header className="sticky top-0 z-10 flex h-14 bg-white/80 backdrop-blur items-center gap-4 border-b border-gray-200 px-4 sm:px-6">
      <SidebarTrigger className="text-gray-500 hover:text-gray-900" />
      
      <div className="flex-1 flex justify-end items-center gap-4">
        {/* Language Quick Selector */}
        <div className="flex items-center gap-2 px-2 py-1 rounded bg-gray-50 border border-gray-200">
          <Globe className="h-4 w-4 text-gray-500" />
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className="bg-transparent text-xs font-medium text-gray-700 hover:text-gray-900 focus:outline-none cursor-pointer"
          >
            <option value="en">English 🇺🇸</option>
            <option value="am">አማርኛ 🇪🇹</option>
            <option value="om">Afaan Oromoo 🇪🇹</option>
            <option value="ti">ትግርኛ 🇪🇹</option>
          </select>
        </div>

        {/* User Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full border border-gray-200">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary-100 text-primary-700 text-xs font-bold">{initials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{userContext?.name || 'Admin'}</p>
                <p className="text-xs leading-none text-gray-500">
                  {userContext?.email || 'admin@equb.et'}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/settings')} className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />
              <span>{t('nav.settings')}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600 focus:text-red-700 focus:bg-red-50">
              <LogOut className="mr-2 h-4 w-4" />
              <span>{t('nav.logout')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
