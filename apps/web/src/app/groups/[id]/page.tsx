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
  Gavel,
  ArrowLeftRight,
  BookTemplate,
  Download,
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useLanguage } from '@/components/layout/LanguageContext';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import { getGroup, getGroupDeposits, verifyDeposit, rejectDeposit, triggerLottery, getMembers, addMemberToGroup, removeMemberFromGroup, createMember, getGroupRules, updateGroupRules, getRuleTemplates, createRuleTemplate, applyRuleTemplate, getMediaUrl, getGroupPenalties, payPenalty, waivePenalty, getGroupDisputes, fileDispute, resolveDispute, getGroupTurnSwaps, respondTurnSwap, requestTurnSwap, getGroupGuarantors, addGuarantor, updateGuarantorStatus, deleteGuarantor, getGroupMemberDues, getMergedGroups, getGroupFeeWaivers, updateMemberShares, createMergedGroup, dissolveMergedGroup, grantFeeWaiver, cancelFeeWaiver, updateMergedGroupPercentages, getMergedGroupDepositStatus, enforceMergedMemberCompliance, getMergedGroupDepositHistory, getGroupLeaders, assignGroupLeader, updateGroupLeader, removeGroupLeader, getAdminUsers, updateGroup } from '@/lib/api';
import type { GroupDetail, DepositItem, MemberListItem, GroupRules, RuleTemplate, PenaltyRecord, DisputeItem, TurnSwapRequest, GuarantorItem, MemberDueCalculation, MergedGroupItem, FeeWaiverItem, MergedMemberDepositStatusItem, MergedGroupDepositHistoryItem, GroupLeaderItem, AdminUserItem } from '@/lib/api';
import PhotoUpload from '@/components/ui/PhotoUpload';
import LocationPicker from '@/components/ui/LocationPicker';

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
  const [activeTab, setActiveTab] = useState<'deposits' | 'members' | 'rules' | 'penalties' | 'disputes' | 'swaps' | 'guarantors' | 'shares' | 'leaders'>('deposits');
  const [penalties, setPenalties] = useState<PenaltyRecord[]>([]);
  const [penaltiesLoading, setPenaltiesLoading] = useState(false);
  const [disputes, setDisputes] = useState<DisputeItem[]>([]);
  const [disputesLoading, setDisputesLoading] = useState(false);
  const [swaps, setSwaps] = useState<TurnSwapRequest[]>([]);
  const [swapsLoading, setSwapsLoading] = useState(false);
  const [guarantors, setGuarantors] = useState<GuarantorItem[]>([]);
  const [guarantorsLoading, setGuarantorsLoading] = useState(false);
  const [memberDues, setMemberDues] = useState<MemberDueCalculation[]>([]);
  const [mergedGroups, setMergedGroups] = useState<MergedGroupItem[]>([]);
  
  // Leaders State
  const [leaders, setLeaders] = useState<GroupLeaderItem[]>([]);
  const [leadersLoading, setLeadersLoading] = useState(false);
  const [adminUsers, setAdminUsers] = useState<AdminUserItem[]>([]);
  const [showAssignLeaderModal, setShowAssignLeaderModal] = useState(false);
  const [leaderForm, setLeaderForm] = useState({
    adminId: '',
    canManageMembers: false,
    canManageDeposits: false,
    canTriggerLottery: false,
    canManageRules: false,
  });
  const [assigningLeader, setAssigningLeader] = useState(false);
  const [updatingLeaderId, setUpdatingLeaderId] = useState<string | null>(null);
  const [feeWaivers, setFeeWaivers] = useState<FeeWaiverItem[]>([]);
  const [sharesLoading, setSharesLoading] = useState(false);
  const [showEditSharesModal, setShowEditSharesModal] = useState<{ userId: string; userName: string; currentShares: number } | null>(null);
  const [editingShares, setEditingShares] = useState(1);
  const [savingShares, setSavingShares] = useState(false);
  const [showGrantWaiverModal, setShowGrantWaiverModal] = useState(false);
  const [waiverForm, setWaiverForm] = useState({ userId: '', reason: '', durationCycles: 1 });
  const [grantingWaiver, setGrantingWaiver] = useState(false);
  const [showCreateMergedModal, setShowCreateMergedModal] = useState(false);
  const [mergedForm, setMergedForm] = useState<{ name: string; selectedUserIds: string[]; totalShares: number }>({ name: '', selectedUserIds: [], totalShares: 1 });
  const [creatingMerged, setCreatingMerged] = useState(false);
  const [dissolvingMergedId, setDissolvingMergedId] = useState<string | null>(null);
  const [cancellingWaiverId, setCancellingWaiverId] = useState<string | null>(null);
  const [mergedDepositStatuses, setMergedDepositStatuses] = useState<Record<string, MergedMemberDepositStatusItem[]>>({});
  const [loadingDepositStatus, setLoadingDepositStatus] = useState<string | null>(null);
  const [enforcingCompliance, setEnforcingCompliance] = useState<string | null>(null);
  const [depositHistory, setDepositHistory] = useState<Record<string, MergedGroupDepositHistoryItem>>({});
  const [loadingHistory, setLoadingHistory] = useState<string | null>(null);
  const [expandedHistoryCycles, setExpandedHistoryCycles] = useState<Record<string, boolean>>({});
  const [showEditPercentagesModal, setShowEditPercentagesModal] = useState<MergedGroupItem | null>(null);
  const [percentageForm, setPercentageForm] = useState<Array<{ userId: string; userName: string; sharePercentage: number }>>([]);
  const [savingPercentages, setSavingPercentages] = useState(false);
  const [showAssignGuarantorModal, setShowAssignGuarantorModal] = useState(false);
  const [guarantorForm, setGuarantorForm] = useState({ guarantorUserId: '', guaranteedUserId: '', notes: '' });
  const [assigningGuarantor, setAssigningGuarantor] = useState(false);
  const [updatingGuarantorId, setUpdatingGuarantorId] = useState<string | null>(null);
  const [showFileDisputeModal, setShowFileDisputeModal] = useState(false);
  const [disputeForm, setDisputeForm] = useState({ type: 'PAYMENT', description: '', againstUserId: '' });
  const [filingDispute, setFilingDispute] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState<string | null>(null);
  const [resolveText, setResolveText] = useState('');
  const [resolving, setResolving] = useState(false);
  const [showRequestSwapModal, setShowRequestSwapModal] = useState(false);
  const [swapForm, setSwapForm] = useState({ targetId: '', reason: '' });
  const [requestingSwap, setRequestingSwap] = useState(false);
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  const [editGroupForm, setEditGroupForm] = useState({
    name: '',
    description: '',
    contributionAmount: '',
    maxMembers: '',
    cycleDuration: 'Weekly',
    photoUrl: '',
    endDate: '',
    physicalAddress: '',
    latitude: '',
    longitude: '',
  });
  const [updatingGroup, setUpdatingGroup] = useState(false);
  const [showEditLocationPicker, setShowEditLocationPicker] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [availableMembers, setAvailableMembers] = useState<MemberListItem[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [membersLoading, setMembersLoading] = useState(false);
  const [addingMemberId, setAddingMemberId] = useState<string | null>(null);
  const [addMemberShares, setAddMemberShares] = useState<number>(1);
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
      await addMemberToGroup(groupId, userId, addMemberShares);
      setShowAddMemberModal(false);
      setAddMemberShares(1);
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
      await addMemberToGroup(groupId, result.id, addMemberShares);
      setShowAddMemberModal(false);
      setShowCreateForm(false);
      resetNewMemberForm();
      setAddMemberShares(1);
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

  const fetchLeaders = async () => {
    setLeadersLoading(true);
    try {
      const data = await getGroupLeaders(groupId);
      setLeaders(data);
    } catch (err: unknown) {
      console.error('Failed to load leaders:', err);
    } finally {
      setLeadersLoading(false);
    }
  };

  const fetchAdminUsers = async () => {
    try {
      const data = await getAdminUsers();
      setAdminUsers(data);
    } catch (err) {
      console.error('Failed to load admin users:', err);
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

  const fetchPenalties = async () => {
    setPenaltiesLoading(true);
    try { const data = await getGroupPenalties(groupId); setPenalties(data); } catch {} finally { setPenaltiesLoading(false); }
  };
  const fetchDisputes = async () => {
    setDisputesLoading(true);
    try { const data = await getGroupDisputes(groupId); setDisputes(data); } catch {} finally { setDisputesLoading(false); }
  };
  const fetchSwaps = async () => {
    setSwapsLoading(true);
    try { const data = await getGroupTurnSwaps(groupId); setSwaps(data); } catch {} finally { setSwapsLoading(false); }
  };
  const fetchGuarantors = async () => {
    setGuarantorsLoading(true);
    try { const data = await getGroupGuarantors(groupId); setGuarantors(data); } catch {} finally { setGuarantorsLoading(false); }
  };
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

  const handlePayPenalty = async (id: string) => {
    try { await payPenalty(id); setSuccess('Penalty marked as paid.'); setTimeout(() => setSuccess(null), 3000); await fetchPenalties(); } catch { setError('Failed to pay penalty.'); }
  };
  const handleWaivePenalty = async (id: string) => {
    try { await waivePenalty(id); setSuccess('Penalty waived.'); setTimeout(() => setSuccess(null), 3000); await fetchPenalties(); } catch { setError('Failed to waive penalty.'); }
  };
  const handleFileDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    setFilingDispute(true);
    try {
      await fileDispute({ groupId, type: disputeForm.type, description: disputeForm.description, againstUserId: disputeForm.againstUserId || undefined });
      setShowFileDisputeModal(false); setDisputeForm({ type: 'PAYMENT', description: '', againstUserId: '' });
      setSuccess('Dispute filed.'); setTimeout(() => setSuccess(null), 3000); await fetchDisputes();
    } catch { setError('Failed to file dispute.'); } finally { setFilingDispute(false); }
  };
  const handleResolveDispute = async () => {
    if (!showResolveModal) return;
    setResolving(true);
    try {
      await resolveDispute(showResolveModal, resolveText, 'RESOLVED');
      setShowResolveModal(null); setResolveText('');
      setSuccess('Dispute resolved.'); setTimeout(() => setSuccess(null), 3000); await fetchDisputes();
    } catch { setError('Failed to resolve dispute.'); } finally { setResolving(false); }
  };
  const handleRespondSwap = async (swapId: string, approve: boolean) => {
    try {
      await respondTurnSwap(swapId, approve);
      setSuccess(approve ? 'Swap approved.' : 'Swap rejected.'); setTimeout(() => setSuccess(null), 3000); await fetchSwaps();
    } catch { setError('Failed to respond to swap.'); }
  };
  const handleRequestSwap = async (e: React.FormEvent) => {
    e.preventDefault();
    setRequestingSwap(true);
    try {
      await requestTurnSwap({ groupId, targetId: swapForm.targetId, reason: swapForm.reason || undefined });
      setShowRequestSwapModal(false); setSwapForm({ targetId: '', reason: '' });
      setSuccess('Swap request sent successfully.'); setTimeout(() => setSuccess(null), 3000); await fetchSwaps();
    } catch { setError('Failed to send swap request.'); } finally { setRequestingSwap(false); }
  };

  const handleTabChange = (tab: 'deposits' | 'members' | 'rules' | 'penalties' | 'disputes' | 'swaps' | 'guarantors' | 'shares' | 'leaders') => {
    setActiveTab(tab);
    if (tab === 'rules') { fetchRules(); fetchTemplates(); }
    if (tab === 'penalties') fetchPenalties();
    if (tab === 'disputes') fetchDisputes();
    if (tab === 'swaps') fetchSwaps();
    if (tab === 'guarantors') fetchGuarantors();
    if (tab === 'shares') fetchSharesData();
    if (tab === 'leaders') { fetchLeaders(); fetchAdminUsers(); }
  };

  const handleUpdateShares = async () => {
    if (!showEditSharesModal) return;
    setSavingShares(true);
    try {
      await updateMemberShares(groupId, showEditSharesModal.userId, editingShares);
      setShowEditSharesModal(null);
      setSuccess('Member shares updated successfully!');
      setTimeout(() => setSuccess(null), 3000);
      await fetchSharesData();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || 'Failed to update shares.');
    } finally { setSavingShares(false); }
  };

  const handleGrantWaiver = async (e: React.FormEvent) => {
    e.preventDefault();
    setGrantingWaiver(true);
    try {
      await grantFeeWaiver({ groupId, userId: waiverForm.userId, reason: waiverForm.reason, durationCycles: waiverForm.durationCycles });
      setShowGrantWaiverModal(false);
      setWaiverForm({ userId: '', reason: '', durationCycles: 1 });
      setSuccess('Fee waiver granted successfully!');
      setTimeout(() => setSuccess(null), 3000);
      await fetchSharesData();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || 'Failed to grant fee waiver.');
    } finally { setGrantingWaiver(false); }
  };

  const handleCancelWaiver = async (waiverId: string) => {
    setCancellingWaiverId(waiverId);
    try {
      await cancelFeeWaiver(waiverId);
      setSuccess('Fee waiver cancelled.');
      setTimeout(() => setSuccess(null), 3000);
      await fetchSharesData();
    } catch { setError('Failed to cancel waiver.'); } finally { setCancellingWaiverId(null); }
  };

  const handleAssignLeader = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssigningLeader(true);
    try {
      await assignGroupLeader(groupId, leaderForm);
      setShowAssignLeaderModal(false);
      setLeaderForm({ adminId: '', canManageMembers: false, canManageDeposits: false, canTriggerLottery: false, canManageRules: false });
      setSuccess('Leader assigned successfully.');
      setTimeout(() => setSuccess(null), 3000);
      await fetchLeaders();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || 'Failed to assign leader.');
    } finally { setAssigningLeader(false); }
  };

  const handleUpdateLeader = async (leaderId: string, updates: { canManageMembers?: boolean; canManageDeposits?: boolean; canTriggerLottery?: boolean; canManageRules?: boolean }) => {
    setUpdatingLeaderId(leaderId);
    try {
      await updateGroupLeader(groupId, leaderId, updates);
      setSuccess('Leader permissions updated.');
      setTimeout(() => setSuccess(null), 3000);
      await fetchLeaders();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || 'Failed to update leader.');
    } finally { setUpdatingLeaderId(null); }
  };

  const handleRemoveLeader = async (leaderId: string) => {
    if (!confirm('Are you sure you want to remove this leader?')) return;
    try {
      await removeGroupLeader(groupId, leaderId);
      setSuccess('Leader removed.');
      setTimeout(() => setSuccess(null), 3000);
      await fetchLeaders();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || 'Failed to remove leader.');
    }
  };

  const handleCreateMergedGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingMerged(true);
    try {
      await createMergedGroup({ groupId, name: mergedForm.name || undefined, userIds: mergedForm.selectedUserIds, totalShares: mergedForm.totalShares });
      setShowCreateMergedModal(false);
      setMergedForm({ name: '', selectedUserIds: [], totalShares: 1 });
      setSuccess('Merged group created successfully!');
      setTimeout(() => setSuccess(null), 3000);
      await fetchSharesData();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || 'Failed to create merged group.');
    } finally { setCreatingMerged(false); }
  };

  const fetchMergedGroupStatus = async (mergedGroupId: string) => {
    setLoadingDepositStatus(mergedGroupId);
    try {
      const statuses = await getMergedGroupDepositStatus(mergedGroupId);
      setMergedDepositStatuses((prev) => ({ ...prev, [mergedGroupId]: statuses }));
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || 'Failed to fetch deposit status.');
    } finally { setLoadingDepositStatus(null); }
  };

  const handleEnforceCompliance = async (mergedGroupId: string) => {
    if (!confirm('Enforce compliance? This will create penalties for members who have not paid their portion.')) return;
    setEnforcingCompliance(mergedGroupId);
    try {
      const result = await enforceMergedMemberCompliance(mergedGroupId);
      if (result.penaltiesCreated.length > 0) {
        setSuccess(`Compliance enforced: ${result.penaltiesCreated.length} penalty(ies) created.`);
      } else {
        setSuccess('All members are compliant — no penalties needed.');
      }
      setTimeout(() => setSuccess(null), 4000);
      await fetchMergedGroupStatus(mergedGroupId);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || 'Failed to enforce compliance.');
    } finally { setEnforcingCompliance(null); }
  };

  const fetchDepositHistory = async (mergedGroupId: string) => {
    setLoadingHistory(mergedGroupId);
    try {
      const history = await getMergedGroupDepositHistory(mergedGroupId);
      setDepositHistory((prev) => ({ ...prev, [mergedGroupId]: history }));
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || 'Failed to load deposit history.');
    } finally { setLoadingHistory(null); }
  };

  const toggleHistoryCycle = (cycleId: string) => {
    setExpandedHistoryCycles((prev) => ({ ...prev, [cycleId]: !prev[cycleId] }));
  };

  const handleDissolveMergedGroup = async (mergedGroupId: string) => {
    if (!confirm('Are you sure you want to dissolve this merged group?')) return;
    setDissolvingMergedId(mergedGroupId);
    try {
      await dissolveMergedGroup(mergedGroupId);
      setSuccess('Merged group dissolved.');
      setTimeout(() => setSuccess(null), 3000);
      await fetchSharesData();
    } catch { setError('Failed to dissolve merged group.'); } finally { setDissolvingMergedId(null); }
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
      setSuccess('Share percentages updated successfully!');
      setTimeout(() => setSuccess(null), 3000);
      await fetchSharesData();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || 'Failed to update percentages.');
    } finally { setSavingPercentages(false); }
  };

  const handleAssignGuarantor = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssigningGuarantor(true);
    try {
      await addGuarantor({ groupId, guarantorUserId: guarantorForm.guarantorUserId, guaranteedUserId: guarantorForm.guaranteedUserId, notes: guarantorForm.notes || undefined });
      setShowAssignGuarantorModal(false);
      setGuarantorForm({ guarantorUserId: '', guaranteedUserId: '', notes: '' });
      setSuccess('Guarantor (ዋስ) assigned successfully!');
      setTimeout(() => setSuccess(null), 3000);
      await fetchGuarantors();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || 'Failed to assign guarantor.');
    } finally { setAssigningGuarantor(false); }
  };
  const handleUpdateGuarantorStatus = async (guarantorId: string, status: 'ACTIVE' | 'RELEASED' | 'CALLED') => {
    setUpdatingGuarantorId(guarantorId);
    try {
      await updateGuarantorStatus(guarantorId, status);
      setSuccess(`Guarantor status updated to ${status}.`);
      setTimeout(() => setSuccess(null), 3000);
      await fetchGuarantors();
    } catch { setError('Failed to update guarantor status.'); } finally { setUpdatingGuarantorId(null); }
  };
  const handleDeleteGuarantor = async (guarantorId: string) => {
    if (!confirm('Remove this guarantor arrangement?')) return;
    try {
      await deleteGuarantor(guarantorId);
      setSuccess('Guarantor arrangement removed.');
      setTimeout(() => setSuccess(null), 3000);
      await fetchGuarantors();
    } catch { setError('Failed to remove guarantor.'); }
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

  const handleUpdateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingGroup(true);
    setError(null);
    try {
      let cycleType: string | undefined;
      if (editGroupForm.cycleDuration) {
        switch (editGroupForm.cycleDuration.toLowerCase()) {
          case 'weekly': cycleType = 'weekly'; break;
          case 'bi-weekly':
          case 'biweekly': cycleType = 'biweekly'; break;
          case 'monthly': cycleType = 'monthly'; break;
          default: cycleType = 'monthly';
        }
      }

      await updateGroup(groupId, {
        name: editGroupForm.name,
        description: editGroupForm.description || undefined,
        contributionAmount: Number(editGroupForm.contributionAmount),
        maxMembers: Number(editGroupForm.maxMembers),
        cycleType,
        photoUrl: editGroupForm.photoUrl || undefined,
        endDate: editGroupForm.endDate || undefined,
        physicalAddress: editGroupForm.physicalAddress || undefined,
        latitude: editGroupForm.latitude ? Number(editGroupForm.latitude) : undefined,
        longitude: editGroupForm.longitude ? Number(editGroupForm.longitude) : undefined,
      });
      setShowEditGroupModal(false);
      setSuccess('Group information updated successfully.');
      setTimeout(() => setSuccess(null), 3000);
      await fetchData();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || 'Failed to update group information.');
    } finally {
      setUpdatingGroup(false);
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
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            {group.photoUrl ? (
              <img src={getMediaUrl(group.photoUrl)} alt={group.name} className="w-20 h-20 rounded-lg object-cover bg-gray-100 flex-shrink-0" />
            ) : (
              <div className="w-20 h-20 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                <Users className="h-8 w-8 text-gray-400" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">{group.name}</h1>
                <Badge status={group.status} />
              </div>
              {group.description && (
                <p className="mt-2 text-sm text-gray-500">{group.description}</p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-gray-500">
                {group.physicalAddress && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {group.physicalAddress}
                    {group.latitude && group.longitude && (
                      <a 
                        href={`https://www.google.com/maps/search/?api=1&query=${group.latitude},${group.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-600 hover:underline ml-1"
                      >
                        (Map)
                      </a>
                    )}
                  </span>
                )}
                {group.endDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    Ends: {new Date(group.endDate).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button
              variant="secondary"
              onClick={() => {
                setEditGroupForm({
                  name: group.name,
                  description: group.description || '',
                  contributionAmount: String(group.contributionAmount),
                  maxMembers: String(group.maxMembers),
                  cycleDuration: group.cycleDuration || 'Weekly',
                  photoUrl: group.photoUrl || '',
                  endDate: group.endDate ? new Date(group.endDate).toISOString().split('T')[0] : '',
                  physicalAddress: group.physicalAddress || '',
                  latitude: group.latitude ? String(group.latitude) : '',
                  longitude: group.longitude ? String(group.longitude) : '',
                });
                setShowEditGroupModal(true);
              }}
            >
              <Settings className="h-4 w-4 mr-2" />
              Edit Info
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                const groupName = prompt(`To delete this group, please type its name: "${group.name}"`);
                if (groupName !== group.name) {
                  if (groupName !== null) alert('Group name did not match. Deletion cancelled.');
                  return;
                }
                try {
                  await import('@/lib/api').then(m => m.softDeleteGroup(groupId));
                  router.push('/groups');
                } catch (err: unknown) {
                  const axiosErr = err as { response?: { data?: { message?: string } } };
                  setError(axiosErr.response?.data?.message || 'Failed to delete group.');
                }
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Group
            </Button>
            <Button
              onClick={handleLotteryDraw}
              loading={drawLoading}
            >
              <Ticket className="h-4 w-4 mr-2" />
              {t('group.draw_lottery')}
            </Button>
          </div>
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
        <button
          onClick={() => handleTabChange('penalties')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'penalties' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <span className="flex items-center gap-1.5"><Ban className="h-3.5 w-3.5" />{t('group.tab_penalties')}</span>
        </button>
        <button
          onClick={() => handleTabChange('disputes')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'disputes' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <span className="flex items-center gap-1.5"><Gavel className="h-3.5 w-3.5" />{t('group.tab_disputes')}</span>
        </button>
        <button
          onClick={() => handleTabChange('swaps')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'swaps' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <span className="flex items-center gap-1.5"><ArrowLeftRight className="h-3.5 w-3.5" />{t('group.tab_swaps')}</span>
        </button>
        <button
          onClick={() => handleTabChange('guarantors')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'guarantors' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" />{t('group.tab_guarantors')}</span>
        </button>
        <button
          onClick={() => handleTabChange('shares')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'shares' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <span className="flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5" />{t('group.tab_shares')}</span>
        </button>
        <button
          onClick={() => handleTabChange('leaders')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'leaders' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" />Leaders</span>
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
                      <p className="text-xs text-gray-500">{t('group.desc_require_exact')}</p>
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
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('group.label_deposit_deadline')}</label>
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
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('group.label_min_verification')}</label>
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
                      <p className="text-xs text-gray-500">{t('group.desc_skip_round')}</p>
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
                      <p className="text-xs text-gray-500">{t('group.desc_require_guarantor')}</p>
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
                      <p className="text-sm font-medium text-gray-900">{t('group.label_mid_cycle_join')}</p>
                      <p className="text-xs text-gray-500">{t('group.desc_mid_cycle_join')}</p>
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
                      <p className="text-xs text-gray-500">{t('group.desc_require_gov_id')}</p>
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
                      <p className="text-sm font-medium text-gray-900">{t('group.label_post_win')}</p>
                      <p className="text-xs text-gray-500">{t('group.desc_post_win')}</p>
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
                      <p className="text-sm font-medium text-gray-900">{t('group.label_auto_complete')}</p>
                      <p className="text-xs text-gray-500">{t('group.desc_auto_complete')}</p>
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
                    {t('group.label_custom_rules')}
                  </label>
                  <textarea
                    value={rules.customRules ?? ''}
                    onChange={(e) => setRules({ ...rules, customRules: e.target.value || undefined })}
                    className="input-field"
                    rows={4}
                    placeholder={t('group.placeholder_custom_rules')}
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
              <p className="text-gray-500 text-sm">{t('group.rules_refresh')}</p>
            </div>
          )}
        </div>
      )}

      {/* Penalties Tab */}
      {activeTab === 'penalties' && (
        <div className="space-y-6">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{t('group.penalties_title')}</h3>
                <p className="text-sm text-gray-500">{t('group.penalties_desc')}</p>
              </div>
            </div>

            {penaltiesLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
              </div>
            ) : penalties.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="table-header">{t('group.col_member')}</th>
                      <th className="table-header">{t('group.col_reason')}</th>
                      <th className="table-header text-right">{t('group.col_amount_etb')}</th>
                      <th className="table-header">{t('group.col_status')}</th>
                      <th className="table-header">{t('group.col_date')}</th>
                      <th className="table-header text-right">{t('group.col_actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {penalties.map((penalty) => (
                      <tr key={penalty.id} className="hover:bg-gray-50/30 transition-colors">
                        <td className="table-cell font-medium text-gray-900">
                          {penalty.user?.name || 'Unknown Member'}
                        </td>
                        <td className="table-cell text-gray-500 max-w-xs truncate" title={penalty.reason}>
                          {penalty.reason}
                        </td>
                        <td className="table-cell text-right font-semibold text-gray-900">
                          {penalty.amount.toLocaleString()}
                        </td>
                        <td className="table-cell">
                          <Badge
                            status={
                              penalty.status === 'PAID'
                                ? 'verified'
                                : penalty.status === 'WAIVED'
                                ? 'pending'
                                : 'rejected'
                            }
                          >
                            {penalty.status}
                          </Badge>
                        </td>
                        <td className="table-cell text-gray-500 text-sm">
                          {new Date(penalty.createdAt).toLocaleDateString()}
                        </td>
                        <td className="table-cell text-right">
                          {penalty.status === 'PENDING' && (
                            <div className="flex justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => handlePayPenalty(penalty.id)}
                              >
                                {t('group.btn_mark_paid')}
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleWaivePenalty(penalty.id)}
                              >
                                {t('group.btn_waive')}
                              </Button>
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
                <Ban className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">{t('group.no_penalties')}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Disputes Tab */}
      {activeTab === 'disputes' && (
        <div className="space-y-6">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{t('group.disputes_title')}</h3>
                <p className="text-sm text-gray-500">{t('group.disputes_desc')}</p>
              </div>
              <Button size="sm" onClick={() => setShowFileDisputeModal(true)}>
                <Gavel className="h-4 w-4 mr-1.5" />
                {t('group.btn_file_dispute')}
              </Button>
            </div>

            {disputesLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
              </div>
            ) : disputes.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="table-header">{t('group.col_filed_by')}</th>
                      <th className="table-header">{t('group.col_against')}</th>
                      <th className="table-header">{t('group.col_type')}</th>
                      <th className="table-header">{t('group.col_description')}</th>
                      <th className="table-header">{t('group.col_status')}</th>
                      <th className="table-header">{t('group.col_resolution')}</th>
                      <th className="table-header text-right">{t('group.col_actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {disputes.map((dispute) => (
                      <tr key={dispute.id} className="hover:bg-gray-50/30 transition-colors">
                        <td className="table-cell font-medium text-gray-900">
                          {dispute.filedBy?.name || 'Unknown'}
                        </td>
                        <td className="table-cell text-gray-500">
                          {dispute.againstUser?.name || 'Group / General'}
                        </td>
                        <td className="table-cell">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 uppercase">
                            {dispute.type}
                          </span>
                        </td>
                        <td className="table-cell text-gray-500 max-w-xs truncate" title={dispute.description}>
                          {dispute.description}
                        </td>
                        <td className="table-cell">
                          <Badge
                            status={
                              dispute.status === 'RESOLVED'
                                ? 'verified'
                                : dispute.status === 'OPEN'
                                ? 'rejected'
                                : 'pending'
                            }
                          >
                            {dispute.status}
                          </Badge>
                        </td>
                        <td className="table-cell text-gray-500 text-sm max-w-xs truncate" title={dispute.resolution}>
                          {dispute.resolution || '-'}
                        </td>
                        <td className="table-cell text-right">
                          {dispute.status === 'OPEN' && (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => setShowResolveModal(dispute.id)}
                            >
                              {t('group.btn_resolve')}
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
                <Gavel className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">{t('group.no_disputes')}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Turn Swaps Tab */}
      {activeTab === 'swaps' && (
        <div className="space-y-6">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{t('group.swaps_title')}</h3>
                <p className="text-sm text-gray-500">{t('group.swaps_desc')}</p>
              </div>
              <Button size="sm" onClick={() => setShowRequestSwapModal(true)}>
                <ArrowLeftRight className="h-4 w-4 mr-1.5" />
                {t('group.btn_request_swap')}
              </Button>
            </div>

            {swapsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
              </div>
            ) : swaps.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="table-header">{t('group.col_requester')}</th>
                      <th className="table-header">{t('group.col_target_member')}</th>
                      <th className="table-header text-center">{t('group.col_req_turn')}</th>
                      <th className="table-header text-center">{t('group.col_tgt_turn')}</th>
                      <th className="table-header">{t('group.col_reason')}</th>
                      <th className="table-header">{t('group.col_status')}</th>
                      <th className="table-header text-right">{t('group.col_actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {swaps.map((swap) => (
                      <tr key={swap.id} className="hover:bg-gray-50/30 transition-colors">
                        <td className="table-cell font-medium text-gray-900">
                          {swap.requester?.name || 'Unknown'}
                        </td>
                        <td className="table-cell text-gray-900">
                          {swap.target?.name || 'Unknown'}
                        </td>
                        <td className="table-cell text-center text-gray-500 font-semibold">{swap.requesterTurn}</td>
                        <td className="table-cell text-center text-gray-500 font-semibold">{swap.targetTurn}</td>
                        <td className="table-cell text-gray-500 max-w-xs truncate" title={swap.reason}>
                          {swap.reason || '-'}
                        </td>
                        <td className="table-cell">
                          <Badge
                            status={
                              swap.status === 'APPROVED'
                                ? 'verified'
                                : swap.status === 'REJECTED'
                                ? 'rejected'
                                : 'pending'
                            }
                          >
                            {swap.status}
                          </Badge>
                        </td>
                        <td className="table-cell text-right">
                          {swap.status === 'PENDING' && (
                            <div className="flex justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => handleRespondSwap(swap.id, true)}
                              >
                                {t('group.btn_approve')}
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleRespondSwap(swap.id, false)}
                              >
                                {t('group.btn_reject')}
                              </Button>
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
                <ArrowLeftRight className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">{t('group.no_swaps')}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Guarantors (Wase / ዋስ) Tab */}
      {activeTab === 'guarantors' && (
        <div className="space-y-6">
          {/* Ethiopian Context Card */}
          <div className="card bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 rounded-lg flex-shrink-0">
                <Shield className="h-5 w-5 text-amber-700" />
              </div>
              <div>
                <h4 className="font-semibold text-amber-900">{t('group.wase_title')}</h4>
                <p className="text-sm text-amber-700 mt-0.5">
                  {t('group.wase_desc')}
                </p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{t('group.guarantors_title')}</h3>
                <p className="text-sm text-gray-500">{t('group.guarantors_desc')}</p>
              </div>
              <Button size="sm" onClick={() => setShowAssignGuarantorModal(true)}>
                <Plus className="h-4 w-4 mr-1.5" />
                {t('group.btn_assign_guarantor')}
              </Button>
            </div>

            {guarantorsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
              </div>
            ) : guarantors.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="table-header">{t('group.col_guarantor')}</th>
                      <th className="table-header">{t('group.col_guaranteed')}</th>
                      <th className="table-header">{t('group.col_status')}</th>
                      <th className="table-header">{t('group.col_notes')}</th>
                      <th className="table-header">{t('group.col_assigned_on')}</th>
                      <th className="table-header text-right">{t('group.col_actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {guarantors.map((g) => (
                      <tr key={g.id} className="hover:bg-gray-50/30 transition-colors">
                        <td className="table-cell">
                          <div>
                            <p className="font-medium text-gray-900">{g.guarantorUser?.name}</p>
                            <p className="text-xs text-gray-400">{g.guarantorUser?.phone}</p>
                          </div>
                        </td>
                        <td className="table-cell">
                          <div>
                            <p className="font-medium text-gray-900">{g.guaranteedUser?.name}</p>
                            <p className="text-xs text-gray-400">{g.guaranteedUser?.phone}</p>
                          </div>
                        </td>
                        <td className="table-cell">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              g.status === 'ACTIVE'
                                ? 'bg-green-100 text-green-700'
                                : g.status === 'CALLED'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {g.status === 'ACTIVE' ? `✅ ${t('group.status_active')}` : g.status === 'CALLED' ? `🚨 ${t('group.status_called')}` : `⚪ ${t('group.status_released')}`}
                          </span>
                        </td>
                        <td className="table-cell text-gray-500 text-sm max-w-xs truncate" title={g.notes}>
                          {g.notes || '-'}
                        </td>
                        <td className="table-cell text-gray-500 text-sm">
                          {new Date(g.createdAt).toLocaleDateString()}
                        </td>
                        <td className="table-cell text-right">
                          <div className="flex justify-end gap-1.5">
                            {g.status === 'ACTIVE' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  loading={updatingGuarantorId === g.id}
                                  onClick={() => handleUpdateGuarantorStatus(g.id, 'RELEASED')}
                                >
                                  {t('group.btn_release')}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="primary"
                                  loading={updatingGuarantorId === g.id}
                                  onClick={() => handleUpdateGuarantorStatus(g.id, 'CALLED')}
                                >
                                  {t('group.btn_call')}
                                </Button>
                              </>
                            )}
                            {(g.status === 'RELEASED' || g.status === 'CALLED') && (
                              <button
                                onClick={() => handleDeleteGuarantor(g.id)}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Remove record"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Shield className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">{t('group.no_guarantors')}</p>
                <p className="text-xs text-gray-400 mt-1">{t('group.no_guarantors_hint')}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Shares & Dues Tab */}
      {activeTab === 'shares' && (
        <div className="space-y-6">
          {sharesLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                <p className="text-sm text-gray-500">{t('group.rules_loading')}</p>
              </div>
            </div>
          ) : (
            <>
              {/* Dues Breakdown Section */}
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{t('group.shares_title')}</h3>
                    <p className="text-sm text-gray-500">{t('group.shares_desc')}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setShowGrantWaiverModal(true)}>
                      <CircleDollarSign className="h-4 w-4 mr-1.5" />
                      {t('group.btn_grant_waiver')}
                    </Button>
                  </div>
                </div>

                {memberDues.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          <th className="table-header">{t('group.col_member')}</th>
                          <th className="table-header text-center">{t('group.col_shares')}</th>
                          <th className="table-header text-right">{t('group.col_contribution')}</th>
                          <th className="table-header text-right">{t('group.col_admin_fee')}</th>
                          <th className="table-header text-right">{t('group.col_total_due')}</th>
                          <th className="table-header text-center">{t('group.col_merged')}</th>
                          <th className="table-header text-right">{t('group.col_actions')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {memberDues.map((due) => (
                          <tr key={due.userId} className="hover:bg-gray-50/30 transition-colors">
                            <td className="table-cell">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900">{due.userName}</span>
                                {due.mergedGroupName && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-violet-50 text-violet-600 font-medium">
                                    {due.mergedGroupName}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="table-cell text-center">
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-50 text-indigo-700 font-bold text-sm">
                                {due.shares}
                              </span>
                            </td>
                            <td className="table-cell text-right text-gray-700">
                              ETB {due.contributionDue.toLocaleString()}
                            </td>
                            <td className="table-cell text-right text-gray-500">
                              ETB {due.adminFeeDue.toLocaleString()}
                            </td>
                            <td className="table-cell text-right font-semibold text-gray-900">
                              ETB {due.totalDue.toLocaleString()}
                            </td>
                            <td className="table-cell text-center">
                              {due.isMerged ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700">Yes</span>
                              ) : (
                                <span className="text-gray-400 text-xs">—</span>
                              )}
                            </td>
                            <td className="table-cell text-right">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  setShowEditSharesModal({ userId: due.userId, userName: due.userName, currentShares: due.shares });
                                  setEditingShares(due.shares);
                                }}
                              >
                                {t('group.btn_edit_shares')}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Wallet className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">{t('group.no_dues')}</p>
                  </div>
                )}
              </div>

              {/* Merged Groups Section */}
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{t('group.merged_title')}</h3>
                    <p className="text-sm text-gray-500">{t('group.merged_desc')}</p>
                  </div>
                  <Button size="sm" onClick={() => setShowCreateMergedModal(true)}>
                    <Plus className="h-4 w-4 mr-1.5" />
                    {t('group.btn_create_merged')}
                  </Button>
                </div>

                {mergedGroups.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {mergedGroups.map((mg) => (
                      <div key={mg.id} className={`border rounded-xl p-4 transition-all ${mg.status === 'DISSOLVED' ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-white border-gray-200 hover:border-indigo-200 hover:shadow-sm'}`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                              <Users className="h-4 w-4 text-violet-600" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-900 text-sm">{mg.name}</h4>
                              <p className="text-xs text-gray-400">{mg.slots.length} {t('group.merged_members_count')} · {mg.totalShares} {t('group.merged_shares')}</p>
                            </div>
                          </div>
                          {mg.status === 'ACTIVE' && (
                            <div className="flex gap-1.5 flex-wrap">
                              <Button
                                size="sm"
                                variant="secondary"
                                loading={loadingDepositStatus === mg.id}
                                onClick={() => fetchMergedGroupStatus(mg.id)}
                              >
                                {t('group.btn_check_status')}
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                loading={loadingHistory === mg.id}
                                onClick={() => fetchDepositHistory(mg.id)}
                              >
                                <Clock className="h-3.5 w-3.5 mr-1" />
                                {t('group.btn_view_history')}
                              </Button>
                              <Button
                                size="sm"
                                variant="primary"
                                loading={enforcingCompliance === mg.id}
                                onClick={() => handleEnforceCompliance(mg.id)}
                              >
                                {t('group.btn_enforce')}
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => openEditPercentages(mg)}
                              >
                                {t('group.btn_edit_percentages')}
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                loading={dissolvingMergedId === mg.id}
                                onClick={() => handleDissolveMergedGroup(mg.id)}
                              >
                                {t('group.btn_dissolve')}
                              </Button>
                            </div>
                          )}
                          {mg.status === 'DISSOLVED' && (
                            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">Dissolved</span>
                          )}
                        </div>
                        <div className="space-y-2">
                          {mg.slots.map((slot) => {
                            const depositStatus = mergedDepositStatuses[mg.id]?.find((s) => s.userId === slot.user.id);
                            return (
                              <div key={slot.id} className="rounded-md bg-gray-50 overflow-hidden">
                                <div className="flex items-center justify-between py-1.5 px-2">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center">
                                      <span className="text-[10px] font-bold text-primary-700">
                                        {slot.user.name.split(' ').map((n) => n[0]).join('')}
                                      </span>
                                    </div>
                                    <span className="text-sm text-gray-700">{slot.user.name}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {depositStatus && (
                                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                        depositStatus.status === 'PAID' ? 'bg-green-100 text-green-700' :
                                        depositStatus.status === 'PARTIAL' ? 'bg-amber-100 text-amber-700' :
                                        depositStatus.status === 'LATE' ? 'bg-red-100 text-red-700' :
                                        'bg-gray-200 text-gray-600'
                                      }`}>
                                        {depositStatus.status}
                                      </span>
                                    )}
                                    <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                                      {(slot.sharePercentage * 100).toFixed(0)}%
                                    </span>
                                  </div>
                                </div>
                                {depositStatus && (
                                  <div className="px-2 pb-2 pt-0.5">
                                    <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
                                      <span>ETB {depositStatus.paidAmount.toLocaleString()} / {depositStatus.expectedTotal.toLocaleString()}</span>
                                      <span className="text-gray-400">
                                        (Fee: ETB {depositStatus.expectedAdminFee.toLocaleString()})
                                      </span>
                                    </div>
                                    <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
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
                          <div className="mt-3 border-t border-gray-100 pt-3">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('group.history_title')}</p>
                            {depositHistory[mg.id].cycles.length > 0 ? (
                              <div className="space-y-1">
                                {depositHistory[mg.id].cycles.map((cycle) => {
                                  const paymentRatio = cycle.totalExpected > 0 ? cycle.totalPaid / cycle.totalExpected : 0;
                                  const isExpanded = expandedHistoryCycles[cycle.cycleId] ?? false;
                                  const borderColor = paymentRatio >= 0.99 ? 'border-green-400' : paymentRatio > 0 ? 'border-amber-400' : 'border-red-400';
                                  const bgColor = paymentRatio >= 0.99 ? 'bg-green-50' : paymentRatio > 0 ? 'bg-amber-50' : 'bg-red-50';

                                  return (
                                    <div key={cycle.cycleId} className={`border-l-4 ${borderColor} rounded-r-lg overflow-hidden`}>
                                      <button
                                        type="button"
                                        onClick={() => toggleHistoryCycle(cycle.cycleId)}
                                        className={`w-full flex items-center justify-between px-3 py-2 ${bgColor} hover:brightness-95 transition-all text-left`}
                                      >
                                        <div className="flex items-center gap-2 min-w-0">
                                          <span className="text-xs font-bold text-gray-700">Cycle {cycle.cycleNumber}</span>
                                          <span className="text-[10px] text-gray-400 hidden sm:inline">
                                            {new Date(cycle.startDate).toLocaleDateString('en-CA')} → {new Date(cycle.endDate).toLocaleDateString('en-CA')}
                                          </span>
                                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                            cycle.cycleStatus === 'COMPLETED' ? 'bg-gray-200 text-gray-600' : 'bg-blue-100 text-blue-700'
                                          }`}>
                                            {cycle.cycleStatus}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                            <div
                                              className={`h-full rounded-full ${
                                                paymentRatio >= 0.99 ? 'bg-green-500' : paymentRatio > 0 ? 'bg-amber-500' : 'bg-red-500'
                                              }`}
                                              style={{ width: `${Math.min(100, paymentRatio * 100)}%` }}
                                            />
                                          </div>
                                          <span className="text-[10px] font-semibold text-gray-600 w-8 text-right">
                                            {Math.round(paymentRatio * 100)}%
                                          </span>
                                          <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                        </div>
                                      </button>

                                      {isExpanded && (
                                        <div className="px-3 py-2 bg-white border-t border-gray-100">
                                          <table className="w-full text-xs">
                                            <thead>
                                              <tr className="text-gray-500">
                                                <th className="text-left py-1 font-medium">Member</th>
                                                <th className="text-right py-1 font-medium">Expected</th>
                                                <th className="text-right py-1 font-medium">Paid</th>
                                                <th className="text-right py-1 font-medium">Status</th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                              {cycle.members.map((member) => (
                                                <tr key={member.userId}>
                                                  <td className="py-1.5 text-gray-700 font-medium">{member.userName}</td>
                                                  <td className="py-1.5 text-right text-gray-500">
                                                    ETB {member.expectedTotal.toLocaleString()}
                                                  </td>
                                                  <td className="py-1.5 text-right text-gray-700 font-medium">
                                                    ETB {member.paidAmount.toLocaleString()}
                                                  </td>
                                                  <td className="py-1.5 text-right">
                                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                                      member.status === 'PAID' ? 'bg-green-100 text-green-700' :
                                                      member.status === 'PARTIAL' ? 'bg-amber-100 text-amber-700' :
                                                      member.status === 'LATE' ? 'bg-red-100 text-red-700' :
                                                      'bg-gray-200 text-gray-600'
                                                    }`}>
                                                      {member.status}
                                                    </span>
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                          <div className="flex justify-between mt-1.5 pt-1.5 border-t border-gray-100 text-[10px] text-gray-500">
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
                              <p className="text-xs text-gray-400 italic">{t('group.no_history')}</p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Users className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">{t('group.no_merged')}</p>
                    <p className="text-xs text-gray-400 mt-1">{t('group.no_merged_hint')}</p>
                  </div>
                )}
              </div>

              {/* Fee Waivers Section */}
              <div className="card">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{t('group.waivers_title')}</h3>
                    <p className="text-sm text-gray-500">{t('group.waivers_desc')}</p>
                  </div>
                </div>

                {feeWaivers.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          <th className="table-header">{t('group.col_member')}</th>
                          <th className="table-header">{t('group.col_reason')}</th>
                          <th className="table-header text-center">{t('group.col_cycles_used')}</th>
                          <th className="table-header text-center">{t('group.col_duration')}</th>
                          <th className="table-header text-center">{t('group.col_missed')}</th>
                          <th className="table-header">{t('group.col_status')}</th>
                          <th className="table-header text-right">{t('group.col_actions')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {feeWaivers.map((waiver) => (
                          <tr key={waiver.id} className="hover:bg-gray-50/30 transition-colors">
                            <td className="table-cell font-medium text-gray-900">
                              {waiver.user?.name || 'Unknown'}
                            </td>
                            <td className="table-cell text-gray-500 max-w-xs truncate" title={waiver.reason}>
                              {waiver.reason}
                            </td>
                            <td className="table-cell text-center">
                              <span className="font-semibold text-gray-900">{waiver.cyclesUsed}</span>
                              <span className="text-gray-400"> / {waiver.durationCycles}</span>
                            </td>
                            <td className="table-cell text-center text-gray-700">
                              {waiver.durationCycles} cycles
                            </td>
                            <td className="table-cell text-center">
                              {waiver.missedAfterExpiry > 0 ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                  {waiver.missedAfterExpiry}
                                </span>
                              ) : (
                                <span className="text-gray-400">0</span>
                              )}
                            </td>
                            <td className="table-cell">
                              <Badge
                                status={
                                  waiver.status === 'ACTIVE'
                                    ? 'active'
                                    : waiver.status === 'EXPIRED'
                                    ? 'completed'
                                    : 'inactive'
                                }
                              >
                                {waiver.status}
                              </Badge>
                            </td>
                            <td className="table-cell text-right">
                              {waiver.status === 'ACTIVE' && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  loading={cancellingWaiverId === waiver.id}
                                  onClick={() => handleCancelWaiver(waiver.id)}
                                >
                                  {t('group.btn_cancel_waiver')}
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
                    <p className="text-gray-500 text-sm">{t('group.no_waivers')}</p>
                    <p className="text-xs text-gray-400 mt-1">{t('group.no_waivers_hint')}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'leaders' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">Group Leaders</h3>
            <Button onClick={() => setShowAssignLeaderModal(true)}>
              <Shield className="h-4 w-4 mr-2" />
              Assign Leader
            </Button>
          </div>
          {leadersLoading ? (
            <div className="py-8 flex justify-center text-gray-500">Loading leaders...</div>
          ) : leaders.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {leaders.map(leader => (
                <div key={leader.id} className="p-4 border rounded-lg bg-white shadow-sm flex flex-col justify-between">
                  <div>
                    <h4 className="font-semibold text-gray-900">{leader.admin.name}</h4>
                    <p className="text-sm text-gray-500">{leader.admin.email}</p>
                    <div className="mt-3 space-y-1">
                      <label className="flex items-center text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={leader.canManageMembers}
                          onChange={(e) => handleUpdateLeader(leader.id, { canManageMembers: e.target.checked })}
                          className="mr-2"
                        />
                        Can Manage Members
                      </label>
                      <label className="flex items-center text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={leader.canManageDeposits}
                          onChange={(e) => handleUpdateLeader(leader.id, { canManageDeposits: e.target.checked })}
                          className="mr-2"
                        />
                        Can Manage Deposits
                      </label>
                      <label className="flex items-center text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={leader.canTriggerLottery}
                          onChange={(e) => handleUpdateLeader(leader.id, { canTriggerLottery: e.target.checked })}
                          className="mr-2"
                        />
                        Can Trigger Lottery
                      </label>
                      <label className="flex items-center text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={leader.canManageRules}
                          onChange={(e) => handleUpdateLeader(leader.id, { canManageRules: e.target.checked })}
                          className="mr-2"
                        />
                        Can Manage Rules
                      </label>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button size="sm" variant="danger" onClick={() => handleRemoveLeader(leader.id)}>
                      Remove Leader
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 border border-dashed rounded-lg bg-gray-50">
              <Shield className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p>No sub-admins assigned to this group.</p>
            </div>
          )}
        </div>
      )}

      {/* Assign Leader Modal */}
      <Modal
        isOpen={showAssignLeaderModal}
        onClose={() => setShowAssignLeaderModal(false)}
        title="Assign Group Leader"
        size="md"
      >
        <form onSubmit={handleAssignLeader} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Select Admin</label>
            <select
              value={leaderForm.adminId}
              onChange={(e) => setLeaderForm({ ...leaderForm, adminId: e.target.value })}
              className="input-field"
              required
            >
              <option value="">Select an admin...</option>
              {adminUsers.map(admin => (
                <option key={admin.id} value={admin.id}>{admin.name} ({admin.email})</option>
              ))}
            </select>
          </div>
          <div className="space-y-2 mt-4">
            <h4 className="text-sm font-medium text-gray-700">Permissions</h4>
            <label className="flex items-center text-sm text-gray-700">
              <input
                type="checkbox"
                checked={leaderForm.canManageMembers}
                onChange={(e) => setLeaderForm({ ...leaderForm, canManageMembers: e.target.checked })}
                className="mr-2"
              />
              Can Manage Members
            </label>
            <label className="flex items-center text-sm text-gray-700">
              <input
                type="checkbox"
                checked={leaderForm.canManageDeposits}
                onChange={(e) => setLeaderForm({ ...leaderForm, canManageDeposits: e.target.checked })}
                className="mr-2"
              />
              Can Manage Deposits
            </label>
            <label className="flex items-center text-sm text-gray-700">
              <input
                type="checkbox"
                checked={leaderForm.canTriggerLottery}
                onChange={(e) => setLeaderForm({ ...leaderForm, canTriggerLottery: e.target.checked })}
                className="mr-2"
              />
              Can Trigger Lottery
            </label>
            <label className="flex items-center text-sm text-gray-700">
              <input
                type="checkbox"
                checked={leaderForm.canManageRules}
                onChange={(e) => setLeaderForm({ ...leaderForm, canManageRules: e.target.checked })}
                className="mr-2"
              />
              Can Manage Rules
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowAssignLeaderModal(false)}>Cancel</Button>
            <Button type="submit" loading={assigningLeader}>Assign</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Shares Modal */}
      <Modal
        isOpen={!!showEditSharesModal}
        onClose={() => setShowEditSharesModal(null)}
        title={t('group.modal_edit_shares')}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Update the number of shares for <strong>{showEditSharesModal?.userName}</strong>. Each share multiplies the contribution and admin fee amounts.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('group.label_shares_count')}</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {[0.25, 0.5, 0.75, 1, 1.5, 2].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setEditingShares(preset)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    editingShares === preset
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  {preset === 0.25 ? '¼' : preset === 0.5 ? '½' : preset === 0.75 ? '¾' : preset === 1.5 ? '1½' : preset}
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
            {group && (
              <div className="flex items-center justify-between text-xs text-indigo-800 bg-indigo-100/60 rounded-md px-2.5 py-1.5 mt-2">
                <span>Expected per cycle:</span>
                <span className="font-bold">ETB {(group.contributionAmount * editingShares).toLocaleString()}</span>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowEditSharesModal(null)}>
              {t('group.btn_cancel')}
            </Button>
            <Button onClick={handleUpdateShares} loading={savingShares}>
              {t('group.save_changes')}
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
        title={t('group.modal_grant_waiver')}
        size="sm"
      >
        <form onSubmit={handleGrantWaiver} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('group.col_member')} *</label>
            <select
              value={waiverForm.userId}
              onChange={(e) => setWaiverForm({ ...waiverForm, userId: e.target.value })}
              className="input-field"
              required
            >
              <option value="" disabled>{t('group.placeholder_select_member')}</option>
              {group?.members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('group.label_waiver_reason')}</label>
            <textarea
              value={waiverForm.reason}
              onChange={(e) => setWaiverForm({ ...waiverForm, reason: e.target.value })}
              className="input-field"
              rows={3}
              placeholder={t('group.placeholder_waiver_reason')}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('group.label_waiver_duration')}</label>
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
              {t('group.btn_cancel')}
            </Button>
            <Button type="submit" loading={grantingWaiver} disabled={!waiverForm.userId || !waiverForm.reason}>
              {t('group.btn_grant_waiver')}
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
        title={t('group.modal_create_merged')}
        size="sm"
      >
        <form onSubmit={handleCreateMergedGroup} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('group.label_merged_name')}</label>
            <input
              type="text"
              value={mergedForm.name}
              onChange={(e) => setMergedForm({ ...mergedForm, name: e.target.value })}
              className="input-field"
              placeholder={t('group.placeholder_merged_name')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('group.label_merged_members')}</label>
            <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
              {group?.members.map((member) => (
                <label
                  key={member.id}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0"
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
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">{member.name}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {mergedForm.selectedUserIds.length}/4 members selected (min 2)
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('group.label_merged_shares')}</label>
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
              {t('group.btn_cancel')}
            </Button>
            <Button type="submit" loading={creatingMerged} disabled={mergedForm.selectedUserIds.length < 2}>
              {t('group.btn_create_merged')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Merged Group Percentages Modal */}
      <Modal
        isOpen={!!showEditPercentagesModal}
        onClose={() => setShowEditPercentagesModal(null)}
        title={t('group.modal_edit_percentages')}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Assign custom share percentages for each member in <strong>{showEditPercentagesModal?.name}</strong>. Percentages must total 100%.
          </p>
          <div className="space-y-3">
            {percentageForm.map((entry, idx) => (
              <div key={entry.userId} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{entry.userName}</p>
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
                  <span className="text-sm text-gray-500 font-medium">%</span>
                </div>
              </div>
            ))}
          </div>
          {/* Sum indicator */}
          {percentageForm.length > 0 && (
            <div className={`text-sm font-medium text-center py-2 rounded-lg ${
              Math.abs(percentageForm.reduce((s, p) => s + p.sharePercentage, 0) - 1.0) <= 0.01
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-700'
            }`}>
              Total: {Math.round(percentageForm.reduce((s, p) => s + p.sharePercentage, 0) * 100)}%
              {Math.abs(percentageForm.reduce((s, p) => s + p.sharePercentage, 0) - 1.0) > 0.01 && (
                <span className="ml-2">(must equal 100%)</span>
              )}
            </div>
          )}
          <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-700">
              <strong>Tip:</strong> {t('group.percentages_tip')}
            </p>
          </div>
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
              {t('group.btn_equal_split')}
            </Button>
            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={() => setShowEditPercentagesModal(null)}>
                {t('group.btn_cancel')}
              </Button>
              <Button
                onClick={handleSavePercentages}
                loading={savingPercentages}
                disabled={Math.abs(percentageForm.reduce((s, p) => s + p.sharePercentage, 0) - 1.0) > 0.01}
              >
                {t('group.btn_save_percentages')}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

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
          setAddMemberShares(1);
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

          {/* Shares Selector */}
          {group && (
            <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">
                  Contribution per full share
                </p>
                <span className="text-sm font-bold text-indigo-900">
                  ETB {group.contributionAmount.toLocaleString()}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {[0.25, 0.5, 0.75, 1, 1.5, 2].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAddMemberShares(preset)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      addMemberShares === preset
                        ? 'bg-primary-600 text-white shadow-sm'
                        : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    {preset === 0.25 ? '¼' : preset === 0.5 ? '½' : preset === 0.75 ? '¾' : preset === 1.5 ? '1½' : preset}
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
              <div className="flex items-center justify-between text-xs text-indigo-800 bg-indigo-100/60 rounded-md px-2.5 py-1.5">
                <span>Expected per cycle:</span>
                <span className="font-bold">
                  ETB {(group.contributionAmount * addMemberShares).toLocaleString()}
                </span>
              </div>
            </div>
          )}

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

                {/* Shares Selector for New Member */}
                {group && (
                  <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">
                        Member Shares
                      </p>
                      <span className="text-sm font-bold text-indigo-900">
                        ETB {group.contributionAmount.toLocaleString()} / full share
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {[0.25, 0.5, 0.75, 1, 1.5, 2].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setAddMemberShares(preset)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                            addMemberShares === preset
                              ? 'bg-primary-600 text-white shadow-sm'
                              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                          }`}
                        >
                          {preset === 0.25 ? '¼' : preset === 0.5 ? '½' : preset === 0.75 ? '¾' : preset === 1.5 ? '1½' : preset}
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
                    <div className="flex items-center justify-between text-xs text-indigo-800 bg-indigo-100/60 rounded-md px-2.5 py-1.5">
                      <span>Expected per cycle:</span>
                      <span className="font-bold">
                        ETB {(group.contributionAmount * addMemberShares).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}

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

      {/* File Dispute Modal */}
      <Modal
        isOpen={showFileDisputeModal}
        onClose={() => {
          setShowFileDisputeModal(false);
          setDisputeForm({ type: 'PAYMENT', description: '', againstUserId: '' });
        }}
        title={t('group.modal_file_dispute')}
        size="sm"
      >
        <form onSubmit={handleFileDispute} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('group.label_dispute_type')}</label>
            <select
              value={disputeForm.type}
              onChange={(e) => setDisputeForm({ ...disputeForm, type: e.target.value })}
              className="input-field"
              required
            >
              <option value="PAYMENT">{t('group.option_payment_issue')}</option>
              <option value="RULE_VIOLATION">{t('group.option_rule_violation')}</option>
              <option value="LOTTERY">{t('group.option_lottery_issue')}</option>
              <option value="OTHER">{t('group.option_other')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('group.label_against_member')}</label>
            <select
              value={disputeForm.againstUserId}
              onChange={(e) => setDisputeForm({ ...disputeForm, againstUserId: e.target.value })}
              className="input-field"
            >
              <option value="">{t('group.option_general_dispute')}</option>
              {group?.members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('group.label_description')}</label>
            <textarea
              value={disputeForm.description}
              onChange={(e) => setDisputeForm({ ...disputeForm, description: e.target.value })}
              className="input-field"
              rows={4}
              placeholder={t('group.placeholder_dispute')}
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowFileDisputeModal(false);
                setDisputeForm({ type: 'PAYMENT', description: '', againstUserId: '' });
              }}
            >
              {t('group.btn_cancel')}
            </Button>
            <Button type="submit" loading={filingDispute}>
              {t('group.btn_submit_dispute')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Resolve Dispute Modal */}
      <Modal
        isOpen={!!showResolveModal}
        onClose={() => {
          setShowResolveModal(null);
          setResolveText('');
        }}
        title={t('group.modal_resolve')}
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('group.label_resolution_notes')}</label>
            <textarea
              value={resolveText}
              onChange={(e) => setResolveText(e.target.value)}
              className="input-field"
              rows={4}
              placeholder={t('group.placeholder_resolution')}
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowResolveModal(null);
                setResolveText('');
              }}
            >
              {t('group.btn_cancel')}
            </Button>
            <Button
              onClick={handleResolveDispute}
              loading={resolving}
              disabled={!resolveText.trim()}
            >
              {t('group.btn_mark_resolved')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Request Turn Swap Modal */}
      <Modal
        isOpen={showRequestSwapModal}
        onClose={() => {
          setShowRequestSwapModal(false);
          setSwapForm({ targetId: '', reason: '' });
        }}
        title={t('group.modal_request_swap')}
        size="sm"
      >
        <form onSubmit={handleRequestSwap} className="space-y-4">
          <p className="text-sm text-gray-500">
            {t('group.swap_desc')}
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('group.label_target_member')}</label>
            <select
              value={swapForm.targetId}
              onChange={(e) => setSwapForm({ ...swapForm, targetId: e.target.value })}
              className="input-field"
              required
            >
              <option value="" disabled>{t('group.placeholder_select_member')}</option>
              {group?.members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('group.label_reason')}</label>
            <textarea
              value={swapForm.reason}
              onChange={(e) => setSwapForm({ ...swapForm, reason: e.target.value })}
              className="input-field"
              rows={3}
              placeholder={t('group.placeholder_swap_reason')}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowRequestSwapModal(false);
                setSwapForm({ targetId: '', reason: '' });
              }}
            >
              {t('group.btn_cancel')}
            </Button>
            <Button type="submit" loading={requestingSwap} disabled={!swapForm.targetId}>
              {t('group.btn_send_request')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Assign Guarantor (Wase) Modal */}
      <Modal
        isOpen={showAssignGuarantorModal}
        onClose={() => {
          setShowAssignGuarantorModal(false);
          setGuarantorForm({ guarantorUserId: '', guaranteedUserId: '', notes: '' });
        }}
        title={t('group.modal_assign_guarantor')}
        size="sm"
      >
        <form onSubmit={handleAssignGuarantor} className="space-y-4">
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
            <p className="text-sm text-amber-700">
              <strong>{t('group.wase_rule')}</strong> {t('group.wase_rule_desc')}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('group.label_guarantor_select')}</label>
            <select
              value={guarantorForm.guarantorUserId}
              onChange={(e) => setGuarantorForm({ ...guarantorForm, guarantorUserId: e.target.value })}
              className="input-field"
              required
            >
              <option value="" disabled>{t('group.placeholder_guarantor')}</option>
              {group?.members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}{member.hasWon ? ` ⚠️ ${t('group.already_won')}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('group.label_guaranteed_select')}</label>
            <select
              value={guarantorForm.guaranteedUserId}
              onChange={(e) => setGuarantorForm({ ...guarantorForm, guaranteedUserId: e.target.value })}
              className="input-field"
              required
            >
              <option value="" disabled>{t('group.placeholder_guaranteed')}</option>
              {group?.members
                .filter((m) => m.id !== guarantorForm.guarantorUserId)
                .map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('group.label_notes')}</label>
            <textarea
              value={guarantorForm.notes}
              onChange={(e) => setGuarantorForm({ ...guarantorForm, notes: e.target.value })}
              className="input-field"
              rows={2}
              placeholder={t('group.placeholder_notes')}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowAssignGuarantorModal(false);
                setGuarantorForm({ guarantorUserId: '', guaranteedUserId: '', notes: '' });
              }}
            >
              {t('group.btn_cancel')}
            </Button>
            <Button
              type="submit"
              loading={assigningGuarantor}
              disabled={!guarantorForm.guarantorUserId || !guarantorForm.guaranteedUserId}
            >
              <Shield className="h-4 w-4 mr-1.5" />
              {t('group.btn_assign')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Group Info Modal */}
      <Modal
        isOpen={showEditGroupModal}
        onClose={() => setShowEditGroupModal(false)}
        title="Edit Equb Group Details"
        size="md"
      >
        <form onSubmit={handleUpdateGroup} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Group Profile Image
            </label>
            <PhotoUpload
              value={editGroupForm.photoUrl}
              onChange={(url) => setEditGroupForm({ ...editGroupForm, photoUrl: url })}
              name={editGroupForm.name || 'Group'}
              size="md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Group Name
            </label>
            <input
              type="text"
              value={editGroupForm.name}
              onChange={(e) => setEditGroupForm({ ...editGroupForm, name: e.target.value })}
              className="input-field"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Contribution Per Share (ETB)
              </label>
              <input
                type="number"
                value={editGroupForm.contributionAmount}
                onChange={(e) => setEditGroupForm({ ...editGroupForm, contributionAmount: e.target.value })}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Max Members
              </label>
              <input
                type="number"
                value={editGroupForm.maxMembers}
                onChange={(e) => setEditGroupForm({ ...editGroupForm, maxMembers: e.target.value })}
                className="input-field"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Cycle Duration
            </label>
            <select
              value={editGroupForm.cycleDuration}
              onChange={(e) => setEditGroupForm({ ...editGroupForm, cycleDuration: e.target.value })}
              className="input-field"
            >
              <option value="Weekly">{t('groups.frequency_weekly')}</option>
              <option value="Bi-Weekly">Bi-Weekly</option>
              <option value="Monthly">{t('groups.frequency_monthly')}</option>
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                End Date
              </label>
              <input
                type="date"
                value={editGroupForm.endDate}
                onChange={(e) => setEditGroupForm({ ...editGroupForm, endDate: e.target.value })}
                className="input-field"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Physical Location
            </label>
            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 flex items-center justify-between">
              <div className="flex-1 min-w-0 pr-4">
                {editGroupForm.physicalAddress ? (
                  <>
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {editGroupForm.physicalAddress}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      GPS: {Number(editGroupForm.latitude).toFixed(6)}, {Number(editGroupForm.longitude).toFixed(6)}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-gray-500 italic">No physical location assigned</p>
                )}
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowEditLocationPicker(true)}
                className="flex-shrink-0 flex items-center gap-1.5 text-xs py-1.5 px-3"
              >
                <MapPin className="h-3.5 w-3.5" />
                Select on Map
              </Button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Description (Optional)
            </label>
            <textarea
              value={editGroupForm.description}
              onChange={(e) => setEditGroupForm({ ...editGroupForm, description: e.target.value })}
              className="input-field"
              rows={3}
              placeholder="Brief description of the group..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowEditGroupModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={updatingGroup}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      <LocationPicker
        isOpen={showEditLocationPicker}
        onClose={() => setShowEditLocationPicker(false)}
        initialLatitude={editGroupForm.latitude ? Number(editGroupForm.latitude) : undefined}
        initialLongitude={editGroupForm.longitude ? Number(editGroupForm.longitude) : undefined}
        initialAddress={editGroupForm.physicalAddress}
        onConfirm={(loc) => {
          setEditGroupForm({
            ...editGroupForm,
            physicalAddress: loc.address,
            latitude: String(loc.latitude),
            longitude: String(loc.longitude),
          });
        }}
      />
    </DashboardLayout>
  );
}
