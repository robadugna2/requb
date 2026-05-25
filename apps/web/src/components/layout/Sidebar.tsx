'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import clsx from 'clsx';
import {
  LayoutDashboard,
  Users,
  UserCircle,
  Receipt,
  Ticket,
  LogOut,
  CircleDollarSign,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Groups', href: '/groups', icon: Users },
  { name: 'Members', href: '/members', icon: UserCircle },
  { name: 'Receipts', href: '/receipts', icon: Receipt },
  { name: 'Lottery', href: '/lottery', icon: Ticket },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

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
          <p className="text-xs text-gray-400">Admin Dashboard</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href || pathname?.startsWith(item.href + '/');
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
              {item.name}
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
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition-all duration-200"
        >
          <LogOut className="h-5 w-5 text-gray-400" />
          Logout
        </button>
      </div>
    </div>
  );
}
