'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { Printer, Loader2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getGroupDeposits, getGroupMemberDues } from '@/lib/api';
import type { DepositItem, GroupDetail, MemberDueCalculation } from '@/lib/api';

type ReportScope = 'cycle' | 'monthly' | 'alltime';

interface ReportsTabProps {
  groupId: string;
  group: GroupDetail;
}

interface CoverageRow {
  name: string;
  expected: number;
  verified: number;
  pending: number;
  count: number;
  status: 'PAID' | 'PARTIAL' | 'UNPAID';
}

const esc = (s: unknown): string =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const statusPill = (status: string): string =>
  status === 'PAID' || status === 'AHEAD'
    ? 'bg-green-50 dark:bg-success-500/10 text-green-700 dark:text-success-400'
    : status === 'PARTIAL'
      ? 'bg-amber-50 dark:bg-warning-500/10 text-amber-700 dark:text-warning-400'
      : status === 'SETTLED'
        ? 'bg-gray-100 dark:bg-white/[0.06] text-gray-600 dark:text-gray-300'
        : 'bg-red-50 dark:bg-error-500/10 text-red-700 dark:text-error-400';

/** Compact contribution reports: cycle coverage, monthly coverage + ledger, all-time balances. */
export default function ReportsTab({ groupId, group }: ReportsTabProps) {
  const [scope, setScope] = useState<ReportScope>('cycle');
  const [cycleNumber, setCycleNumber] = useState<number | null>(null);
  const [month, setMonth] = useState<string>('');
  const [deposits, setDeposits] = useState<DepositItem[]>([]);
  const [dues, setDues] = useState<MemberDueCalculation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);

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

  const contribution = group.contributionAmount;
  const activeMembers = group.members;
  const cyclesSoFar = Math.max(cycles.length, 1);

  const duesByUserId = useMemo(() => {
    const m = new Map<string, MemberDueCalculation>();
    for (const d of dues) m.set(d.userId, d);
    return m;
  }, [dues]);

  /** Month key for a deposit: transfer date, recorded date, then created date. */
  const monthKeyOf = (d: DepositItem): string => {
    const src = d.transferDate && d.transferDate !== 'N/A' ? d.transferDate : d.date;
    if (src && src.length >= 7 && src !== 'N/A') return src.slice(0, 7);
    return (d.createdAt || '').slice(0, 7);
  };

  const months = useMemo(() => {
    const keys = new Set<string>();
    for (const d of deposits) {
      const k = monthKeyOf(d);
      if (k) keys.add(k);
    }
    if (keys.size === 0) keys.add(new Date().toISOString().slice(0, 7));
    return [...keys].sort().reverse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deposits]);

  useEffect(() => {
    // Wait for the real deposits before locking in a default — seeding from an
    // empty list would freeze on the calendar month and never revisit it.
    if (loading) return;
    if (!month && months.length) {
      // Default to the latest month that actually has recorded payments.
      setMonth(months.find((m) => deposits.some((d) => monthKeyOf(d) === m)) || months[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, months, month, deposits]);

  // ─── Models ─────────────────────────────────────────────────────────────────
  /** Per-member coverage (expected vs paid) for all active members + former
   *  members with activity in the period. Used by cycle and monthly scopes. */
  const buildCoverage = (inPeriod: (d: DepositItem) => boolean): CoverageRow[] => {
    const rows: CoverageRow[] = [];
    for (const m of activeMembers) {
      const expected = duesByUserId.get(m.id)?.contributionDue ?? contribution;
      const mine = deposits.filter((d) => d.userId === m.id && d.status !== 'rejected' && inPeriod(d));
      const verified = mine.filter((d) => d.status === 'verified').reduce((s, d) => s + (d.amount || 0), 0);
      const pending = mine.filter((d) => d.status === 'pending').reduce((s, d) => s + (d.amount || 0), 0);
      const paid = verified + pending;
      rows.push({
        name: m.name,
        expected,
        verified,
        pending,
        count: mine.length,
        status: paid >= expected - 1 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'UNPAID',
      });
    }
    for (const d of deposits.filter((x) => x.status !== 'rejected' && !activeMembers.some((m) => m.id === x.userId) && inPeriod(x))) {
      const name = `(former) ${d.memberName}`;
      const e = rows.find((r) => r.name === name);
      if (e) {
        if (d.status === 'verified') e.verified += d.amount || 0;
        else if (d.status === 'pending') e.pending += d.amount || 0;
        e.count++;
        continue;
      }
      rows.push({
        name,
        expected: 0,
        verified: d.status === 'verified' ? d.amount || 0 : 0,
        pending: d.status === 'pending' ? d.amount || 0 : 0,
        count: 1,
        status: 'PAID',
      });
    }
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  };

  const cycleRows = useMemo(
    () => (scope === 'cycle' && cycleNumber !== null ? buildCoverage((d) => d.cycleNumber === cycleNumber) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scope, cycleNumber, activeMembers, deposits, duesByUserId, contribution],
  );

  const monthMemberRows = useMemo(
    () => (scope === 'monthly' && month ? buildCoverage((d) => monthKeyOf(d) === month) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scope, month, activeMembers, deposits, duesByUserId, contribution],
  );

  const monthRows = useMemo(
    () =>
      scope === 'monthly' && month
        ? deposits
            .filter((d) => monthKeyOf(d) === month)
            .sort((a, b) => String(a.transferDate || a.date).localeCompare(String(b.transferDate || b.date)))
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scope, month, deposits],
  );

  const allTimeRows = useMemo(() => {
    if (scope !== 'alltime') return [];
    const rows: {
      userId: string;
      name: string;
      shares: number;
      totalPaid: number;
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
        expectedToDate,
        balance,
        status: balance < -1 ? 'AHEAD' : balance <= 1 ? 'SETTLED' : 'OWES',
      });
    }
    return rows.sort((a, b) => b.totalPaid - a.totalPaid || a.name.localeCompare(b.name));
  }, [scope, activeMembers, deposits, contribution, cyclesSoFar, duesByUserId]);

  // Summary figures for the chips row (per active scope)
  const summary = useMemo(() => {
    if (scope === 'alltime') {
      const paid = allTimeRows.reduce((s, r) => s + r.totalPaid, 0);
      const expected = allTimeRows.reduce((s, r) => s + r.expectedToDate, 0);
      return {
        expected,
        collected: paid,
        pending: 0,
        good: allTimeRows.filter((r) => r.status !== 'OWES').length,
        partial: 0,
        bad: allTimeRows.filter((r) => r.status === 'OWES').length,
        goodLabel: 'settled/ahead',
        badLabel: 'owing',
      };
    }
    const rows = scope === 'cycle' ? cycleRows : monthMemberRows;
    return {
      expected: rows.reduce((s, r) => s + r.expected, 0),
      collected: rows.reduce((s, r) => s + r.verified, 0),
      pending: rows.reduce((s, r) => s + r.pending, 0),
      good: rows.filter((r) => r.status === 'PAID').length,
      partial: rows.filter((r) => r.status === 'PARTIAL').length,
      bad: rows.filter((r) => r.status === 'UNPAID').length,
      goodLabel: 'paid',
      badLabel: 'unpaid',
    };
  }, [scope, cycleRows, monthMemberRows, allTimeRows]);

  const coverage = scope === 'cycle' ? cycleRows : scope === 'monthly' ? monthMemberRows : null;

  // ─── Print ──────────────────────────────────────────────────────────────────
  const printReport = () => {
    const today = new Date().toLocaleString();
    let title = '';
    let subtitle = '';
    let headHtml = '';
    let rowsHtml = '';
    let totalsHtml = '';

    if (scope === 'alltime') {
      title = 'All-Time Contribution Summary (Since Start)';
      subtitle = `${group.name} — ${cyclesSoFar} cycle(s) so far, ETB ${contribution.toLocaleString()} per member per cycle`;
      headHtml =
        '<th>Member</th><th class="num">Shares</th><th class="num">Paid (ETB)</th><th class="num">Expected To Date (ETB)</th><th class="num">Balance (ETB)</th><th>Standing</th>';
      const totPaid = allTimeRows.reduce((s, r) => s + r.totalPaid, 0);
      const totExp = allTimeRows.reduce((s, r) => s + r.expectedToDate, 0);
      rowsHtml = allTimeRows
        .map(
          (r) =>
            `<tr><td>${esc(r.name)}</td><td class="num">${r.shares}</td><td class="num">${r.totalPaid.toLocaleString()}</td><td class="num">${r.expectedToDate.toLocaleString()}</td><td class="num">${r.balance.toLocaleString()}</td><td>${r.status}</td></tr>`,
        )
        .join('');
      totalsHtml = `<tr class="totals"><td>Total (${allTimeRows.length} members)</td><td></td><td class="num">${totPaid.toLocaleString()}</td><td class="num">${totExp.toLocaleString()}</td><td class="num">${(totPaid - totExp).toLocaleString()}</td><td></td></tr>`;
    } else {
      title = scope === 'cycle' ? `Cycle ${cycleNumber} Contribution Report` : `Monthly Payment Coverage — ${month}`;
      subtitle = `${group.name} — expected ETB ${contribution.toLocaleString()} per member per cycle`;
      headHtml =
        '<th>Member</th><th class="num">Expected (ETB)</th><th class="num">Verified (ETB)</th><th class="num">Pending (ETB)</th><th class="num">#</th><th>Status</th>';
      const rows = coverage ?? [];
      const totExp = rows.reduce((s, r) => s + r.expected, 0);
      const totVer = rows.reduce((s, r) => s + r.verified, 0);
      const totPen = rows.reduce((s, r) => s + r.pending, 0);
      const totCnt = rows.reduce((s, r) => s + r.count, 0);
      rowsHtml = rows
        .map(
          (r) =>
            `<tr><td>${esc(r.name)}</td><td class="num">${r.expected.toLocaleString()}</td><td class="num">${r.verified.toLocaleString()}</td><td class="num">${r.pending ? r.pending.toLocaleString() : '—'}</td><td class="num">${r.count}</td><td>${r.status}</td></tr>`,
        )
        .join('');
      totalsHtml = `<tr class="totals"><td>Total (${rows.length} members)</td><td class="num">${totExp.toLocaleString()}</td><td class="num">${totVer.toLocaleString()}</td><td class="num">${totPen ? totPen.toLocaleString() : '—'}</td><td class="num">${totCnt}</td><td></td></tr>`;
    }

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)} — ${esc(group.name)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #111; margin: 28px 34px; }
  .head { border-bottom: 3px solid #465fff; padding-bottom: 12px; margin-bottom: 6px; }
  .head h1 { margin: 0; font-size: 22px; color: #1a2231; }
  .head .sub { color: #555; font-size: 13px; margin-top: 4px; }
  .meta { display: flex; justify-content: space-between; font-size: 11px; color: #777; margin: 8px 0 18px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #d9dce3; padding: 6px 9px; text-align: left; }
  th { background: #f0f2f7; font-size: 11px; text-transform: uppercase; letter-spacing: .3px; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  tr.totals td { font-weight: 700; background: #f6f7fb; border-top: 2px solid #465fff; }
  .foot { margin-top: 26px; font-size: 10px; color: #999; border-top: 1px solid #e3e3e3; padding-top: 8px;
          display: flex; justify-content: space-between; }
  @page { size: A4; margin: 14mm; }
</style></head><body>
<div class="head"><h1>${esc(group.name)}</h1><div class="sub">${esc(title)}</div></div>
<div class="meta"><span>${esc(subtitle)}</span><span>Generated ${esc(today)}</span></div>
<table><thead><tr>${headHtml}</tr></thead>
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
    { key: 'cycle', label: 'Cycle' },
    { key: 'monthly', label: 'Monthly' },
    { key: 'alltime', label: 'Since Start' },
  ];

  const chip =
    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-white/[0.04] text-gray-600 dark:text-gray-300';

  return (
    <div className="space-y-3">
      {/* Compact toolbar: type + period + print in one row */}
      <div className="card !py-2.5 !px-3 flex flex-wrap items-center gap-2">
        <div className="flex bg-gray-100 dark:bg-white/[0.08] p-0.5 rounded-lg">
          {scopes.map((s) => (
            <button
              key={s.key}
              onClick={() => setScope(s.key)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                scope === s.key
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white/90 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {scope === 'cycle' && (
          <select
            className="input-field !w-auto !py-1 !text-xs"
            value={cycleNumber ?? ''}
            onChange={(e) => setCycleNumber(e.target.value ? Number(e.target.value) : null)}
          >
            {cycles.length === 0 && <option value="">No cycles</option>}
            {cycles.map((c) => (
              <option key={c.id} value={c.cycleNumber}>
                Cycle {c.cycleNumber}
                {c.status === 'ACTIVE' ? ' (active)' : ''}
              </option>
            ))}
          </select>
        )}

        {scope === 'monthly' && (
          <input
            type="month"
            className="input-field !w-auto !py-1 !text-xs"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        )}

        <div className="ml-auto">
          <Button size="sm" variant="secondary" onClick={printReport} disabled={loading}>
            <Printer className="h-3.5 w-3.5 mr-1" /> Print
          </Button>
        </div>
      </div>

      {/* One-line summary */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={chip}>
          Expected <b className="tabular-nums">ETB {summary.expected.toLocaleString()}</b>
        </span>
        <span className={chip}>
          Collected{' '}
          <b className="tabular-nums text-green-700 dark:text-success-400">ETB {summary.collected.toLocaleString()}</b>
        </span>
        {summary.pending > 0 && (
          <span className={chip}>
            Pending{' '}
            <b className="tabular-nums text-amber-700 dark:text-warning-400">ETB {summary.pending.toLocaleString()}</b>
          </span>
        )}
        <span className={`${chip} !bg-green-50 dark:!bg-success-500/10 !border-green-100 dark:!border-success-500/20 !text-green-700 dark:!text-success-400`}>
          {summary.good} {summary.goodLabel}
        </span>
        {summary.partial > 0 && (
          <span className={`${chip} !bg-amber-50 dark:!bg-warning-500/10 !border-amber-100 dark:!border-warning-500/20 !text-amber-700 dark:!text-warning-400`}>
            {summary.partial} partial
          </span>
        )}
        {summary.bad > 0 && (
          <span className={`${chip} !bg-red-50 dark:!bg-error-500/10 !border-red-100 dark:!border-error-500/20 !text-red-700 dark:!text-error-400`}>
            {summary.bad} {summary.badLabel}
          </span>
        )}
      </div>

      {/* Dense, scrollable table — stays a fixed height so it never sprawls */}
      {loading ? (
        <div className="card flex items-center justify-center h-28">
          <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
        </div>
      ) : error ? (
        <div className="card !py-3 flex items-center gap-2 text-sm text-error-600 dark:text-error-400">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      ) : (
        <div className="card !p-0 overflow-hidden">
          <div className="overflow-auto max-h-[52vh]">
            <table className="w-full text-[13px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-50 dark:bg-gray-900 text-left text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <th className="py-1.5 px-3 font-semibold">Member</th>
                  {scope === 'alltime' ? (
                    <>
                      <th className="py-1.5 px-3 text-right font-semibold">Shares</th>
                      <th className="py-1.5 px-3 text-right font-semibold">Paid (ETB)</th>
                      <th className="py-1.5 px-3 text-right font-semibold">Expected (ETB)</th>
                      <th className="py-1.5 px-3 text-right font-semibold">Balance (ETB)</th>
                      <th className="py-1.5 px-3 font-semibold">Standing</th>
                    </>
                  ) : (
                    <>
                      <th className="py-1.5 px-3 text-right font-semibold">Expected</th>
                      <th className="py-1.5 px-3 text-right font-semibold">Verified</th>
                      <th className="py-1.5 px-3 text-right font-semibold">Pending</th>
                      <th className="py-1.5 px-3 text-right font-semibold">#</th>
                      <th className="py-1.5 px-3 font-semibold">Status</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {scope === 'alltime'
                  ? allTimeRows.map((r) => (
                      <tr
                        key={r.userId}
                        className="border-t border-gray-50 dark:border-gray-800/60 hover:bg-gray-50/60 dark:hover:bg-white/[0.02]"
                      >
                        <td className="py-1.5 px-3 font-medium text-gray-900 dark:text-white/90">{r.name}</td>
                        <td className="py-1.5 px-3 text-right tabular-nums text-gray-700 dark:text-gray-300">{r.shares}</td>
                        <td className="py-1.5 px-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                          {r.totalPaid.toLocaleString()}
                        </td>
                        <td className="py-1.5 px-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                          {r.expectedToDate.toLocaleString()}
                        </td>
                        <td
                          className={`py-1.5 px-3 text-right tabular-nums font-medium ${
                            r.balance > 1
                              ? 'text-error-600 dark:text-error-400'
                              : r.balance < -1
                                ? 'text-green-700 dark:text-success-400'
                                : 'text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {r.balance.toLocaleString()}
                        </td>
                        <td className="py-1.5 px-3">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${statusPill(r.status)}`}>
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  : (coverage ?? []).map((r) => (
                      <tr
                        key={r.name}
                        className="border-t border-gray-50 dark:border-gray-800/60 hover:bg-gray-50/60 dark:hover:bg-white/[0.02]"
                      >
                        <td className="py-1.5 px-3 font-medium text-gray-900 dark:text-white/90">{r.name}</td>
                        <td className="py-1.5 px-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                          {r.expected.toLocaleString()}
                        </td>
                        <td className="py-1.5 px-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                          {r.verified.toLocaleString()}
                        </td>
                        <td className="py-1.5 px-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                          {r.pending.toLocaleString()}
                        </td>
                        <td className="py-1.5 px-3 text-right tabular-nums text-gray-500 dark:text-gray-400">{r.count}</td>
                        <td className="py-1.5 px-3">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${statusPill(r.status)}`}>
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                <tr className="border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-white/[0.02] font-semibold">
                  <td className="py-1.5 px-3">
                    Total{' '}
                    <span className="font-normal text-gray-500 dark:text-gray-400">
                      ({(scope === 'alltime' ? allTimeRows.length : coverage?.length ?? 0)} members)
                    </span>
                  </td>
                  {scope === 'alltime' ? (
                    <>
                      <td />
                      <td className="py-1.5 px-3 text-right tabular-nums">
                        {allTimeRows.reduce((s, r) => s + r.totalPaid, 0).toLocaleString()}
                      </td>
                      <td className="py-1.5 px-3 text-right tabular-nums">
                        {allTimeRows.reduce((s, r) => s + r.expectedToDate, 0).toLocaleString()}
                      </td>
                      <td className="py-1.5 px-3 text-right tabular-nums">
                        {(
                          allTimeRows.reduce((s, r) => s + r.totalPaid, 0) -
                          allTimeRows.reduce((s, r) => s + r.expectedToDate, 0)
                        ).toLocaleString()}
                      </td>
                      <td />
                    </>
                  ) : (
                    <>
                      <td className="py-1.5 px-3 text-right tabular-nums">{summary.expected.toLocaleString()}</td>
                      <td className="py-1.5 px-3 text-right tabular-nums">{summary.collected.toLocaleString()}</td>
                      <td className="py-1.5 px-3 text-right tabular-nums">{summary.pending.toLocaleString()}</td>
                      <td className="py-1.5 px-3 text-right tabular-nums">
                        {(coverage ?? []).reduce((s, r) => s + r.count, 0)}
                      </td>
                      <td />
                    </>
                  )}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Monthly transaction ledger — collapsed by default */}
      {scope === 'monthly' && month && monthRows.length > 0 && !loading && !error && (
        <div className="card !p-0 overflow-hidden">
          <button
            onClick={() => setShowDetail((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.02]"
          >
            <span>
              Transactions in {month}{' '}
              <span className="text-gray-400">({monthRows.length})</span>
            </span>
            {showDetail ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          {showDetail && (
            <div className="border-t border-gray-100 dark:border-gray-800 overflow-auto max-h-[40vh]">
              <table className="w-full text-[13px]">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gray-50 dark:bg-gray-900 text-left text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    <th className="py-1.5 px-3 font-semibold">Date</th>
                    <th className="py-1.5 px-3 font-semibold">Member</th>
                    <th className="py-1.5 px-3 font-semibold">FT Reference</th>
                    <th className="py-1.5 px-3 font-semibold">Status</th>
                    <th className="py-1.5 px-3 text-right font-semibold">Amount (ETB)</th>
                  </tr>
                </thead>
                <tbody>
                  {monthRows.map((d) => (
                    <tr key={d.id} className="border-t border-gray-50 dark:border-gray-800/60">
                      <td className="py-1.5 px-3 tabular-nums text-gray-700 dark:text-gray-300">
                        {String(d.transferDate || d.date).slice(0, 10)}
                      </td>
                      <td className="py-1.5 px-3 font-medium text-gray-900 dark:text-white/90">{d.memberName}</td>
                      <td className="py-1.5 px-3 font-mono text-xs text-gray-600 dark:text-gray-400">{d.ftNumber || '—'}</td>
                      <td className="py-1.5 px-3 capitalize text-gray-700 dark:text-gray-300">{d.status}</td>
                      <td className="py-1.5 px-3 text-right tabular-nums text-gray-900 dark:text-white/90">
                        {(d.amount || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-white/[0.02] font-semibold">
                    <td className="py-1.5 px-3" colSpan={4}>
                      Total
                    </td>
                    <td className="py-1.5 px-3 text-right tabular-nums">
                      {monthRows
                        .filter((d) => d.status !== 'rejected')
                        .reduce((s, d) => s + (d.amount || 0), 0)
                        .toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
