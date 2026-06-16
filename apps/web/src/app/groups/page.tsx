'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Users, Calendar, CircleDollarSign, Search, AlertCircle } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useLanguage } from '@/components/layout/LanguageContext';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import { getGroups, createGroup, getRuleTemplates, getTrashGroups, restoreGroup, softDeleteGroup, permanentDeleteGroup } from '@/lib/api';
import type { GroupListItem, RuleTemplate } from '@/lib/api';

export default function GroupsPage() {
  const { t } = useLanguage();
  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [trashGroups, setTrashGroups] = useState<GroupListItem[]>([]);
  const [templates, setTemplates] = useState<RuleTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTrashModal, setShowTrashModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    contributionAmount: '',
    cycleDuration: 'Weekly',
    maxMembers: '',
    description: '',
    photoUrl: '',
    endDate: '',
    physicalAddress: '',
    latitude: '',
    longitude: '',
    templateId: '',
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchGroupsAndTemplates = async () => {
    setLoading(true);
    setError(null);
    try {
      const [groupsData, templatesData] = await Promise.all([
        getGroups(),
        getRuleTemplates().catch(() => [])
      ]);
      setGroups(groupsData);
      setTemplates(templatesData);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load groups. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const fetchTrash = async () => {
    try {
      const trashData = await getTrashGroups();
      setTrashGroups(trashData);
    } catch (err) {
      console.error('Failed to load trash:', err);
    }
  };

  const openTrashModal = () => {
    fetchTrash();
    setShowTrashModal(true);
  };

  const handleRestoreGroup = async (id: string) => {
    try {
      await restoreGroup(id);
      await fetchTrash();
      await fetchGroupsAndTemplates();
      setSuccess('Group restored successfully.');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || 'Failed to restore group.');
    }
  };

  const handlePermanentDeleteGroup = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this group? This action cannot be undone.')) return;
    try {
      await permanentDeleteGroup(id);
      await fetchTrash();
      setSuccess('Group permanently deleted.');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || 'Failed to permanently delete group.');
    }
  };

  useEffect(() => {
    fetchGroupsAndTemplates();
  }, []);

  const openCreateModal = () => {
    setError(null);
    setShowCreateModal(true);
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await createGroup({
        name: formData.name,
        contributionAmount: Number(formData.contributionAmount),
        cycleDuration: formData.cycleDuration,
        maxMembers: Number(formData.maxMembers),
        description: formData.description,
        photoUrl: formData.photoUrl || undefined,
        endDate: formData.endDate || undefined,
        physicalAddress: formData.physicalAddress || undefined,
        latitude: formData.latitude ? Number(formData.latitude) : undefined,
        longitude: formData.longitude ? Number(formData.longitude) : undefined,
        templateId: formData.templateId || undefined,
      });
      setShowCreateModal(false);
      setFormData({
        name: '',
        contributionAmount: '',
        cycleDuration: 'Weekly',
        maxMembers: '',
        description: '',
        photoUrl: '',
        endDate: '',
        physicalAddress: '',
        latitude: '',
        longitude: '',
        templateId: '',
      });
      setSuccess(t('groups.success_create'));
      setTimeout(() => setSuccess(null), 4000);
      await fetchGroupsAndTemplates();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(
        axiosErr.response?.data?.message || 'Failed to create group. Please check fields or try again.'
      );
    } finally {
      setCreating(false);
    }
  };

  const filteredGroups = groups.filter((group) =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
            <p className="text-sm text-gray-500">{t('groups.loading')}</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('groups.title')}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {t('groups.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={openTrashModal}>
            Recycle Bin
          </Button>
          <Button onClick={openCreateModal}>
            <Plus className="h-4 w-4 mr-2" />
            {t('groups.create_btn')}
          </Button>
        </div>
      </div>

      {success && (
        <div className="mb-6 p-4 rounded-lg bg-green-50 text-green-700 text-sm font-medium border border-green-100 flex items-center justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="text-green-500 hover:text-green-700 font-bold text-lg">×</button>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 text-red-700 text-sm font-medium border border-red-100 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700 font-bold text-lg">×</button>
        </div>
      )}

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder={t('groups.search_placeholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-10"
          />
        </div>
      </div>

      {/* Groups Grid */}
      {filteredGroups.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGroups.map((group) => (
            <Link
              key={group.id}
              href={`/groups/${group.id}`}
              className="card-hover group cursor-pointer"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                    {group.name}
                  </h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {group.cycleDuration === 'Weekly' ? t('groups.frequency_weekly') : group.cycleDuration === 'Monthly' ? t('groups.frequency_monthly') : group.cycleDuration} {t('groups.cycle').toLowerCase()}
                  </p>
                </div>
                <Badge status={group.status} />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-gray-500">
                    <Users className="h-4 w-4" />
                    {t('groups.members')}
                  </span>
                  <span className="font-medium text-gray-900">
                    {group.membersCount}/{group.maxMembers}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-gray-500">
                    <CircleDollarSign className="h-4 w-4" />
                    {t('groups.contribution')}
                  </span>
                  <span className="font-medium text-gray-900">
                    ETB {group.contributionAmount.toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-gray-500">
                    <Calendar className="h-4 w-4" />
                    {t('groups.cycle')}
                  </span>
                  <span className="font-medium text-gray-900">
                    {group.currentCycle}/{group.totalCycles}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                  <span>{t('groups.progress')}</span>
                  <span>
                    {group.totalCycles > 0
                      ? Math.round((group.currentCycle / group.totalCycles) * 100)
                      : 0}
                    %
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div
                    className="bg-primary-600 h-1.5 rounded-full transition-all duration-500"
                    style={{
                      width: `${
                        group.totalCycles > 0
                          ? (group.currentCycle / group.totalCycles) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 card">
          <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">{t('groups.no_groups')}</h3>
          <p className="text-gray-500 text-sm">
            {searchQuery
              ? t('groups.no_groups_match')
              : t('groups.no_groups_desc')}
          </p>
          {!searchQuery && (
            <Button onClick={openCreateModal} className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              {t('groups.create_btn')}
            </Button>
          )}
        </div>
      )}

      {/* Create Group Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={t('groups.modal_title')}
        size="md"
      >
        <form onSubmit={handleCreateGroup} className="space-y-4">
          {error && (
            <div className="p-3 rounded bg-red-50 text-red-600 text-xs font-medium border border-red-100">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('groups.label_name')}
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="input-field"
              placeholder="e.g., Weekly Equb #4"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {t('groups.label_amount_per_share')}
              </label>
              <input
                type="number"
                value={formData.contributionAmount}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    contributionAmount: e.target.value,
                  })
                }
                className="input-field"
                placeholder="5000"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                {t('groups.amount_per_share_hint')}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {t('groups.label_max_members')}
              </label>
              <input
                type="number"
                value={formData.maxMembers}
                onChange={(e) =>
                  setFormData({ ...formData, maxMembers: e.target.value })
                }
                className="input-field"
                placeholder="12"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('groups.label_duration')}
            </label>
            <select
              value={formData.cycleDuration}
              onChange={(e) =>
                setFormData({ ...formData, cycleDuration: e.target.value })
              }
              className="input-field"
            >
              <option value="Weekly">{t('groups.frequency_weekly')}</option>
              <option value="Bi-Weekly">Bi-Weekly</option>
              <option value="Monthly">{t('groups.frequency_monthly')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Photo URL
            </label>
            <input
              type="text"
              value={formData.photoUrl}
              onChange={(e) =>
                setFormData({ ...formData, photoUrl: e.target.value })
              }
              className="input-field"
              placeholder="https://example.com/image.jpg"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                End Date
              </label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) =>
                  setFormData({ ...formData, endDate: e.target.value })
                }
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Rule Template
              </label>
              <select
                value={formData.templateId}
                onChange={(e) =>
                  setFormData({ ...formData, templateId: e.target.value })
                }
                className="input-field"
              >
                <option value="">None (Create Empty Rules)</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Physical Address
            </label>
            <input
              type="text"
              value={formData.physicalAddress}
              onChange={(e) =>
                setFormData({ ...formData, physicalAddress: e.target.value })
              }
              className="input-field"
              placeholder="Bole, Addis Ababa"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Latitude
              </label>
              <input
                type="number"
                step="any"
                value={formData.latitude}
                onChange={(e) =>
                  setFormData({ ...formData, latitude: e.target.value })
                }
                className="input-field"
                placeholder="8.9806"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Longitude
              </label>
              <input
                type="number"
                step="any"
                value={formData.longitude}
                onChange={(e) =>
                  setFormData({ ...formData, longitude: e.target.value })
                }
                className="input-field"
                placeholder="38.7578"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('groups.label_description')}
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="input-field"
              rows={3}
              placeholder="Brief description of the group..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowCreateModal(false)}
            >
              {t('groups.btn_cancel')}
            </Button>
            <Button type="submit" loading={creating}>
              {t('groups.btn_create')}
            </Button>
          </div>
        </form>
      </Modal>
      {/* Trash Modal */}
      <Modal
        isOpen={showTrashModal}
        onClose={() => setShowTrashModal(false)}
        title="Recycle Bin"
        size="lg"
      >
        <div className="space-y-4">
          {trashGroups.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {trashGroups.map((group) => (
                <div key={group.id} className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
                  <div>
                    <h4 className="font-semibold text-gray-900">{group.name}</h4>
                    <p className="text-sm text-gray-500">Deleted: {new Date(group.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => handleRestoreGroup(group.id)}>
                      Restore
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => handlePermanentDeleteGroup(group.id)}>
                      Delete Permanently
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No groups in the recycle bin.
            </div>
          )}
          <div className="flex justify-end pt-4 border-t border-gray-100">
            <Button variant="secondary" onClick={() => setShowTrashModal(false)}>Close</Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
