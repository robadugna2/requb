'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, Globe, LogOut, Settings as SettingsIcon, User as UserIcon } from 'lucide-react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { useLanguage, Language } from './LanguageContext';
import { useSidebar } from './SidebarContext';
import { getUnreadNotificationCount } from '@/lib/api';

export default function Header() {
  const router = useRouter();
  const { language, setLanguage, t } = useLanguage();
  const { isMobileOpen, toggleMobileSidebar, toggleSidebar } = useSidebar();
  const [showDropdown, setShowDropdown] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [user, setUser] = useState<{ name: string; email: string; role: string } | null>(() => {
    if (typeof window === 'undefined') return null;
    const token = localStorage.getItem('equb_token');
    if (!token) return null;
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64Url).split('').map(function (c) {
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

  const initials = user?.name ? user.name.substring(0, 2).toUpperCase() : 'AD';

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

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
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('equb_token');
    router.push('/login');
  };

  const handleToggle = () => {
    if (window.innerWidth >= 768) {
      toggleSidebar();
    } else {
      toggleMobileSidebar();
    }
  };

  return (
    <header className="sticky top-0 flex w-full bg-white border-b border-gray-200 z-40">
      <div className="flex flex-col items-center justify-between grow lg:flex-row lg:px-6">
        <div className="flex items-center justify-between w-full gap-2 px-3 py-3 sm:gap-4 lg:justify-normal lg:px-0 lg:py-4">
          {/* Hamburger */}
          <button
            className="flex items-center justify-center w-10 h-10 text-gray-500 border border-gray-200 rounded-lg lg:h-11 lg:w-11 hover:bg-gray-50 transition-colors"
            onClick={handleToggle}
            aria-label="Toggle Sidebar"
          >
            <svg width="18" height="14" viewBox="0 0 16 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M0.583252 1C0.583252 0.585788 0.919038 0.25 1.33325 0.25H14.6666C15.0808 0.25 15.4166 0.585786 15.4166 1C15.4166 1.41421 15.0808 1.75 14.6666 1.75L1.33325 1.75C0.919038 1.75 0.583252 1.41422 0.583252 1ZM0.583252 11C0.583252 10.5858 0.919038 10.25 1.33325 10.25L14.6666 10.25C15.0808 10.25 15.4166 10.5858 15.4166 11C15.4166 11.4142 15.0808 11.75 14.6666 11.75L1.33325 11.75C0.919038 11.75 0.583252 11.4142 0.583252 11ZM1.33325 5.25C0.583252 5.25 0.583252 5.58579 0.583252 6C0.583252 6.41421 0.919038 6.75 1.33325 6.75L7.99992 6.75C8.41413 6.75 8.74992 6.41421 8.74992 6C8.74992 5.58579 8.41413 5.25 7.99992 5.25L1.33325 5.25Z"
                fill="currentColor"
              />
            </svg>
          </button>

          <Breadcrumbs />
        </div>

        {/* Right side */}
        <div className="flex items-center justify-between w-full gap-4 px-4 py-3 lg:justify-end lg:px-0 lg:py-4">
          {/* Search — desktop */}
          <div className="hidden lg:block">
            <form onSubmit={(e) => e.preventDefault()}>
              <div className="relative">
                <span className="absolute -translate-y-1/2 left-4 top-1/2 pointer-events-none">
                  <svg className="fill-gray-500" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M3.04175 9.37363C3.04175 5.87693 5.87711 3.04199 9.37508 3.04199C12.8731 3.04199 15.7084 5.87693 15.7084 9.37363C15.7084 12.8703 12.8731 15.7053 9.37508 15.7053C5.87711 15.7053 3.04175 12.8703 3.04175 9.37363ZM9.37508 1.54199C5.04902 1.54199 1.54175 5.04817 1.54175 9.37363C1.54175 13.6991 5.04902 17.2053 9.37508 17.2053C11.2674 17.2053 13.003 16.5344 14.357 15.4176L17.177 18.238C17.4699 18.5309 17.9448 18.5309 18.2377 18.238C18.5306 17.9451 18.5306 17.4703 18.2377 17.1774L15.418 14.3573C16.5365 13.0033 17.2084 11.2669 17.2084 9.37363C17.2084 5.04817 13.7011 1.54199 9.37508 1.54199Z"
                      fill=""
                    />
                  </svg>
                </span>
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search or type command..."
                  className="h-11 w-full rounded-lg border border-gray-200 bg-transparent py-2.5 pl-12 pr-14 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-4 focus:ring-brand-500/10 xl:w-[300px] transition-all"
                />
                <span className="absolute right-2.5 top-1/2 inline-flex -translate-y-1/2 items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 px-[7px] py-[4.5px] text-xs -tracking-[0.2px] text-gray-500">
                  <span>⌘</span>
                  <span>K</span>
                </span>
              </div>
            </form>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Language selector */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 shadow-theme-xs">
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

            {/* Notification bell */}
            <Link
              href="/notifications"
              className="relative flex items-center justify-center w-10 h-10 text-gray-700 border border-gray-200 rounded-lg shadow-theme-xs hover:bg-gray-50 transition-colors"
              title={t('nav.notifications')}
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-error-500 rounded-full">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>

            {/* User dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center gap-2.5 p-1.5 rounded-lg border border-gray-200 shadow-theme-xs hover:bg-gray-50 transition-colors"
              >
                <span className="flex items-center justify-center w-9 h-9 rounded-full bg-brand-50 text-sm font-bold text-brand-500">
                  {initials}
                </span>
                <span className="hidden md:block text-left leading-tight">
                  <span className="block text-sm font-medium text-gray-800">{user?.name || 'Admin'}</span>
                  <span className="block text-xs text-gray-500">{user?.role || 'ADMIN'}</span>
                </span>
                <svg
                  className={`hidden md:block stroke-gray-400 transition-transform duration-200 mr-2 ${showDropdown ? 'rotate-180' : ''}`}
                  width="18"
                  height="18"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M4.79175 7.39551L10.0001 12.6038L15.2084 7.39551" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {showDropdown && (
                <div className="absolute right-0 mt-2 flex w-[260px] flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg animate-fade-in-up">
                  <div>
                    <span className="block font-medium text-gray-700 text-theme-sm">
                      {user?.name || 'Admin'}
                    </span>
                    <span className="mt-0.5 block text-theme-xs text-gray-500">
                      {user?.email || 'admin@equb.et'}
                    </span>
                  </div>
                  <ul className="flex flex-col gap-1 pt-4 pb-3 border-b border-gray-200">
                    <li>
                      <button
                        onClick={() => { setShowDropdown(false); router.push('/settings'); }}
                        className="menu-dropdown-item menu-dropdown-item-inactive w-full"
                      >
                        <UserIcon className="h-4 w-4 text-gray-500" />
                        {t('nav.settings')}
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => { setShowDropdown(false); router.push('/admins'); }}
                        className="menu-dropdown-item menu-dropdown-item-inactive w-full"
                      >
                        <SettingsIcon className="h-4 w-4 text-gray-500" />
                        {t('nav.admins')}
                      </button>
                    </li>
                  </ul>
                  <button
                    onClick={handleLogout}
                    className="menu-dropdown-item mt-3 w-full text-error-500 hover:bg-error-50 rounded-lg"
                  >
                    <LogOut className="h-4 w-4" />
                    {t('nav.logout')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
