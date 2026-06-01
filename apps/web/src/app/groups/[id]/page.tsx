'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Users,
  Calendar,
  CircleDollarSign,
  CheckCircle,
  XCircle,
  Ticket,
  Clock,
  AlertCircle,
  UserPlus,
  Search,
  Trash2,
  ChevronRight,
  ChevronDown,
  Plus,
  MapPin,
  Briefcase,
  Settings,
  Save,
  Shield,
  Ban,
  Wallet,
  Scale,
  BookTemplate,
  Download,
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useLanguage } from '@/components/layout/LanguageContext';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import { getGroup, getGroupDeposits, verifyDeposit, rejectDeposit, triggerLottery, getMembers, addMemberToGroup, removeMemberFromGroup, createMember, getGroupRules, updateGroupRules, getRuleTemplates, createRuleTemplate, applyRuleTemplate, getMediaUrl } from '@/lib/api';
import type { GroupDetail, DepositItem, MemberListItem, GroupRules, RuleTemplate } from '@/lib/api';
import PhotoUpload from '@/components/ui/PhotoUpload';

const PENALTY_TYPES = [
  { value: 'NONE', label: 'No Penalty' },
  { value: 'FIXED', label: 'Fixed Amount (ETB)' },
  { value: 'PERCENTAGE', label: 'Percentage of Contribution' },
];

const PAYOUT_SCHEDULES = [
  { value: 'IMMEDIATE', label: 'Immediate' },
  { value: 'NEXT_DAY', label: 'Next Day' },
  { value: 'END_OF_CYCLE', label: 'End of Cycle' },
  { value: 'CUSTOM', label: 'Custom Delay' },
];

const EARLY_WITHDRAWAL_POLICIES = [
  { value: 'NOT_ALLOWED', label: 'Not Allowed' },
  { value: 'WITH_FEE', label: 'Allowed with Fee' },
  { value: 'ALLOWED', label: 'Allowed Freely' },
];

const DISPUTE_RESOLUTIONS = [
  { value: 'ADMIN_DECISION', label: 'Admin Decision' },
  { value: 'MEMBER_VOTE', label: 'Member Vote' },
  { value: 'THIRD_PARTY', label: 'Third Party' },
];

const ADMIN_FEE_TYPES = [
  { value: 'NONE', label: 'No Fee' },
  { value: 'FIXED', label: 'Fixed Amount (ETB)' },
  { value: 'PERCENTAGE', label: 'Percentage of Payout' },
];

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

