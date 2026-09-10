'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, Globe, LogOut, Settings as SettingsIcon, User as UserIcon } from 'lucide-react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { useLanguage, Language } from './LanguageContext';
import { useSidebar } from './SidebarContext';
import { useTheme } from './ThemeContext';
import { getUnreadNotificationCount } from '@/lib/api';

export default function Header() {
  const router = useRouter();
  const { language, setLanguage, t } = useLanguage();
  const { isMobileOpen, toggleMobileSidebar, toggleSidebar } = useSidebar();
  const { theme, toggleTheme } = useTheme();
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
    <header className="sticky top-0 flex w-full bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 z-40">
      <div className="flex flex-col items-center justify-between grow lg:flex-row lg:px-6">
        <div className="flex items-center justify-between w-full gap-2 px-3 py-3 sm:gap-4 lg:justify-normal lg:px-0 lg:py-4">
          {/* Hamburger */}
          <button
            className="flex items-center justify-center w-10 h-10 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-800 rounded-lg lg:h-11 lg:w-11 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors"
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
                  className="h-11 w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-transparent py-2.5 pl-12 pr-14 text-sm text-gray-800 dark:text-white/90 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-4 focus:ring-brand-500/10 xl:w-[300px] transition-all"
                />
                <span className="absolute right-2.5 top-1/2 inline-flex -translate-y-1/2 items-center gap-0.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-white/[0.04] px-[7px] py-[4.5px] text-xs -tracking-[0.2px] text-gray-500 dark:text-gray-400">
                  <span>⌘</span>
                  <span>K</span>
                </span>
              </div>
            </form>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              title={`Theme: ${theme} (click to change)`}
              className="relative flex items-center justify-center w-10 h-10 text-gray-700 dark:text-gray-400 border border-gray-200 dark:border-gray-800 rounded-lg shadow-theme-xs hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              {theme === 'dark' ? (
                <svg className="fill-gray-400 dark:fill-gray-500" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18.0143 12.4939C18.3 12.4244 18.5581 12.6526 18.4776 12.9347C17.2973 17.0582 13.4325 19.9949 8.99531 19.7222C4.20434 19.4294 0.571093 15.7961 0.278247 11.0052C0.00563161 6.56821 2.94198 2.70347 7.06516 1.52303C7.34725 1.44253 7.57546 1.70065 7.50592 1.98634C7.28265 2.90011 7.16478 3.85306 7.16478 4.83328C7.16478 11.1794 12.2925 16.3071 18.6386 16.3071C18.6204 16.3071 18.6022 16.3071 18.584 16.3071C18.3956 16.3082 18.2049 16.3098 18.0143 16.3074L18.0143 12.4939ZM17.113 14.7218C11.3433 14.4366 6.7665 9.6586 6.7665 3.82161C6.7665 3.34083 6.7984 2.86789 6.86005 2.40429C3.52532 3.75674 1.28205 7.08603 1.49971 10.9406C1.74803 15.3442 5.34961 18.9458 9.75324 19.1941C12.6484 19.3574 15.2502 17.9903 16.8068 15.8266C16.9102 15.7914 17.0126 15.7557 17.113 14.7218Z" />
                  <path d="M17.113 14.7218C16.0263 14.6679 14.9857 14.4399 14.0171 14.0664C15.9895 12.5975 17.2648 10.2424 17.2648 7.58527C17.2648 4.92654 15.9878 2.57009 14.0133 1.10139C14.9837 0.726775 16.0266 0.498435 17.1157 0.444911C17.1159 0.4449 17.1161 0.444891 17.1163 0.444882L17.113 14.7218Z" fillOpacity="0.1" />
                </svg>
              ) : (
                <svg className="fill-current" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M10.0001 13.7498C12.0712 13.7498 13.7501 12.0709 13.7501 9.99983C13.7501 7.92876 12.0712 6.24983 10.0001 6.24983C7.92902 6.24983 6.25009 7.92876 6.25009 9.99983C6.25009 12.0709 7.92902 13.7498 10.0001 13.7498Z" />
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M9.99974 0.416504C10.345 0.416504 10.6248 0.696326 10.6248 1.0415V2.9165C10.6248 3.26168 10.345 3.5415 9.99974 3.5415C9.65456 3.5415 9.37474 3.26168 9.37474 2.9165V1.0415C9.37474 0.696326 9.65456 0.416504 9.99974 0.416504ZM4.10994 2.36089C4.35402 2.11682 4.74975 2.11682 4.99382 2.36089L6.32633 3.6934C6.57041 3.93748 6.57041 4.33321 6.32633 4.57728C6.08225 4.82136 5.68652 4.82136 5.44245 4.57728L4.10994 3.24478C3.86586 3.0007 3.86586 2.60497 4.10994 2.36089ZM1.0415 9.37484C1.0415 9.02966 1.32132 8.74984 1.6665 8.74984H3.5415C3.88668 8.74984 4.1665 9.02966 4.1665 9.37484C4.1665 9.72002 3.88668 9.99984 3.5415 9.99984H1.6665C1.32132 9.99984 1.0415 9.72002 1.0415 9.37484ZM15.8332 9.37484C15.8332 9.02966 16.113 8.74984 16.4582 8.74984H18.3332C18.6784 8.74984 18.9582 9.02966 18.9582 9.37484C18.9582 9.72002 18.6784 9.99984 18.3332 9.99984H16.4582C16.113 9.99984 15.8332 9.72002 15.8332 9.37484ZM15.2122 2.36089C15.4563 2.11682 15.852 2.11682 16.0961 2.36089C16.3402 2.60497 16.3402 3.0007 16.0961 3.24478L14.7636 4.57728C14.5195 4.82136 14.1238 4.82136 13.8797 4.57728C13.6356 4.33321 13.6356 3.93748 13.8797 3.6934L15.2122 2.36089ZM9.99974 15.2082C10.345 15.2082 10.6248 15.488 10.6248 15.8332V17.7082C10.6248 18.0534 10.345 18.3332 9.99974 18.3332C9.65456 18.3332 9.37474 18.0534 9.37474 17.7082V15.8332C9.37474 15.488 9.65456 15.2082 9.99974 15.2082ZM3.6934 13.6726C3.93748 13.4285 4.33321 13.4285 4.57728 13.6726C4.82136 13.9167 4.82136 14.3124 4.57728 14.5565L3.24478 15.889C3.0007 16.1331 2.60497 16.1331 2.36089 15.889C2.11682 15.6449 2.11682 15.2492 2.36089 15.0051L3.6934 13.6726ZM14.5565 13.6726C14.8006 13.4285 15.1963 13.4285 15.4404 13.6726L16.7729 15.0051C17.017 15.2492 17.017 15.6449 16.7729 15.889C16.5288 16.1331 16.1331 16.1331 15.889 15.889L14.5565 14.5565C14.3124 14.3124 14.3124 13.9167 14.5565 13.6726ZM5.62474 9.99984C5.62474 7.58359 7.5835 5.62484 9.99974 5.62484C12.416 5.62484 14.3747 7.58359 14.3747 9.99984C14.3747 12.4161 12.416 14.3748 9.99974 14.3748C7.5835 14.3748 5.62474 12.4161 5.62474 9.99984Z"
                  />
                </svg>
              )}
            </button>

            {/* Language selector */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 shadow-theme-xs">
              <Globe className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                className="bg-transparent text-xs font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white/90 focus:outline-none cursor-pointer"
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
              className="relative flex items-center justify-center w-10 h-10 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-800 rounded-lg shadow-theme-xs hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors"
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
                className="flex items-center gap-2.5 p-1.5 rounded-lg border border-gray-200 dark:border-gray-800 shadow-theme-xs hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors"
              >
                <span className="flex items-center justify-center w-9 h-9 rounded-full bg-brand-50 text-sm font-bold text-brand-500">
                  {initials}
                </span>
                <span className="hidden md:block text-left leading-tight">
                  <span className="block text-sm font-medium text-gray-800 dark:text-white/90">{user?.name || 'Admin'}</span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400">{user?.role || 'ADMIN'}</span>
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
                <div className="absolute right-0 mt-2 flex w-[260px] flex-col rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 shadow-theme-lg animate-fade-in-up">
                  <div>
                    <span className="block font-medium text-gray-700 dark:text-gray-300 text-theme-sm">
                      {user?.name || 'Admin'}
                    </span>
                    <span className="mt-0.5 block text-theme-xs text-gray-500 dark:text-gray-400">
                      {user?.email || 'admin@equb.et'}
                    </span>
                  </div>
                  <ul className="flex flex-col gap-1 pt-4 pb-3 border-b border-gray-200 dark:border-gray-800">
                    <li>
                      <button
                        onClick={() => { setShowDropdown(false); router.push('/settings'); }}
                        className="menu-dropdown-item menu-dropdown-item-inactive w-full"
                      >
                        <UserIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                        {t('nav.settings')}
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => { setShowDropdown(false); router.push('/admins'); }}
                        className="menu-dropdown-item menu-dropdown-item-inactive w-full"
                      >
                        <SettingsIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
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
