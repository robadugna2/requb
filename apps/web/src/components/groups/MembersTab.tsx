'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  UserPlus,
  Search,
  Trash2,
  ChevronRight,
  ChevronDown,
  Plus,
  Briefcase,
  MapPin,
  Wallet,
  CircleDollarSign,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/ui/StatusBadge';
import Modal from '@/components/ui/Modal';
import PhotoUpload from '@/components/ui/PhotoUpload';
import {
  getMembers,
  addMemberToGroup,
  removeMemberFromGroup,
  createMember,
  getGroupMemberDues,
  getMergedGroups,
  getGroupFeeWaivers,
  updateMemberShares,
  createMergedGroup,
  dissolveMergedGroup,
  grantFeeWaiver,
  cancelFeeWaiver,
  updateMergedGroupPercentages,
  getMergedGroupDepositStatus,
  enforceMergedMemberCompliance,
  getMergedGroupDepositHistory,
  getMediaUrl,
} from '@/lib/api';
import type {
  GroupDetail,
  MemberListItem,
  MemberDueCalculation,
  MergedGroupItem,
  FeeWaiverItem,
  MergedMemberDepositStatusItem,
  MergedGroupDepositHistoryItem,
} from '@/lib/api';

const EMPLOYMENT_TYPES = [
  { value: '', label: 'Select...' },
  { value: 'PRIVATE', label: 'Private Sector' },
  { value: 'GOVERNMENT', label: 'Government' },
  { value: 'NGO', label: 'NGO' },
  { value: 'SELF_EMPLOYED', label: 'Self Employed' },
  { value: 'UNEMPLOYED', label: 'Unemployed' },
  { value: 'STUDENT', label: 'Student' },
  { value: 'RETIRED', label: 'Retired' },
];

const MARITAL_STATUSES = [
  { value: '', label: 'Select...' },
  { value: 'SINGLE', label: 'Single' },
  { value: 'MARRIED', label: 'Married' },
  { value: 'DIVORCED', label: 'Divorced' },
  { value: 'WIDOWED', label: 'Widowed' },
];

const SHARE_PRESETS = [0.25, 0.5, 0.75, 1, 1.5, 2];

function shareLabel(s: number): string {
  if (s === 0.25) return '¼';
  if (s === 0.5) return '½';
  if (s === 0.75) return '¾';
  if (s === 1.5) return '1½';
  return `${s}×`;
}

