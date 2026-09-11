'use client';

import React, { useState, useEffect } from 'react';
import {
  Ban,
  CircleDollarSign,
  Shield,
  Settings,
  Save,
  Wallet,
  Scale,
  BookTemplate,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Modal from '@/components/ui/Modal';
import {
  getGroupRules,
  updateGroupRules,
  getRuleTemplates,
  createRuleTemplate,
  applyRuleTemplate,
  getGroupLeaders,
  assignGroupLeader,
  updateGroupLeader,
  removeGroupLeader,
  getAdminUsers,
} from '@/lib/api';
import type { GroupRules, RuleTemplate, GroupLeaderItem, AdminUserItem } from '@/lib/api';

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

function Toggle({
  checked,
  onChange,
  title,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-white/[0.04] rounded-lg">
      <div className="pr-3">
        <p className="text-sm font-medium text-gray-900 dark:text-white/90">{title}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
      </div>
      <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-600" />
      </label>
    </div>
  );
}

function SectionCard({ icon, title, action, children }: { icon: React.ReactNode; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-gray-100 dark:bg-white/[0.08] rounded-lg flex-shrink-0">{icon}</div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white/90">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

interface SettingsTabProps {
  groupId: string;
  isOwnerOrSuper: boolean;
  refreshKey: number;
  notifySuccess: (msg: string) => void;
  notifyError: (msg: string) => void;
}

export default function SettingsTab({
  groupId,
  isOwnerOrSuper,
  refreshKey,
  notifySuccess,
  notifyError,
}: SettingsTabProps) {
  const [rules, setRules] = useState<GroupRules | null>(null);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rulesSaving, setRulesSaving] = useState(false);
  const [rulesLoaded, setRulesLoaded] = useState(false);
  const [templates, setTemplates] = useState<RuleTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);

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

  const fetchRules = async () => {
    if (rulesLoaded) return;
    setRulesLoading(true);
    try {
      const data = await getGroupRules(groupId);
      setRules(data);
      setRulesLoaded(true);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      notifyError(axiosErr.response?.data?.message || 'Failed to load group rules.');
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

  const fetchLeaders = async () => {
    setLeadersLoading(true);
    try {
      const data = await getGroupLeaders(groupId);
      setLeaders(data);
    } catch (err) {
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

  useEffect(() => {
    fetchRules();
    fetchTemplates();
    if (isOwnerOrSuper) {
      fetchLeaders();
      fetchAdminUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, refreshKey, isOwnerOrSuper]);

  const handleApplyTemplate = async (templateId: string) => {
    setApplyingTemplate(true);
    try {
      await applyRuleTemplate(templateId, groupId);
      const data = await getGroupRules(groupId);
      setRules(data);
      notifySuccess('Template applied successfully!');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      notifyError(axiosErr.response?.data?.message || 'Failed to apply template.');
    } finally {
      setApplyingTemplate(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!rules || !templateName.trim()) return;
    setSavingTemplate(true);
    try {
      const { id: _id, groupId: _gId, ...ruleFields } = rules;
      await createRuleTemplate({ name: templateName.trim(), description: templateDescription.trim() || undefined, ...ruleFields });
      setShowSaveTemplateModal(false);
      setTemplateName('');
      setTemplateDescription('');
      notifySuccess('Rule template saved!');
      await fetchTemplates();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      notifyError(axiosErr.response?.data?.message || 'Failed to save template.');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleSaveRules = async () => {
    if (!rules) return;
    setRulesSaving(true);
    try {
      const { id: _id, groupId: _gId, ...rulesData } = rules;
      const updated = await updateGroupRules(groupId, rulesData);
      setRules(updated);
      notifySuccess('Group rules saved successfully!');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      notifyError(axiosErr.response?.data?.message || 'Failed to save rules. Please try again.');
    } finally {
      setRulesSaving(false);
    }
  };

  const handleAssignLeader = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssigningLeader(true);
    try {
      await assignGroupLeader(groupId, leaderForm);
      setShowAssignLeaderModal(false);
      setLeaderForm({ adminId: '', canManageMembers: false, canManageDeposits: false, canTriggerLottery: false, canManageRules: false });
      notifySuccess('Leader assigned successfully.');
      await fetchLeaders();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      notifyError(axiosErr.response?.data?.message || 'Failed to assign leader.');
    } finally {
      setAssigningLeader(false);
    }
  };

  const handleUpdateLeader = async (leaderId: string, updates: { canManageMembers?: boolean; canManageDeposits?: boolean; canTriggerLottery?: boolean; canManageRules?: boolean }) => {
    setUpdatingLeaderId(leaderId);
    try {
      await updateGroupLeader(groupId, leaderId, updates);
      notifySuccess('Leader permissions updated.');
      await fetchLeaders();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      notifyError(axiosErr.response?.data?.message || 'Failed to update leader.');
    } finally {
      setUpdatingLeaderId(null);
    }
  };

  const handleRemoveLeader = async (leaderId: string) => {
    if (!window.confirm('Are you sure you want to remove this leader?')) return;
    try {
      await removeGroupLeader(groupId, leaderId);
      notifySuccess('Leader removed.');
      await fetchLeaders();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      notifyError(axiosErr.response?.data?.message || 'Failed to remove leader.');
    }
  };

  if (rulesLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading group settings…</p>
        </div>
      </div>
    );
  }

  if (!rules) {
    return (
      <div className="text-center py-16 card">
        <Settings className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white/90 mb-1">Unable to load rules</h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm">Refresh the page and try again.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Template Toolbar */}
      <div className="card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="p-2 bg-indigo-50 dark:bg-brand-500/10 rounded-lg">
            <BookTemplate className="h-5 w-5 text-indigo-600 dark:text-brand-400" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">Rule Templates</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Load or save reusable rule configurations</p>
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
            <Download className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 dark:text-gray-500 pointer-events-none" />
          </div>
          <Button size="sm" variant="secondary" onClick={() => setShowSaveTemplateModal(true)}>
            <BookTemplate className="h-4 w-4 mr-1.5" />
            Save as Template
          </Button>
        </div>
      </div>

      {/* Penalty Settings */}
      <SectionCard icon={<Ban className="h-5 w-5 text-red-600 dark:text-error-400" />} title="Penalty Settings">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Late Penalty</label>
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Penalty Amount (ETB)</label>
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Penalty Percentage (%)</label>
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Grace Period (Days)</label>
            <input
              type="number"
              value={rules.gracePeriodDays}
              onChange={(e) => setRules({ ...rules, gracePeriodDays: Number(e.target.value) })}
              className="input-field"
              min={0}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Max Missed Payments (before removal)</label>
            <input
              type="number"
              value={rules.maxMissedPayments}
              onChange={(e) => setRules({ ...rules, maxMissedPayments: Number(e.target.value) })}
              className="input-field"
              min={1}
            />
          </div>
        </div>
      </SectionCard>

      {/* Deposit Rules */}
      <SectionCard icon={<CircleDollarSign className="h-5 w-5 text-green-600 dark:text-success-400" />} title="Deposit Rules">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Toggle
            checked={rules.requireExactAmount}
            onChange={(v) => setRules({ ...rules, requireExactAmount: v })}
            title="Require Expected Contribution"
            description="Base rule: deposits should match the member's expected amount (shares × contribution)"
          />
          <Toggle
            checked={rules.allowPartialPayments}
            onChange={(v) => setRules({ ...rules, allowPartialPayments: v })}
            title="Allow Partial Payments"
            description="Members may pay less than expected — recorded with the shortfall, catchable up later"
          />
          <Toggle
            checked={rules.allowOverpayment}
            onChange={(v) => setRules({ ...rules, allowOverpayment: v })}
            title="Allow Overpayments"
            description="Members may pay extra (double-pay, cover skipped cycles) — surplus carries forward"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Deposit Deadline Day</label>
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Min Verification Hours</label>
            <input
              type="number"
              value={rules.minVerificationHours}
              onChange={(e) => setRules({ ...rules, minVerificationHours: Number(e.target.value) })}
              className="input-field"
              min={0}
            />
          </div>
        </div>
      </SectionCard>

      {/* Member Rules */}
      <SectionCard icon={<Shield className="h-5 w-5 text-blue-600 dark:text-blue-light-400" />} title="Member Rules">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Toggle
            checked={rules.allowSkipRound}
            onChange={(v) => setRules({ ...rules, allowSkipRound: v })}
            title="Allow Skip Round"
            description="Members may skip a contribution round"
          />
          {rules.allowSkipRound && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Max Skips Allowed</label>
              <input
                type="number"
                value={rules.maxSkipsAllowed}
                onChange={(e) => setRules({ ...rules, maxSkipsAllowed: Number(e.target.value) })}
                className="input-field"
                min={0}
              />
            </div>
          )}
          <Toggle
            checked={rules.requireGuarantor}
            onChange={(v) => setRules({ ...rules, requireGuarantor: v })}
            title="Require Guarantor (ዋስ)"
            description="Every member needs a guarantor"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Min Members to Start</label>
            <input
              type="number"
              value={rules.minMembersToStart}
              onChange={(e) => setRules({ ...rules, minMembersToStart: Number(e.target.value) })}
              className="input-field"
              min={2}
            />
          </div>
          <Toggle
            checked={rules.allowMidCycleJoin ?? false}
            onChange={(v) => setRules({ ...rules, allowMidCycleJoin: v })}
            title="Allow Mid-Cycle Join"
            description="New members can join mid-cycle"
          />
          <Toggle
            checked={rules.requireGovernmentId ?? false}
            onChange={(v) => setRules({ ...rules, requireGovernmentId: v })}
            title="Require Government ID"
            description="Members must provide a government ID"
          />
          <Toggle
            checked={rules.postWinContributionRequired ?? true}
            onChange={(v) => setRules({ ...rules, postWinContributionRequired: v })}
            title="Post-Win Contribution"
            description="Winners must keep contributing after payout"
          />
          <Toggle
            checked={rules.autoCompleteGroup ?? true}
            onChange={(v) => setRules({ ...rules, autoCompleteGroup: v })}
            title="Auto-Complete Group"
            description="Group completes automatically after final cycle"
          />
        </div>
      </SectionCard>

      {/* Admin Fee Configuration */}
      <SectionCard icon={<CircleDollarSign className="h-5 w-5 text-teal-600" />} title="Admin Fee">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Fee Type</label>
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Fee Amount (ETB)</label>
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Fee Percentage (%)</label>
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
      </SectionCard>

      {/* Payout Configuration */}
      <SectionCard icon={<Wallet className="h-5 w-5 text-purple-600 dark:text-theme-purple-500" />} title="Payout Configuration">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Payout Schedule</label>
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Payout Delay (Days)</label>
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Early Withdrawal</label>
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Early Withdrawal Fee (ETB)</label>
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
      </SectionCard>

      {/* Governance */}
      <SectionCard icon={<Scale className="h-5 w-5 text-orange-600 dark:text-orange-400" />} title="Governance">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Dispute Resolution Method</label>
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
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Custom Rules</label>
            <textarea
              value={rules.customRules ?? ''}
              onChange={(e) => setRules({ ...rules, customRules: e.target.value || undefined })}
              className="input-field"
              rows={4}
              placeholder="Any additional rules agreed by the group…"
            />
          </div>
        </div>
      </SectionCard>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSaveRules} loading={rulesSaving}>
          <Save className="h-4 w-4 mr-2" />
          Save Rules
        </Button>
      </div>

      {/* Group Leaders (owner/super-admin only) */}
      {isOwnerOrSuper && (
        <SectionCard
          icon={<Shield className="h-5 w-5 text-indigo-600 dark:text-brand-400" />}
          title="Group Leaders"
          action={
            <Button size="sm" onClick={() => setShowAssignLeaderModal(true)}>
              <Shield className="h-4 w-4 mr-1.5" />
              Assign Leader
            </Button>
          }
        >
          {leadersLoading ? (
            <div className="py-8 flex justify-center text-gray-500 dark:text-gray-400">Loading leaders…</div>
          ) : leaders.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {leaders.map((leader) => (
                <div key={leader.id} className="p-4 border rounded-lg bg-white dark:bg-gray-900 shadow-sm flex flex-col justify-between">
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white/90">{leader.admin.name}</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{leader.admin.email}</p>
                    <div className="mt-3 space-y-1">
                      {([
                        { key: 'canManageMembers', label: 'Can Manage Members' },
                        { key: 'canManageDeposits', label: 'Can Manage Deposits' },
                        { key: 'canTriggerLottery', label: 'Can Trigger Lottery' },
                        { key: 'canManageRules', label: 'Can Manage Rules' },
                      ] as const).map(({ key, label }) => (
                        <label key={key} className="flex items-center text-sm text-gray-700 dark:text-gray-300">
                          <input
                            type="checkbox"
                            checked={leader[key]}
                            onChange={(e) => handleUpdateLeader(leader.id, { [key]: e.target.checked })}
                            className="mr-2"
                          />
                          {label}
                        </label>
                      ))}
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
            <div className="text-center py-8 text-gray-500 dark:text-gray-400 border border-dashed rounded-lg bg-gray-50 dark:bg-white/[0.04]">
              <Shield className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p>No sub-admins assigned to this group.</p>
            </div>
          )}
        </SectionCard>
      )}

      {/* ─── Modals ─────────────────────────────────────────── */}

      {/* Save Template Modal */}
      <Modal
        isOpen={showSaveTemplateModal}
        onClose={() => {
          setShowSaveTemplateModal(false);
          setTemplateName('');
          setTemplateDescription('');
        }}
        title="Save Rule Template"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Save the current rule configuration as a reusable template that can be applied to other groups.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Template Name *</label>
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Description (Optional)</label>
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
              Cancel
            </Button>
            <Button onClick={handleSaveTemplate} loading={savingTemplate} disabled={!templateName.trim()}>
              <BookTemplate className="h-4 w-4 mr-2" />
              Save Template
            </Button>
          </div>
        </div>
      </Modal>

      {/* Assign Leader Modal */}
      <Modal
        isOpen={showAssignLeaderModal}
        onClose={() => setShowAssignLeaderModal(false)}
        title="Assign Group Leader"
        size="md"
      >
        <form onSubmit={handleAssignLeader} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Select Admin</label>
            <select
              value={leaderForm.adminId}
              onChange={(e) => setLeaderForm({ ...leaderForm, adminId: e.target.value })}
              className="input-field"
              required
            >
              <option value="">Select an admin...</option>
              {adminUsers.map((admin) => (
                <option key={admin.id} value={admin.id}>{admin.name} ({admin.email})</option>
              ))}
            </select>
          </div>
          <div className="space-y-2 mt-4">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Permissions</h4>
            {([
              { key: 'canManageMembers', label: 'Can Manage Members' },
              { key: 'canManageDeposits', label: 'Can Manage Deposits' },
              { key: 'canTriggerLottery', label: 'Can Trigger Lottery' },
              { key: 'canManageRules', label: 'Can Manage Rules' },
            ] as const).map(({ key, label }) => (
              <label key={key} className="flex items-center text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={leaderForm[key]}
                  onChange={(e) => setLeaderForm({ ...leaderForm, [key]: e.target.checked })}
                  className="mr-2"
                />
                {label}
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowAssignLeaderModal(false)}>Cancel</Button>
            <Button type="submit" loading={assigningLeader}>Assign</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
