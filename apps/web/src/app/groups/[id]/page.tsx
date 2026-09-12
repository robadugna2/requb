'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  AlertCircle,
  CircleDollarSign,
  Users,
  Inbox,
  Settings,
  FileBarChart,
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { AnimatePresence, motion } from 'framer-motion';
import { getGroup, triggerLottery } from '@/lib/api';
import type { GroupDetail } from '@/lib/api';
import { useAdminPermissions } from '@/lib/useAdminPermissions';
import GroupHeader from '@/components/groups/GroupHeader';
import DepositsTab from '@/components/groups/DepositsTab';
import ReportsTab from '@/components/groups/ReportsTab';
import MembersTab from '@/components/groups/MembersTab';
import RequestsTab from '@/components/groups/RequestsTab';
import SettingsTab from '@/components/groups/SettingsTab';

type TabKey = 'deposits' | 'members' | 'reports' | 'requests' | 'settings';

const TAB_DEFS: Array<{ key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'deposits', label: 'Deposits', icon: CircleDollarSign },
  { key: 'reports', label: 'Reports', icon: FileBarChart },
  { key: 'members', label: 'Members', icon: Users },
  { key: 'requests', label: 'Requests', icon: Inbox },
  { key: 'settings', label: 'Settings', icon: Settings },
];

export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [drawLoading, setDrawLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('deposits');
  const [refreshKey, setRefreshKey] = useState(0);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const notifySuccess = useCallback((msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 4000);
  }, []);

  const notifyError = useCallback((msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 6000);
  }, []);

  const permissions = useAdminPermissions();
  const groupPerms = permissions.permissionsByGroup[groupId];

  const isOwnerOrSuper = permissions.role === 'SUPER_ADMIN' ||
    (permissions.role === 'ADMIN' && group?.createdById === permissions.userId);

  const canManageDeposits = isOwnerOrSuper || permissions.isFullAccess || (groupPerms?.canManageDeposits ?? false);
  const canManageMembers = isOwnerOrSuper || permissions.isFullAccess || (groupPerms?.canManageMembers ?? false);
  const canManageRules = isOwnerOrSuper || permissions.isFullAccess || (groupPerms?.canManageRules ?? false);

  const visibleTabs: TabKey[] = (() => {
    if (permissions.loading || !group) return [];
    if (isOwnerOrSuper || permissions.isFullAccess) return ['deposits', 'reports', 'members', 'requests', 'settings'];
    const tabs: TabKey[] = [];
    if (canManageDeposits) tabs.push('deposits', 'reports');
    if (canManageMembers) tabs.push('members', 'requests');
    if (canManageRules) tabs.push('settings');
    return tabs;
  })();

  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.includes(activeTab)) {
      setActiveTab(visibleTabs[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleTabs.join(',')]);

  const fetchGroup = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const groupData = await getGroup(groupId);
      setGroup(groupData);
    } catch {
      setError('Failed to load group details.');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchGroup();
  }, [fetchGroup]);

  const handleLotteryDraw = async () => {
    setDrawLoading(true);
    setError(null);
    try {
      const result = await triggerLottery(groupId);
      notifySuccess(
        `Draw complete — ${result.winnerName} is the lucky member (ETB ${(result.gross || result.amount || 0).toLocaleString()}). Confirm the win in the Lottery Arena.`
      );
      await fetchGroup();
      setRefreshKey((k) => k + 1);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      notifyError(
        axiosErr.response?.data?.message || 'Lottery draw failed. Verify that current cycle has active verified deposits.'
      );
    } finally {
      setDrawLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading group…</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!group) {
    return (
      <DashboardLayout>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to groups
        </button>
        <div className="text-center py-16 card">
          <AlertCircle className="h-12 w-12 text-red-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white/90 mb-1">Group not found</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            This group may have been deleted or you don&apos;t have access to it.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {success && (
        <div className="mb-6 p-4 rounded-lg bg-green-50 dark:bg-success-500/10 text-green-700 dark:text-success-400 text-sm font-medium border border-green-100 flex items-center justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="text-green-500 hover:text-green-700 font-bold text-lg">×</button>
        </div>
      )}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-error-500/10 text-red-700 dark:text-error-400 text-sm font-medium border border-red-100 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 dark:text-error-400 hover:text-red-700 dark:hover:text-red-400 font-bold text-lg">×</button>
        </div>
      )}

      <button
        onClick={() => router.push('/groups')}
        className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to groups
      </button>

      <GroupHeader
        group={group}
        groupId={groupId}
        isOwnerOrSuper={isOwnerOrSuper}
        canTriggerLottery={permissions.isFullAccess || isOwnerOrSuper || (groupPerms?.canTriggerLottery ?? false)}
        drawLoading={drawLoading}
        onDrawLottery={handleLotteryDraw}
        onGroupUpdated={(updated) => setGroup((prev) => (prev ? { ...prev, ...updated } : updated))}
        onCbeAccountsSaved={(accounts) => setGroup((prev) => (prev ? { ...prev, cbeAccountNumbers: accounts } : prev))}
        notifySuccess={notifySuccess}
        notifyError={notifyError}
      />

      {/* Compact tab bar with sliding active pill */}
      {visibleTabs.length > 0 && (
        <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-white/[0.08] p-1 rounded-xl w-fit max-w-full overflow-x-auto">
          {TAB_DEFS.filter((tab) => visibleTabs.includes(tab.key)).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`relative flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === key ? 'text-gray-900 dark:text-white/90' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {activeTab === key && (
                <motion.span
                  layoutId="group-tab-pill"
                  className="absolute inset-0 bg-white dark:bg-gray-900 rounded-lg shadow-sm ring-1 ring-gray-200/60"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <Icon className="h-4 w-4" />
                {label}
                {key === 'members' && (
                  <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${activeTab === key ? 'bg-primary-100 dark:bg-brand-500/15 text-primary-700 dark:text-brand-400' : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400'}`}>
                    {group.membersCount}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Animated tab content */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        >
          {activeTab === 'deposits' && visibleTabs.includes('deposits') && (
            <DepositsTab
              groupId={groupId}
              group={group}
              groupCbeAccounts={group.cbeAccountNumbers || []}
              canManageDeposits={canManageDeposits}
              refreshKey={refreshKey}
              notifySuccess={notifySuccess}
              notifyError={notifyError}
            />
          )}

          {activeTab === 'reports' && visibleTabs.includes('reports') && (
            <ReportsTab groupId={groupId} group={group} />
          )}

          {activeTab === 'members' && visibleTabs.includes('members') && (
            <MembersTab
              group={group}
              groupId={groupId}
              canManage={canManageMembers}
              refreshKey={refreshKey}
              notifySuccess={notifySuccess}
              notifyError={notifyError}
              onGroupChanged={() => { fetchGroup(); setRefreshKey((k) => k + 1); }}
            />
          )}

          {activeTab === 'requests' && visibleTabs.includes('requests') && (
            <RequestsTab
              group={group}
              groupId={groupId}
              refreshKey={refreshKey}
              notifySuccess={notifySuccess}
              notifyError={notifyError}
            />
          )}

          {activeTab === 'settings' && visibleTabs.includes('settings') && (
            <SettingsTab
              groupId={groupId}
              isOwnerOrSuper={isOwnerOrSuper}
              refreshKey={refreshKey}
              notifySuccess={notifySuccess}
              notifyError={notifyError}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </DashboardLayout>
  );
}
