'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  AlertCircle,
  CheckCircle,
  XCircle,
  Ticket,
  UserPlus,
  Trash2,
  Shield,
  Calendar,
  Info,
  CheckCheck,
  Clock,
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useLanguage } from '@/components/layout/LanguageContext';
import { Button } from '@/components/ui/button';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from '@/lib/api';
import type { NotificationItem } from '@/lib/api';

const NOTIFICATION_CONFIG: Record<string, { icon: React.ElementType; bg: string; iconColor: string; dotColor: string }> = {
  DEADLINE_APPROACHING: { icon: Clock, bg: 'bg-yellow-50', iconColor: 'text-yellow-600', dotColor: 'bg-yellow-500' },
  PAYMENT_OVERDUE: { icon: AlertCircle, bg: 'bg-red-50', iconColor: 'text-red-600', dotColor: 'bg-red-500' },
  DEPOSIT_VERIFIED: { icon: CheckCircle, bg: 'bg-green-50', iconColor: 'text-green-600', dotColor: 'bg-green-500' },
  DEPOSIT_REJECTED: { icon: XCircle, bg: 'bg-red-50', iconColor: 'text-red-600', dotColor: 'bg-red-500' },
  LOTTERY_WIN: { icon: Ticket, bg: 'bg-purple-50', iconColor: 'text-purple-600', dotColor: 'bg-purple-500' },
  MEMBER_JOINED: { icon: UserPlus, bg: 'bg-green-50', iconColor: 'text-green-600', dotColor: 'bg-green-500' },
  MEMBER_REMOVED: { icon: Trash2, bg: 'bg-red-50', iconColor: 'text-red-600', dotColor: 'bg-red-500' },
  RULE_VIOLATION: { icon: Shield, bg: 'bg-red-50', iconColor: 'text-red-600', dotColor: 'bg-red-500' },
  CYCLE_STARTED: { icon: Calendar, bg: 'bg-blue-50', iconColor: 'text-blue-600', dotColor: 'bg-blue-500' },
  GENERAL: { icon: Info, bg: 'bg-blue-50', iconColor: 'text-blue-600', dotColor: 'bg-blue-500' },
};

const FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'read', label: 'Read' },
];

function getRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return 'just now';
  if (diffMinutes === 1) return '1 minute ago';
  if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
  if (diffHours === 1) return '1 hour ago';
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 30) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

export default function NotificationsPage() {
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [error, setError] = useState<string | null>(null);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: { read?: string } = {};
      if (filter === 'unread') filters.read = 'false';
      if (filter === 'read') filters.read = 'true';
      const data = await getNotifications(filters);
      setNotifications(data);
    } catch {
      setError('Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch {
      setError('Failed to mark notification as read.');
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingAllRead(true);
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      setError('Failed to mark all as read.');
    } finally {
      setMarkingAllRead(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch {
      setError('Failed to delete notification.');
    }
  };

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('notifications.title')}</h1>
            <p className="mt-1 text-sm text-gray-500">
              {t('notifications.subtitle')}
            </p>
          </div>
          {unreadCount > 0 && filter === 'all' && (
            <span className="inline-flex items-center justify-center h-6 px-2.5 text-xs font-bold text-white bg-red-500 rounded-full">
              {unreadCount} {t('receipts.pending').toLowerCase()}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleMarkAllRead}
            loading={markingAllRead}
          >
            <CheckCheck className="h-4 w-4 mr-2" />
            {t('notifications.mark_all')}
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 text-red-700 text-sm font-medium border border-red-100 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 font-bold text-lg">×</button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key as 'all' | 'unread' | 'read')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              filter === tab.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.key === 'all' ? t('receipts.all_status') : tab.key === 'unread' ? t('receipts.pending') : t('receipts.verified')}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
            <p className="text-sm text-gray-500">{t('notifications.loading')}</p>
          </div>
        </div>
      ) : notifications.length > 0 ? (
        <div className="space-y-2">
          {notifications.map((notification) => {
            const config = NOTIFICATION_CONFIG[notification.type] || NOTIFICATION_CONFIG.GENERAL;
            const Icon = config.icon;

            return (
              <div
                key={notification.id}
                className={`card flex items-start gap-4 p-4 transition-all cursor-pointer hover:shadow-md ${
                  !notification.read ? 'border-l-4 border-l-primary-500 bg-primary-50/30' : ''
                }`}
                onClick={() => {
                  if (!notification.read) handleMarkAsRead(notification.id);
                }}
              >
                {/* Icon */}
                <div className={`p-2.5 rounded-lg flex-shrink-0 ${config.bg}`}>
                  <Icon className={`h-5 w-5 ${config.iconColor}`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className={`text-sm font-semibold ${!notification.read ? 'text-gray-900' : 'text-gray-600'}`}>
                          {notification.title}
                        </h3>
                        {!notification.read && (
                          <span className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0" />
                        )}
                      </div>
                      <p className={`text-sm mt-0.5 ${!notification.read ? 'text-gray-700' : 'text-gray-500'}`}>
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-400 mt-1.5">
                        {getRelativeTime(notification.createdAt)}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(notification.id);
                      }}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                      title="Delete notification"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 card">
          <Bell className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">
            {filter === 'unread'
              ? t('notifications.all_caught_up')
              : filter === 'read'
              ? t('notifications.no_read')
              : t('notifications.no_notifications')}
          </h3>
          <p className="text-gray-500 text-sm">
            {filter === 'unread'
              ? t('notifications.no_unread_desc')
              : filter === 'read'
              ? t('notifications.no_read_desc')
              : t('notifications.no_notifications_desc')}
          </p>
        </div>
      )}
    </DashboardLayout>
  );
}
