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
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { getGroup, triggerLottery } from '@/lib/api';
import type { GroupDetail } from '@/lib/api';
import { useAdminPermissions } from '@/lib/useAdminPermissions';
import GroupHeader from '@/components/groups/GroupHeader';
import DepositsTab from '@/components/groups/DepositsTab';
import MembersTab from '@/components/groups/MembersTab';
import RequestsTab from '@/components/groups/RequestsTab';
import SettingsTab from '@/components/groups/SettingsTab';

type TabKey = 'deposits' | 'members' | 'requests' | 'settings';

const TAB_DEFS: Array<{ key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'deposits', label: 'Deposits', icon: CircleDollarSign },
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
    if (isOwnerOrSuper || permissions.isFullAccess) return ['deposits', 'members', 'requests', 'settings'];
    const tabs: TabKey[] = [];
    if (canManageDeposits) tabs.push('deposits');
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
        `Lottery draw complete! Winner: ${result.winner?.name || 'TBD'} (Amount: ETB ${result.amount || 0})`
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
            <p className="text-sm text-gray-500">Loading group…</p>
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
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to groups
        </button>
        <div className="text-center py-16 card">
          <AlertCircle className="h-12 w-12 text-red-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">Group not found</h3>
          <p className="text-gray-500 text-sm">
            This group may have been deleted or you don&apos;t have access to it.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {success && (
        <div className="mb-6 p-4 rounded-lg bg-green-50 text-green-700 text-sm font-medium border border-green-100 flex items-center justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="text-green-500 hover:text-green-700 font-bold text-lg">×</button>
        </div>
      )}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 text-red-700 text-sm font-medium border border-red-100 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 font-bold text-lg">×</button>
        </div>
      )}

      <button
        onClick={() => router.push('/groups')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
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

      {/* Compact tab bar */}
      {visibleTabs.length > 0 && (
        <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit max-w-full overflow-x-auto">
          {TAB_DEFS.filter((tab) => visibleTabs.includes(tab.key)).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
              {key === 'members' && (
                <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${activeTab === key ? 'bg-gray-100 text-gray-600' : 'bg-white text-gray-500'}`}>
                  {group.membersCount}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

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
    </DashboardLayout>
  );
}
