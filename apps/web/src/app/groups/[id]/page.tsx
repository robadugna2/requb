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
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { getGroup, getGroupDeposits, verifyDeposit, rejectDeposit, triggerLottery } from '@/lib/api';

interface Member {
  id: string;
  name: string;
  phone: string;
  hasWon: boolean;
  cycleWon?: number;
}

interface Deposit {
  id: string;
  memberName: string;
  amount: number;
  status: 'verified' | 'pending' | 'rejected';
  date: string;
  receiptUrl?: string;
}

interface GroupDetail {
  id: string;
  name: string;
  description?: string;
  membersCount: number;
  maxMembers: number;
  contributionAmount: number;
  status: 'active' | 'inactive' | 'completed';
  cycleDuration: string;
  currentCycle: number;
  totalCycles: number;
  members: Member[];
  nextDrawDate?: string;
}

const mockGroup: GroupDetail = {
  id: '1',
  name: 'Weekly Equb #1',
  description: 'A weekly rotating savings group for neighborhood members.',
  membersCount: 12,
  maxMembers: 12,
  contributionAmount: 5000,
  status: 'active',
  cycleDuration: 'Weekly',
  currentCycle: 8,
  totalCycles: 12,
  nextDrawDate: '2024-03-15',
  members: [
    { id: '1', name: 'Abebe Kebede', phone: '+251911234567', hasWon: true, cycleWon: 3 },
    { id: '2', name: 'Meron Tadesse', phone: '+251922345678', hasWon: true, cycleWon: 1 },
    { id: '3', name: 'Dawit Haile', phone: '+251933456789', hasWon: true, cycleWon: 5 },
    { id: '4', name: 'Sara Tekle', phone: '+251944567890', hasWon: false },
    { id: '5', name: 'Yohannes Gebre', phone: '+251955678901', hasWon: true, cycleWon: 7 },
    { id: '6', name: 'Tigist Alemu', phone: '+251966789012', hasWon: false },
    { id: '7', name: 'Bekele Wolde', phone: '+251977890123', hasWon: true, cycleWon: 2 },
    { id: '8', name: 'Hanna Yosef', phone: '+251988901234', hasWon: false },
    { id: '9', name: 'Fikadu Desta', phone: '+251999012345', hasWon: true, cycleWon: 4 },
    { id: '10', name: 'Liya Berhe', phone: '+251910123456', hasWon: true, cycleWon: 6 },
    { id: '11', name: 'Tesfaye Mulat', phone: '+251921234567', hasWon: true, cycleWon: 8 },
    { id: '12', name: 'Alem Girma', phone: '+251932345678', hasWon: false },
  ],
};

const mockDeposits: Deposit[] = [
  { id: '1', memberName: 'Abebe Kebede', amount: 5000, status: 'verified', date: '2024-03-10' },
  { id: '2', memberName: 'Meron Tadesse', amount: 5000, status: 'verified', date: '2024-03-10' },
  { id: '3', memberName: 'Dawit Haile', amount: 5000, status: 'pending', date: '2024-03-11' },
  { id: '4', memberName: 'Sara Tekle', amount: 5000, status: 'pending', date: '2024-03-11' },
  { id: '5', memberName: 'Yohannes Gebre', amount: 5000, status: 'verified', date: '2024-03-09' },
  { id: '6', memberName: 'Tigist Alemu', amount: 5000, status: 'rejected', date: '2024-03-10' },
  { id: '7', memberName: 'Bekele Wolde', amount: 5000, status: 'verified', date: '2024-03-10' },
  { id: '8', memberName: 'Hanna Yosef', amount: 5000, status: 'pending', date: '2024-03-12' },
];

export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;

  const [group, setGroup] = useState<GroupDetail>(mockGroup);
  const [deposits, setDeposits] = useState<Deposit[]>(mockDeposits);
  const [loading, setLoading] = useState(true);
  const [drawLoading, setDrawLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'deposits' | 'members'>('deposits');
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [groupData, depositsData] = await Promise.allSettled([
          getGroup(groupId),
          getGroupDeposits(groupId),
        ]);
        if (groupData.status === 'fulfilled') setGroup(groupData.value);
        if (depositsData.status === 'fulfilled') setDeposits(depositsData.value);
      } catch (error) {
        console.log('Using mock data');
      } finally {
        setLoading(false);
      }
    };
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
    } catch (err: any) {
      setError(
        err.response?.data?.message || 'Failed to verify deposit. Please try again.'
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
    } catch (err: any) {
      setError(
        err.response?.data?.message || 'Failed to reject deposit. Please try again.'
      );
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
      // Refresh data
      const [groupData, depositsData] = await Promise.allSettled([
        getGroup(groupId),
        getGroupDeposits(groupId),
      ]);
      if (groupData.status === 'fulfilled') setGroup(groupData.value);
      if (depositsData.status === 'fulfilled') setDeposits(depositsData.value);
    } catch (err: any) {
      setError(
        err.response?.data?.message || 'Lottery draw failed. Verify that current cycle has active verified deposits.'
      );
    } finally {
      setDrawLoading(false);
    }
  };

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
        Back to Groups
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
            Draw Lottery
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Members</p>
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
              <p className="text-xs text-gray-500">Contribution</p>
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
              <p className="text-xs text-gray-500">Current Cycle</p>
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
              <p className="text-xs text-gray-500">Next Draw</p>
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
          onClick={() => setActiveTab('deposits')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'deposits'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Current Cycle Deposits
        </button>
        <button
          onClick={() => setActiveTab('members')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'members'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Members
        </button>
      </div>

      {/* Deposits Table */}
      {activeTab === 'deposits' && (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="table-header">Member</th>
                  <th className="table-header">Amount</th>
                  <th className="table-header">Date</th>
                  <th className="table-header">Status</th>
                  <th className="table-header text-right">Actions</th>
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
        </div>
      )}

      {/* Members List */}
      {activeTab === 'members' && (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="table-header">#</th>
                  <th className="table-header">Name</th>
                  <th className="table-header">Phone</th>
                  <th className="table-header">Won</th>
                  <th className="table-header">Cycle Won</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {group.members.map((member, index) => (
                  <tr key={member.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="table-cell text-gray-500">{index + 1}</td>
                    <td className="table-cell font-medium text-gray-900">
                      {member.name}
                    </td>
                    <td className="table-cell text-gray-500">{member.phone}</td>
                    <td className="table-cell">
                      {member.hasWon ? (
                        <Badge status="verified">Won</Badge>
                      ) : (
                        <Badge status="pending">Waiting</Badge>
                      )}
                    </td>
                    <td className="table-cell text-gray-500">
                      {member.cycleWon ? `Cycle ${member.cycleWon}` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