function formatEmployment(type?: string) {
  if (!type) return null;
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface MembersTabProps {
  group: GroupDetail;
  groupId: string;
  canManage: boolean;
  refreshKey: number;
  notifySuccess: (msg: string) => void;
  notifyError: (msg: string) => void;
  onGroupChanged: () => void;
}

export default function MembersTab({
  group,
  groupId,
  canManage,
  refreshKey,
  notifySuccess,
  notifyError,
  onGroupChanged,
}: MembersTabProps) {
  const router = useRouter();

  const [memberDues, setMemberDues] = useState<MemberDueCalculation[]>([]);
  const [mergedGroups, setMergedGroups] = useState<MergedGroupItem[]>([]);
  const [feeWaivers, setFeeWaivers] = useState<FeeWaiverItem[]>([]);
  const [sharesLoading, setSharesLoading] = useState(false);
  const [rosterSearch, setRosterSearch] = useState('');

  // Add member modal
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [availableMembers, setAvailableMembers] = useState<MemberListItem[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [membersLoading, setMembersLoading] = useState(false);
  const [addingMemberId, setAddingMemberId] = useState<string | null>(null);
  const [addMemberShares, setAddMemberShares] = useState<number>(1);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creatingMember, setCreatingMember] = useState(false);
  const [newMemberForm, setNewMemberForm] = useState({
    name: '',
    phone: '',
    telegramId: '',
    governmentId: '',
    photoUrl: '',
    employmentType: '',
    employerName: '',
    maritalStatus: '',
    country: 'Ethiopia',
    city: '',
    subCity: '',
    woreda: '',
    houseNumber: '',
  });

  // Edit shares modal
  const [showEditSharesModal, setShowEditSharesModal] = useState<{ userId: string; userName: string; currentShares: number } | null>(null);
  const [editingShares, setEditingShares] = useState(1);
  const [savingShares, setSavingShares] = useState(false);

  // Waiver modal
  const [showGrantWaiverModal, setShowGrantWaiverModal] = useState(false);
  const [waiverForm, setWaiverForm] = useState({ userId: '', reason: '', durationCycles: 1 });
  const [grantingWaiver, setGrantingWaiver] = useState(false);
  const [cancellingWaiverId, setCancellingWaiverId] = useState<string | null>(null);

  // Merged groups
  const [showCreateMergedModal, setShowCreateMergedModal] = useState(false);
  const [mergedForm, setMergedForm] = useState<{ name: string; selectedUserIds: string[]; totalShares: number }>({ name: '', selectedUserIds: [], totalShares: 1 });
  const [creatingMerged, setCreatingMerged] = useState(false);
  const [dissolvingMergedId, setDissolvingMergedId] = useState<string | null>(null);
  const [mergedDepositStatuses, setMergedDepositStatuses] = useState<Record<string, MergedMemberDepositStatusItem[]>>({});
  const [loadingDepositStatus, setLoadingDepositStatus] = useState<string | null>(null);
  const [enforcingCompliance, setEnforcingCompliance] = useState<string | null>(null);
  const [depositHistory, setDepositHistory] = useState<Record<string, MergedGroupDepositHistoryItem>>({});
  const [loadingHistory, setLoadingHistory] = useState<string | null>(null);
  const [expandedHistoryCycles, setExpandedHistoryCycles] = useState<Record<string, boolean>>({});
  const [showEditPercentagesModal, setShowEditPercentagesModal] = useState<MergedGroupItem | null>(null);
  const [percentageForm, setPercentageForm] = useState<Array<{ userId: string; userName: string; sharePercentage: number }>>([]);
  const [savingPercentages, setSavingPercentages] = useState(false);

  const fetchSharesData = async () => {
    setSharesLoading(true);
    try {
      const [duesData, mergedData, waiversData] = await Promise.allSettled([
        getGroupMemberDues(groupId),
        getMergedGroups(groupId),
        getGroupFeeWaivers(groupId),
      ]);
      if (duesData.status === 'fulfilled') setMemberDues(duesData.value);
      if (mergedData.status === 'fulfilled') setMergedGroups(mergedData.value);
      if (waiversData.status === 'fulfilled') setFeeWaivers(waiversData.value);
    } catch {} finally { setSharesLoading(false); }
  };

  useEffect(() => {
    fetchSharesData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, refreshKey]);

  const resetNewMemberForm = () => {
    setNewMemberForm({
      name: '',
      phone: '',
      telegramId: '',
      governmentId: '',
      photoUrl: '',
      employmentType: '',
      employerName: '',
      maritalStatus: '',
      country: 'Ethiopia',
      city: '',
      subCity: '',
      woreda: '',
      houseNumber: '',
    });
  };

  const openAddMemberModal = async () => {
    setShowAddMemberModal(true);
    setMemberSearch('');
    setMembersLoading(true);
    try {
      const allMembers = await getMembers();
      setAvailableMembers(allMembers);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      notifyError(axiosErr.response?.data?.message || 'Failed to load members list.');
    } finally {
      setMembersLoading(false);
    }
  };

  const handleAddMember = async (userId: string) => {
    setAddingMemberId(userId);
    try {
      await addMemberToGroup(groupId, userId, addMemberShares);
      setShowAddMemberModal(false);
      setAddMemberShares(1);
      notifySuccess('Member added to group successfully!');
      onGroupChanged();
      await fetchSharesData();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      notifyError(axiosErr.response?.data?.message || 'Failed to add member. Please try again.');
    } finally {
      setAddingMemberId(null);
    }
  };

  const handleCreateAndAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingMember(true);
    try {
      const result = await createMember({
        name: newMemberForm.name,
        phone: newMemberForm.phone,
        telegramId: newMemberForm.telegramId || undefined,
        governmentId: newMemberForm.governmentId || undefined,
        photoUrl: newMemberForm.photoUrl || undefined,
        employmentType: newMemberForm.employmentType || undefined,
        employerName: newMemberForm.employerName || undefined,
        maritalStatus: newMemberForm.maritalStatus || undefined,
        country: newMemberForm.country || undefined,
        city: newMemberForm.city || undefined,
        subCity: newMemberForm.subCity || undefined,
        woreda: newMemberForm.woreda || undefined,
        houseNumber: newMemberForm.houseNumber || undefined,
      });
      await addMemberToGroup(groupId, result.id, addMemberShares);
      setShowAddMemberModal(false);
      setShowCreateForm(false);
      resetNewMemberForm();
      setAddMemberShares(1);
      notifySuccess('New member created and added to group!');
      onGroupChanged();
      await fetchSharesData();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      notifyError(axiosErr.response?.data?.message || 'Failed to create member. Please try again.');
    } finally {
      setCreatingMember(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    setRemovingMemberId(userId);
    try {
      await removeMemberFromGroup(groupId, userId);
      notifySuccess('Member removed from group.');
      onGroupChanged();
      await fetchSharesData();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      notifyError(axiosErr.response?.data?.message || 'Failed to remove member. Please try again.');
    } finally {
      setRemovingMemberId(null);
    }
  };

  const handleUpdateShares = async () => {
    if (!showEditSharesModal) return;
    setSavingShares(true);
    try {
      await updateMemberShares(groupId, showEditSharesModal.userId, editingShares);
      setShowEditSharesModal(null);
      notifySuccess('Member shares updated successfully!');
      await fetchSharesData();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      notifyError(axiosErr.response?.data?.message || 'Failed to update shares.');
    } finally { setSavingShares(false); }
  };

  const handleGrantWaiver = async (e: React.FormEvent) => {
    e.preventDefault();
    setGrantingWaiver(true);
    try {
      await grantFeeWaiver({ groupId, userId: waiverForm.userId, reason: waiverForm.reason, durationCycles: waiverForm.durationCycles });
      setShowGrantWaiverModal(false);
      setWaiverForm({ userId: '', reason: '', durationCycles: 1 });
      notifySuccess('Fee waiver granted successfully!');
      await fetchSharesData();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      notifyError(axiosErr.response?.data?.message || 'Failed to grant fee waiver.');
    } finally { setGrantingWaiver(false); }
  };

  const handleCancelWaiver = async (waiverId: string) => {
    setCancellingWaiverId(waiverId);
    try {
      await cancelFeeWaiver(waiverId);
      notifySuccess('Fee waiver cancelled.');
      await fetchSharesData();
    } catch { notifyError('Failed to cancel waiver.'); } finally { setCancellingWaiverId(null); }
  };

  const handleCreateMergedGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingMerged(true);
    try {
      await createMergedGroup({ groupId, name: mergedForm.name || undefined, userIds: mergedForm.selectedUserIds, totalShares: mergedForm.totalShares });
      setShowCreateMergedModal(false);
      setMergedForm({ name: '', selectedUserIds: [], totalShares: 1 });
      notifySuccess('Merged group created successfully!');
      await fetchSharesData();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      notifyError(axiosErr.response?.data?.message || 'Failed to create merged group.');
    } finally { setCreatingMerged(false); }
  };

  const fetchMergedGroupStatus = async (mergedGroupId: string) => {
    setLoadingDepositStatus(mergedGroupId);
    try {
      const statuses = await getMergedGroupDepositStatus(mergedGroupId);
      setMergedDepositStatuses((prev) => ({ ...prev, [mergedGroupId]: statuses }));
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      notifyError(axiosErr.response?.data?.message || 'Failed to fetch deposit status.');
    } finally { setLoadingDepositStatus(null); }
  };

  const handleEnforceCompliance = async (mergedGroupId: string) => {
    if (!window.confirm('Enforce compliance? This will create penalties for members who have not paid their portion.')) return;
    setEnforcingCompliance(mergedGroupId);
    try {
      const result = await enforceMergedMemberCompliance(mergedGroupId);
      if (result.penaltiesCreated.length > 0) {
        notifySuccess(`Compliance enforced: ${result.penaltiesCreated.length} penalty(ies) created.`);
      } else {
        notifySuccess('All members are compliant — no penalties needed.');
      }
      await fetchMergedGroupStatus(mergedGroupId);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      notifyError(axiosErr.response?.data?.message || 'Failed to enforce compliance.');
    } finally { setEnforcingCompliance(null); }
  };

  const fetchDepositHistory = async (mergedGroupId: string) => {
    setLoadingHistory(mergedGroupId);
    try {
      const history = await getMergedGroupDepositHistory(mergedGroupId);
      setDepositHistory((prev) => ({ ...prev, [mergedGroupId]: history }));
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      notifyError(axiosErr.response?.data?.message || 'Failed to load deposit history.');
    } finally { setLoadingHistory(null); }
  };

  const toggleHistoryCycle = (cycleId: string) => {
    setExpandedHistoryCycles((prev) => ({ ...prev, [cycleId]: !prev[cycleId] }));
  };

  const handleDissolveMergedGroup = async (mergedGroupId: string) => {
    if (!window.confirm('Are you sure you want to dissolve this merged group?')) return;
    setDissolvingMergedId(mergedGroupId);
    try {
      await dissolveMergedGroup(mergedGroupId);
      notifySuccess('Merged group dissolved.');
      await fetchSharesData();
    } catch { notifyError('Failed to dissolve merged group.'); } finally { setDissolvingMergedId(null); }
  };

  const openEditPercentages = (mg: MergedGroupItem) => {
    const activeSlots = mg.slots.filter((s) => s.status === 'ACTIVE');
    setPercentageForm(
      activeSlots.map((slot) => ({
        userId: slot.user.id,
        userName: slot.user.name,
        sharePercentage: slot.sharePercentage,
      }))
    );
    setShowEditPercentagesModal(mg);
  };

  const handleSavePercentages = async () => {
    if (!showEditPercentagesModal) return;
    setSavingPercentages(true);
    try {
      await updateMergedGroupPercentages(
        showEditPercentagesModal.id,
        percentageForm.map(({ userId, sharePercentage }) => ({ userId, sharePercentage })),
      );
      setShowEditPercentagesModal(null);
      notifySuccess('Share percentages updated successfully!');
      await fetchSharesData();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      notifyError(axiosErr.response?.data?.message || 'Failed to update percentages.');
    } finally { setSavingPercentages(false); }
  };

  // Join roster rows: dues (shares & amounts) + member profile info
  const rosterRows = useMemo(() => {
    const byId = new Map(group.members.map((m) => [m.id, m]));
    return memberDues
      .map((due) => {
        const member = byId.get(due.userId);
        return member ? { ...due, member } : null;
      })
      .filter((x): x is MemberDueCalculation & { member: typeof group.members[number] } => x !== null)
      .sort((a, b) => b.shares - a.shares || a.userName.localeCompare(b.userName));
  }, [memberDues, group.members]);

  const filteredRoster = useMemo(() => {
    if (!rosterSearch.trim()) return rosterRows;
    const q = rosterSearch.trim().toLowerCase();
    return rosterRows.filter(
      (r) => r.userName.toLowerCase().includes(q) || (r.member.phone ?? '').includes(q)
    );
  }, [rosterRows, rosterSearch]);

  const filteredAvailableMembers = availableMembers
    .filter((m) => !group?.members.some((gm) => gm.id === m.id))
    .filter(
      (m) =>
        m.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
        m.phone.includes(memberSearch)
    );

  const suggestedFromOtherGroups = filteredAvailableMembers.filter((m) => m.groups.length > 0);
  const ungroupedMembers = filteredAvailableMembers.filter((m) => m.groups.length === 0);

  const totalPerCycle = rosterRows.reduce((s, r) => s + r.totalDue, 0);

  return (
    <div className="space-y-6">
      {/* Unified Member Roster */}
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white/90">Members & Shares</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {group.members.length} active · ETB {totalPerCycle.toLocaleString()} collected per cycle
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
              <input
                type="text"
                value={rosterSearch}
                onChange={(e) => setRosterSearch(e.target.value)}
                placeholder="Search name or phone…"
                className="input-field pl-9 text-sm w-full"
              />
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setShowGrantWaiverModal(true)}
            >
              <CircleDollarSign className="h-4 w-4 mr-1.5" />
              Waiver
            </Button>
            {group.membersCount < group.maxMembers && canManage && (
              <Button size="sm" onClick={openAddMemberModal}>
                <UserPlus className="h-4 w-4 mr-1.5" />
                Add
              </Button>
            )}
          </div>
        </div>

        {sharesLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-4">
              <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading member roster…</p>
            </div>
          </div>
        ) : filteredRoster.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-white/[0.04] border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th className="table-header">#</th>
                  <th className="table-header">Member</th>
                  <th className="table-header text-center">Share</th>
                  <th className="table-header text-right">Per Cycle</th>
                  <th className="table-header text-right">Admin Fee</th>
                  <th className="table-header text-right">Total Due</th>
                  <th className="table-header">Won</th>
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {filteredRoster.map((row, index) => (
                  <tr
                    key={row.userId}
                    className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/members/${row.userId}`)}
                  >
                    <td className="table-cell text-gray-500 dark:text-gray-400">{index + 1}</td>
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-brand-500/15 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {row.member.photoUrl ? (
                            <img src={getMediaUrl(row.member.photoUrl)} alt={row.userName} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xs font-bold text-primary-700 dark:text-brand-400">
                              {row.userName.split(' ').map((n) => n[0]).join('')}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 dark:text-white/90 truncate">{row.userName}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{row.member.phone}</p>
                        </div>
                        {row.mergedGroupName && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-violet-50 dark:bg-theme-purple-500/10 text-violet-600 dark:text-theme-purple-500 font-medium" title={`Merged: ${row.mergedGroupName}`}>
                            {row.mergedGroupName}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="table-cell text-center">
                      <span
                        className={`inline-flex items-center justify-center min-w-[2.25rem] px-1.5 h-7 rounded-full font-bold text-sm ${
                          row.shares === 1
                            ? 'bg-indigo-50 dark:bg-brand-500/10 text-indigo-700 dark:text-brand-400'
                            : row.shares > 1
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 dark:bg-warning-500/10 text-amber-700 dark:text-warning-400'
                        }`}
                        title={`${row.shares} share(s) — ETB ${(group.contributionAmount * row.shares).toLocaleString()} / cycle`}
                      >
                        {shareLabel(row.shares)}
                      </span>
                    </td>
                    <td className="table-cell text-right text-gray-700 dark:text-gray-300">
                      ETB {row.contributionDue.toLocaleString()}
                    </td>
                    <td className="table-cell text-right text-gray-500 dark:text-gray-400">
                      ETB {row.adminFeeDue.toLocaleString()}
                    </td>
                    <td className="table-cell text-right font-semibold text-gray-900 dark:text-white/90">
                      ETB {row.totalDue.toLocaleString()}
                    </td>
                    <td className="table-cell">
                      {row.member.hasWon ? (
                        <StatusBadge status="verified">Won</StatusBadge>
                      ) : (
                        <StatusBadge status="pending">Pending</StatusBadge>
                      )}
                    </td>
                    <td className="table-cell text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {canManage && (
                          <>
                            <button
                              onClick={() => {
                                setShowEditSharesModal({ userId: row.userId, userName: row.userName, currentShares: row.shares });
                                setEditingShares(row.shares);
                              }}
                              className="p-1.5 text-indigo-600 dark:text-brand-400 hover:bg-indigo-50 dark:hover:bg-brand-500/10 rounded-lg transition-colors"
                              title="Edit shares"
                            >
                              <Wallet className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleRemoveMember(row.userId)}
                              disabled={removingMemberId === row.userId}
                              className="p-1.5 text-red-600 dark:text-error-400 hover:bg-red-50 dark:hover:bg-error-500/10 rounded-lg transition-colors disabled:opacity-50"
                              title="Remove member"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        <ChevronRight className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Users className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              {rosterSearch ? 'No members match your search.' : 'No members yet.'}
            </p>
            {!rosterSearch && canManage && (
              <Button onClick={openAddMemberModal} size="sm" className="mt-4">
                <UserPlus className="h-4 w-4 mr-2" />
                Add First Member
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Merged Groups Section */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white/90">Merged Member Groups (ድርሻ ማጣመር)</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Combine multiple members into a single share slot</p>
          </div>
          {canManage && (
            <Button size="sm" onClick={() => setShowCreateMergedModal(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Create Merged
            </Button>
          )}
        </div>

        {mergedGroups.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mergedGroups.map((mg) => (
              <div key={mg.id} className={`border rounded-xl p-4 transition-all ${mg.status === 'DISSOLVED' ? 'bg-gray-50 dark:bg-white/[0.04] border-gray-200 dark:border-gray-800 opacity-60' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-indigo-200 hover:shadow-sm'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                      <Users className="h-4 w-4 text-violet-600 dark:text-theme-purple-500" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white/90 text-sm">{mg.name}</h4>
                      <p className="text-xs text-gray-400 dark:text-gray-500">{mg.slots.length} members · {mg.totalShares} shares</p>
                    </div>
                  </div>
                  {mg.status === 'ACTIVE' && (
                    <div className="flex gap-1.5 flex-wrap">
                      <Button size="sm" variant="secondary" loading={loadingDepositStatus === mg.id} onClick={() => fetchMergedGroupStatus(mg.id)}>
                        Check Status
                      </Button>
                      <Button size="sm" variant="secondary" loading={loadingHistory === mg.id} onClick={() => fetchDepositHistory(mg.id)}>
                        <Clock className="h-3.5 w-3.5 mr-1" />
                        History
                      </Button>
                      <Button size="sm" variant="default" loading={enforcingCompliance === mg.id} onClick={() => handleEnforceCompliance(mg.id)}>
                        Enforce
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => openEditPercentages(mg)}>
                        %
                      </Button>
                      <Button size="sm" variant="secondary" loading={dissolvingMergedId === mg.id} onClick={() => handleDissolveMergedGroup(mg.id)}>
                        Dissolve
                      </Button>
                    </div>
                  )}
                  {mg.status === 'DISSOLVED' && (
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-white/[0.08] px-2 py-1 rounded">Dissolved</span>
                  )}
                </div>
                <div className="space-y-2">
                  {mg.slots.map((slot) => {
                    const depositStatus = mergedDepositStatuses[mg.id]?.find((s) => s.userId === slot.user.id);
                    return (
                      <div key={slot.id} className="rounded-md bg-gray-50 dark:bg-white/[0.04] overflow-hidden">
                        <div className="flex items-center justify-between py-1.5 px-2">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-brand-500/15 flex items-center justify-center">
                              <span className="text-[10px] font-bold text-primary-700 dark:text-brand-400">
                                {slot.user.name.split(' ').map((n) => n[0]).join('')}
                              </span>
                            </div>
                            <span className="text-sm text-gray-700 dark:text-gray-300">{slot.user.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {depositStatus && (
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                depositStatus.status === 'PAID' ? 'bg-green-100 dark:bg-success-500/20 text-green-700 dark:text-success-400' :
                                depositStatus.status === 'PARTIAL' ? 'bg-amber-100 dark:bg-warning-500/20 text-amber-700 dark:text-warning-400' :
                                depositStatus.status === 'LATE' ? 'bg-red-100 dark:bg-error-500/20 text-red-700 dark:text-error-400' :
                                'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                              }`}>
                                {depositStatus.status}
                              </span>
                            )}
                            <span className="text-xs font-semibold text-indigo-600 dark:text-brand-400 bg-indigo-50 dark:bg-brand-500/10 px-2 py-0.5 rounded">
                              {(slot.sharePercentage * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                        {depositStatus && (
                          <div className="px-2 pb-2 pt-0.5">
                            <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 mb-1">
                              <span>ETB {depositStatus.paidAmount.toLocaleString()} / {depositStatus.expectedTotal.toLocaleString()}</span>
                              <span className="text-gray-400 dark:text-gray-500">
                                (Fee: ETB {depositStatus.expectedAdminFee.toLocaleString()})
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  depositStatus.status === 'PAID' ? 'bg-green-500' :
                                  depositStatus.status === 'PARTIAL' ? 'bg-amber-500' :
                                  depositStatus.status === 'LATE' ? 'bg-red-500' :
                                  'bg-gray-400'
                                }`}
                                style={{ width: `${Math.min(100, depositStatus.expectedTotal > 0 ? (depositStatus.paidAmount / depositStatus.expectedTotal) * 100 : 0)}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Deposit History Timeline */}
                {depositHistory[mg.id] && (
                  <div className="mt-3 border-t border-gray-100 dark:border-gray-800 pt-3">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Deposit History</p>
                    {depositHistory[mg.id].cycles.length > 0 ? (
                      <div className="space-y-1">
                        {depositHistory[mg.id].cycles.map((cycle) => {
                          const paymentRatio = cycle.totalExpected > 0 ? cycle.totalPaid / cycle.totalExpected : 0;
                          const isExpanded = expandedHistoryCycles[cycle.cycleId] ?? false;
                          const borderColor = paymentRatio >= 0.99 ? 'border-green-400' : paymentRatio > 0 ? 'border-amber-400' : 'border-red-400';
                          const bgColor = paymentRatio >= 0.99 ? 'bg-green-50 dark:bg-success-500/10' : paymentRatio > 0 ? 'bg-amber-50 dark:bg-warning-500/10' : 'bg-red-50 dark:bg-error-500/10';

                          return (
                            <div key={cycle.cycleId} className={`border-l-4 ${borderColor} rounded-r-lg overflow-hidden`}>
                              <button
                                type="button"
                                onClick={() => toggleHistoryCycle(cycle.cycleId)}
                                className={`w-full flex items-center justify-between px-3 py-2 ${bgColor} hover:brightness-95 transition-all text-left`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Cycle {cycle.cycleNumber}</span>
                                  <span className="text-[10px] text-gray-400 dark:text-gray-500 hidden sm:inline">
                                    {new Date(cycle.startDate).toLocaleDateString('en-CA')} → {new Date(cycle.endDate).toLocaleDateString('en-CA')}
                                  </span>
                                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                    cycle.cycleStatus === 'COMPLETED' ? 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400' : 'bg-blue-100 dark:bg-blue-light-500/20 text-blue-700'
                                  }`}>
                                    {cycle.cycleStatus}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${
                                        paymentRatio >= 0.99 ? 'bg-green-500' : paymentRatio > 0 ? 'bg-amber-500' : 'bg-red-500'
                                      }`}
                                      style={{ width: `${Math.min(100, paymentRatio * 100)}%` }}
                                    />
                                  </div>
                                  <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-400 w-8 text-right">
                                    {Math.round(paymentRatio * 100)}%
                                  </span>
                                  <ChevronDown className={`h-3.5 w-3.5 text-gray-400 dark:text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                </div>
                              </button>

                              {isExpanded && (
                                <div className="px-3 py-2 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="text-gray-500 dark:text-gray-400">
                                        <th className="text-left py-1 font-medium">Member</th>
                                        <th className="text-right py-1 font-medium">Expected</th>
                                        <th className="text-right py-1 font-medium">Paid</th>
                                        <th className="text-right py-1 font-medium">Status</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                                      {cycle.members.map((member) => (
                                        <tr key={member.userId}>
                                          <td className="py-1.5 text-gray-700 dark:text-gray-300 font-medium">{member.userName}</td>
                                          <td className="py-1.5 text-right text-gray-500 dark:text-gray-400">
                                            ETB {member.expectedTotal.toLocaleString()}
                                          </td>
                                          <td className="py-1.5 text-right text-gray-700 dark:text-gray-300 font-medium">
                                            ETB {member.paidAmount.toLocaleString()}
                                          </td>
                                          <td className="py-1.5 text-right">
                                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                              member.status === 'PAID' ? 'bg-green-100 dark:bg-success-500/20 text-green-700 dark:text-success-400' :
                                              member.status === 'PARTIAL' ? 'bg-amber-100 dark:bg-warning-500/20 text-amber-700 dark:text-warning-400' :
                                              member.status === 'LATE' ? 'bg-red-100 dark:bg-error-500/20 text-red-700 dark:text-error-400' :
                                              'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                                            }`}>
                                              {member.status}
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                  <div className="flex justify-between mt-1.5 pt-1.5 border-t border-gray-100 dark:border-gray-800 text-[10px] text-gray-500 dark:text-gray-400">
                                    <span>Total Expected: ETB {cycle.totalExpected.toLocaleString()}</span>
                                    <span>Total Paid: ETB {cycle.totalPaid.toLocaleString()}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 dark:text-gray-500 italic">No history recorded yet.</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Users className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400 text-sm">No merged groups yet.</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Merge 2–4 members into one shared slot if they contribute together.</p>
          </div>
        )}
      </div>

      {/* Fee Waivers Section */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white/90">Admin Fee Waivers</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Members temporarily excused from the admin fee</p>
          </div>
        </div>

        {feeWaivers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-white/[0.04] border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th className="table-header">Member</th>
                  <th className="table-header">Reason</th>
                  <th className="table-header text-center">Used</th>
                  <th className="table-header text-center">Duration</th>
                  <th className="table-header text-center">Missed</th>
                  <th className="table-header">Status</th>
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {feeWaivers.map((waiver) => (
                  <tr key={waiver.id} className="hover:bg-gray-50/30 transition-colors">
                    <td className="table-cell font-medium text-gray-900 dark:text-white/90">
                      {waiver.user?.name || 'Unknown'}
                    </td>
                    <td className="table-cell text-gray-500 dark:text-gray-400 max-w-xs truncate" title={waiver.reason}>
                      {waiver.reason}
                    </td>
                    <td className="table-cell text-center">
                      <span className="font-semibold text-gray-900 dark:text-white/90">{waiver.cyclesUsed}</span>
                      <span className="text-gray-400 dark:text-gray-500"> / {waiver.durationCycles}</span>
                    </td>
                    <td className="table-cell text-center text-gray-700 dark:text-gray-300">
                      {waiver.durationCycles} cycles
                    </td>
                    <td className="table-cell text-center">
                      {waiver.missedAfterExpiry > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-error-500/20 text-red-700 dark:text-error-400">
                          {waiver.missedAfterExpiry}
                        </span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">0</span>
                      )}
                    </td>
                    <td className="table-cell">
                      <StatusBadge
                        status={
                          waiver.status === 'ACTIVE'
                            ? 'active'
                            : waiver.status === 'EXPIRED'
                            ? 'completed'
                            : 'inactive'
                        }
                      >
                        {waiver.status}
                      </StatusBadge>
                    </td>
                    <td className="table-cell text-right">
                      {waiver.status === 'ACTIVE' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={cancellingWaiverId === waiver.id}
                          onClick={() => handleCancelWaiver(waiver.id)}
                        >
                          Cancel
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <CircleDollarSign className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400 text-sm">No fee waivers granted.</p>
          </div>
        )}
      </div>

      {/* ─── Modals ─────────────────────────────────────────── */}

      {/* Edit Shares Modal */}
      <Modal
        isOpen={!!showEditSharesModal}
        onClose={() => setShowEditSharesModal(null)}
        title="Edit Member Shares"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Update the number of shares for <strong>{showEditSharesModal?.userName}</strong>. Each share multiplies the contribution and admin fee amounts.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Shares count</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {SHARE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setEditingShares(preset)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    editingShares === preset
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.08] border border-gray-200 dark:border-gray-800'
                  }`}
                >
                  {shareLabel(preset)}
                </button>
              ))}
            </div>
            <input
              type="number"
              value={editingShares || ''}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setEditingShares(isNaN(val) ? 0.25 : Math.max(0.25, Math.min(10, val)));
              }}
              className="input-field"
              min={0.25}
              max={10}
              step={0.01}
              placeholder="Custom shares count (0.25 - 10)"
            />
            <div className="flex items-center justify-between text-xs text-indigo-800 dark:text-brand-300 bg-indigo-100/60 rounded-md px-2.5 py-1.5 mt-2">
              <span>Expected per cycle:</span>
              <span className="font-bold">ETB {(group.contributionAmount * editingShares).toLocaleString()}</span>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowEditSharesModal(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateShares} loading={savingShares}>
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>

      {/* Grant Waiver Modal */}
      <Modal
        isOpen={showGrantWaiverModal}
        onClose={() => {
          setShowGrantWaiverModal(false);
          setWaiverForm({ userId: '', reason: '', durationCycles: 1 });
        }}
        title="Grant Fee Waiver"
        size="sm"
      >
        <form onSubmit={handleGrantWaiver} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Member *</label>
            <select
              value={waiverForm.userId}
              onChange={(e) => setWaiverForm({ ...waiverForm, userId: e.target.value })}
              className="input-field"
              required
            >
              <option value="" disabled>Select a member…</option>
              {group?.members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Reason</label>
            <textarea
              value={waiverForm.reason}
              onChange={(e) => setWaiverForm({ ...waiverForm, reason: e.target.value })}
              className="input-field"
              rows={3}
              placeholder="Why is this fee waived?"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Duration (cycles)</label>
            <input
              type="number"
              value={waiverForm.durationCycles}
              onChange={(e) => setWaiverForm({ ...waiverForm, durationCycles: Math.max(1, Number(e.target.value)) })}
              className="input-field"
              min={1}
              max={52}
              required
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowGrantWaiverModal(false);
                setWaiverForm({ userId: '', reason: '', durationCycles: 1 });
              }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={grantingWaiver} disabled={!waiverForm.userId || !waiverForm.reason}>
              Grant Waiver
            </Button>
          </div>
        </form>
      </Modal>

      {/* Create Merged Group Modal */}
      <Modal
        isOpen={showCreateMergedModal}
        onClose={() => {
          setShowCreateMergedModal(false);
          setMergedForm({ name: '', selectedUserIds: [], totalShares: 1 });
        }}
        title="Create Merged Member Group"
        size="sm"
      >
        <form onSubmit={handleCreateMergedGroup} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Group Name</label>
            <input
              type="text"
              value={mergedForm.name}
              onChange={(e) => setMergedForm({ ...mergedForm, name: e.target.value })}
              className="input-field"
              placeholder="Optional — auto-named if empty"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Members (2–4)</label>
            <div className="border border-gray-200 dark:border-gray-800 rounded-lg max-h-48 overflow-y-auto">
              {group?.members.map((member) => (
                <label
                  key={member.id}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-white/[0.04] cursor-pointer border-b border-gray-50 dark:border-gray-800 last:border-0"
                >
                  <input
                    type="checkbox"
                    checked={mergedForm.selectedUserIds.includes(member.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        if (mergedForm.selectedUserIds.length < 4) {
                          setMergedForm({ ...mergedForm, selectedUserIds: [...mergedForm.selectedUserIds, member.id] });
                        }
                      } else {
                        setMergedForm({ ...mergedForm, selectedUserIds: mergedForm.selectedUserIds.filter((id) => id !== member.id) });
                      }
                    }}
                    disabled={!mergedForm.selectedUserIds.includes(member.id) && mergedForm.selectedUserIds.length >= 4}
                    className="rounded border-gray-300 text-primary-600 dark:text-brand-400 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{member.name}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {mergedForm.selectedUserIds.length}/4 members selected (min 2)
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Total Shares</label>
            <input
              type="number"
              value={mergedForm.totalShares}
              onChange={(e) => setMergedForm({ ...mergedForm, totalShares: Math.max(1, Number(e.target.value)) })}
              className="input-field"
              min={1}
              max={5}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowCreateMergedModal(false);
                setMergedForm({ name: '', selectedUserIds: [], totalShares: 1 });
              }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={creatingMerged} disabled={mergedForm.selectedUserIds.length < 2}>
              Create Merged Group
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Merged Group Percentages Modal */}
      <Modal
        isOpen={!!showEditPercentagesModal}
        onClose={() => setShowEditPercentagesModal(null)}
        title="Edit Share Percentages"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Assign custom share percentages for each member in <strong>{showEditPercentagesModal?.name}</strong>. Percentages must total 100%.
          </p>
          <div className="space-y-3">
            {percentageForm.map((entry, idx) => (
              <div key={entry.userId} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white/90 truncate">{entry.userName}</p>
                </div>
                <div className="flex items-center gap-2 w-32">
                  <input
                    type="number"
                    value={parseFloat((entry.sharePercentage * 100).toFixed(2))}
                    onChange={(e) => {
                      const newPercentageForm = [...percentageForm];
                      newPercentageForm[idx] = {
                        ...newPercentageForm[idx],
                        sharePercentage: Math.max(1, Math.min(99, parseFloat(e.target.value) || 0)) / 100,
                      };
                      setPercentageForm(newPercentageForm);
                    }}
                    className="input-field text-center w-20"
                    min={1}
                    max={99}
                    step={0.01}
                  />
                  <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">%</span>
                </div>
              </div>
            ))}
          </div>
          {percentageForm.length > 0 && (
            <div className={`text-sm font-medium text-center py-2 rounded-lg ${
              Math.abs(percentageForm.reduce((s, p) => s + p.sharePercentage, 0) - 1.0) <= 0.01
                ? 'bg-green-50 dark:bg-success-500/10 text-green-700 dark:text-success-400'
                : 'bg-red-50 dark:bg-error-500/10 text-red-700 dark:text-error-400'
            }`}>
              Total: {Math.round(percentageForm.reduce((s, p) => s + p.sharePercentage, 0) * 100)}%
              {Math.abs(percentageForm.reduce((s, p) => s + p.sharePercentage, 0) - 1.0) > 0.01 && (
                <span className="ml-2">(must equal 100%)</span>
              )}
            </div>
          )}
          <div className="flex justify-between pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                const equalShare = 1 / percentageForm.length;
                setPercentageForm(percentageForm.map((p) => ({ ...p, sharePercentage: equalShare })));
              }}
            >
              Equal Split
            </Button>
            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={() => setShowEditPercentagesModal(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleSavePercentages}
                loading={savingPercentages}
                disabled={Math.abs(percentageForm.reduce((s, p) => s + p.sharePercentage, 0) - 1.0) > 0.01}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Add Member Modal */}
      <Modal
        isOpen={showAddMemberModal}
        onClose={() => {
          setShowAddMemberModal(false);
          setShowCreateForm(false);
          resetNewMemberForm();
          setAddMemberShares(1);
        }}
        title="Add Member to Group"
        size="lg"
      >
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              className="input-field pl-10"
            />
          </div>

          {/* Shares Selector */}
          <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-indigo-700 dark:text-brand-400 uppercase tracking-wide">
                Contribution per full share
              </p>
              <span className="text-sm font-bold text-indigo-900">
                ETB {group.contributionAmount.toLocaleString()}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SHARE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAddMemberShares(preset)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    addMemberShares === preset
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.08] border border-gray-200 dark:border-gray-800'
                  }`}
                >
                  {shareLabel(preset)}
                </button>
              ))}
            </div>
            <input
              type="number"
              value={addMemberShares || ''}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setAddMemberShares(isNaN(val) ? 0.25 : Math.max(0.25, Math.min(10, val)));
              }}
              className="input-field"
              min={0.25}
              max={10}
              step={0.01}
              placeholder="Custom shares count (0.25 - 10)"
            />
            <div className="flex items-center justify-between text-xs text-indigo-800 dark:text-brand-300 bg-indigo-100/60 rounded-md px-2.5 py-1.5">
              <span>Expected per cycle:</span>
              <span className="font-bold">
                ETB {(group.contributionAmount * addMemberShares).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Existing Members List */}
          <div className="max-h-[400px] overflow-y-auto border border-gray-100 dark:border-gray-800 rounded-lg">
            {membersLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
              </div>
            ) : filteredAvailableMembers.length > 0 ? (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {suggestedFromOtherGroups.length > 0 && (
                  <div>
                    <div className="px-4 py-2 bg-blue-50 dark:bg-blue-light-500/10 border-b border-blue-100">
                      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
                        Suggested from Other Groups ({suggestedFromOtherGroups.length})
                      </p>
                    </div>
                    <ul className="divide-y divide-gray-50 dark:divide-gray-800">
                      {suggestedFromOtherGroups.map((member) => (
                        <li key={member.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-brand-500/15 flex items-center justify-center overflow-hidden flex-shrink-0">
                              {member.photoUrl ? (
                                <img src={member.photoUrl} alt={member.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-xs font-bold text-primary-700 dark:text-brand-400">
                                  {member.name.split(' ').map((n) => n[0]).join('')}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white/90">{member.name}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{member.phone}</p>
                              <div className="flex flex-wrap items-center gap-1 mt-1">
                                {member.groups.map((g, idx) => (
                                  <span key={idx} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-blue-50 dark:bg-blue-light-500/10 text-blue-600 dark:text-blue-light-400 font-medium">
                                    {g}
                                  </span>
                                ))}
                                {member.employmentType && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-purple-50 dark:bg-theme-purple-500/10 text-purple-600 dark:text-theme-purple-500 font-medium">
                                    <Briefcase className="h-2.5 w-2.5" />
                                    {formatEmployment(member.employmentType)}
                                  </span>
                                )}
                                {member.city && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-green-50 dark:bg-success-500/10 text-green-600 dark:text-success-400 font-medium">
                                    <MapPin className="h-2.5 w-2.5" />
                                    {member.city}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleAddMember(member.id)}
                            loading={addingMemberId === member.id}
                            disabled={addingMemberId !== null}
                          >
                            Add
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {ungroupedMembers.length > 0 && (
                  <div>
                    <div className="px-4 py-2 bg-gray-50 dark:bg-white/[0.04] border-b border-gray-100 dark:border-gray-800">
                      <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                        Ungrouped Members ({ungroupedMembers.length})
                      </p>
                    </div>
                    <ul className="divide-y divide-gray-50 dark:divide-gray-800">
                      {ungroupedMembers.map((member) => (
                        <li key={member.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-white/[0.08] flex items-center justify-center overflow-hidden flex-shrink-0">
                              {member.photoUrl ? (
                                <img src={member.photoUrl} alt={member.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                                  {member.name.split(' ').map((n) => n[0]).join('')}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white/90">{member.name}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{member.phone}</p>
                              <div className="flex flex-wrap items-center gap-1 mt-1">
                                {member.employmentType && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-purple-50 dark:bg-theme-purple-500/10 text-purple-600 dark:text-theme-purple-500 font-medium">
                                    <Briefcase className="h-2.5 w-2.5" />
                                    {formatEmployment(member.employmentType)}
                                  </span>
                                )}
                                {member.city && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-green-50 dark:bg-success-500/10 text-green-600 dark:text-success-400 font-medium">
                                    <MapPin className="h-2.5 w-2.5" />
                                    {member.city}
                                  </span>
                                )}
                                <span className="text-[10px] text-gray-400 dark:text-gray-500 italic">No group yet</span>
                              </div>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleAddMember(member.id)}
                            loading={addingMemberId === member.id}
                            disabled={addingMemberId !== null}
                          >
                            Add
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {memberSearch
                    ? 'No matching members found.'
                    : 'All members are already in this group.'}
                </p>
              </div>
            )}
          </div>

          {/* Create & Add New Member */}
          <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="flex items-center justify-between w-full px-4 py-3 bg-gray-50 dark:bg-white/[0.04] hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors text-left"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <UserPlus className="h-4 w-4" />
                Create & Add New Member
              </span>
              <ChevronDown
                className={`h-4 w-4 text-gray-400 dark:text-gray-500 transition-transform ${
                  showCreateForm ? 'rotate-180' : ''
                }`}
              />
            </button>

            {showCreateForm && (
              <form onSubmit={handleCreateAndAdd} className="p-4 space-y-4 border-t border-gray-200 dark:border-gray-800">
                <div className="flex justify-center">
                  <PhotoUpload
                    value={newMemberForm.photoUrl}
                    onChange={(url) => setNewMemberForm({ ...newMemberForm, photoUrl: url })}
                    name={newMemberForm.name || 'New'}
                    size="md"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name *</label>
                    <input
                      type="text"
                      value={newMemberForm.name}
                      onChange={(e) => setNewMemberForm({ ...newMemberForm, name: e.target.value })}
                      className="input-field"
                      placeholder="Full legal name"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Phone *</label>
                    <input
                      type="tel"
                      value={newMemberForm.phone}
                      onChange={(e) => setNewMemberForm({ ...newMemberForm, phone: e.target.value })}
                      className="input-field"
                      placeholder="+251911234567"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Government ID</label>
                    <input
                      type="text"
                      value={newMemberForm.governmentId}
                      onChange={(e) => setNewMemberForm({ ...newMemberForm, governmentId: e.target.value })}
                      className="input-field"
                      placeholder="ID number"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Telegram ID</label>
                    <input
                      type="text"
                      value={newMemberForm.telegramId}
                      onChange={(e) => setNewMemberForm({ ...newMemberForm, telegramId: e.target.value })}
                      className="input-field"
                      placeholder="@username"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Employment</label>
                    <select
                      value={newMemberForm.employmentType}
                      onChange={(e) => setNewMemberForm({ ...newMemberForm, employmentType: e.target.value })}
                      className="input-field"
                    >
                      {EMPLOYMENT_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Marital Status</label>
                    <select
                      value={newMemberForm.maritalStatus}
                      onChange={(e) => setNewMemberForm({ ...newMemberForm, maritalStatus: e.target.value })}
                      className="input-field"
                    >
                      {MARITAL_STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Employer</label>
                    <input
                      type="text"
                      value={newMemberForm.employerName}
                      onChange={(e) => setNewMemberForm({ ...newMemberForm, employerName: e.target.value })}
                      className="input-field"
                      placeholder="Company name"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Country</label>
                    <input
                      type="text"
                      value={newMemberForm.country}
                      onChange={(e) => setNewMemberForm({ ...newMemberForm, country: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">City</label>
                    <input
                      type="text"
                      value={newMemberForm.city}
                      onChange={(e) => setNewMemberForm({ ...newMemberForm, city: e.target.value })}
                      className="input-field"
                      placeholder="Addis Ababa"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Sub City</label>
                    <input
                      type="text"
                      value={newMemberForm.subCity}
                      onChange={(e) => setNewMemberForm({ ...newMemberForm, subCity: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Woreda</label>
                    <input
                      type="text"
                      value={newMemberForm.woreda}
                      onChange={(e) => setNewMemberForm({ ...newMemberForm, woreda: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">House No.</label>
                    <input
                      type="text"
                      value={newMemberForm.houseNumber}
                      onChange={(e) => setNewMemberForm({ ...newMemberForm, houseNumber: e.target.value })}
                      className="input-field"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setShowCreateForm(false);
                      resetNewMemberForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" loading={creatingMember}>
                    <UserPlus className="h-4 w-4 mr-1" />
                    Create & Add
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
