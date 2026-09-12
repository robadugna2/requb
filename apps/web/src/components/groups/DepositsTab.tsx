'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Trash2,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  ArrowUpDown,
  FileText,
  TrendingUp,
  AlertTriangle,
  Ban,
  Zap,
  ScanLine,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/ui/StatusBadge';
import Modal from '@/components/ui/Modal';
import { AutoVerifyButton } from '@/components/ui/CbeVerifyPanel';
import {
  getGroupDeposits,
  verifyDeposit,
  rejectDeposit,
  autoVerifyDepositCbe,
  getGroupPenalties,
  payPenalty,
  waivePenalty,
  getMediaUrl,
} from '@/lib/api';
import type { DepositItem, PenaltyRecord, GroupDetail } from '@/lib/api';

const DEPOSITS_PER_PAGE = 25;

interface DepositsTabProps {
  groupId: string;
  group: GroupDetail;
  groupCbeAccounts: string[];
  canManageDeposits: boolean;
  refreshKey: number;
  notifySuccess: (msg: string) => void;
  notifyError: (msg: string) => void;
}

export default function DepositsTab({
  groupId,
  group,
  groupCbeAccounts,
  canManageDeposits,
  refreshKey,
  notifySuccess,
  notifyError,
}: DepositsTabProps) {
  const router = useRouter();
  const [deposits, setDeposits] = useState<DepositItem[]>([]);
  const [penalties, setPenalties] = useState<PenaltyRecord[]>([]);
  const [penaltiesLoading, setPenaltiesLoading] = useState(false);

  const [depositSearch, setDepositSearch] = useState('');
  const [depositStatusFilter, setDepositStatusFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>('all');
  const [depositCycleFilter, setDepositCycleFilter] = useState<number | 'all'>('all');
  const [depositSort, setDepositSort] = useState<{ field: 'date' | 'amount' | 'member'; dir: 'asc' | 'desc' }>({ field: 'date', dir: 'desc' });
  const [depositPage, setDepositPage] = useState(1);
  const [selectedDepositIds, setSelectedDepositIds] = useState<Set<string>>(new Set());
  const [previewDeposit, setPreviewDeposit] = useState<DepositItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingDepositId, setRejectingDepositId] = useState<string | null>(null);
  const [batchVerifying, setBatchVerifying] = useState(false);
  const [verifyingDepositId, setVerifyingDepositId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getGroupDeposits(groupId);
        if (!cancelled) setDeposits(data);
      } catch {
        if (!cancelled) notifyError('Failed to load deposits.');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, refreshKey]);

  useEffect(() => {
    let cancelled = false;
    setPenaltiesLoading(true);
    (async () => {
      try {
        const data = await getGroupPenalties(groupId);
        if (!cancelled) setPenalties(data);
      } catch { /* optional data */ } finally {
        if (!cancelled) setPenaltiesLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, refreshKey]);

  const handleVerify = async (depositId: string) => {
    setVerifyingDepositId(depositId);
    try {
      await verifyDeposit(depositId);
      setDeposits(deposits.map((d) => d.id === depositId ? { ...d, status: 'verified' as const } : d));
      if (previewDeposit?.id === depositId) setPreviewDeposit({ ...previewDeposit, status: 'verified' });
      notifySuccess('Deposit verified successfully!');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      notifyError(axiosErr.response?.data?.message || 'Failed to verify deposit. Please try again.');
    } finally {
      setVerifyingDepositId(null);
    }
  };

  const handleReject = async (depositId: string, reason?: string) => {
    setRejectingDepositId(depositId);
    try {
      await rejectDeposit(depositId, reason);
      setDeposits(deposits.map((d) => d.id === depositId ? { ...d, status: 'rejected' as const, rejectionReason: reason } : d));
      if (previewDeposit?.id === depositId) setPreviewDeposit({ ...previewDeposit, status: 'rejected', rejectionReason: reason });
      setRejectReason('');
      notifySuccess('Deposit rejected.');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      notifyError(axiosErr.response?.data?.message || 'Failed to reject deposit. Please try again.');
    } finally {
      setRejectingDepositId(null);
    }
  };

  const handleBatchVerify = async () => {
    if (selectedDepositIds.size === 0) return;
    setBatchVerifying(true);
    let successCount = 0;
    for (const id of Array.from(selectedDepositIds)) {
      try {
        await verifyDeposit(id);
        successCount++;
      } catch { /* continue */ }
    }
    setDeposits((prev) =>
      prev.map((d) => selectedDepositIds.has(d.id) ? { ...d, status: 'verified' as const } : d)
    );
    setSelectedDepositIds(new Set());
    setBatchVerifying(false);
    notifySuccess(`${successCount} deposit(s) verified successfully!`);
  };

  const depositCycles = useMemo(() => {
    const nums = Array.from(new Set(deposits.map((d) => d.cycleNumber).filter(Boolean) as number[]));
    return nums.sort((a, b) => a - b);
  }, [deposits]);

  const filteredSortedDeposits = useMemo(() => {
    let list = [...deposits];
    if (depositCycleFilter !== 'all') list = list.filter((d) => d.cycleNumber === depositCycleFilter);
    if (depositStatusFilter !== 'all') list = list.filter((d) => d.status === depositStatusFilter);
    if (depositSearch.trim()) {
      const q = depositSearch.trim().toLowerCase();
      list = list.filter((d) =>
        d.memberName.toLowerCase().includes(q) ||
        (d.ftNumber?.toLowerCase().includes(q) ?? false) ||
        (d.bankName?.toLowerCase().includes(q) ?? false)
      );
    }
    list.sort((a, b) => {
      let cmp = 0;
      if (depositSort.field === 'date') cmp = (a.transferDate ?? '').localeCompare(b.transferDate ?? '');
      else if (depositSort.field === 'amount') cmp = a.amount - b.amount;
      else if (depositSort.field === 'member') cmp = a.memberName.localeCompare(b.memberName);
      return depositSort.dir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [deposits, depositCycleFilter, depositStatusFilter, depositSearch, depositSort]);

  const depositKPIs = useMemo(() => {
    const all = depositCycleFilter === 'all' ? deposits : deposits.filter((d) => d.cycleNumber === depositCycleFilter);
    return {
      totalVerified: all.filter((d) => d.status === 'verified').reduce((s, d) => s + d.amount, 0),
      countVerified: all.filter((d) => d.status === 'verified').length,
      totalPending: all.filter((d) => d.status === 'pending').reduce((s, d) => s + d.amount, 0),
      countPending: all.filter((d) => d.status === 'pending').length,
      countRejected: all.filter((d) => d.status === 'rejected').length,
      countLate: all.filter((d) => d.isLate).length,
    };
  }, [deposits, depositCycleFilter]);

  const depositPageCount = Math.max(1, Math.ceil(filteredSortedDeposits.length / DEPOSITS_PER_PAGE));
  const pagedDeposits = filteredSortedDeposits.slice((depositPage - 1) * DEPOSITS_PER_PAGE, depositPage * DEPOSITS_PER_PAGE);

  const toggleDepositSort = (field: 'date' | 'amount' | 'member') => {
    setDepositSort((prev) =>
      prev.field === field ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: 'asc' }
    );
    setDepositPage(1);
  };

  const toggleSelectDeposit = (id: string) => {
    setSelectedDepositIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const pendingPageDeposits = pagedDeposits.filter((d) => d.status === 'pending');
  const allPagePendingSelected = pendingPageDeposits.length > 0 && pendingPageDeposits.every((d) => selectedDepositIds.has(d.id));

  const toggleSelectAllPage = () => {
    setSelectedDepositIds((prev) => {
      const next = new Set(prev);
      if (allPagePendingSelected) {
        pendingPageDeposits.forEach((d) => next.delete(d.id));
      } else {
        pendingPageDeposits.forEach((d) => next.add(d.id));
      }
      return next;
    });
  };

  const handleExportCSV = useCallback(() => {
    const rows = filteredSortedDeposits.map((d) => [
      d.cycleNumber ?? '',
      d.memberName,
      d.amount,
      d.bankName ?? '',
      d.ftNumber ?? '',
      d.transferDate,
      d.senderName ?? '',
      d.status,
      d.isLate ? 'Yes' : 'No',
    ]);
    const header = ['Cycle', 'Member', 'Amount (ETB)', 'Bank', 'FT Ref', 'Transfer Date', 'Sender', 'Status', 'Late'];
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deposits-${group.name ?? groupId}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredSortedDeposits, group.name, groupId]);

  const handlePayPenalty = async (id: string) => {
    try { await payPenalty(id); notifySuccess('Penalty marked as paid.'); await fetchPenalties(); } catch { notifyError('Failed to pay penalty.'); }
  };
  const handleWaivePenalty = async (id: string) => {
    try { await waivePenalty(id); notifySuccess('Penalty waived.'); await fetchPenalties(); } catch { notifyError('Failed to waive penalty.'); }
  };
  const fetchPenalties = async () => {
    setPenaltiesLoading(true);
    try { const data = await getGroupPenalties(groupId); setPenalties(data); } catch {} finally { setPenaltiesLoading(false); }
  };

  return (
    <div className="space-y-4">
      {/* Compact KPI strip — one slim row instead of four big cards */}
      <div className="card !p-0 overflow-hidden">
        <div className="grid grid-cols-4 divide-x divide-gray-100 dark:divide-gray-800">
          {[
            { icon: TrendingUp, tint: 'text-green-600 dark:text-success-400', label: 'Verified', value: `ETB ${depositKPIs.totalVerified.toLocaleString()}`, sub: `${depositKPIs.countVerified} deposits` },
            { icon: Clock, tint: 'text-amber-500', label: 'Pending', value: `ETB ${depositKPIs.totalPending.toLocaleString()}`, sub: `${depositKPIs.countPending} awaiting` },
            { icon: XCircle, tint: 'text-red-500 dark:text-error-400', label: 'Rejected', value: `${depositKPIs.countRejected}`, sub: 'deposits' },
            { icon: AlertTriangle, tint: 'text-orange-500 dark:text-orange-400', label: 'Late', value: `${depositKPIs.countLate}`, sub: 'flagged' },
          ].map((k) => (
            <div key={k.label} className="px-2 py-2.5 min-w-0">
              <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 font-semibold truncate">
                <k.icon className={`h-3 w-3 shrink-0 ${k.tint}`} />
                <span className="truncate">{k.label}</span>
              </p>
              <p className="mt-0.5 text-sm font-bold text-gray-900 dark:text-white/90 tabular-nums truncate">{k.value}</p>
              <p className={`text-[10px] truncate ${k.tint}`}>{k.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Compact toolbar: search + scan / filters / status pills */}
      <div className="card p-2.5 space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
            <input
              type="text"
              value={depositSearch}
              onChange={(e) => { setDepositSearch(e.target.value); setDepositPage(1); }}
              placeholder="Member, FT ref, or bank…"
              className="input-field pl-9 text-sm w-full"
            />
          </div>
          {canManageDeposits && (
            <Button size="sm" onClick={() => router.push(`/scan?group=${groupId}`)} className="shrink-0 self-stretch">
              <ScanLine className="h-4 w-4 mr-1" />
              Scan FT
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <select
            value={depositCycleFilter}
            onChange={(e) => { setDepositCycleFilter(e.target.value === 'all' ? 'all' : Number(e.target.value)); setDepositPage(1); }}
            className="input-field text-sm flex-1 min-w-0"
          >
            <option value="all">All Cycles</option>
            {depositCycles.map((c) => <option key={c} value={c}>Cycle {c}</option>)}
          </select>
          <select
            value={`${depositSort.field}-${depositSort.dir}`}
            onChange={(e) => {
              const [field, dir] = e.target.value.split('-') as ['date' | 'amount' | 'member', 'asc' | 'desc'];
              setDepositSort({ field, dir }); setDepositPage(1);
            }}
            className="input-field text-sm flex-1 min-w-0"
          >
            <option value="date-desc">Date — Newest</option>
            <option value="date-asc">Date — Oldest</option>
            <option value="amount-desc">Amount — High→Low</option>
            <option value="amount-asc">Amount — Low→High</option>
            <option value="member-asc">Member — A→Z</option>
            <option value="member-desc">Member — Z→A</option>
          </select>
          <button
            onClick={handleExportCSV}
            className="shrink-0 flex items-center gap-1.5 px-3 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white/90 border border-gray-200 dark:border-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors self-stretch"
            title="Export current view as CSV"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">CSV</span>
          </button>
        </div>

        {/* Status filter pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {(['all', 'pending', 'verified', 'rejected'] as const).map((s) => {
            const counts: Record<string, number> = {
              all: deposits.length,
              pending: deposits.filter(d => d.status === 'pending').length,
              verified: deposits.filter(d => d.status === 'verified').length,
              rejected: deposits.filter(d => d.status === 'rejected').length,
            };
            const active = depositStatusFilter === s;
            return (
              <button
                key={s}
                onClick={() => { setDepositStatusFilter(s); setDepositPage(1); setSelectedDepositIds(new Set()); }}
                className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                  active ? 'bg-primary-600 text-white shadow-sm' : 'bg-gray-100 dark:bg-white/[0.08] text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/[0.12]'
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
                <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${active ? 'bg-white/20' : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400'}`}>
                  {counts[s]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Batch verify action bar */}
      {selectedDepositIds.size > 0 && (
        <div className="flex items-center justify-between bg-indigo-50 dark:bg-brand-500/10 border border-indigo-200 rounded-lg px-4 py-2.5">
          <span className="text-sm font-medium text-indigo-800 dark:text-brand-300">{selectedDepositIds.size} deposit(s) selected</span>
          <div className="flex gap-2">
            <button onClick={() => setSelectedDepositIds(new Set())} className="text-xs text-indigo-600 dark:text-brand-400 hover:underline">Clear</button>
            <Button size="sm" onClick={handleBatchVerify} loading={batchVerifying}>
              <CheckCircle className="h-3.5 w-3.5 mr-1" /> Verify All
            </Button>
          </div>
        </div>
      )}

      {/* Deposits Table */}
      <div className="card overflow-hidden p-0">
        {filteredSortedDeposits.length > 0 ? (
          <>
            {/* Mobile / tablet: compact deposit cards */}
            <div className="md:hidden divide-y divide-gray-50 dark:divide-gray-800">
              {pagedDeposits.map((deposit) => (
                <div
                  key={deposit.id}
                  onClick={() => setPreviewDeposit(deposit)}
                  className="flex items-center gap-2.5 px-3 py-2.5 active:bg-gray-50 dark:active:bg-white/[0.02] cursor-pointer"
                >
                  {deposit.status === 'pending' && (
                    <input
                      type="checkbox"
                      checked={selectedDepositIds.has(deposit.id)}
                      onChange={() => toggleSelectDeposit(deposit.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded border-gray-300 text-primary-600 dark:text-brand-400 focus:ring-primary-500 shrink-0"
                    />
                  )}
                  <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-brand-500/15 flex items-center justify-center shrink-0">
                    <span className="text-[11px] font-bold text-primary-700 dark:text-brand-400">
                      {deposit.memberName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white/90 truncate">{deposit.memberName}</p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate mt-0.5">
                      {deposit.ftNumber || deposit.bankName || '—'} · {String(deposit.transferDate || deposit.date).slice(0, 10)}
                      {deposit.senderName && deposit.senderName !== deposit.memberName && (
                        <> · via {deposit.senderName}</>
                      )}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white/90 tabular-nums">
                      ETB {deposit.amount.toLocaleString()}
                    </p>
                    <div className="flex items-center justify-end gap-1 mt-0.5">
                      {deposit.cycleNumber && (
                        <span className="text-[10px] font-semibold text-indigo-700 dark:text-brand-400 bg-indigo-50 dark:bg-brand-500/10 px-1.5 py-px rounded-full">
                          C{deposit.cycleNumber}
                        </span>
                      )}
                      {deposit.isLate && (
                        <span className="text-[10px] bg-orange-100 text-orange-700 dark:text-orange-400 px-1.5 py-px rounded-full font-medium">Late</span>
                      )}
                      <StatusBadge status={deposit.status} />
                    </div>
                  </div>
                  {deposit.status === 'pending' && canManageDeposits && (
                    <div className="flex flex-col gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleVerify(deposit.id)}
                        disabled={verifyingDepositId === deposit.id}
                        className="p-1.5 text-green-600 dark:text-success-400 bg-green-50 dark:bg-success-500/10 rounded-lg disabled:opacity-40 active:scale-95 transition-all"
                        title="Verify"
                      >
                        <CheckCircle className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleReject(deposit.id)}
                        disabled={rejectingDepositId === deposit.id}
                        className="p-1.5 text-red-500 dark:text-error-400 bg-red-50 dark:bg-error-500/10 rounded-lg disabled:opacity-40 active:scale-95 transition-all"
                        title="Reject"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop: full table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-white/[0.04] border-b border-gray-100 dark:border-gray-800">
                  <tr>
                    <th className="table-header w-10">
                      <input
                        type="checkbox"
                        checked={allPagePendingSelected}
                        onChange={toggleSelectAllPage}
                        disabled={pendingPageDeposits.length === 0}
                        className="rounded border-gray-300 text-primary-600 dark:text-brand-400 focus:ring-primary-500"
                        title="Select all pending on this page"
                      />
                    </th>
                    <th className="table-header">
                      <button onClick={() => toggleDepositSort('member')} className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-white/90">
                        Member {depositSort.field === 'member' ? (depositSort.dir === 'asc' ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>) : <ArrowUpDown className="h-3 w-3 opacity-40"/>}
                      </button>
                    </th>
                    <th className="table-header">Cycle</th>
                    <th className="table-header">
                      <button onClick={() => toggleDepositSort('amount')} className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-white/90">
                        Amount {depositSort.field === 'amount' ? (depositSort.dir === 'asc' ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>) : <ArrowUpDown className="h-3 w-3 opacity-40"/>}
                      </button>
                    </th>
                    <th className="table-header">Bank</th>
                    <th className="table-header">FT Ref</th>
                    <th className="table-header">
                      <button onClick={() => toggleDepositSort('date')} className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-white/90">
                        Date {depositSort.field === 'date' ? (depositSort.dir === 'asc' ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>) : <ArrowUpDown className="h-3 w-3 opacity-40"/>}
                      </button>
                    </th>
                    <th className="table-header">Status</th>
                    <th className="table-header text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {pagedDeposits.map((deposit) => (
                    <tr
                      key={deposit.id}
                      className="hover:bg-gray-50/60 transition-colors cursor-pointer"
                      onClick={() => setPreviewDeposit(deposit)}
                    >
                      <td className="table-cell" onClick={(e) => e.stopPropagation()}>
                        {deposit.status === 'pending' && (
                          <input
                            type="checkbox"
                            checked={selectedDepositIds.has(deposit.id)}
                            onChange={() => toggleSelectDeposit(deposit.id)}
                            className="rounded border-gray-300 text-primary-600 dark:text-brand-400 focus:ring-primary-500"
                          />
                        )}
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary-100 dark:bg-brand-500/15 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-primary-700 dark:text-brand-400">{deposit.memberName.split(' ').map(n => n[0]).join('').slice(0,2)}</span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white/90">{deposit.memberName}</p>
                            {deposit.senderName && deposit.senderName !== deposit.memberName && (
                              <p className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-[140px]" title={deposit.senderName}>via {deposit.senderName}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="table-cell">
                        {deposit.cycleNumber ? (
                          <span className="text-xs font-semibold text-indigo-700 dark:text-brand-400 bg-indigo-50 dark:bg-brand-500/10 px-2 py-0.5 rounded-full">C{deposit.cycleNumber}</span>
                        ) : <span className="text-gray-400 dark:text-gray-500 text-xs">—</span>}
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-gray-900 dark:text-white/90">ETB {deposit.amount.toLocaleString()}</span>
                          {deposit.isLate && (
                            <span className="text-xs bg-orange-100 text-orange-700 dark:text-orange-400 px-1.5 py-0.5 rounded-full font-medium">Late</span>
                          )}
                        </div>
                      </td>
                      <td className="table-cell text-sm text-gray-500 dark:text-gray-400">{deposit.bankName || '—'}</td>
                      <td className="table-cell">
                        {deposit.ftNumber ? (
                          <span className="font-mono text-xs text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-white/[0.08] px-1.5 py-0.5 rounded max-w-[130px] truncate block" title={deposit.ftNumber}>{deposit.ftNumber}</span>
                        ) : <span className="text-gray-400 dark:text-gray-500 text-xs">—</span>}
                      </td>
                      <td className="table-cell text-xs text-gray-500 dark:text-gray-400">{deposit.transferDate}</td>
                      <td className="table-cell"><StatusBadge status={deposit.status} /></td>
                      <td className="table-cell text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setPreviewDeposit(deposit)} className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-brand-500/10 rounded-lg transition-colors" title="View details">
                            <Eye className="h-4 w-4" />
                          </button>
                          {deposit.status === 'pending' && canManageDeposits && (
                            <>
                              <button
                                onClick={() => handleVerify(deposit.id)}
                                disabled={verifyingDepositId === deposit.id}
                                className="p-1.5 text-green-600 dark:text-success-400 hover:bg-green-50 dark:hover:bg-success-500/10 rounded-lg transition-colors disabled:opacity-40"
                                title="Verify"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleReject(deposit.id)}
                                disabled={rejectingDepositId === deposit.id}
                                className="p-1.5 text-red-500 dark:text-error-400 hover:bg-red-50 dark:hover:bg-error-500/10 rounded-lg transition-colors disabled:opacity-40"
                                title="Reject"
                              >
                                <XCircle className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {depositPageCount > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-white/[0.04]">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Showing {((depositPage-1)*DEPOSITS_PER_PAGE)+1}–{Math.min(depositPage*DEPOSITS_PER_PAGE, filteredSortedDeposits.length)} of {filteredSortedDeposits.length}
                </p>
                <div className="flex gap-1">
                  <button disabled={depositPage === 1} onClick={() => setDepositPage(p => p-1)} className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-800 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors">← Prev</button>
                  <span className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">{depositPage}/{depositPageCount}</span>
                  <button disabled={depositPage === depositPageCount} onClick={() => setDepositPage(p => p+1)} className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-800 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors">Next →</button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-10">
            <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400 font-medium">No deposits found</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {depositSearch || depositStatusFilter !== 'all' || depositCycleFilter !== 'all'
                ? 'Try adjusting your filters or search term'
                : 'Deposits will appear here once members submit receipts'}
            </p>
            {(depositSearch || depositStatusFilter !== 'all' || depositCycleFilter !== 'all') && (
              <button
                onClick={() => { setDepositSearch(''); setDepositStatusFilter('all'); setDepositCycleFilter('all'); }}
                className="mt-3 text-xs text-primary-600 dark:text-brand-400 hover:underline"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Penalties section */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white/90">Penalties</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Late-payment penalties enforced by the group rules</p>
          </div>
        </div>

        {penaltiesLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          </div>
        ) : penalties.length > 0 ? (
          <>
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-gray-50 dark:divide-gray-800">
              {penalties.map((penalty) => (
                <div key={penalty.id} className="flex items-center gap-2.5 px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white/90 truncate">
                      {penalty.user?.name || 'Unknown Member'}
                    </p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate mt-0.5">
                      {penalty.reason} · {new Date(penalty.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white/90 tabular-nums">
                      ETB {penalty.amount.toLocaleString()}
                    </p>
                    <StatusBadge
                      status={penalty.status === 'PAID' ? 'verified' : penalty.status === 'WAIVED' ? 'pending' : 'rejected'}
                    >
                      {penalty.status}
                    </StatusBadge>
                  </div>
                  {penalty.status === 'PENDING' && (
                    <div className="flex flex-col gap-1 shrink-0">
                      <Button size="sm" onClick={() => handlePayPenalty(penalty.id)}>Paid</Button>
                      <Button size="sm" variant="secondary" onClick={() => handleWaivePenalty(penalty.id)}>Waive</Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-white/[0.04] border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th className="table-header">Member</th>
                  <th className="table-header">Reason</th>
                  <th className="table-header text-right">Amount (ETB)</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Date</th>
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {penalties.map((penalty) => (
                  <tr key={penalty.id} className="hover:bg-gray-50/30 transition-colors">
                    <td className="table-cell font-medium text-gray-900 dark:text-white/90">
                      {penalty.user?.name || 'Unknown Member'}
                    </td>
                    <td className="table-cell text-gray-500 dark:text-gray-400 max-w-xs truncate" title={penalty.reason}>
                      {penalty.reason}
                    </td>
                    <td className="table-cell text-right font-semibold text-gray-900 dark:text-white/90">
                      {penalty.amount.toLocaleString()}
                    </td>
                    <td className="table-cell">
                      <StatusBadge
                        status={
                          penalty.status === 'PAID'
                            ? 'verified'
                            : penalty.status === 'WAIVED'
                            ? 'pending'
                            : 'rejected'
                        }
                      >
                        {penalty.status}
                      </StatusBadge>
                    </td>
                    <td className="table-cell text-gray-500 dark:text-gray-400 text-sm">
                      {new Date(penalty.createdAt).toLocaleDateString()}
                    </td>
                    <td className="table-cell text-right">
                      {penalty.status === 'PENDING' && (
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" variant="default" onClick={() => handlePayPenalty(penalty.id)}>
                            Mark Paid
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => handleWaivePenalty(penalty.id)}>
                            Waive
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <Ban className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400 text-sm">No penalties recorded for this group.</p>
          </div>
        )}
      </div>

      {/* Receipt Preview Modal */}
      {previewDeposit && (
        <Modal isOpen={!!previewDeposit} onClose={() => { setPreviewDeposit(null); setRejectReason(''); }} title="Deposit Details">
          <div className="space-y-4">
            {previewDeposit.receiptUrl && (
              <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-white/[0.04]">
                <img src={getMediaUrl(previewDeposit.receiptUrl)} alt="Receipt" className="w-full max-h-64 object-contain" />
              </div>
            )}

            <div className="flex items-center justify-between">
              <StatusBadge status={previewDeposit.status} />
              {previewDeposit.isLate && (
                <span className="text-xs bg-orange-100 text-orange-700 dark:text-orange-400 px-2 py-1 rounded-full font-medium flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Late payment
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                { label: 'Member', value: previewDeposit.memberName },
                { label: 'Cycle', value: previewDeposit.cycleNumber ? `Cycle ${previewDeposit.cycleNumber}` : '—' },
                { label: 'Amount', value: `ETB ${previewDeposit.amount.toLocaleString()}` },
                { label: 'Bank', value: previewDeposit.bankName || '—' },
                { label: 'FT Reference', value: previewDeposit.ftNumber || '—' },
                { label: 'Transfer Date', value: previewDeposit.transferDate },
                { label: 'Sender Name', value: previewDeposit.senderName || '—' },
                { label: 'Sender Account', value: previewDeposit.senderAccount || '—' },
                { label: 'Branch', value: previewDeposit.branch || '—' },
                { label: 'Submitted', value: previewDeposit.date },
                ...(previewDeposit.confidence != null ? [{ label: 'OCR Confidence', value: `${(previewDeposit.confidence * 100).toFixed(0)}%` }] : []),
                ...(previewDeposit.narrative ? [{ label: 'Method', value: previewDeposit.narrative }] : []),
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-50 dark:bg-white/[0.04] rounded-lg p-2.5">
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">{label}</p>
                  <p className="font-medium text-gray-800 dark:text-white/90 break-all">{value}</p>
                </div>
              ))}
            </div>

            {previewDeposit.status === 'rejected' && previewDeposit.rejectionReason && (
              <div className="bg-red-50 dark:bg-error-500/10 border border-red-100 rounded-lg p-3 text-sm text-red-700 dark:text-error-400">
                <p className="font-medium mb-0.5">Rejection Reason</p>
                <p>{previewDeposit.rejectionReason}</p>
              </div>
            )}

            {previewDeposit.status === 'pending' && (
              <div className="border-t border-blue-100 pt-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 -mx-1 mt-2">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center">
                    <Zap className="h-3 w-3 text-white" />
                  </div>
                  <h4 className="text-sm font-bold text-blue-900">CBE Auto-Verification</h4>
                </div>
                <AutoVerifyButton
                  depositId={previewDeposit.id}
                  ftNumber={previewDeposit.ftNumber}
                  groupId={groupId}
                  cbeAccountNumbers={groupCbeAccounts}
                  expectedAmount={previewDeposit.amount}
                  onVerified={() => {
                    setDeposits((prev) =>
                      prev.map((d) => d.id === previewDeposit.id ? { ...d, status: 'verified' as const, autoVerified: true } : d)
                    );
                    setPreviewDeposit({ ...previewDeposit, status: 'verified' });
                    notifySuccess('✅ Deposit auto-verified via CBE Direct!');
                  }}
                  onAutoVerifyFn={autoVerifyDepositCbe}
                  onManualVerify={() => handleVerify(previewDeposit.id)}
                  onManualReject={() => handleReject(previewDeposit.id)}
                  canManage={canManageDeposits}
                />
              </div>
            )}

            {previewDeposit.status === 'pending' && !canManageDeposits && (
              <div className="border-t border-gray-100 dark:border-gray-800 pt-4 space-y-3">
                <Button
                  onClick={() => handleVerify(previewDeposit.id)}
                  loading={verifyingDepositId === previewDeposit.id}
                  className="w-full"
                >
                  <CheckCircle className="h-4 w-4 mr-2" /> Verify Deposit
                </Button>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Rejection reason (optional)…"
                    className="input-field text-sm w-full"
                  />
                  <Button
                    variant="danger"
                    onClick={() => handleReject(previewDeposit.id, rejectReason || undefined)}
                    loading={rejectingDepositId === previewDeposit.id}
                    className="w-full"
                  >
                    <XCircle className="h-4 w-4 mr-2" /> Reject Deposit
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
