'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Phone,
  MessageCircle,
  Users,
  MapPin,
  Shield,
  Trash2,
  CircleDollarSign,
  Trophy,
  Calendar,
  AlertCircle,
  Eye,
  Pencil,
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useLanguage } from '@/components/layout/LanguageContext';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import { getMember, deleteUserWithPassword, updateMember, getMediaUrl, updateMemberShares } from '@/lib/api';
import type { UserDetail } from '@/lib/api';
import PhotoUpload from '@/components/ui/PhotoUpload';

export default function MemberDetailPage() {
  const { t } = useLanguage();
  const params = useParams();
  const router = useRouter();
  const memberId = params.id as string;

  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'deposits' | 'groups' | 'wins'>('deposits');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState({
    name: '',
    phone: '',
    telegramId: '',
    governmentId: '',
    bankAccountName: '',
    photoUrl: '',
    employmentType: '',
    employerName: '',
    maritalStatus: '',
    country: '',
    city: '',
    subCity: '',
    woreda: '',
    houseNumber: '',
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [showEditSharesModal, setShowEditSharesModal] = useState(false);
  const [editingShareGroup, setEditingShareGroup] = useState<{groupId: string, groupName: string, shares: number, contributionAmount: number} | null>(null);
  const [shareValue, setShareValue] = useState<number>(1);
  const [savingShares, setSavingShares] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getMember(memberId);
        setUser(data);
      } catch (err: unknown) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        setError(axiosErr.response?.data?.message || 'Failed to load member details.');
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [memberId]);

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

  const openEditModal = () => {
    if (!user) return;
    setEditData({
      name: user.name || '',
      phone: user.phone || '',
      telegramId: user.telegramId || '',
      governmentId: user.governmentId || '',
      bankAccountName: user.bankAccountName || '',
      photoUrl: user.photoUrl || '',
      employmentType: user.employmentType || '',
      employerName: user.employerName || '',
      maritalStatus: user.maritalStatus || '',
      country: user.country || '',
      city: user.city || '',
      subCity: user.subCity || '',
      woreda: user.woreda || '',
      houseNumber: user.houseNumber || '',
    });
    setShowEditModal(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {};
      Object.entries(editData).forEach(([key, val]) => {
        if (val) payload[key] = val;
        else payload[key] = null;
      });
      // name and phone are required
      payload.name = editData.name;
      payload.phone = editData.phone;
      await updateMember(memberId, payload);
      setShowEditModal(false);
      setSuccess(t('member.success_update'));
      setTimeout(() => setSuccess(null), 4000);
      // Refresh data
      const data = await getMember(memberId);
      setUser(data);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || 'Failed to update member.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteUserWithPassword(memberId, deletePassword);
      router.push('/members');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setDeleteError(
        axiosErr.response?.data?.message || 'Failed to delete user. Check your password.'
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleEditShares = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShareGroup) return;
    setSavingShares(true);
    setError(null);
    try {
      await updateMemberShares(editingShareGroup.groupId, memberId, shareValue);
      setShowEditSharesModal(false);
      setSuccess(t('member.shares_updated'));
      setTimeout(() => setSuccess(null), 4000);
      const data = await getMember(memberId);
      setUser(data);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || 'Failed to update shares.');
    } finally {
      setSavingShares(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
            <p className="text-sm text-gray-500">{t('member.loading_detail')}</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    return (
      <DashboardLayout>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('member.back')}
        </button>
        <div className="text-center py-16 card">
          <AlertCircle className="h-12 w-12 text-red-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">{t('member.not_found')}</h3>
          <p className="text-gray-500 text-sm">
            {error || t('member.not_found_desc')}
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const formatEmploymentType = (type?: string) => {
    if (!type) return 'Not specified';
    return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const formatMaritalStatus = (status?: string) => {
    if (!status) return 'Not specified';
    return status.charAt(0) + status.slice(1).toLowerCase();
  };


  return (
    <DashboardLayout>
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('member.back')}
      </button>

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
        </div>
      )}

      {/* Profile Header */}
      <div className="card mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-5">
            {/* Avatar / Photo */}
            <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center overflow-hidden flex-shrink-0">
              {user.photoUrl ? (
                <img
                  src={getMediaUrl(user.photoUrl)}
                  alt={user.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-2xl font-bold text-primary-700">
                  {user.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')}
                </span>
              )}
            </div>

            <div>
              <h1 className="text-2xl font-bold text-gray-900">{user.name}</h1>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1.5 text-gray-600">
                  <Phone className="h-4 w-4" />
                  <span className="text-sm">{user.phone}</span>
                </div>
                {user.telegramId && (
                  <div className="flex items-center gap-1.5 text-blue-600">
                    <MessageCircle className="h-4 w-4" />
                    <span className="text-sm">{user.telegramId}</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {t('member.since')} {user.createdAt}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={openEditModal}
            >
              <Pencil className="h-4 w-4 mr-2" />
              {t('member.edit')}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setShowDeleteModal(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {t('member.delete_btn')}
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">{t('member.tab_groups')}</p>
              <p className="text-sm font-semibold text-gray-900">{user.groups.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <CircleDollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">{t('members.col_deposits')}</p>
              <p className="text-sm font-semibold text-gray-900">
                ETB {user.totalDeposits.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 rounded-lg">
              <Trophy className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">{t('member.stat_wins')}</p>
              <p className="text-sm font-semibold text-gray-900">{user.lotteryWins.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-50 rounded-lg">
              <Calendar className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">{t('member.stat_payments')}</p>
              <p className="text-sm font-semibold text-gray-900">{user.deposits.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* {t('member.personal_info')} & {t('members.address')} */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* {t('member.personal_info')} */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5 text-gray-400" />
            {t('member.personal_info')}
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-50">
              <span className="text-sm text-gray-500">{t('members.label_gov_id')}</span>
              <span className="text-sm font-medium text-gray-900">
                {user.governmentId || 'Not provided'}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-50">
              <span className="text-sm text-gray-500">Bank Account Name</span>
              <span className="text-sm font-medium text-gray-900">
                {user.bankAccountName || 'Not provided'}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-50">
              <span className="text-sm text-gray-500">{t('members.label_marital')}</span>
              <span className="text-sm font-medium text-gray-900">
                {formatMaritalStatus(user.maritalStatus)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-50">
              <span className="text-sm text-gray-500">{t('members.label_employment')}</span>
              <span className="text-sm font-medium text-gray-900">
                {formatEmploymentType(user.employmentType)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-gray-500">{t('members.label_employer')}</span>
              <span className="text-sm font-medium text-gray-900">
                {user.employerName || 'Not specified'}
              </span>
            </div>
          </div>
        </div>

        {/* {t('members.address')} */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-gray-400" />
            {t('members.address')}
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-50">
              <span className="text-sm text-gray-500">{t('members.label_country')}</span>
              <span className="text-sm font-medium text-gray-900">
                {user.country || 'Not specified'}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-50">
              <span className="text-sm text-gray-500">{t('members.label_city')}</span>
              <span className="text-sm font-medium text-gray-900">
                {user.city || 'Not specified'}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-50">
              <span className="text-sm text-gray-500">Sub {t('members.label_city')}</span>
              <span className="text-sm font-medium text-gray-900">
                {user.subCity || 'Not specified'}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-50">
              <span className="text-sm text-gray-500">{t('members.label_woreda')}</span>
              <span className="text-sm font-medium text-gray-900">
                {user.woreda || 'Not specified'}
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-gray-500">{t('members.label_house')}</span>
              <span className="text-sm font-medium text-gray-900">
                {user.houseNumber || 'Not specified'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('deposits')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'deposits'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {t('member.tab_deposits')} ({user.deposits.length})
        </button>
        <button
          onClick={() => setActiveTab('groups')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'groups'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {t('member.tab_groups')} ({user.groups.length})
        </button>
        <button
          onClick={() => setActiveTab('wins')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'wins'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {t('member.stat_wins')} ({user.lotteryWins.length})
        </button>
      </div>

      {/* Deposit History */}
      {activeTab === 'deposits' && (
        <div className="card overflow-hidden p-0">
          {user.deposits.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="table-header">Group</th>
                    <th className="table-header">Cycle</th>
                    <th className="table-header">Amount</th>
                    <th className="table-header">{t('group.col_status')}</th>
                    <th className="table-header">{t('group.col_date')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {user.deposits.map((deposit) => (
                    <tr key={deposit.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="table-cell font-medium text-gray-900">
                        {deposit.groupName}
                      </td>
                      <td className="table-cell text-gray-500">
                        Cycle {deposit.cycleNumber}
                      </td>
                      <td className="table-cell text-gray-700">
                        ETB {deposit.amount.toLocaleString()}
                      </td>
                      <td className="table-cell">
                        <Badge status={deposit.status} />
                      </td>
                      <td className="table-cell text-gray-500">{deposit.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <CircleDollarSign className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">{t('member.no_deposits')}</p>
            </div>
          )}
        </div>
      )}

      {/* {t('member.tab_groups')} */}
      {activeTab === 'groups' && (
        <div className="card overflow-hidden p-0">
          {user.groups.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="table-header">{t('member.col_group_name')}</th>
                    <th className="table-header">{t('group.col_status')}</th>
                    <th className="table-header">Joined</th>
                    <th className="table-header">{t('member.col_shares')}</th>
                    <th className="table-header">{t('member.col_expected')}</th>
                    <th className="table-header text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {user.groups.map((group) => (
                    <tr key={group.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="table-cell font-medium text-gray-900">
                        {group.groupName}
                      </td>
                      <td className="table-cell">
                        <Badge status={group.status === 'ACTIVE' ? 'active' : 'inactive'} />
                      </td>
                      <td className="table-cell text-gray-500">{group.joinedAt}</td>
                      <td className="table-cell">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-700/10">
                          {group.shares} {t('member.col_shares')}
                        </span>
                      </td>
                      <td className="table-cell font-semibold text-gray-900">
                        ETB {(group.contributionAmount * group.shares).toLocaleString()}
                      </td>
                      <td className="table-cell text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => {
                              setEditingShareGroup({ groupId: group.groupId, groupName: group.groupName, shares: group.shares, contributionAmount: group.contributionAmount });
                              setShareValue(group.shares);
                              setShowEditSharesModal(true);
                            }}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title={t('member.edit_shares')}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => router.push(`/groups/${group.groupId}`)}
                            className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                            title="View group"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
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
              <p className="text-gray-500">{t('member.no_groups')}</p>
            </div>
          )}
        </div>
      )}

      {/* {t('member.stat_wins')} */}
      {activeTab === 'wins' && (
        <div className="card overflow-hidden p-0">
          {user.lotteryWins.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="table-header">Group</th>
                    <th className="table-header">Cycle</th>
                    <th className="table-header">{t('member.col_amount_won')}</th>
                    <th className="table-header">{t('group.col_date')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {user.lotteryWins.map((win) => (
                    <tr key={win.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="table-cell font-medium text-gray-900">
                        {win.groupName}
                      </td>
                      <td className="table-cell text-gray-500">
                        Cycle {win.cycleNumber}
                      </td>
                      <td className="table-cell font-semibold text-green-700">
                        ETB {win.amountWon.toLocaleString()}
                      </td>
                      <td className="table-cell text-gray-500">{win.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Trophy className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">{t('member.no_wins')}</p>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeletePassword('');
          setDeleteError(null);
        }}
        title={t('member.modal_delete')}
        size="sm"
      >
        <form onSubmit={handleDelete} className="space-y-4">
          <div className="p-4 rounded-lg bg-red-50 border border-red-100">
            <p className="text-sm text-red-700">
              {t('member.delete_warning')}
            </p>
          </div>

          {deleteError && (
            <div className="p-3 rounded bg-red-50 text-red-600 text-xs font-medium border border-red-100">
              {deleteError}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('member.delete_confirm_label')}
            </label>
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              className="input-field"
              placeholder={t('member.placeholder_pwd')}
              required
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowDeleteModal(false);
                setDeletePassword('');
                setDeleteError(null);
              }}
            >
              {t('members.btn_cancel')}
            </Button>
            <Button type="submit" variant="danger" loading={deleting}>
              <Trash2 className="h-4 w-4 mr-2" />
              {t('member.modal_delete')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* {t('member.edit')} Member Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={`${t('member.edit')} Member`}
        size="lg"
      >
        <form onSubmit={handleEdit} className="space-y-5">
          {/* Photo Upload */}
          <div className="flex justify-center">
            <PhotoUpload
              value={editData.photoUrl}
              onChange={(url) => setEditData({ ...editData, photoUrl: url })}
              name={editData.name || 'U'}
              size="lg"
            />
          </div>

          {/* Basic Info */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-2">{t('members.basic_info')}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('members.label_name')}</label>
                <input
                  type="text"
                  value={editData.name}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('members.label_phone')}</label>
                <input
                  type="tel"
                  value={editData.phone}
                  onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('members.label_gov_id')} / Digital ID</label>
                <input
                  type="text"
                  value={editData.governmentId}
                  onChange={(e) => setEditData({ ...editData, governmentId: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Bank Account Name</label>
                <input
                  type="text"
                  value={editData.bankAccountName}
                  onChange={(e) => setEditData({ ...editData, bankAccountName: e.target.value })}
                  className="input-field"
                  placeholder="Name as it appears on bank statements"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('members.label_telegram')}</label>
                <input
                  type="text"
                  value={editData.telegramId}
                  onChange={(e) => setEditData({ ...editData, telegramId: e.target.value })}
                  className="input-field"
                />
              </div>
            </div>
          </div>

          {/* {t('members.personal_details')} */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-2">{t('members.personal_details')}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('members.label_marital')}</label>
                <select
                  value={editData.maritalStatus}
                  onChange={(e) => setEditData({ ...editData, maritalStatus: e.target.value })}
                  className="input-field"
                >
                  {MARITAL_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('members.label_employment')} Type</label>
                <select
                  value={editData.employmentType}
                  onChange={(e) => setEditData({ ...editData, employmentType: e.target.value })}
                  className="input-field"
                >
                  {EMPLOYMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('members.label_employer')} / Company Name</label>
                <input
                  type="text"
                  value={editData.employerName}
                  onChange={(e) => setEditData({ ...editData, employerName: e.target.value })}
                  className="input-field"
                />
              </div>
            </div>
          </div>

          {/* {t('members.address')} */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-2">{t('members.address')}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('members.label_country')}</label>
                <input
                  type="text"
                  value={editData.country}
                  onChange={(e) => setEditData({ ...editData, country: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('members.label_city')}</label>
                <input
                  type="text"
                  value={editData.city}
                  onChange={(e) => setEditData({ ...editData, city: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Sub {t('members.label_city')}</label>
                <input
                  type="text"
                  value={editData.subCity}
                  onChange={(e) => setEditData({ ...editData, subCity: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('members.label_woreda')}</label>
                <input
                  type="text"
                  value={editData.woreda}
                  onChange={(e) => setEditData({ ...editData, woreda: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('members.label_house')}</label>
                <input
                  type="text"
                  value={editData.houseNumber}
                  onChange={(e) => setEditData({ ...editData, houseNumber: e.target.value })}
                  className="input-field"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <Button type="button" variant="secondary" onClick={() => setShowEditModal(false)}>
              {t('members.btn_cancel')}
            </Button>
            <Button type="submit" loading={saving}>
              {t('member.save_changes')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Shares Modal */}
      <Modal
        isOpen={showEditSharesModal}
        onClose={() => setShowEditSharesModal(false)}
        title={t('member.edit_shares')}
      >
        <form onSubmit={handleEditShares} className="space-y-4">
          <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-indigo-900 mb-1">{editingShareGroup?.groupName}</h4>
            <p className="text-xs text-indigo-700">{t('groups.amount_per_share_hint')}</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('members.label_shares')}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
              {[0.25, 0.5, 0.75, 1, 1.5, 2].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setShareValue(preset)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    shareValue === preset
                      ? 'bg-primary-600 text-white shadow-sm ring-2 ring-primary-600 ring-offset-1'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                  }`}
                >
                  {preset === 0.25 ? t('members.share_quarter') : preset === 0.5 ? t('members.share_half') : preset === 0.75 ? t('members.share_three_quarter') : preset === 1 ? t('members.share_full') : preset}
                </button>
              ))}
            </div>
            <input
              type="number"
              value={shareValue || ''}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setShareValue(isNaN(val) ? 0.25 : Math.max(0.25, Math.min(10, val)));
              }}
              className="input-field"
              min={0.25}
              max={10}
              step={0.01}
              placeholder="Custom shares count (0.25 - 10)"
            />
            {editingShareGroup && (
              <div className="flex items-center justify-between text-xs text-indigo-800 bg-indigo-100/60 rounded-md px-2.5 py-1.5 mt-2">
                <span>Expected per cycle:</span>
                <span className="font-bold">ETB {(editingShareGroup.contributionAmount * shareValue).toLocaleString()}</span>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowEditSharesModal(false)}
            >
              {t('members.btn_cancel')}
            </Button>
            <Button type="submit" loading={savingShares}>
              {t('member.btn_save')}
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
