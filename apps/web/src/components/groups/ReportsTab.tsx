'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { Printer, Loader2, FileText, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getGroupDeposits, getGroupMemberDues } from '@/lib/api';
import type { DepositItem, GroupDetail, MemberDueCalculation } from '@/lib/api';

type ReportScope = 'cycle' | 'monthly' | 'alltime';

interface ReportsTabProps {
  groupId: string;
  group: GroupDetail;
}

interface MemberDeps {
  memberName: string;
  expected: number;
  paidVerified: number;
  paidPending: number;
  deposits: DepositItem[];
}

const esc = (s: unknown): string =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const fmt = (n: number): string => `ETB ${Math.round(n * 100) / 100}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const statusChip = (status: string): string => {
  const map: Record<string, string> = {
    verified: '<span class="ok">Verified</span>',
    pending: '<span class="warn">Pending</span>',
    rejected: '<span class="bad">Rejected</span>',
  };
  return map[status] ?? esc(status);
};

/** Authorized-payers report tab: cycle coverage, monthly ledger, all-time totals. */
export default function ReportsTab({ groupId, group }: ReportsTabProps) {
  const [scope, setScope] = useState<ReportScope>('cycle');
  const [cycleNumber, setCycleNumber] = useState<number | null>(null);
  const [month, setMonth] = useState<string>('');
  const [deposits, setDeposits] = useState<DepositItem[]>([]);
  const [dues, setDues] = useState<MemberDueCalculation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([getGroupDeposits(groupId), getGroupMemberDues(groupId)])
      .then(([deps, d]) => {
        if (cancelled) return;
        setDeposits(deps);
        setDues(d);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load report data');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [groupId, group.membersCount]);

  const cycles = useMemo(
    () => [...(group.cycles ?? [])].sort((a, b) => a.cycleNumber - b.cycleNumber),
    [group.cycles],
  );

  const latestCycle = cycles.length ? cycles[cycles.length - 1].cycleNumber : null;

  useEffect(() => {
    if (cycleNumber === null && latestCycle !== null) setCycleNumber(latestCycle);
  }, [latestCycle, cycleNumber]);

  const months = useMemo(() => {
    const keys = new Set<string>();
    for (const d of deposits) {
      const src = d.transferDate && d.transferDate !== 'N/A' ? d.transferDate : d.date;
      if (src && src.length >= 7) keys.add(src.slice(0, 7));
    }
    return [...keys].sort().reverse();
  }, [deposits]);

  useEffect(() => {
    if (!month && months.length) setMonth(months[0]);
  }, [months, month]);

  const activeMembers = group.members;
  const duesByUserId = useMemo(() => {
    const m = new Map<string, MemberDueCalculation>();
    for (const d of dues) m.set(d.userId, d);
    return m;
  }, [dues]);

  const cyclesSoFar = Math.max(cycles.length, 1);

  const contribution = group.contributionAmount;

  // ─── Cycle report model ─────────────────────────────────────────────────────
  const cycleRows = useMemo(() => {
    if (scope !== 'cycle' || cycleNumber === null) return [];
    const rows: {
      name: string;
      expected: number;
      verified: number;
      pending: number;
      rejected: number;
      status: 'PAID' | 'PARTIAL' | 'UNPAID';
      count: number;
    }[] = [];
    for (const m of activeMembers) {
      const expected = duesByUserId.get(m.id)?.contributionDue ?? contribution;
      const inCycle = deposits.filter(
        (d) => d.userId === m.id && d.cycleNumber === cycleNumber && d.status !== 'rejected',
      );
      const verified = inCycle.filter((d) => d.status === 'verified').reduce((s, d) => s + (d.amount || 0), 0);
      const pending = inCycle.filter((d) => d.status === 'pending').reduce((s, d) => s + (d.amount || 0), 0);
      const paid = verified + pending;
      const status: 'PAID' | 'PARTIAL' | 'UNPAID' =
        paid >= expected - 1 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'UNPAID';
      rows.push({
        name: m.name,
        expected,
        verified,
        pending,
        rejected: 0,
        status,
        count: inCycle.length,
      });
    }
    // Former members / others with deposits in this cycle
    for (const d of deposits.filter(
      (x) => x.cycleNumber === cycleNumber && !activeMembers.some((m) => m.id === x.userId),
    )) {
      const existing = rows.find((r) => r.name === `(former) ${d.memberName}`);
      if (existing) {
        existing.verified += d.status === 'verified' ? d.amount || 0 : 0;
        existing.pending += d.status === 'pending' ? d.amount || 0 : 0;
      } else {
        rows.push({
          name: `(former) ${d.memberName}`,
          expected: 0,
          verified: d.status === 'verified' ? d.amount || 0 : 0,
          pending: d.status === 'pending' ? d.amount || 0 : 0,
          rejected: 0,
          status: 'PAID',
          count: 1,
        });
      }
    }
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }, [scope, cycleNumber, activeMembers, deposits, duesByUserId, contribution]);

  // ─── Monthly report model ───────────────────────────────────────────────────
  const monthRows = useMemo(() => {
    if (scope !== 'monthly' || !month) return [];
    return deposits
      .filter((d) => {
        const src = d.transferDate && d.transferDate !== 'N/A' ? d.transferDate : d.date;
        return src && src.slice(0, 7) === month;
      })
      .sort((a, b) => String(a.transferDate || a.date).localeCompare(String(b.transferDate || b.date)));
  }, [scope, month, deposits]);

  const monthByMember = useMemo(() => {
    const m = new Map<string, { verified: number; pending: number; count: number }>();
    for (const d of monthRows) {
      if (d.status === 'rejected') continue;
      const e = m.get(d.memberName) ?? { verified: 0, pending: 0, count: 0 };
      if (d.status === 'verified') e.verified += d.amount || 0;
      else if (d.status === 'pending') e.pending += d.amount || 0;
      e.count++;
      m.set(d.memberName, e);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [monthRows]);

  // ─── Since-start report model ───────────────────────────────────────────────
  const allTimeRows = useMemo(() => {
    if (scope !== 'alltime') return [];
    const rows: {
      userId: string;
      name: string;
      shares: number;
      totalPaid: number;
      verified: number;
      pending: number;
      expectedToDate: number;
      balance: number;
      status: 'AHEAD' | 'SETTLED' | 'OWES';
    }[] = [];
    for (const m of activeMembers) {
      const mine = deposits.filter((d) => d.userId === m.id && d.status !== 'rejected');
      const verified = mine.filter((d) => d.status === 'verified').reduce((s, d) => s + (d.amount || 0), 0);
      const pending = mine.filter((d) => d.status === 'pending').reduce((s, d) => s + (d.amount || 0), 0);
      const totalPaid = verified + pending;
      const expectedToDate = contribution * cyclesSoFar;
      const balance = expectedToDate - totalPaid;
      rows.push({
        userId: m.id,
        name: m.name,
        shares: duesByUserId.get(m.id)?.shares ?? 1,
        totalPaid,
        verified,
        pending,
        expectedToDate,
        balance,
        status: balance < -1 ? 'AHEAD' : balance <= 1 ? 'SETTLED' : 'OWES',
      });
    }
    return rows.sort((a, b) => b.totalPaid - a.totalPaid || a.name.localeCompare(b.name));
  }, [scope, activeMembers, deposits, contribution, cyclesSoFar, duesByUserId]);

  // ─── Print ──────────────────────────────────────────────────────────────────
  const printReport = () => {
    const today = new Date().toLocaleString();
    let rowsHtml = '';
    let totalsHtml = '';
    let title = '';
    let subtitle = '';

    if (scope === 'cycle' && cycleNumber !== null) {
      title = `Cycle ${cycleNumber} Contribution Report`;
      subtitle = `${group.name} — expected ETB ${contribution.toLocaleString()} per member per cycle`;
      const totExp = cycleRows.reduce((s, r) => s + r.expected, 0);
      const totVer = cycleRows.reduce((s, r) => s + r.verified, 0);
      const totPen = cycleRows.reduce((s, r) => s + r.pending, 0);
      rowsHtml = cycleRows
        .map(
          (r) =>
            `<tr><td>${esc(r.name)}</td><td class="num">${r.expected.toLocaleString()}</td><td class="num">${r.verified.toLocaleString()}</td><td class="num">${r.pending ? r.pending.toLocaleString() : '—'}</td><td>${r.status}</td></tr>`,
        )
        .join('');
      totalsHtml = `<tr class="totals"><td>Total (${cycleRows.length} members)</td><td class="num">${totExp.toLocaleString()}</td><td class="num">${totVer.toLocaleString()}</td><td class="num">${totPen ? totPen.toLocaleString() : '—'}</td><td></td></tr>`;
    } else if (scope === 'monthly' && month) {
      title = `Payment Report — ${month}`;
      subtitle = `${group.name} — all recorded transactions in ${month}`;
      const total = monthRows.filter((d) => d.status !== 'rejected').reduce((s, d) => s + (d.amount || 0), 0);
      rowsHtml = monthRows
        .map(
          (d) =>
            `<tr><td>${esc(d.transferDate || d.date)}</td><td>${esc(d.memberName)}</td><td>${esc(d.ftNumber || '—')}</td><td>${esc(d.narrative || d.bankName || '—')}</td><td>${statusChip(d.status)}</td><td class="num">${(d.amount || 0).toLocaleString()}</td></tr>`,
        )
        .join('');
      totalsHtml = `<tr class="totals"><td colspan="5">Total — ${monthRows.length} transaction(s), ${monthByMember.length} member(s)</td><td class="num">${total.toLocaleString()}</td></tr>`;
    } else {
      title = 'All-Time Contribution Summary (Since Start)';
      subtitle = `${group.name} — ${cyclesSoFar} cycle(s) so far, ETB ${contribution.toLocaleString()} per member per cycle`;
      const totPaid = allTimeRows.reduce((s, r) => s + r.totalPaid, 0);
      const totExp = allTimeRows.reduce((s, r) => s + r.expectedToDate, 0);
      rowsHtml = allTimeRows
        .map(
          (r) =>
            `<tr><td>${esc(r.name)}</td><td class="num">${r.shares}</td><td class="num">${r.totalPaid.toLocaleString()}</td><td class="num">${r.expectedToDate.toLocaleString()}</td><td class="num">${r.balance.toLocaleString()}</td><td>${r.status}</td></tr>`,
        )
        .join('');
      totalsHtml = `<tr class="totals"><td>Total (${allTimeRows.length} members)</td><td></td><td class="num">${totPaid.toLocaleString()}</td><td class="num">${totExp.toLocaleString()}</td><td class="num">${(totPaid - totExp).toLocaleString()}</td><td></td></tr>`;
    }

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)} — ${esc(group.name)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #111; margin: 28px 34px; }
  .head { border-bottom: 3px solid #465fff; padding-bottom: 12px; margin-bottom: 6px; }
  .head h1 { margin: 0; font-size: 22px; color: #1a2231; }
  .head .sub { color: #555; font-size: 13px; margin-top: 4px; }
  .meta { display: flex; justify-content: space-between; font-size: 11px; color: #777; margin: 8px 0 18px; }
  h2 { font-size: 15px; margin: 18px 0 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #d9dce3; padding: 6px 9px; text-align: left; }
  th { background: #f0f2f7; font-size: 11px; text-transform: uppercase; letter-spacing: .3px; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  tr.totals td { font-weight: 700; background: #f6f7fb; border-top: 2px solid #465fff; }
  .ok { color: #127a3d; font-weight: 600; }
  .warn { color: #9a6700; font-weight: 600; }
  .bad { color: #b42318; font-weight: 600; }
  .foot { margin-top: 26px; font-size: 10px; color: #999; border-top: 1px solid #e3e3e3; padding-top: 8px;
          display: flex; justify-content: space-between; }
  @page { size: A4; margin: 14mm; }
</style></head><body>
<div class="head"><h1>${esc(group.name)}</h1><div class="sub">${esc(title)}</div></div>
<div class="meta"><span>${esc(subtitle)}</span><span>Generated ${esc(today)}</span></div>
<table><thead><tr>${rowsHtml ? '<th>Member</th>' : ''}${scope === 'monthly' ? '<th>Date</th><th>FT Reference</th><th>Method</th><th>Status</th><th class="num">Amount (ETB)</th>' : '<th class="num">Expected (ETB)</th><th class="num">Verified (ETB)</th><th class="num">Pending (ETB)</th>' + (scope === 'alltime' ? '<th class="num">Shares</th><th class="num">Balance (ETB)</th><th>Status</th>' : '<th>Status</th>')} </tr></thead>
<tbody>${rowsHtml}${totalsHtml}</tbody></table>
<div class="foot"><span>Generated by the Equb Platform</span><span>${esc(today)}</span></div>
<script>window.onload = function () { setTimeout(function () { window.print(); }, 250); };</script>
</body></html>`;

    const w = window.open('', '_blank', 'width=1000,height=740');
    if (!w) {
      alert('Please allow pop-ups for this site to print the report.');
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
  };

  const scopes: { key: ReportScope; label: string }[] = [
    { key: 'cycle', label: 'Cycle Report' },
    { key: 'monthly', label: 'Monthly Report' },
    { key: 'alltime', label: 'Since Start' },
  ];

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 flex-wrap">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Report Type</label>
            <div className="flex bg-gray-100 dark:bg-white/[0.08] p-1 rounded-lg w-fit">
              {scopes.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setScope(s.key)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    scope === s.key
                      ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white/90 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {scope === 'cycle' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Cycle</label>
              <select
                className="input-field"
                value={cycleNumber ?? ''}
                onChange={(e) => setCycleNumber(e.target.value ? Number(e.target.value) : null)}
              >
                {cycles.length === 0 && <option value="">No cycles</option>}
                {cycles.map((c) => (
                  <option key={c.id} value={c.cycleNumber}>
                    Cycle {c.cycleNumber}{c.status === 'ACTIVE' ? ' (active)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {scope === 'monthly' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Month</label>
              <input
                type="month"
                className="input-field"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </div>
          )}

          <div className="sm:ml-auto">
            <Button onClick={printReport} disabled={loading}>
              <Printer className="h-4 w-4 mr-1" /> Print Report
            </Button>
          </div>
        </div>
      </div>

      {/* Report content */}
      {loading ? (
        <div className="card flex items-center justify-center h-40">
          <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
        </div>
      ) : error ? (
        <div className="card flex items-center gap-2 text-sm text-error-600 dark:text-error-400">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          {/* Cycle report */}
          {scope === 'cycle' && cycleNumber !== null && (
            <>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white/90 mb-1">
                Cycle {cycleNumber} Contribution Report
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                {group.name} · expected ETB {contribution.toLocaleString()} per member per cycle ·{' '}
                {cycleRows.filter((r) => r.status === 'PAID').length} paid ·{' '}
                {cycleRows.filter((r) => r.status === 'PARTIAL').length} partial ·{' '}
                {cycleRows.filter((r) => r.status === 'UNPAID').length} unpaid
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                    <th className="py-2 pr-3">Member</th>
                    <th className="py-2 px-3 text-right">Expected (ETB)</th>
                    <th className="py-2 px-3 text-right">Verified (ETB)</th>
                    <th className="py-2 px-3 text-right">Pending (ETB)</th>
                    <th className="py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {cycleRows.map((r) => (
                    <tr key={r.name} className="border-b border-gray-50 dark:border-gray-800/60">
                      <td className="py-2 pr-3 font-medium text-gray-900 dark:text-white/90">{r.name}</td>
                      <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">{r.expected.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">{r.verified.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">{r.pending.toLocaleString()}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            r.status === 'PAID'
                              ? 'bg-green-50 dark:bg-success-500/10 text-green-700 dark:text-success-400'
                              : r.status === 'PARTIAL'
                                ? 'bg-amber-50 dark:bg-warning-500/10 text-amber-700 dark:text-warning-400'
                                : 'bg-red-50 dark:bg-error-500/10 text-red-700 dark:text-error-400'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  <tr className="font-semibold border-t-2 border-gray-200 dark:border-gray-700">
                    <td className="py-2 pr-3">Total</td>
                    <td className="py-2 px-3 text-right">{cycleRows.reduce((s, r) => s + r.expected, 0).toLocaleString()}</td>
                    <td className="py-2 px-3 text-right">{cycleRows.reduce((s, r) => s + r.verified, 0).toLocaleString()}</td>
                    <td className="py-2 px-3 text-right">{cycleRows.reduce((s, r) => s + r.pending, 0).toLocaleString()}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </>
          )}

          {/* Monthly report */}
          {scope === 'monthly' && (
            <>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white/90 mb-1">
                Payment Report — {month || 'select a month'}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                {monthRows.length} transaction(s) ·{' '}
                {monthRows.filter((d) => d.status !== 'rejected').reduce((s, d) => s + (d.amount || 0), 0).toLocaleString()} ETB recorded
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 px-3">Member</th>
                    <th className="py-2 px-3">FT Reference</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3 text-right">Amount (ETB)</th>
                  </tr>
                </thead>
                <tbody>
                  {monthRows.map((d) => (
                    <tr key={d.id} className="border-b border-gray-50 dark:border-gray-800/60">
                      <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">{String(d.transferDate || d.date).slice(0, 10)}</td>
                      <td className="py-2 px-3 font-medium text-gray-900 dark:text-white/90">{d.memberName}</td>
                      <td className="py-2 px-3 font-mono text-xs text-gray-600 dark:text-gray-400">{d.ftNumber || '—'}</td>
                      <td className="py-2 px-3 capitalize text-gray-700 dark:text-gray-300">{d.status}</td>
                      <td className="py-2 px-3 text-right text-gray-900 dark:text-white/90">{(d.amount || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                  <tr className="font-semibold border-t-2 border-gray-200 dark:border-gray-700">
                    <td className="py-2 pr-3" colSpan={4}>Total</td>
                    <td className="py-2 px-3 text-right">
                      {monthRows.filter((d) => d.status !== 'rejected').reduce((s, d) => s + (d.amount || 0), 0).toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </>
          )}

          {/* Since start */}
          {scope === 'alltime' && (
            <>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white/90 mb-1">
                All-Time Contribution Summary
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                {group.name} · {cyclesSoFar} cycle(s) so far · ETB {contribution.toLocaleString()} per member per cycle ·
                balances are cumulative (negative = paid ahead)
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                    <th className="py-2 pr-3">Member</th>
                    <th className="py-2 px-3 text-right">Shares</th>
                    <th className="py-2 px-3 text-right">Total Paid (ETB)</th>
                    <th className="py-2 px-3 text-right">Expected To Date (ETB)</th>
                    <th className="py-2 px-3 text-right">Balance (ETB)</th>
                    <th className="py-2 px-3">Standing</th>
                  </tr>
                </thead>
                <tbody>
                  {allTimeRows.map((r) => (
                    <tr key={r.userId} className="border-b border-gray-50 dark:border-gray-800/60">
                      <td className="py-2 pr-3 font-medium text-gray-900 dark:text-white/90">{r.name}</td>
                      <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">{r.shares}</td>
                      <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">{r.totalPaid.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">{r.expectedToDate.toLocaleString()}</td>
                      <td className={`py-2 px-3 text-right font-medium ${r.balance > 1 ? 'text-error-600 dark:text-error-400' : r.balance < -1 ? 'text-green-700 dark:text-success-400' : 'text-gray-700 dark:text-gray-300'}`}>
                        {r.balance.toLocaleString()}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            r.status === 'AHEAD'
                              ? 'bg-green-50 dark:bg-success-500/10 text-green-700 dark:text-success-400'
                              : r.status === 'SETTLED'
                                ? 'bg-gray-100 dark:bg-white/[0.06] text-gray-600 dark:text-gray-300'
                                : 'bg-red-50 dark:bg-error-500/10 text-red-700 dark:text-error-400'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  <tr className="font-semibold border-t-2 border-gray-200 dark:border-gray-700">
                    <td className="py-2 pr-3">Total</td>
                    <td />
                    <td className="py-2 px-3 text-right">{allTimeRows.reduce((s, r) => s + r.totalPaid, 0).toLocaleString()}</td>
                    <td className="py-2 px-3 text-right">{allTimeRows.reduce((s, r) => s + r.expectedToDate, 0).toLocaleString()}</td>
                    <td className="py-2 px-3 text-right">
                      {(allTimeRows.reduce((s, r) => s + r.totalPaid, 0) - allTimeRows.reduce((s, r) => s + r.expectedToDate, 0)).toLocaleString()}
                    </td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  );
}
