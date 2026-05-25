'use client';

import React, { useState, useEffect } from 'react';
import { Search, Plus, Phone, MessageCircle, Users } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { getMembers, createMember } from '@/lib/api';

interface Member {
  id: string;
  name: string;
  phone: string;
  telegramId?: string;
  groups: string[];
  joinedAt: string;
  totalDeposits: number;
}

const mockMembers: Member[] = [
  {
    id: '1',
    name: 'Abebe Kebede',
    phone: '+251911234567',
    telegramId: '@abebe_k',
    groups: ['Weekly Equb #1', 'Monthly Savings Group'],
    joinedAt: '2024-01-05',
    totalDeposits: 45000,
  },
  {
    id: '2',
    name: 'Meron Tadesse',
    phone: '+251922345678',
    telegramId: '@meron_t',
    groups: ['Weekly Equb #1'],
    joinedAt: '2024-01-10',
    totalDeposits: 35000,
  },
  {
    id: '3',
    name: 'Dawit Haile',
    phone: '+251933456789',
    telegramId: '@dawit_h',
    groups: ['Weekly Equb #1', 'Bi-Weekly Equb #5'],
    joinedAt: '2024-01-12',
    totalDeposits: 52000,
  },
  {
    id: '4',
    name: 'Sara Tekle',
    phone: '+251944567890',
    groups: ['Weekly Equb #1'],
    joinedAt: '2024-01-15',
    totalDeposits: 25000,
  },
  {
    id: '5',
    name: 'Yohannes Gebre',
    phone: '+251955678901',
    telegramId: '@yohannes_g',
    groups: ['Monthly Savings Group'],
    joinedAt: '2024-02-01',
    totalDeposits: 30000,
  },
  {
    id: '6',
    name: 'Tigist Alemu',
    phone: '+251966789012',
    telegramId: '@tigist_a',
    groups: ['Weekly Equb #1', 'Premium Monthly'],
    joinedAt: '2024-01-08',
    totalDeposits: 75000,
  },
  {
    id: '7',
    name: 'Bekele Wolde',
    phone: '+251977890123',
    groups: ['Bi-Weekly Equb #5'],
    joinedAt: '2024-01-20',
    totalDeposits: 15000,
  },
  {
    id: '8',
    name: 'Hanna Yosef',
    phone: '+251988901234',
    telegramId: '@hanna_y',
    groups: ['Monthly Savings Group', 'Premium Monthly'],
    joinedAt: '2024-01-25',
    totalDeposits: 60000,
  },
  {
    id: '9',
    name: 'Fikadu Desta',
    phone: '+251999012345',
    telegramId: '@fikadu_d',
    groups: ['Weekly Equb #1'],
    joinedAt: '2024-02-05',
    totalDeposits: 28000,
  },
  {
    id: '10',
    name: 'Liya Berhe',
    phone: '+251910123456',
    groups: ['Bi-Weekly Equb #5', 'New Weekly Group'],
    joinedAt: '2024-02-10',
    totalDeposits: 18000,
  },
];

const mapApiUserToMember = (user: any): Member => ({
  id: user.id,
  name: user.name,
  phone: user.phone,
  telegramId: user.telegramId || '',
  groups: user.memberships?.map((m: any) => m.group?.name).filter(Boolean) || [],
  joinedAt: user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A',
  totalDeposits: user.deposits?.reduce((sum: number, d: any) => sum + (d.amount || 0), 0) || 0,
});

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>(mockMembers);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    telegramId: '',
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const data = await getMembers();
        if (data) setMembers(data.map(mapApiUserToMember));
      } catch (error) {
        console.log('Using mock data');
      } finally {
        setLoading(false);
      }
    };
    fetchMembers();
  }, []);

  const openCreateModal = () => {
    setError(null);
    setShowCreateModal(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await createMember(formData);
      setShowCreateModal(false);
      setFormData({ name: '', phone: '', telegramId: '' });
      setSuccess('Member added successfully!');
      setTimeout(() => setSuccess(null), 4000);
      const data = await getMembers();
      if (data) setMembers(data.map(mapApiUserToMember));
    } catch (err: any) {
      console.error('Failed to create member', err);
      setError(
        err.response?.data?.message || 'Failed to add member. Please verify fields or try again.'
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

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Members</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage all platform members ({members.length} total)
          </p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="h-4 w-4 mr-2" />
          Add Member
        </Button>
      </div>

      {success && (
        <div className="mb-6 p-4 rounded-lg bg-green-50 text-green-700 text-sm font-medium border border-green-100 flex items-center justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="text-green-500 hover:text-green-700 font-bold text-lg">×</button>
        </div>
      )}

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, phone, or telegram ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-10"
          />
        </div>
      </div>

      {/* Members Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="table-header">Name</th>
                <th className="table-header">Phone</th>
                <th className="table-header">Telegram</th>
                <th className="table-header">Groups</th>
                <th className="table-header">Total Deposits</th>
                <th className="table-header">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredMembers.map((member) => (
                <tr
                  key={member.id}
                  className="hover:bg-gray-50/50 transition-colors"
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
                        {member.groups.map((group, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700"
                          >
                            {group}
                          </span>
                        ))}
                      </div>
                    </div>
                  </td>
                  <td className="table-cell font-medium text-gray-900">
                    ETB {member.totalDeposits.toLocaleString()}
                  </td>
                  <td className="table-cell text-gray-500">
                    {member.joinedAt}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredMembers.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No members found matching your search.</p>
          </div>
        )}
      </div>

      {/* Create Member Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Add New Member"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {error && (
            <div className="p-3 rounded bg-red-50 text-red-600 text-xs font-medium border border-red-100">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Full Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="input-field"
              placeholder="Enter full name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Phone Number
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
              className="input-field"
              placeholder="+251911234567"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Telegram ID (Optional)
            </label>
            <input
              type="text"
              value={formData.telegramId}
              onChange={(e) =>
                setFormData({ ...formData, telegramId: e.target.value })
              }
              className="input-field"
              placeholder="@username"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowCreateModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={creating}>
              Add Member
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
