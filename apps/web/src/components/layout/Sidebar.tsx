'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import clsx from 'clsx';
import {
  LayoutDashboard,
  Users,
  Receipt,
  Ticket,
  BookTemplate,
  Bell,
  LogOut,
  CircleDollarSign,
  Settings,
  Globe,
} from 'lucide-react';
import { getUnreadNotificationCount } from '@/lib/api';
import { useLanguage, Language } from './LanguageContext';

const navigation = [
  { name: 'Dashboard', key: 'nav.dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Groups', key: 'nav.groups', href: '/groups', icon: Users },
  { name: 'Members', key: 'nav.members', href: '/members', icon: Users },
  { name: 'Receipts', key: 'nav.receipts', href: '/receipts', icon: Receipt },
  { name: 'Lottery', key: 'nav.lottery', href: '/lottery', icon: Ticket },
  { name: 'Rule Templates', key: 'nav.rules', href: '/rule-templates', icon: BookTemplate },
  { name: 'Notifications', key: 'nav.notifications', href: '/notifications', icon: Bell },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const { language, setLanguage, t } = useLanguage();

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

  const handleLogout = () => {
    localStorage.removeItem('equb_token');
    router.push('/login');
  };

  return (
    <div className="flex flex-col h-full w-64 bg-gray-900 text-white">
      {/* Brand */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-gray-800">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl gradient-primary">
          <CircleDollarSign className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">Equb</h1>
          <p className="text-xs text-gray-400">{t('nav.admin_panel')}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href || pathname?.startsWith(item.href + '/');
          const displayName = t(item.key);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/20'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              )}
            >
              <item.icon className={clsx('h-5 w-5', isActive ? 'text-white' : 'text-gray-400')} />
              <span className="flex-1">{displayName}</span>
              {item.name === 'Notifications' && unreadCount > 0 && (
                <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold text-white bg-red-500 rounded-full">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User & Logout */}
      <div className="px-3 py-4 border-t border-gray-800">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center">
            <span className="text-xs font-bold text-white">AD</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">Admin</p>
            <p className="text-xs text-gray-400 truncate">admin@equb.et</p>
          </div>
        </div>
        
        {/* Language Quick Selector */}
        <div className="flex items-center gap-2 px-3 py-1.5 mb-2 rounded bg-gray-800/40 border border-gray-800">
          <Globe className="h-3.5 w-3.5 text-gray-400" />
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className="bg-transparent text-xs text-gray-300 hover:text-white focus:outline-none cursor-pointer w-full"
          >
            <option value="en" className="bg-gray-900 text-white">English 🇺🇸</option>
            <option value="am" className="bg-gray-900 text-white">አማርኛ 🇪🇹</option>
            <option value="om" className="bg-gray-900 text-white">Afaan Oromoo 🇪🇹</option>
            <option value="ti" className="bg-gray-900 text-white">ትግርኛ 🇪🇹</option>
          </select>
        </div>

        <Link
          href="/settings"
          className={clsx(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
            pathname === '/settings'
              ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/20'
              : 'text-gray-300 hover:bg-gray-800 hover:text-white'
          )}
        >
          <Settings className={clsx('h-5 w-5', pathname === '/settings' ? 'text-white' : 'text-gray-400')} />
          {t('nav.settings')}
        </Link>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition-all duration-200"
        >
          <LogOut className="h-5 w-5 text-gray-400" />
          {t('nav.logout')}
        </button>
      </div>
    </div>
  );
}
