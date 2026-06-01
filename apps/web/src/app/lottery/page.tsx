'use client';

import React, { useState, useEffect } from 'react';
import {
  Ticket,
  Trophy,
  Users,
  Calendar,
  Sparkles,
  RotateCw,
  AlertCircle,
  ShieldAlert,
  Percent,
  ListOrdered,
  BadgeAlert,
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useLanguage } from '@/components/layout/LanguageContext';
import Button from '@/components/ui/Button';
import { getLotteryResults, triggerLottery, getGroups, getGroup, getGroupRules } from '@/lib/api';
import type { LotteryResultItem, GroupListItem, GroupDetail, GroupRules } from '@/lib/api';

export default function LotteryPage() {
  const { t } = useLanguage();
  const [results, setResults] = useState<LotteryResultItem[]>([]);
  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [selectedGroupDetail, setSelectedGroupDetail] = useState<GroupDetail | null>(null);
  const [selectedGroupRules, setSelectedGroupRules] = useState<GroupRules | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [drawResult, setDrawResult] = useState<{
    winner: string;
    amount: number;
  } | null>(null);
  const [showAnimation, setShowAnimation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [resultsData, groupsData] = await Promise.allSettled([
          getLotteryResults(),
          getGroups(),
        ]);
        if (resultsData.status === 'fulfilled') setResults(resultsData.value);
        if (groupsData.status === 'fulfilled') setGroups(groupsData.value);

        if (resultsData.status === 'rejected' && groupsData.status === 'rejected') {
          setError('Failed to load lottery data. Please check your connection.');
        }
      } catch (err) {
        setError('Failed to load lottery data. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Fetch group details and rules when group is selected
  useEffect(() => {
    const fetchGroupDetails = async () => {
      if (!selectedGroupId) {
        setSelectedGroupDetail(null);
        setSelectedGroupRules(null);
        return;
      }
      setDetailsLoading(true);
      try {
        const [detail, rules] = await Promise.all([
          getGroup(selectedGroupId),
          getGroupRules(selectedGroupId),
        ]);
        setSelectedGroupDetail(detail);
        setSelectedGroupRules(rules);
      } catch (err) {
        console.error('Failed to load group detail/rules:', err);
      } finally {
        setDetailsLoading(false);
      }
    };
    fetchGroupDetails();
  }, [selectedGroupId]);

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

      // Refresh results and details list
      const [resultsData, detailData] = await Promise.all([
        getLotteryResults(),
        getGroup(selectedGroupId),
      ]);
      if (resultsData) setResults(resultsData);
      if (detailData) setSelectedGroupDetail(detailData);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setShowAnimation(false);
      setError(
        axiosErr.response?.data?.message || 'Lottery draw failed. Please check that this group has active, verified deposits for the current cycle.'
      );
    } finally {
      setIsDrawing(false);
    }
  };

  // Payout calculation preview
  const getPayoutPreview = () => {
    if (!selectedGroupDetail || !selectedGroupRules) return null;
    const gross = selectedGroupDetail.contributionAmount * selectedGroupDetail.membersCount;
    let fee = 0;
    if (selectedGroupRules.adminFeeType === 'FIXED') {
      fee = selectedGroupRules.adminFeeAmount || 0;
    } else if (selectedGroupRules.adminFeeType === 'PERCENTAGE') {
      fee = gross * ((selectedGroupRules.adminFeePercent || 0) / 100);
    }
    const net = gross - fee;
    return { gross, fee, net };
  };

  const payoutPreview = getPayoutPreview();

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
            <p className="text-sm text-gray-500">{t('lottery.loading')}</p>
          </div>
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
        <div className="mb-6 p-4 rounded-lg bg-red-50 text-red-700 text-sm font-medium border border-red-100 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700 font-bold text-lg">×</button>
        </div>
      )}
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{t('lottery.title')}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {t('lottery.subtitle')}
        </p>
      </div>

      {/* Draw Section */}
      <div className="card mb-8">
        <div className="flex flex-col lg:flex-row items-start gap-8">
          {/* Lottery Wheel / Animation */}
          <div className="flex-shrink-0 mx-auto lg:mx-0">
            <div
              className={`w-36 h-36 rounded-full border-4 border-primary-200 flex items-center justify-center relative overflow-hidden ${
                isDrawing ? 'animate-spin-slow' : ''
              }`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary-100 via-brand-100 to-primary-200" />
              <div className="relative z-10">
                {drawResult ? (
                  <Trophy className="h-14 w-14 text-yellow-500" />
                ) : isDrawing ? (
                  <RotateCw className="h-14 w-14 text-primary-600" />
                ) : (
                  <Ticket className="h-14 w-14 text-primary-600" />
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
          <div className="flex-1 w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {drawResult ? t('lottery.draw_complete') : t('lottery.trigger_draw')}
            </h3>

            {drawResult ? (
              <div className="bg-green-50 border border-green-100 rounded-xl p-6 mb-4">
                <div className="flex items-center gap-3 mb-3">
                  <Sparkles className="h-6 w-6 text-yellow-500" />
                  <span className="text-lg font-bold text-green-800">
                    {t('lottery.winner')} {drawResult.winner}
                  </span>
                </div>
                <div className="space-y-1.5 text-sm text-green-700">
                  <p>
                    {t('lottery.gross_payout')}{' '}
                    <span className="font-semibold">
                      ETB {drawResult.amount.toLocaleString()}
                    </span>
                  </p>
                  {payoutPreview && payoutPreview.fee > 0 && (
                    <>
                      <p>
                        {t('lottery.admin_fee')}{' '}
                        <span className="font-semibold text-red-600">
                          - ETB {payoutPreview.fee.toLocaleString()}
                        </span>
                      </p>
                      <p className="text-base font-bold text-green-950">
                        {t('lottery.net_payout')}{' '}
                        <span>
                          ETB {payoutPreview.net.toLocaleString()}
                        </span>
                      </p>
                    </>
                  )}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-4"
                  onClick={() => {
                    setDrawResult(null);
                    setShowAnimation(false);
                  }}
                >
                  {t('lottery.draw_again')}
                </Button>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-500 mb-6">
                  Select a group and trigger the lottery draw for the current
                  cycle. Only eligible members who have paid and comply with rules
                  will be included in the draw.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end mb-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      {t('lottery.select_group')}
                    </label>
                    <select
                      value={selectedGroupId}
                      onChange={(e) => setSelectedGroupId(e.target.value)}
                      className="input-field"
                    >
                      <option value="">{t('lottery.choose_group')}</option>
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
                    disabled={!selectedGroupId || detailsLoading}
                    size="lg"
                    className="w-full"
                  >
                    <Ticket className="h-5 w-5 mr-2" />
                    {isDrawing ? 'Drawing...' : t('lottery.draw_now')}
                  </Button>
                </div>

                {/* Rules & Eligibility Preview */}
                {selectedGroupId && !detailsLoading && selectedGroupDetail && selectedGroupRules && (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                    <div>
                      <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-3 flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4 text-primary-600" />
                        Lottery Strategy & Fees
                      </h4>
                      <ul className="space-y-2.5 text-sm text-gray-600">
                        <li className="flex justify-between border-b border-gray-200 pb-1.5">
                          <span>Lottery Strategy:</span>
                          <span className="font-semibold text-gray-900 capitalize">
                            {selectedGroupRules.allowMidCycleJoin ? 'Flexi-Mid Join' : 'Strict Cycle'} ({selectedGroupRules.minMembersToStart} min members)
                          </span>
                        </li>
                        <li className="flex justify-between border-b border-gray-200 pb-1.5">
                          <span>Post-Win Compliance:</span>
                          <span className="font-semibold text-gray-900">
                            {selectedGroupRules.postWinContributionRequired ? 'Required' : 'Voluntary'}
                          </span>
                        </li>
                        {payoutPreview && (
                          <>
                            <li className="flex justify-between border-b border-gray-200 pb-1.5">
                              <span>Gross Pool:</span>
                              <span className="font-semibold text-gray-900">
                                ETB {payoutPreview.gross.toLocaleString()}
                              </span>
                            </li>
                            <li className="flex justify-between border-b border-gray-200 pb-1.5">
                              <span>Admin Fee type:</span>
                              <span className="font-semibold text-gray-900 capitalize">
                                {selectedGroupRules.adminFeeType.toLowerCase()}
                              </span>
                            </li>
                            <li className="flex justify-between border-b border-gray-200 pb-1.5 text-red-600">
                              <span>Admin Deduction:</span>
                              <span className="font-bold">
                                - ETB {payoutPreview.fee.toLocaleString()}
                              </span>
                            </li>
                            <li className="flex justify-between pt-1 text-base font-bold text-primary-700">
                              <span>{t('lottery.net_payout')}</span>
                              <span>
                                ETB {payoutPreview.net.toLocaleString()}
                              </span>
                            </li>
                          </>
                        )}
                      </ul>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-3 flex items-center gap-2">
                        <ListOrdered className="h-4 w-4 text-primary-600" />
                        Member Status (Active Cycle)
                      </h4>
                      <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                        {selectedGroupDetail.members.map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center justify-between text-sm p-2 bg-white rounded-lg border border-gray-100"
                          >
                            <span className="font-medium text-gray-900">{member.name}</span>
                            <div className="flex gap-2">
                              {member.hasWon ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-yellow-50 text-yellow-800 text-xs font-semibold">
                                  Already Won (C{member.cycleWon})
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-green-50 text-green-800 text-xs font-semibold">
                                  {t('lottery.eligible')}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Past Results */}
      <div className="card overflow-hidden p-0">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">
            {t('lottery.past_results')}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {t('lottery.past_results_desc')}
          </p>
        </div>
        {results.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="table-header">Group</th>
                  <th className="table-header">Cycle</th>
                  <th className="table-header">{t('lottery.col_winner')}</th>
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
        ) : (
          <div className="text-center py-16">
            <Ticket className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">{t('lottery.no_results')}</p>
            <p className="text-gray-400 text-sm mt-1">
              Select a group above and trigger your first draw.
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
