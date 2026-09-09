'use client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail
} from '@/components/ui/sidebar';
import { navGroups } from '@/config/nav-config';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';
import { ChevronsUpDown, LogOut, User as UserIcon, Globe, CircleDollarSign } from 'lucide-react';
import { useLanguage, Language } from './LanguageContext';
import { getUnreadNotificationCount } from '@/lib/api';

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { language, setLanguage, t } = useLanguage();
  const [unreadCount, setUnreadCount] = React.useState(0);
  
  const [user, setUser] = React.useState<{ name: string; email: string; role: string } | null>(() => {
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

  const handleLogout = () => {
    localStorage.removeItem('equb_token');
    router.push('/login');
  };

  const initials = user?.name ? user.name.substring(0, 2).toUpperCase() : 'AD';

  return (
    <Sidebar collapsible='icon'>
      <SidebarHeader className='group-data-[collapsible=icon]:pt-4 py-4 px-4'>
        <div className="flex items-center gap-2">
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary-600 text-white font-bold gradient-primary">
            <CircleDollarSign className="h-5 w-5 text-white" />
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate font-semibold">Equb</span>
            <span className="truncate text-xs">{t('nav.admin_panel')}</span>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent className='overflow-x-hidden'>
        {navGroups.map((group) => {
          // Filter items based on role
          const filteredItems = group.items.filter(item => !user || item.roles.includes(user.role));
          if (filteredItems.length === 0) return null;

          return (
            <SidebarGroup key={group.label || 'ungrouped'} className='py-0'>
              {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
              <SidebarMenu>
                {filteredItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.url || pathname.startsWith(item.url + '/');
                  
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        tooltip={t(item.key)}
                        isActive={isActive}
                      >
                        <Link href={item.url} className="relative">
                          {Icon && <Icon />}
                          <span className="flex-1">{t(item.key)}</span>
                          {item.title === 'Notifications' && unreadCount > 0 && (
                            <span className="absolute right-2 top-1.5 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold text-white bg-red-500 rounded-full group-data-[collapsible=icon]:hidden">
                              {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                          )}
                          {/* Small indicator dot when collapsed */}
                          {item.title === 'Notifications' && unreadCount > 0 && (
                            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500 hidden group-data-[collapsible=icon]:block" />
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter>
        <div className="group-data-[collapsible=icon]:hidden mb-2 px-2">
          {/* Language Quick Selector */}
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-gray-50 border border-gray-100">
            <Globe className="h-4 w-4 text-gray-500 flex-shrink-0" />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="bg-transparent text-xs font-medium text-gray-700 hover:text-gray-900 focus:outline-none cursor-pointer w-full"
            >
              <option value="en">English 🇺🇸</option>
              <option value="am">አማርኛ 🇪🇹</option>
              <option value="om">Afaan Oromoo 🇪🇹</option>
              <option value="ti">ትግርኛ 🇪🇹</option>
            </select>
          </div>
        </div>

        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size='lg'
                  className='data-[state=open]:bg-gray-100 data-[state=open]:text-gray-900'
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarFallback className="rounded-lg bg-primary-100 text-primary-700 text-xs font-bold">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden ml-2">
                    <span className="truncate font-semibold">{user?.name || 'Admin'}</span>
                    <span className="truncate text-xs text-gray-500">{user?.role || 'Admin'}</span>
                  </div>
                  <ChevronsUpDown className='ml-auto size-4 group-data-[collapsible=icon]:hidden' />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className='w-56 rounded-lg'
                side='bottom'
                align='end'
                sideOffset={4}
              >
                <DropdownMenuLabel className='p-0 font-normal'>
                  <div className='flex items-center gap-2 px-2 py-1.5 text-left text-sm'>
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarFallback className="rounded-lg bg-primary-100 text-primary-700 text-xs font-bold">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{user?.name || 'Admin'}</span>
                      <span className="truncate text-xs text-gray-500">{user?.email || 'admin@equb.et'}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => router.push('/settings')} className="cursor-pointer">
                    <UserIcon className='mr-2 h-4 w-4' />
                    {t('nav.settings')}
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-600">
                  <LogOut className='mr-2 h-4 w-4' />
                  {t('nav.logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
