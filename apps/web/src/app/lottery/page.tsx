'use client';

import React, { useState, useEffect } from 'react';
import {
  Ticket,
  Trophy,
  Users,
  Calendar,
  Sparkles,
  RotateCw,
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { getLotteryResults, triggerLottery, getGroups } from '@/lib/api';

interface LotteryResult {
  id: string;
  groupName: string;
  groupId: string;
  cycle: number;
  winnerName: string;
  amount: number;
  date: string;
}

interface Group {
  id: string;
  name: string;
  currentCycle: number;
  status: string;
}

const mockResults: LotteryResult[] = [
  {
    id: '1',
    groupName: 'Weekly Equb #1',
    groupId: '1',
    cycle: 8,
    winnerName: 'Tesfaye Mulat',
    amount: 60000,
    date: '2024-03-08',
  },
  {
    id: '2',
    groupName: 'Monthly Savings Group',
    groupId: '2',
    cycle: 3,
    winnerName: 'Hanna Yosef',
    amount: 200000,
    date: '2024-03-01',
  },
  {
    id: '3',
    groupName: 'Weekly Equb #1',
    groupId: '1',
    cycle: 7,
    winnerName: 'Yohannes Gebre',
    amount: 60000,
    date: '2024-03-01',
  },
  {
    id: '4',
    groupName: 'Bi-Weekly Equb #5',
    groupId: '3',
    cycle: 5,
    winnerName: 'Dawit Haile',
    amount: 20000,
    date: '2024-02-28',
  },
  {
    id: '5',
    groupName: 'Weekly Equb #1',
    groupId: '1',
    cycle: 6,
    winnerName: 'Liya Berhe',
    amount: 60000,
    date: '2024-02-22',
  },
  {
    id: '6',
    groupName: 'Monthly Savings Group',
    groupId: '2',
    cycle: 2,
    winnerName: 'Abebe Kebede',
    amount: 200000,
    date: '2024-02-01',
  },
];

const mockGroups: Group[] = [
  { id: '1', name: 'Weekly Equb #1', currentCycle: 8, status: 'active' },
  { id: '2', name: 'Monthly Savings Group', currentCycle: 3, status: 'active' },
  { id: '3', name: 'Bi-Weekly Equb #5', currentCycle: 5, status: 'active' },
];

export default function LotteryPage() {
  const [results, setResults] = useState<LotteryResult[]>(mockResults);
  const [groups, setGroups] = useState<Group[]>(mockGroups);
  const [loading, setLoading] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [drawResult, setDrawResult] = useState<{
    winner: string;
    amount: number;
  } | null>(null);
  const [showAnimation, setShowAnimation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [resultsData, groupsData] = await Promise.allSettled([
          getLotteryResults(),
          getGroups(),
        ]);
        if (resultsData.status === 'fulfilled') setResults(resultsData.value);
        if (groupsData.status === 'fulfilled') setGroups(groupsData.value);
      } catch (error) {
        console.log('Using mock data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleDraw = async () => {
    if (!selectedGroupId) return;

    setIsDrawing(true);
    setShowAnimation(true);
    setDrawResult(null);
    setError(null);
    setSuccess(null);

    // Simulate animation delay
    await new Promise((resolve) => setTimeout(resolve, 3000));

    try {
      const result = await triggerLottery(selectedGroupId);
      setDrawResult({
        winner: result.winner?.name || 'Winner',
        amount: result.amount || 0,
      });
      setSuccess('Lottery draw completed successfully!');
      setTimeout(() => setSuccess(null), 4000);
      
      // Refresh results list
      const resultsData = await getLotteryResults();
      if (resultsData) setResults(resultsData);
    } catch (err: any) {
      console.error('Failed to trigger lottery draw', err);
      setShowAnimation(false);
      setError(
        err.response?.data?.message || 'Lottery draw failed. Please check that this group has active, verified deposits for the current cycle.'
      );
    } finally {
      setIsDrawing(false);
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
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Lottery Draws</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage and trigger lottery draws for equb groups
        </p>
      </div>

      {/* Draw Section */}
      <div className="card mb-8">
        <div className="flex items-start gap-6">
          {/* Lottery Wheel / Animation */}
          <div className="flex-shrink-0">
            <div
              className={`w-32 h-32 rounded-full border-4 border-primary-200 flex items-center justify-center relative overflow-hidden ${
                isDrawing ? 'animate-spin-slow' : ''
              }`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary-100 via-brand-100 to-primary-200" />
              <div className="relative z-10">
                {drawResult ? (
                  <Trophy className="h-12 w-12 text-yellow-500" />
                ) : isDrawing ? (
                  <RotateCw className="h-12 w-12 text-primary-600" />
                ) : (
                  <Ticket className="h-12 w-12 text-primary-600" />
                )}
              </div>

              {/* Spinning segments */}
              {isDrawing && (
                <>
                  <div className="absolute top-0 left-1/2 w-0.5 h-full bg-primary-300 -translate-x-1/2" />
                  <div className="absolute top-1/2 left-0 w-full h-0.5 bg-primary-300 -translate-y-1/2" />
                  <div className="absolute top-0 left-0 w-full h-full border-t-4 border-primary-500 rounded-full" />
                </>
              )}
            </div>
          </div>

          {/* Draw Controls */}
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {drawResult ? '🎉 Draw Complete!' : 'Trigger New Draw'}
            </h3>

            {drawResult ? (
              <div className="bg-green-50 border border-green-100 rounded-xl p-6 mb-4">
                <div className="flex items-center gap-3 mb-3">
                  <Sparkles className="h-6 w-6 text-yellow-500" />
                  <span className="text-lg font-bold text-green-800">
                    Winner: {drawResult.winner}
                  </span>
                </div>
                <p className="text-green-700">
                  Payout amount:{' '}
                  <span className="font-bold">
                    ETB {drawResult.amount.toLocaleString()}
                  </span>
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-4"
                  onClick={() => {
                    setDrawResult(null);
                    setShowAnimation(false);
                  }}
                >
                  Draw Again
                </Button>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-500 mb-4">
                  Select a group and trigger the lottery draw for the current
                  cycle. Only eligible members who haven&apos;t won yet will be
                  included.
                </p>

                <div className="flex items-end gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Select Group
                    </label>
                    <select
                      value={selectedGroupId}
                      onChange={(e) => setSelectedGroupId(e.target.value)}
                      className="input-field"
                    >
                      <option value="">Choose a group...</option>
                      {groups
                        .filter((g) => g.status === 'active')
                        .map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.name} (Cycle {group.currentCycle})
                          </option>
                        ))}
                    </select>
                  </div>
                  <Button
                    onClick={handleDraw}
                    loading={isDrawing}
                    disabled={!selectedGroupId}
                    size="lg"
                  >
                    <Ticket className="h-5 w-5 mr-2" />
                    {isDrawing ? 'Drawing...' : 'Draw Now'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Past Results */}
      <div className="card overflow-hidden p-0">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">
            Past Draw Results
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            History of all lottery draws across groups
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="table-header">Group</th>
                <th className="table-header">Cycle</th>
                <th className="table-header">Winner</th>
                <th className="table-header">Amount</th>
                <th className="table-header">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {results.map((result) => (
                <tr
                  key={result.id}
                  className="hover:bg-gray-50/50 transition-colors"
                >
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-gray-400" />
                      <span className="font-medium text-gray-900">
                        {result.groupName}
                      </span>
                    </div>
                  </td>
                  <td className="table-cell">
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-primary-50 text-primary-700 text-xs font-medium">
                      Cycle {result.cycle}
                    </span>
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-yellow-500" />
                      <span className="font-medium text-gray-900">
                        {result.winnerName}
                      </span>
                    </div>
                  </td>
                  <td className="table-cell font-semibold text-gray-900">
                    ETB {result.amount.toLocaleString()}
                  </td>
                  <td className="table-cell text-gray-500">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {result.date}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {results.length === 0 && (
          <div className="text-center py-16">
            <Ticket className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No lottery draws yet.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
