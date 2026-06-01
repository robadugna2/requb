'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, Phone, MessageCircle, Users, AlertCircle, ChevronRight } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useLanguage } from '@/components/layout/LanguageContext';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { getMembers, createMember } from '@/lib/api';
import type { MemberListItem } from '@/lib/api';
import PhotoUpload from '@/components/ui/PhotoUpload';

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

export default function MembersPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [members, setMembers] = useState<MemberListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
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
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchMembers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMembers();
      setMembers(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load members. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const openCreateModal = () => {
    setError(null);
    setFormData({
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
    setShowCreateModal(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await createMember({
        name: formData.name,
        phone: formData.phone,
        telegramId: formData.telegramId || undefined,
        governmentId: formData.governmentId || undefined,
        photoUrl: formData.photoUrl || undefined,
        employmentType: formData.employmentType || undefined,
        employerName: formData.employerName || undefined,
        maritalStatus: formData.maritalStatus || undefined,
        country: formData.country || undefined,
        city: formData.city || undefined,
        subCity: formData.subCity || undefined,
        woreda: formData.woreda || undefined,
        houseNumber: formData.houseNumber || undefined,
      });
      setShowCreateModal(false);
      setSuccess(t('members.success_create'));
      setTimeout(() => setSuccess(null), 4000);
      await fetchMembers();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(
        axiosErr.response?.data?.message || 'Failed to add member. Please verify fields or try again.'
      );
    } finally {
      setCreating(false);
    }
  };

  const filteredMembers = members.filter(
    (member) =>
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.phone.includes(searchQuery) ||
      member.telegramId?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
            <p className="text-sm text-gray-500">{t('members.loading')}</p>
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
          <h1 className="text-2xl font-bold text-gray-900">{t('members.title')}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {t('members.subtitle')} ({members.length})
          </p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="h-4 w-4 mr-2" />
          {t('members.add_btn')}
        </Button>
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
            placeholder={t('members.search_placeholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-10"
          />
        </div>
      </div>

      {/* Members Table */}
      <div className="card overflow-hidden p-0">
        {filteredMembers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="table-header">{t('members.col_name')}</th>
                  <th className="table-header">{t('members.col_phone')}</th>
                  <th className="table-header">{t('members.col_telegram')}</th>
                  <th className="table-header">{t('members.col_groups')}</th>
                  <th className="table-header">{t('members.col_deposits')}</th>
                  <th className="table-header">{t('members.col_joined')}</th>
                  <th className="table-header"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredMembers.map((member) => (
                  <tr
                    key={member.id}
                    className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/members/${member.id}`)}
                  >
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                          <span className="text-xs font-bold text-primary-700">
                            {member.name
                              .split(' ')
                              .map((n) => n[0])
                              .join('')}
                          </span>
                        </div>
                        <span className="font-medium text-gray-900">
                          {member.name}
                        </span>
                      </div>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <Phone className="h-3.5 w-3.5" />
                        {member.phone}
                      </div>
                    </td>
                    <td className="table-cell">
                      {member.telegramId ? (
                        <div className="flex items-center gap-1.5 text-blue-600">
                          <MessageCircle className="h-3.5 w-3.5" />
                          {member.telegramId}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-gray-400" />
                        <div className="flex flex-wrap gap-1">
                          {member.groups.length > 0 ? (
                            member.groups.map((group, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700"
                              >
                                {group}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-gray-400">{t('member.no_groups')}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="table-cell font-medium text-gray-900">
                      ETB {member.totalDeposits.toLocaleString()}
                    </td>
                    <td className="table-cell text-gray-500">
                      {member.joinedAt}
                    </td>
                    <td className="table-cell text-right">
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Users className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">
              {searchQuery
                ? t('members.no_members_match')
                : t('members.no_members_desc')}
            </p>
          </div>
        )}
      </div>

      {/* Create Member Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={t('members.modal_title')}
        size="lg"
      >
        <form onSubmit={handleCreate} className="space-y-5">
          {error && (
            <div className="p-3 rounded bg-red-50 text-red-600 text-xs font-medium border border-red-100">
              {error}
            </div>
          )}

          {/* Basic Info */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-2">{t('members.basic_info')}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {t('members.label_name')}
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field"
                  placeholder="Enter full name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {t('members.label_phone')}
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="input-field"
                  placeholder="+251911234567"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {t('members.label_gov_id')}
                </label>
                <input
                  type="text"
                  value={formData.governmentId}
                  onChange={(e) => setFormData({ ...formData, governmentId: e.target.value })}
                  className="input-field"
                  placeholder="ID number"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {t('members.label_telegram')}
                </label>
                <input
                  type="text"
                  value={formData.telegramId}
                  onChange={(e) => setFormData({ ...formData, telegramId: e.target.value })}
                  className="input-field"
                  placeholder="@username"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {t('members.label_photo')}
                </label>
                <PhotoUpload
                  value={formData.photoUrl}
                  onChange={(url) => setFormData({ ...formData, photoUrl: url })}
                  name={formData.name || 'New'}
                  size="md"
                />
              </div>
            </div>
          </div>

          {/* {t('members.personal_details')} */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-2">{t('members.personal_details')}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {t('members.label_marital')}
                </label>
                <select
                  value={formData.maritalStatus}
                  onChange={(e) => setFormData({ ...formData, maritalStatus: e.target.value })}
                  className="input-field"
                >
                  {MARITAL_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {t('members.label_employment')}
                </label>
                <select
                  value={formData.employmentType}
                  onChange={(e) => setFormData({ ...formData, employmentType: e.target.value })}
                  className="input-field"
                >
                  {EMPLOYMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {t('members.label_employer')}
                </label>
                <input
                  type="text"
                  value={formData.employerName}
                  onChange={(e) => setFormData({ ...formData, employerName: e.target.value })}
                  className="input-field"
                  placeholder="Employer or business name"
                />
              </div>
            </div>
          </div>

          {/* {t('members.address')} */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-2">{t('members.address')}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {t('members.label_country')}
                </label>
                <input
                  type="text"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className="input-field"
                  placeholder="Ethiopia"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {t('members.label_city')}
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="input-field"
                  placeholder="Addis Ababa"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Sub {t('members.label_city')}
                </label>
                <input
                  type="text"
                  value={formData.subCity}
                  onChange={(e) => setFormData({ ...formData, subCity: e.target.value })}
                  className="input-field"
                  placeholder="Sub city"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {t('members.label_woreda')}
                </label>
                <input
                  type="text"
                  value={formData.woreda}
                  onChange={(e) => setFormData({ ...formData, woreda: e.target.value })}
                  className="input-field"
                  placeholder={t('members.label_woreda')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {t('members.label_house')}
                </label>
                <input
                  type="text"
                  value={formData.houseNumber}
                  onChange={(e) => setFormData({ ...formData, houseNumber: e.target.value })}
                  className="input-field"
                  placeholder="House number"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowCreateModal(false)}
            >
              {t('members.btn_cancel')}
            </Button>
            <Button type="submit" loading={creating}>
              {t('members.add_btn')}
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
