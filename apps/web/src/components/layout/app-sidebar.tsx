'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  Globe,
  LogOut,
  User as UserIcon,
  ChevronsUpDown,
  CircleDollarSign,
} from 'lucide-react';
import { navGroups } from '@/config/nav-config';
import { useLanguage, Language } from './LanguageContext';
import { useSidebar } from './SidebarContext';
import { getUnreadNotificationCount, getMediaUrl } from '@/lib/api';
import { useUnknownSenderCount } from '@/lib/useUnknownSenderCount';

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { language, setLanguage, t } = useLanguage();
  const { isExpanded, isMobileOpen, isHovered, setIsHovered, toggleMobileSidebar } = useSidebar();
  // The mobile drawer is always wide, so it always shows labels — unlike the
  // desktop rail, which collapses to icons unless expanded/hovered.
  const showLabels = isExpanded || isHovered || isMobileOpen;
  const [unreadCount, setUnreadCount] = useState(0);
  const unknownSenderCount = useUnknownSenderCount();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const [user, setUser] = useState<{ name: string; email: string; role: string } | null>(() => {
    if (typeof window === 'undefined') return null;
    const token = localStorage.getItem('equb_token');
    if (!token) return null;
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      const payload = JSON.parse(jsonPayload);
      return {
        name: payload.name || 'Admin',
        email: payload.email || '',
        role: payload.role || 'ADMIN',
      };
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const fetchCount = () => {
      getUnreadNotificationCount()
        .then((data) => setUnreadCount(data.count))
        .catch(() => {});
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('equb_admin_photo');
      if (stored) setPhotoUrl(stored);
    } catch { /* ignore */ }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('equb_token');
    router.push('/login');
  };

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/');

  const initials = user?.name ? user.name.substring(0, 2).toUpperCase() : 'AD';

  const renderMenuItems = () => (
    <ul className="flex flex-col gap-4">
      {navGroups.map((group) => {
        const filteredItems = group.items.filter((item) => !user || item.roles.includes(user.role));
        if (filteredItems.length === 0) return null;

        return (
          <div key={group.label || 'ungrouped'}>
            <h2
              className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 dark:text-gray-500 ${
                !showLabels ? 'lg:justify-center' : 'justify-start'
              }`}
            >
              {showLabels ? (
                t(group.label.toLowerCase()) || group.label
              ) : (
                <span className="flex gap-1">
                  <span className="h-1 w-1 rounded-full bg-gray-400" />
                  <span className="h-1 w-1 rounded-full bg-gray-400" />
                  <span className="h-1 w-1 rounded-full bg-gray-400" />
                </span>
              )}
            </h2>
            <ul className="flex flex-col gap-1.5">
              {filteredItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.url);

                return (
                  <li key={item.title}>
                    <Link
                      href={item.url}
                      onClick={() => isMobileOpen && toggleMobileSidebar()}
                      className={`menu-item group ${
                        active && 'menu-item-active'
                      } ${!active && 'menu-item-inactive'}`}
                    >
                      <span
                        className={`${active ? 'menu-item-icon-active' : 'menu-item-icon-inactive'} [&_svg]:h-[22px] [&_svg]:w-[22px]`}
                      >
                        {Icon && <Icon />}
                      </span>
                      {showLabels && (
                        <span className="menu-item-text flex-1">{t(item.key)}</span>
                      )}
                      {item.title === 'Notifications' && unreadCount > 0 && (
                        <span
                          className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold text-white bg-error-500 rounded-full ${
                            showLabels ? '' : 'absolute right-2 top-2'
                          }`}
                        >
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                      {item.title === 'Receipts' && unknownSenderCount > 0 && (
                        <span
                          className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold text-amber-800 bg-warning-400 rounded-full ${
                            showLabels ? '' : 'absolute right-2 top-2'
                          }`}
                          title="Unknown senders awaiting a pairing decision"
                        >
                          {unknownSenderCount > 99 ? '99+' : unknownSenderCount}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </ul>
  );

  return (
    <aside
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 px-5 left-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white/90 h-screen transition-all duration-300 ease-in-out z-50
        ${isExpanded || isMobileOpen || isHovered ? 'w-[290px]' : 'w-[90px]'}
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`py-6 flex ${!isExpanded && !isHovered ? 'lg:justify-center' : 'justify-start'}`}
      >
        <Link href="/dashboard">
          {isExpanded || isHovered || isMobileOpen ? (
            <div className="flex items-center gap-2.5">
              <div className="flex aspect-square size-9 items-center justify-center rounded-xl gradient-primary shadow-theme-md">
                <CircleDollarSign className="h-5 w-5 text-white" />
              </div>
              <div className="grid text-left leading-tight">
                <span className="truncate text-lg font-bold text-gray-800 dark:text-white/90">Equb</span>
                <span className="truncate text-xs text-gray-500 dark:text-gray-400">{t('nav.admin_panel')}</span>
              </div>
            </div>
          ) : (
            <div className="flex aspect-square size-10 items-center justify-center rounded-xl gradient-primary shadow-theme-md">
              <CircleDollarSign className="h-5 w-5 text-white" />
            </div>
          )}
        </Link>
      </div>

      <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar">
        <nav className="mb-6">{renderMenuItems()}</nav>

        {/* Language quick selector — expanded only */}
        {showLabels && (
          <div className="mb-6">
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-gray-800">
              <Globe className="h-4 w-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                className="bg-transparent text-xs font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white/90 focus:outline-none cursor-pointer w-full"
              >
                <option value="en">English 🇺🇸</option>
                <option value="am">አማርኛ 🇪🇹</option>
                <option value="om">Afaan Oromoo 🇪🇹</option>
                <option value="ti">ትግርኛ 🇪🇹</option>
              </select>
            </div>
          </div>
        )}

        {/* User footer */}
        {showLabels ? (
          <div className="border-t border-gray-200 dark:border-gray-800 pt-4 pb-6">
            <div className="flex items-center gap-3 px-1">
              <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                {photoUrl ? (
                  <Image src={getMediaUrl(photoUrl)} alt={user?.name || 'Admin'} width={40} height={40} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-bold text-brand-500">{initials}</span>
                )}
              </div>
              <div className="grid flex-1 text-left leading-tight min-w-0">
                <span className="truncate text-sm font-semibold text-gray-800 dark:text-white/90">{user?.name || 'Admin'}</span>
                <span className="truncate text-xs text-gray-500 dark:text-gray-400">{user?.role || 'ADMIN'}</span>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-400 dark:text-gray-500 hover:text-error-500 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors"
                title={t('nav.logout')}
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="border-t border-gray-200 dark:border-gray-800 pt-4 pb-6 flex justify-center">
            <button
              onClick={handleLogout}
              className="p-2.5 text-gray-400 dark:text-gray-500 hover:text-error-500 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors"
              title={t('nav.logout')}
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

export default AppSidebar;