function formatEmployment(type?: string) {
  if (!type) return null;
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function GroupDetailPage() {
  const { t } = useLanguage();
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [deposits, setDeposits] = useState<DepositItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawLoading, setDrawLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'deposits' | 'members' | 'rules'>('deposits');
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [availableMembers, setAvailableMembers] = useState<MemberListItem[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [membersLoading, setMembersLoading] = useState(false);
  const [addingMemberId, setAddingMemberId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creatingMember, setCreatingMember] = useState(false);
  const [rules, setRules] = useState<GroupRules | null>(null);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rulesSaving, setRulesSaving] = useState(false);
  const [rulesLoaded, setRulesLoaded] = useState(false);
  const [templates, setTemplates] = useState<RuleTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [applyingTemplate, setApplyingTemplate] = useState(false);
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

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [groupData, depositsData] = await Promise.allSettled([
        getGroup(groupId),
        getGroupDeposits(groupId),
      ]);
      if (groupData.status === 'fulfilled') setGroup(groupData.value);
      else setError('Failed to load group details.');
      if (depositsData.status === 'fulfilled') setDeposits(depositsData.value);
    } catch (err) {
      setError('Failed to load group data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [groupId]);

  const handleVerify = async (depositId: string) => {
    setError(null);
    try {
      await verifyDeposit(depositId);
      setDeposits(
        deposits.map((d) =>
          d.id === depositId ? { ...d, status: 'verified' as const } : d
        )
      );
      setSuccess('Deposit verified successfully!');
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(
        axiosErr.response?.data?.message || 'Failed to verify deposit. Please try again.'
      );
    }
  };

  const handleReject = async (depositId: string) => {
    setError(null);
    try {
      await rejectDeposit(depositId);
      setDeposits(
        deposits.map((d) =>
          d.id === depositId ? { ...d, status: 'rejected' as const } : d
        )
      );
      setSuccess('Deposit rejected successfully.');
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(
        axiosErr.response?.data?.message || 'Failed to reject deposit. Please try again.'
      );
    }
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
      setError(axiosErr.response?.data?.message || 'Failed to load members list.');
    } finally {
      setMembersLoading(false);
    }
  };

  const handleAddMember = async (userId: string) => {
    setAddingMemberId(userId);
    setError(null);
    try {
      await addMemberToGroup(groupId, userId);
      setShowAddMemberModal(false);
      setSuccess('Member added to group successfully!');
      setTimeout(() => setSuccess(null), 4000);
      await fetchData();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(
        axiosErr.response?.data?.message || 'Failed to add member. Please try again.'
      );
    } finally {
      setAddingMemberId(null);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    setRemovingMemberId(userId);
    setError(null);
    try {
      await removeMemberFromGroup(groupId, userId);
      setSuccess('Member removed from group.');
      setTimeout(() => setSuccess(null), 4000);
      await fetchData();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(
        axiosErr.response?.data?.message || 'Failed to remove member. Please try again.'
      );
    } finally {
      setRemovingMemberId(null);
    }
  };

  const filteredAvailableMembers = availableMembers
    .filter((m) => !group?.members.some((gm) => gm.id === m.id))
    .filter(
      (m) =>
        m.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
        m.phone.includes(memberSearch)
    );

  const suggestedFromOtherGroups = filteredAvailableMembers.filter((m) => m.groups.length > 0);
  const ungroupedMembers = filteredAvailableMembers.filter((m) => m.groups.length === 0);

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

  const handleCreateAndAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingMember(true);
    setError(null);
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
      await addMemberToGroup(groupId, result.id);
      setShowAddMemberModal(false);
      setShowCreateForm(false);
      resetNewMemberForm();
      setSuccess('New member created and added to group!');
      setTimeout(() => setSuccess(null), 4000);
      await fetchData();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(
        axiosErr.response?.data?.message || 'Failed to create member. Please try again.'
      );
    } finally {
      setCreatingMember(false);
    }
  };

  const fetchRules = async () => {
    if (rulesLoaded) return;
    setRulesLoading(true);
    try {
      const data = await getGroupRules(groupId);
      setRules(data);
      setRulesLoaded(true);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || 'Failed to load group rules.');
    } finally {
      setRulesLoading(false);
    }
  };

  const fetchTemplates = async () => {
    setTemplatesLoading(true);
    try {
      const data = await getRuleTemplates();
      setTemplates(data);
    } catch {
      // silently fail - templates are optional
    } finally {
      setTemplatesLoading(false);
    }
  };

  const handleApplyTemplate = async (templateId: string) => {
    setApplyingTemplate(true);
    setError(null);
    try {
      await applyRuleTemplate(templateId, groupId);
      const data = await getGroupRules(groupId);
      setRules(data);
      setSuccess('Template applied successfully!');
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || 'Failed to apply template.');
    } finally {
      setApplyingTemplate(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!rules || !templateName.trim()) return;
    setSavingTemplate(true);
    setError(null);
    try {
      const { id: _id, groupId: _gId, ...ruleFields } = rules;
      await createRuleTemplate({ name: templateName.trim(), description: templateDescription.trim() || undefined, ...ruleFields });
      setShowSaveTemplateModal(false);
      setTemplateName('');
      setTemplateDescription('');
      setSuccess('Rule template saved!');
      setTimeout(() => setSuccess(null), 4000);
      await fetchTemplates();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || 'Failed to save template.');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleSaveRules = async () => {
    if (!rules) return;
    setRulesSaving(true);
    setError(null);
    try {
      const { id: _id, groupId: _gId, ...rulesData } = rules;
      const updated = await updateGroupRules(groupId, rulesData);
      setRules(updated);
      setSuccess('Group rules saved successfully!');
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || 'Failed to save rules. Please try again.');
    } finally {
      setRulesSaving(false);
    }
  };

  const handleTabChange = (tab: 'deposits' | 'members' | 'rules') => {
    setActiveTab(tab);
    if (tab === 'rules') {
      fetchRules();
      fetchTemplates();
    }
  };

  const handleLotteryDraw = async () => {
    setDrawLoading(true);
    setError(null);
    try {
      const result = await triggerLottery(groupId);
      setSuccess(
        `Lottery draw complete! Winner: ${result.winner?.name || 'TBD'} (Amount: ETB ${result.amount || 0})`
      );
      await fetchData();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(
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
            <p className="text-sm text-gray-500">{t('group.loading')}</p>
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
          {t('group.back_to_groups')}
        </button>
        <div className="text-center py-16 card">
          <AlertCircle className="h-12 w-12 text-red-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">{t('group.not_found')}</h3>
          <p className="text-gray-500 text-sm">
            {t('group.not_found_desc')}
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
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('group.back_to_groups')}
      </button>

      {/* Group Header */}
      <div className="card mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{group.name}</h1>
              <Badge status={group.status} />
            </div>
            {group.description && (
              <p className="mt-2 text-sm text-gray-500">{group.description}</p>
            )}
          </div>
          <Button
            onClick={handleLotteryDraw}
            loading={drawLoading}
            className="flex-shrink-0"
          >
            <Ticket className="h-4 w-4 mr-2" />
            {t('group.draw_lottery')}
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">{t('groups.members')}</p>
              <p className="text-sm font-semibold text-gray-900">
                {group.membersCount}/{group.maxMembers}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <CircleDollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">{t('groups.contribution')}</p>
              <p className="text-sm font-semibold text-gray-900">
                ETB {group.contributionAmount.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 rounded-lg">
              <Calendar className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">{t('groups.cycle')}</p>
              <p className="text-sm font-semibold text-gray-900">
                {group.currentCycle}/{group.totalCycles}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-50 rounded-lg">
              <Clock className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">{t('group.next_draw')}</p>
              <p className="text-sm font-semibold text-gray-900">
                {group.nextDrawDate || 'TBD'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => handleTabChange('deposits')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'deposits'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {t('group.tab_deposits')}
        </button>
        <button
          onClick={() => handleTabChange('members')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'members'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {t('group.tab_members')}
        </button>
        <button
          onClick={() => handleTabChange('rules')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'rules'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Settings className="h-3.5 w-3.5" />
            {t('group.tab_rules')}
          </span>
        </button>
      </div>

      {/* Deposits Table */}
      {activeTab === 'deposits' && (
        <div className="card overflow-hidden p-0">
          {deposits.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="table-header">{t('group.col_member')}</th>
                    <th className="table-header">{t('group.col_amount')}</th>
                    <th className="table-header">{t('group.col_date')}</th>
                    <th className="table-header">{t('group.col_status')}</th>
                    <th className="table-header text-right">{t('group.col_actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {deposits.map((deposit) => (
                    <tr key={deposit.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="table-cell font-medium text-gray-900">
                        {deposit.memberName}
                      </td>
                      <td className="table-cell text-gray-700">
                        ETB {deposit.amount.toLocaleString()}
                      </td>
                      <td className="table-cell text-gray-500">{deposit.date}</td>
                      <td className="table-cell">
                        <Badge status={deposit.status} />
                      </td>
                      <td className="table-cell text-right">
                        {deposit.status === 'pending' && (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleVerify(deposit.id)}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Verify"
                            >
                              <CheckCircle className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handleReject(deposit.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Reject"
                            >
                              <XCircle className="h-5 w-5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">{t('group.no_deposits')}</p>
            </div>
          )}
        </div>
      )}

      {/* Members List */}
      {activeTab === 'members' && (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">
              {group.members.length} {group.members.length === 1 ? t('group.active_members') : t('group.active_members_plural')}
            </p>
            {group.membersCount < group.maxMembers && (
              <Button onClick={openAddMemberModal} size="sm">
                <UserPlus className="h-4 w-4 mr-2" />
                {t('group.add_member')}
              </Button>
            )}
          </div>
          <div className="card overflow-hidden p-0">
            {group.members.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="table-header">#</th>
                      <th className="table-header">{t('group.col_member')}</th>
                      <th className="table-header">Phone</th>
                      <th className="table-header">{t('group.col_won')}</th>
                      <th className="table-header">{t('group.col_cycle_won')}</th>
                      <th className="table-header text-right">{t('group.col_actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {group.members.map((member, index) => (
                      <tr
                        key={member.id}
                        className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                        onClick={() => router.push(`/members/${member.id}`)}
                      >
                        <td className="table-cell text-gray-500">{index + 1}</td>
                        <td className="table-cell">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                              {member.photoUrl ? (
                                <img src={getMediaUrl(member.photoUrl)} alt={member.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-xs font-bold text-primary-700">
                                  {member.name.split(' ').map((n) => n[0]).join('')}
                                </span>
                              )}
                            </div>
                            <span className="font-medium text-gray-900">{member.name}</span>
                          </div>
                        </td>
                        <td className="table-cell text-gray-500">{member.phone}</td>
                        <td className="table-cell">
                          {member.hasWon ? (
                            <Badge status="verified">{t('group.col_won')}</Badge>
                          ) : (
                            <Badge status="pending">{t('receipts.pending')}</Badge>
                          )}
                        </td>
                        <td className="table-cell text-gray-500">
                          {member.cycleWon ? `Cycle ${member.cycleWon}` : '-'}
                        </td>
                        <td className="table-cell text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRemoveMember(member.id); }}
                              disabled={removingMemberId === member.id}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                              title="Remove member"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                            <ChevronRight className="h-4 w-4 text-gray-400" />
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
                <p className="text-gray-500">{t('group.no_members')}</p>
                <Button onClick={openAddMemberModal} size="sm" className="mt-4">
                  <UserPlus className="h-4 w-4 mr-2" />
                  {t('group.add_first_member')}
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      {/* {t('group.tab_rules')} */}
      {activeTab === 'rules' && (
        <div className="space-y-6">
          {rulesLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                <p className="text-sm text-gray-500">{t('group.rules_loading')}</p>
              </div>
            </div>
          ) : rules ? (
            <>
              {/* Template Toolbar */}
              <div className="card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="p-2 bg-indigo-50 rounded-lg">
                    <BookTemplate className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900">{t('group.rules_title')}</h3>
                    <p className="text-xs text-gray-500">{t('group.rules_subtitle')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:flex-initial">
                    <select
                      onChange={(e) => {
                        if (e.target.value) handleApplyTemplate(e.target.value);
                        e.target.value = '';
                      }}
                      disabled={applyingTemplate || templatesLoading || templates.length === 0}
                      className="input-field text-sm pr-8 min-w-[180px] disabled:opacity-50"
                      defaultValue=""
                    >
                      <option value="" disabled>
                        {templatesLoading ? 'Loading...' : templates.length === 0 ? 'No templates yet' : 'Load from Template...'}
                      </option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}{t.description ? ` — ${t.description}` : ''}
                        </option>
                      ))}
                    </select>
                    <Download className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setShowSaveTemplateModal(true)}
                  >
                    <BookTemplate className="h-4 w-4 mr-1.5" />
                    {t('group.save_template')}
                  </Button>
                </div>
              </div>

              {/* Penalty Settings */}
              <div className="card">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-red-50 rounded-lg">
                    <Ban className="h-5 w-5 text-red-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">{t('group.rules_penalty')}</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('group.label_late_penalty')}</label>
                    <select
                      value={rules.latePenaltyType}
                      onChange={(e) => setRules({ ...rules, latePenaltyType: e.target.value as GroupRules['latePenaltyType'] })}
                      className="input-field"
                    >
                      {PENALTY_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  {rules.latePenaltyType === 'FIXED' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Penalty Amount (ETB)</label>
                      <input
                        type="number"
                        value={rules.latePenaltyAmount ?? ''}
                        onChange={(e) => setRules({ ...rules, latePenaltyAmount: e.target.value ? Number(e.target.value) : undefined })}
                        className="input-field"
                        placeholder="e.g., 100"
                        min={0}
                      />
                    </div>
                  )}
                  {rules.latePenaltyType === 'PERCENTAGE' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Penalty Percentage (%)</label>
                      <input
                        type="number"
                        value={rules.latePenaltyPercent ?? ''}
                        onChange={(e) => setRules({ ...rules, latePenaltyPercent: e.target.value ? Number(e.target.value) : undefined })}
                        className="input-field"
                        placeholder="e.g., 5"
                        min={0}
                        max={100}
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Grace Period (Days)</label>
                    <input
                      type="number"
                      value={rules.gracePeriodDays}
                      onChange={(e) => setRules({ ...rules, gracePeriodDays: Number(e.target.value) })}
                      className="input-field"
                      min={0}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('group.label_max_missed_removal')}</label>
                    <input
                      type="number"
                      value={rules.maxMissedPayments}
                      onChange={(e) => setRules({ ...rules, maxMissedPayments: Number(e.target.value) })}
                      className="input-field"
                      min={1}
                    />
                  </div>
                </div>
              </div>

              {/* Deposit Rules */}
              <div className="card">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-green-50 rounded-lg">
                    <CircleDollarSign className="h-5 w-5 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">{t('group.rules_deposit')}</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{t('group.label_require_exact')}</p>
                      <p className="text-xs text-gray-500">Deposits must match the contribution amount exactly</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rules.requireExactAmount}
                        onChange={(e) => setRules({ ...rules, requireExactAmount: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-600" />
                    </label>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Deposit Deadline (Day of Month)</label>
                    <input
                      type="number"
                      value={rules.depositDeadlineDay ?? ''}
                      onChange={(e) => setRules({ ...rules, depositDeadlineDay: e.target.value ? Number(e.target.value) : undefined })}
                      className="input-field"
                      placeholder="e.g., 5 (5th of each month)"
                      min={1}
                      max={31}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Min Verification Time (Hours)</label>
                    <input
                      type="number"
                      value={rules.minVerificationHours}
                      onChange={(e) => setRules({ ...rules, minVerificationHours: Number(e.target.value) })}
                      className="input-field"
                      min={0}
                    />
                  </div>
                </div>
              </div>

              {/* Member Rules */}
              <div className="card">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <Shield className="h-5 w-5 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">{t('group.rules_member')}</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{t('group.label_allow_skip')}</p>
                      <p className="text-xs text-gray-500">Members can skip a contribution round</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rules.allowSkipRound}
                        onChange={(e) => setRules({ ...rules, allowSkipRound: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-600" />
                    </label>
                  </div>
                  {rules.allowSkipRound && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('group.label_max_skips')}</label>
                      <input
                        type="number"
                        value={rules.maxSkipsAllowed}
                        onChange={(e) => setRules({ ...rules, maxSkipsAllowed: Number(e.target.value) })}
                        className="input-field"
                        min={0}
                      />
                    </div>
                  )}
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{t('group.label_require_guarantor')}</p>
                      <p className="text-xs text-gray-500">Members must have a guarantor to join</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rules.requireGuarantor}
                        onChange={(e) => setRules({ ...rules, requireGuarantor: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-600" />
                    </label>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('group.label_min_members')}</label>
                    <input
                      type="number"
                      value={rules.minMembersToStart}
                      onChange={(e) => setRules({ ...rules, minMembersToStart: Number(e.target.value) })}
                      className="input-field"
                      min={2}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Allow Mid-Cycle Join</p>
                      <p className="text-xs text-gray-500">New members can join after a cycle has started</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rules.allowMidCycleJoin ?? false}
                        onChange={(e) => setRules({ ...rules, allowMidCycleJoin: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-600" />
                    </label>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{t('group.label_require_gov_id')}</p>
                      <p className="text-xs text-gray-500">Members must provide a kebele/national ID</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rules.requireGovernmentId ?? false}
                        onChange={(e) => setRules({ ...rules, requireGovernmentId: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-600" />
                    </label>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Post-Win Contribution Required</p>
                      <p className="text-xs text-gray-500">Winners must continue paying after receiving payout</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rules.postWinContributionRequired ?? true}
                        onChange={(e) => setRules({ ...rules, postWinContributionRequired: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-600" />
                    </label>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Auto-Complete Group</p>
                      <p className="text-xs text-gray-500">Group auto-completes when all members have won</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rules.autoCompleteGroup ?? true}
                        onChange={(e) => setRules({ ...rules, autoCompleteGroup: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-600" />
                    </label>
                  </div>
                </div>
              </div>

              {/* Admin Fee Configuration */}
              <div className="card">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-teal-50 rounded-lg">
                    <CircleDollarSign className="h-5 w-5 text-teal-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">{t('group.label_admin_fee')}</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('group.label_admin_fee_type')}</label>
                    <select
                      value={rules.adminFeeType ?? 'NONE'}
                      onChange={(e) => setRules({ ...rules, adminFeeType: e.target.value as GroupRules['adminFeeType'] })}
                      className="input-field"
                    >
                      {ADMIN_FEE_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  {rules.adminFeeType === 'FIXED' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Fee Amount (ETB)</label>
                      <input
                        type="number"
                        value={rules.adminFeeAmount ?? ''}
                        onChange={(e) => setRules({ ...rules, adminFeeAmount: e.target.value ? Number(e.target.value) : undefined })}
                        className="input-field"
                        placeholder="Fee amount"
                        min={0}
                      />
                    </div>
                  )}
                  {rules.adminFeeType === 'PERCENTAGE' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Fee Percentage (%)</label>
                      <input
                        type="number"
                        value={rules.adminFeePercent ?? ''}
                        onChange={(e) => setRules({ ...rules, adminFeePercent: e.target.value ? Number(e.target.value) : undefined })}
                        className="input-field"
                        placeholder="e.g., 2"
                        min={0}
                        max={100}
                        step={0.5}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Payout Configuration */}
              <div className="card">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-purple-50 rounded-lg">
                    <Wallet className="h-5 w-5 text-purple-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">{t('group.rules_payout')}</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('group.label_payout_schedule')}</label>
                    <select
                      value={rules.payoutSchedule}
                      onChange={(e) => setRules({ ...rules, payoutSchedule: e.target.value as GroupRules['payoutSchedule'] })}
                      className="input-field"
                    >
                      {PAYOUT_SCHEDULES.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  {rules.payoutSchedule === 'CUSTOM' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Payout Delay (Days)</label>
                      <input
                        type="number"
                        value={rules.payoutDelayDays}
                        onChange={(e) => setRules({ ...rules, payoutDelayDays: Number(e.target.value) })}
                        className="input-field"
                        min={0}
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('group.label_early_withdrawal')}</label>
                    <select
                      value={rules.earlyWithdrawalPolicy}
                      onChange={(e) => setRules({ ...rules, earlyWithdrawalPolicy: e.target.value as GroupRules['earlyWithdrawalPolicy'] })}
                      className="input-field"
                    >
                      {EARLY_WITHDRAWAL_POLICIES.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                  {rules.earlyWithdrawalPolicy === 'WITH_FEE' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Early Withdrawal Fee (ETB)</label>
                      <input
                        type="number"
                        value={rules.earlyWithdrawalFee ?? ''}
                        onChange={(e) => setRules({ ...rules, earlyWithdrawalFee: e.target.value ? Number(e.target.value) : undefined })}
                        className="input-field"
                        placeholder="Fee amount"
                        min={0}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Governance */}
              <div className="card">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-orange-50 rounded-lg">
                    <Scale className="h-5 w-5 text-orange-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">{t('group.rules_governance')}</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('group.label_dispute_method')}</label>
                    <select
                      value={rules.disputeResolution}
                      onChange={(e) => setRules({ ...rules, disputeResolution: e.target.value as GroupRules['disputeResolution'] })}
                      className="input-field"
                    >
                      {DISPUTE_RESOLUTIONS.map((d) => (
                        <option key={d.value} value={d.value}>{d.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Additional Rules */}
              <div className="card">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Settings className="h-5 w-5 text-gray-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">{t('group.rules_additional')}</h3>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Custom Rules & Notes
                  </label>
                  <textarea
                    value={rules.customRules ?? ''}
                    onChange={(e) => setRules({ ...rules, customRules: e.target.value || undefined })}
                    className="input-field"
                    rows={4}
                    placeholder="Enter any additional group-specific rules, agreements, or notes here..."
                  />
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end">
                <Button onClick={handleSaveRules} loading={rulesSaving}>
                  <Save className="h-4 w-4 mr-2" />
                  {t('group.rules_save')}
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-16 card">
              <Settings className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">{t('group.rules_unable')}</h3>
              <p className="text-gray-500 text-sm">Please try refreshing the page.</p>
            </div>
          )}
        </div>
      )}

      {/* Save Template Modal */}
      <Modal
        isOpen={showSaveTemplateModal}
        onClose={() => {
          setShowSaveTemplateModal(false);
          setTemplateName('');
          setTemplateDescription('');
        }}
        title={t('group.save_template_as')}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Save the current rule configuration as a reusable template that can be applied to other groups.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Template Name *</label>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              className="input-field"
              placeholder="e.g., Standard Monthly Rules"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description (Optional)</label>
            <textarea
              value={templateDescription}
              onChange={(e) => setTemplateDescription(e.target.value)}
              className="input-field"
              rows={2}
              placeholder="Brief description of this template..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowSaveTemplateModal(false);
                setTemplateName('');
                setTemplateDescription('');
              }}
            >
              {t('groups.btn_cancel')}
            </Button>
            <Button
              onClick={handleSaveTemplate}
              loading={savingTemplate}
              disabled={!templateName.trim()}
            >
              <BookTemplate className="h-4 w-4 mr-2" />
              {t('group.save_template')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* {t('group.add_member')} Modal */}
      <Modal
        isOpen={showAddMemberModal}
        onClose={() => {
          setShowAddMemberModal(false);
          setShowCreateForm(false);
          resetNewMemberForm();
        }}
        title="{t('group.add_member')} to Group"
        size="lg"
      >
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              className="input-field pl-10"
            />
          </div>

          {/* Members List */}
          <div className="max-h-[400px] overflow-y-auto border border-gray-100 rounded-lg">
            {membersLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
              </div>
            ) : filteredAvailableMembers.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {/* Suggested from Other Groups */}
                {suggestedFromOtherGroups.length > 0 && (
                  <div>
                    <div className="px-4 py-2 bg-blue-50 border-b border-blue-100">
                      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
                        Suggested from Other Groups ({suggestedFromOtherGroups.length})
                      </p>
                    </div>
                    <ul className="divide-y divide-gray-50">
                      {suggestedFromOtherGroups.map((member) => (
                        <li
                          key={member.id}
                          className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                              {member.photoUrl ? (
                                <img src={member.photoUrl} alt={member.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-xs font-bold text-primary-700">
                                  {member.name.split(' ').map((n) => n[0]).join('')}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900">{member.name}</p>
                              <p className="text-xs text-gray-500">{member.phone}</p>
                              <div className="flex flex-wrap items-center gap-1 mt-1">
                                {member.groups.map((g, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-blue-50 text-blue-600 font-medium"
                                  >
                                    {g}
                                  </span>
                                ))}
                                {member.employmentType && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-purple-50 text-purple-600 font-medium">
                                    <Briefcase className="h-2.5 w-2.5" />
                                    {formatEmployment(member.employmentType)}
                                  </span>
                                )}
                                {member.city && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-green-50 text-green-600 font-medium">
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

                {/* Ungrouped Members */}
                {ungroupedMembers.length > 0 && (
                  <div>
                    <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        Ungrouped Members ({ungroupedMembers.length})
                      </p>
                    </div>
                    <ul className="divide-y divide-gray-50">
                      {ungroupedMembers.map((member) => (
                        <li
                          key={member.id}
                          className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                              {member.photoUrl ? (
                                <img src={member.photoUrl} alt={member.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-xs font-bold text-gray-500">
                                  {member.name.split(' ').map((n) => n[0]).join('')}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900">{member.name}</p>
                              <p className="text-xs text-gray-500">{member.phone}</p>
                              <div className="flex flex-wrap items-center gap-1 mt-1">
                                {member.employmentType && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-purple-50 text-purple-600 font-medium">
                                    <Briefcase className="h-2.5 w-2.5" />
                                    {formatEmployment(member.employmentType)}
                                  </span>
                                )}
                                {member.city && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-green-50 text-green-600 font-medium">
                                    <MapPin className="h-2.5 w-2.5" />
                                    {member.city}
                                  </span>
                                )}
                                <span className="text-[10px] text-gray-400 italic">{t('groups.no_groups')}</span>
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
                <p className="text-sm text-gray-500">
                  {memberSearch
                    ? 'No matching members found.'
                    : 'All members are already in this group.'}
                </p>
              </div>
            )}
          </div>

          {/* Create & Add New Member */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="flex items-center justify-between w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Plus className="h-4 w-4" />
                Create & Add New Member
              </span>
              <ChevronDown
                className={`h-4 w-4 text-gray-400 transition-transform ${
                  showCreateForm ? 'rotate-180' : ''
                }`}
              />
            </button>

            {showCreateForm && (
              <form onSubmit={handleCreateAndAdd} className="p-4 space-y-4 border-t border-gray-200">
                {/* Photo Upload */}
                <div className="flex justify-center">
                  <PhotoUpload
                    value={newMemberForm.photoUrl}
                    onChange={(url) => setNewMemberForm({ ...newMemberForm, photoUrl: url })}
                    name={newMemberForm.name || 'New'}
                    size="md"
                  />
                </div>

                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Full Name *</label>
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
                    <label className="block text-xs font-medium text-gray-700 mb-1">Phone *</label>
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
                    <label className="block text-xs font-medium text-gray-700 mb-1">{t('member.government_id')}</label>
                    <input
                      type="text"
                      value={newMemberForm.governmentId}
                      onChange={(e) => setNewMemberForm({ ...newMemberForm, governmentId: e.target.value })}
                      className="input-field"
                      placeholder="ID number"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{t('member.telegram_id')}</label>
                    <input
                      type="text"
                      value={newMemberForm.telegramId}
                      onChange={(e) => setNewMemberForm({ ...newMemberForm, telegramId: e.target.value })}
                      className="input-field"
                      placeholder="@username"
                    />
                  </div>
                </div>

                {/* Personal Details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{t('member.employment')}</label>
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
                    <label className="block text-xs font-medium text-gray-700 mb-1">{t('member.marital_status')}</label>
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
                    <label className="block text-xs font-medium text-gray-700 mb-1">{t('member.employer')}</label>
                    <input
                      type="text"
                      value={newMemberForm.employerName}
                      onChange={(e) => setNewMemberForm({ ...newMemberForm, employerName: e.target.value })}
                      className="input-field"
                      placeholder="Company name"
                    />
                  </div>
                </div>

                {/* Address */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{t('member.country')}</label>
                    <input
                      type="text"
                      value={newMemberForm.country}
                      onChange={(e) => setNewMemberForm({ ...newMemberForm, country: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{t('member.city')}</label>
                    <input
                      type="text"
                      value={newMemberForm.city}
                      onChange={(e) => setNewMemberForm({ ...newMemberForm, city: e.target.value })}
                      className="input-field"
                      placeholder="Addis Ababa"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{t('member.sub_city')}</label>
                    <input
                      type="text"
                      value={newMemberForm.subCity}
                      onChange={(e) => setNewMemberForm({ ...newMemberForm, subCity: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{t('member.woreda')}</label>
                    <input
                      type="text"
                      value={newMemberForm.woreda}
                      onChange={(e) => setNewMemberForm({ ...newMemberForm, woreda: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">House No.</label>
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
    </DashboardLayout>
  );
}
