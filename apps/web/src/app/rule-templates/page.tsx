'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  BookTemplate,
  Pencil,
  Trash2,
  Plus,
  Search,
  Ban,
  CircleDollarSign,
  Shield,
  Wallet,
  Scale,
  Settings,
  Save,
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useLanguage } from '@/components/layout/LanguageContext';
import { Button } from '@/components/ui/button';
import Modal from '@/components/ui/Modal';
import {
  getRuleTemplates,
  createRuleTemplate,
  updateRuleTemplate,
  deleteRuleTemplate,
} from '@/lib/api';
import type { RuleTemplate } from '@/lib/api';

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

interface TemplateForm {
  name: string;
  description: string;
  latePenaltyType: string;
  latePenaltyAmount: number | undefined;
  latePenaltyPercent: number | undefined;
  gracePeriodDays: number;
  maxMissedPayments: number;
  requireExactAmount: boolean;
  depositDeadlineDay: number | undefined;
  minVerificationHours: number;
  allowSkipRound: boolean;
  maxSkipsAllowed: number;
  requireGuarantor: boolean;
  minMembersToStart: number;
  payoutSchedule: string;
  payoutDelayDays: number;
  earlyWithdrawalPolicy: string;
  earlyWithdrawalFee: number | undefined;
  disputeResolution: string;
  customRules: string;
}

const DEFAULT_FORM: TemplateForm = {
  name: '',
  description: '',
  latePenaltyType: 'NONE',
  latePenaltyAmount: undefined,
  latePenaltyPercent: undefined,
  gracePeriodDays: 0,
  maxMissedPayments: 3,
  requireExactAmount: true,
  depositDeadlineDay: undefined,
  minVerificationHours: 0,
  allowSkipRound: false,
  maxSkipsAllowed: 0,
  requireGuarantor: false,
  minMembersToStart: 2,
  payoutSchedule: 'IMMEDIATE',
  payoutDelayDays: 0,
  earlyWithdrawalPolicy: 'NOT_ALLOWED',
  earlyWithdrawalFee: undefined,
  disputeResolution: 'ADMIN_DECISION',
  customRules: '',
};

function templateToForm(t: RuleTemplate): TemplateForm {
  return {
    name: t.name,
    description: t.description ?? '',
    latePenaltyType: t.latePenaltyType,
    latePenaltyAmount: t.latePenaltyAmount,
    latePenaltyPercent: t.latePenaltyPercent,
    gracePeriodDays: t.gracePeriodDays,
    maxMissedPayments: t.maxMissedPayments,
    requireExactAmount: t.requireExactAmount,
    depositDeadlineDay: t.depositDeadlineDay,
    minVerificationHours: t.minVerificationHours,
    allowSkipRound: t.allowSkipRound,
    maxSkipsAllowed: t.maxSkipsAllowed,
    requireGuarantor: t.requireGuarantor,
    minMembersToStart: t.minMembersToStart,
    payoutSchedule: t.payoutSchedule,
    payoutDelayDays: t.payoutDelayDays,
    earlyWithdrawalPolicy: t.earlyWithdrawalPolicy,
    earlyWithdrawalFee: t.earlyWithdrawalFee,
    disputeResolution: t.disputeResolution,
    customRules: t.customRules ?? '',
  };
}

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

function getPenaltyLabel(type: string): string {
  return PENALTY_TYPES.find((t) => t.value === type)?.label ?? type;
}

function getPayoutLabel(type: string): string {
  return PAYOUT_SCHEDULES.find((s) => s.value === type)?.label ?? type;
}

function getWithdrawalLabel(type: string): string {
  return EARLY_WITHDRAWAL_POLICIES.find((p) => p.value === type)?.label ?? type;
}

