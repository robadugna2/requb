'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Users, Calendar, CircleDollarSign, Search } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import { getGroups, createGroup } from '@/lib/api';

interface Group {
  id: string;
  name: string;
  membersCount: number;
  maxMembers: number;
  contributionAmount: number;
  status: 'active' | 'inactive' | 'completed';
  cycleDuration: string;
  currentCycle: number;
  totalCycles: number;
  createdAt: string;
}

const mockGroups: Group[] = [
  {
    id: '1',
    name: 'Weekly Equb #1',
    membersCount: 12,
    maxMembers: 12,
    contributionAmount: 5000,
    status: 'active',
    cycleDuration: 'Weekly',
    currentCycle: 8,
    totalCycles: 12,
    createdAt: '2024-01-15',
  },
  {
    id: '2',
    name: 'Monthly Savings Group',
    membersCount: 20,
    maxMembers: 25,
    contributionAmount: 10000,
    status: 'active',
    cycleDuration: 'Monthly',
    currentCycle: 3,
    totalCycles: 25,
    createdAt: '2024-02-01',
  },
  {
    id: '3',
    name: 'Bi-Weekly Equb #5',
    membersCount: 8,
    maxMembers: 10,
    contributionAmount: 2500,
    status: 'active',
    cycleDuration: 'Bi-Weekly',
    currentCycle: 5,
    totalCycles: 10,
    createdAt: '2024-01-20',
  },
  {
    id: '4',
    name: 'Premium Monthly',
    membersCount: 15,
    maxMembers: 15,
    contributionAmount: 25000,
    status: 'completed',
    cycleDuration: 'Monthly',
    currentCycle: 15,
    totalCycles: 15,
    createdAt: '2023-09-01',
  },
  {
    id: '5',
    name: 'New Weekly Group',
    membersCount: 3,
    maxMembers: 12,
    contributionAmount: 3000,
    status: 'inactive',
    cycleDuration: 'Weekly',
    currentCycle: 0,
    totalCycles: 12,
    createdAt: '2024-03-01',
  },
];

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>(mockGroups);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    contributionAmount: '',
    cycleDuration: 'Weekly',
    maxMembers: '',
    description: '',
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const data = await getGroups();
        if (data && data.length > 0) setGroups(data);
      } catch (error) {
        console.log('Using mock data');
      } finally {
        setLoading(false);
      }
    };
    fetchGroups();
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
      });
      setShowCreateModal(false);
      setFormData({
        name: '',
        contributionAmount: '',
        cycleDuration: 'Weekly',
        maxMembers: '',
        description: '',
      });
      setSuccess('Equb group created successfully!');
      setTimeout(() => setSuccess(null), 4000);
      // Refresh groups
      const data = await getGroups();
      if (data) setGroups(data);
    } catch (err: any) {
      console.error('Failed to create group', err);
      setError(
        err.response?.data?.message || 'Failed to create group. Please check fields or try again.'
      );
    } finally {
      setCreating(false);
    }
  };

  const filteredGroups = groups.filter((group) =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Equb Groups</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage all rotating savings groups
          </p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="h-4 w-4 mr-2" />
          Create Group
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
            placeholder="Search groups..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-10"
          />
        </div>
      </div>

      {/* Groups Grid */}
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
                  {group.cycleDuration} cycle
                </p>
              </div>
              <Badge status={group.status} />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-gray-500">
                  <Users className="h-4 w-4" />
                  Members
                </span>
                <span className="font-medium text-gray-900">
                  {group.membersCount}/{group.maxMembers}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-gray-500">
                  <CircleDollarSign className="h-4 w-4" />
                  Contribution
                </span>
                <span className="font-medium text-gray-900">
                  ETB {group.contributionAmount.toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-gray-500">
                  <Calendar className="h-4 w-4" />
                  Cycle
                </span>
                <span className="font-medium text-gray-900">
                  {group.currentCycle}/{group.totalCycles}
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                <span>Progress</span>
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

      {/* Create Group Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Equb Group"
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
              Group Name
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
                Contribution (ETB)
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
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Max Members
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
              Cycle Duration
            </label>
            <select
              value={formData.cycleDuration}
              onChange={(e) =>
                setFormData({ ...formData, cycleDuration: e.target.value })
              }
              className="input-field"
            >
              <option value="Weekly">Weekly</option>
              <option value="Bi-Weekly">Bi-Weekly</option>
              <option value="Monthly">Monthly</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Description (Optional)
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
              Cancel
            </Button>
            <Button type="submit" loading={creating}>
              Create Group
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