export default function RuleTemplatesPage() {
  const { t } = useLanguage();
  const [templates, setTemplates] = useState<RuleTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<RuleTemplate | null>(null);
  const [form, setForm] = useState<TemplateForm>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const deleteTarget = templates.find((t) => t.id === deleteConfirmId);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getRuleTemplates();
      setTemplates(data);
    } catch {
      setError('Failed to load rule templates.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const openCreateModal = () => {
    setEditingTemplate(null);
    setForm(DEFAULT_FORM);
    setShowFormModal(true);
  };

  const openEditModal = (template: RuleTemplate) => {
    setEditingTemplate(template);
    setForm(templateToForm(template));
    setShowFormModal(true);
  };

  const closeFormModal = () => {
    setShowFormModal(false);
    setEditingTemplate(null);
    setForm(DEFAULT_FORM);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        customRules: form.customRules.trim() || undefined,
      };
      if (editingTemplate) {
        await updateRuleTemplate(editingTemplate.id, payload as Partial<RuleTemplate>);
        setSuccess('Template updated successfully!');
      } else {
        await createRuleTemplate(payload as Partial<RuleTemplate> & { name: string });
        setSuccess('Template created successfully!');
      }
      closeFormModal();
      await fetchTemplates();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || 'Failed to save template.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    setError(null);
    try {
      await deleteRuleTemplate(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      setDeleteConfirmId(null);
      setSuccess('Template deleted successfully.');
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || 'Failed to delete template.');
    } finally {
      setDeleting(null);
    }
  };

  const filteredTemplates = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <DashboardLayout>
      {/* Success / Error Banners */}
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

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('rules.title')}</h1>
            <p className="mt-1 text-sm text-gray-500">
              {t('rules.subtitle')}
            </p>
          </div>
          {templates.length > 0 && (
            <span className="inline-flex items-center justify-center h-6 px-2.5 text-xs font-bold text-indigo-700 bg-indigo-100 rounded-full">
              {templates.length}
            </span>
          )}
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="h-4 w-4 mr-2" />
          {t('rules.create_btn')}
        </Button>
      </div>

      {/* Search */}
      {templates.length > 0 && (
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder={t('rules.search_placeholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10 max-w-md"
          />
        </div>
      )}

      {/* Template List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
            <p className="text-sm text-gray-500">{t('rules.loading')}</p>
          </div>
        </div>
      ) : filteredTemplates.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredTemplates.map((template) => (
            <div
              key={template.id}
              className="card hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="p-2 bg-indigo-50 rounded-lg flex-shrink-0">
                    <BookTemplate className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900 truncate">
                      {template.name}
                    </h3>
                    {template.description && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                        {template.description}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1.5">
                      Created by {template.createdBy.name} · {getRelativeTime(template.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => openEditModal(template)}
                    className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="Edit template"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(template.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete template"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Rule Summary Badges */}
              <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-gray-100">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-50 text-red-700">
                  <Ban className="h-2.5 w-2.5" />
                  {getPenaltyLabel(template.latePenaltyType)}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-50 text-purple-700">
                  <Wallet className="h-2.5 w-2.5" />
                  {getPayoutLabel(template.payoutSchedule)}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700">
                  <Shield className="h-2.5 w-2.5" />
                  {getWithdrawalLabel(template.earlyWithdrawalPolicy)}
                </span>
                {template.requireGuarantor && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-orange-50 text-orange-700">
                    {t('group.label_require_guarantor')}
                  </span>
                )}
                {template.allowSkipRound && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-50 text-green-700">
                    {t('group.label_allow_skip')}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : templates.length > 0 ? (
        <div className="text-center py-16 card">
          <Search className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">{t('rules.no_templates_match')}</h3>
          <p className="text-gray-500 text-sm">
            {t('rules.no_templates_match_desc')}
          </p>
        </div>
      ) : (
        <div className="text-center py-16 card">
          <BookTemplate className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">{t('rules.no_templates')}</h3>
          <p className="text-gray-500 text-sm mb-4">
            {t('rules.no_templates_desc')}
          </p>
          <Button onClick={openCreateModal} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            {t('rules.create_btn')}
          </Button>
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={showFormModal}
        onClose={closeFormModal}
        title={editingTemplate ? t('rules.modal_edit') : t('rules.modal_create')}
        size="lg"
      >
        <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">
          {/* Name & Description */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('rules.label_name')}</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input-field"
                placeholder="e.g., Standard Monthly Rules"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('rules.label_desc')}</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="input-field"
                rows={2}
                placeholder={t('rules.label_desc_placeholder')}
              />
            </div>
          </div>

          {/* Penalty Settings */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-red-50 rounded-lg">
                <Ban className="h-4 w-4 text-red-600" />
              </div>
              <h4 className="text-sm font-semibold text-gray-900">{t('group.rules_penalty')}</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('group.label_late_penalty')}</label>
                <select
                  value={form.latePenaltyType}
                  onChange={(e) => setForm({ ...form, latePenaltyType: e.target.value })}
                  className="input-field"
                >
                  {PENALTY_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              {form.latePenaltyType === 'FIXED' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Penalty Amount (ETB)</label>
                  <input
                    type="number"
                    value={form.latePenaltyAmount ?? ''}
                    onChange={(e) => setForm({ ...form, latePenaltyAmount: e.target.value ? Number(e.target.value) : undefined })}
                    className="input-field"
                    placeholder="e.g., 100"
                    min={0}
                  />
                </div>
              )}
              {form.latePenaltyType === 'PERCENTAGE' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Penalty Percentage (%)</label>
                  <input
                    type="number"
                    value={form.latePenaltyPercent ?? ''}
                    onChange={(e) => setForm({ ...form, latePenaltyPercent: e.target.value ? Number(e.target.value) : undefined })}
                    className="input-field"
                    placeholder="e.g., 5"
                    min={0}
                    max={100}
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Grace Period (Days)</label>
                <input
                  type="number"
                  value={form.gracePeriodDays}
                  onChange={(e) => setForm({ ...form, gracePeriodDays: Number(e.target.value) })}
                  className="input-field"
                  min={0}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('group.label_max_missed')}</label>
                <input
                  type="number"
                  value={form.maxMissedPayments}
                  onChange={(e) => setForm({ ...form, maxMissedPayments: Number(e.target.value) })}
                  className="input-field"
                  min={1}
                />
              </div>
            </div>
          </div>

          {/* Deposit Rules */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-green-50 rounded-lg">
                <CircleDollarSign className="h-4 w-4 text-green-600" />
              </div>
              <h4 className="text-sm font-semibold text-gray-900">{t('group.rules_deposit')}</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-xs font-medium text-gray-900">{t('group.label_require_exact')}</p>
                  <p className="text-[10px] text-gray-500">{t('group.desc_require_exact')}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.requireExactAmount}
                    onChange={(e) => setForm({ ...form, requireExactAmount: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-600" />
                </label>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Deposit Deadline (Day of Month)</label>
                <input
                  type="number"
                  value={form.depositDeadlineDay ?? ''}
                  onChange={(e) => setForm({ ...form, depositDeadlineDay: e.target.value ? Number(e.target.value) : undefined })}
                  className="input-field"
                  placeholder="e.g., 5"
                  min={1}
                  max={31}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Min Verification Time (Hours)</label>
                <input
                  type="number"
                  value={form.minVerificationHours}
                  onChange={(e) => setForm({ ...form, minVerificationHours: Number(e.target.value) })}
                  className="input-field"
                  min={0}
                />
              </div>
            </div>
          </div>

          {/* Member Rules */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-blue-50 rounded-lg">
                <Shield className="h-4 w-4 text-blue-600" />
              </div>
              <h4 className="text-sm font-semibold text-gray-900">{t('group.rules_member')}</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-xs font-medium text-gray-900">{t('group.label_allow_skip')}</p>
                  <p className="text-[10px] text-gray-500">{t('group.desc_skip_round')}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.allowSkipRound}
                    onChange={(e) => setForm({ ...form, allowSkipRound: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-600" />
                </label>
              </div>
              {form.allowSkipRound && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{t('group.label_max_skips')}</label>
                  <input
                    type="number"
                    value={form.maxSkipsAllowed}
                    onChange={(e) => setForm({ ...form, maxSkipsAllowed: Number(e.target.value) })}
                    className="input-field"
                    min={0}
                  />
                </div>
              )}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-xs font-medium text-gray-900">{t('group.label_require_guarantor')}</p>
                  <p className="text-[10px] text-gray-500">{t('group.desc_require_guarantor')}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.requireGuarantor}
                    onChange={(e) => setForm({ ...form, requireGuarantor: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-600" />
                </label>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('group.label_min_members')}</label>
                <input
                  type="number"
                  value={form.minMembersToStart}
                  onChange={(e) => setForm({ ...form, minMembersToStart: Number(e.target.value) })}
                  className="input-field"
                  min={2}
                />
              </div>
            </div>
          </div>

          {/* Payout Configuration */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-purple-50 rounded-lg">
                <Wallet className="h-4 w-4 text-purple-600" />
              </div>
              <h4 className="text-sm font-semibold text-gray-900">{t('group.rules_payout')}</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('group.label_payout_schedule')}</label>
                <select
                  value={form.payoutSchedule}
                  onChange={(e) => setForm({ ...form, payoutSchedule: e.target.value })}
                  className="input-field"
                >
                  {PAYOUT_SCHEDULES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              {form.payoutSchedule === 'CUSTOM' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Payout Delay (Days)</label>
                  <input
                    type="number"
                    value={form.payoutDelayDays}
                    onChange={(e) => setForm({ ...form, payoutDelayDays: Number(e.target.value) })}
                    className="input-field"
                    min={0}
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('group.label_early_withdrawal')}</label>
                <select
                  value={form.earlyWithdrawalPolicy}
                  onChange={(e) => setForm({ ...form, earlyWithdrawalPolicy: e.target.value })}
                  className="input-field"
                >
                  {EARLY_WITHDRAWAL_POLICIES.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              {form.earlyWithdrawalPolicy === 'WITH_FEE' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Early Withdrawal Fee (ETB)</label>
                  <input
                    type="number"
                    value={form.earlyWithdrawalFee ?? ''}
                    onChange={(e) => setForm({ ...form, earlyWithdrawalFee: e.target.value ? Number(e.target.value) : undefined })}
                    className="input-field"
                    placeholder="Fee amount"
                    min={0}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Governance */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-orange-50 rounded-lg">
                <Scale className="h-4 w-4 text-orange-600" />
              </div>
              <h4 className="text-sm font-semibold text-gray-900">{t('group.rules_governance')}</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{t('group.label_dispute_method')}</label>
                <select
                  value={form.disputeResolution}
                  onChange={(e) => setForm({ ...form, disputeResolution: e.target.value })}
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
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-gray-100 rounded-lg">
                <Settings className="h-4 w-4 text-gray-600" />
              </div>
              <h4 className="text-sm font-semibold text-gray-900">{t('group.rules_additional')}</h4>
            </div>
            <textarea
              value={form.customRules}
              onChange={(e) => setForm({ ...form, customRules: e.target.value })}
              className="input-field"
              rows={3}
              placeholder="Enter any additional rules or notes..."
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-gray-100">
          <Button variant="secondary" onClick={closeFormModal}>
            {t('rules.btn_cancel')}
          </Button>
          <Button onClick={handleSave} loading={saving} disabled={!form.name.trim()}>
            <Save className="h-4 w-4 mr-2" />
            {editingTemplate ? t('rules.btn_save') : t('rules.btn_create')}
          </Button>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        title="Delete Template"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to delete{' '}
            <span className="font-semibold text-gray-900">
              {deleteTarget?.name}
            </span>
            ? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              loading={deleting === deleteConfirmId}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
