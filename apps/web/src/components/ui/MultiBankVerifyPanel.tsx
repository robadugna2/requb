'use client';

/**
 * Multi-bank receipt verification UI.
 *
 * Two pieces, both additive to the existing CBE-only flow:
 *
 *   <MultiBankVerifyPanel />  a standalone lookup panel — paste a receipt link
 *                             or type a reference, pick a provider (or let the
 *                             server work it out), and read one normalised
 *                             answer.
 *
 *   <BankVerifyButton />      a per-deposit action that checks ONE stored
 *                             deposit against its bank and auto-approves it only
 *                             when amount + receiver account + reference all
 *                             match.
 *
 * Neither piece can approve anything the existing CBE path would have rejected:
 * the server applies the same two cross-checks plus a duplicate-reference guard.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  Info,
  Loader2,
  Search,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import {
  autoVerifyDepositWithBank,
  getVerificationBanks,
  verifyBankPayment,
} from '@/lib/api';
import type {
  BankCode,
  BankIdentifiersInput,
  BankVerificationResult,
  DepositAutoVerifyOutcome,
  VerificationBank,
} from '@/lib/api';

// ─── helpers ────────────────────────────────────────────────────────────────

/** Banks whose lookup is account-specific, so the panel must ask for it. */
const NEEDS_ACCOUNT: BankCode[] = ['cbe', 'boa'];

/** Which identifier slot each provider reads. */
function buildIdentifiers(
  bank: BankCode | 'auto',
  text: string,
  account: string,
): BankIdentifiersInput {
  const value = text.trim();
  const digits = account.replace(/\D/g, '');

  if (bank === 'auto') {
    // Give the server's router both shapes it discriminates on; it reports
    // "ambiguous" rather than guessing when they collide.
    return { referenceNumber: value, transactionNumber: value };
  }

  switch (bank) {
    case 'cbe':
      // CBE accepts a legacy FT reference (needs the last 8 digits of the
      // receiving account) or a modern Receipt ID. Send both slots so the
      // adapter can decide — it validates each one before using it.
      return {
        referenceNumber: value,
        receiptNumber: value,
        accountSuffix: digits.length >= 8 ? digits.slice(-8) : undefined,
      };
    case 'boa':
      return {
        referenceNumber: value,
        accountSuffix: digits.length >= 5 ? digits.slice(-5) : undefined,
      };
    case 'cbebirr':
      return { receiptNumber: value };
    case 'telebirr':
    case 'mpesa':
    case 'awash':
      return { transactionNumber: value, referenceNumber: value };
    default:
      return { referenceNumber: value };
  }
}

function formatDate(value?: string): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

// ─── result card ────────────────────────────────────────────────────────────

function ResultCard({
  result,
  labels,
}: {
  result: BankVerificationResult;
  labels: Record<string, string>;
}) {
  const tone =
    result.status === 'success'
      ? {
          wrap: 'border-green-200 bg-green-50 dark:border-success-500/25 dark:bg-success-500/10',
          icon: <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-success-400" />,
          title: 'text-green-900 dark:text-success-300',
          label: 'Confirmed by the bank',
        }
      : result.status === 'not_found'
        ? {
            wrap: 'border-amber-200 bg-amber-50 dark:border-warning-500/25 dark:bg-warning-500/10',
            icon: <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-warning-400" />,
            title: 'text-amber-900 dark:text-warning-300',
            label: 'No matching transaction',
          }
        : {
            wrap: 'border-red-200 bg-red-50 dark:border-error-500/25 dark:bg-error-500/10',
            icon: <XCircle className="h-4 w-4 text-red-600 dark:text-error-400" />,
            title: 'text-red-900 dark:text-error-300',
            label: 'Could not be checked',
          };

  const rows: Array<[string, string | undefined]> = [
    ['Provider', labels[result.bank] ?? result.bank],
    ['Amount', result.amount !== undefined ? `ETB ${result.amount.toLocaleString()}` : undefined],
    ['Sender', result.senderName],
    ['Sender account', result.senderAccount],
    ['Receiver', result.receiverName],
    ['Receiver account', result.receiverAccount],
    ['Reference', result.referenceNumber ?? result.receiptNumber ?? result.transactionNumber],
    ['Date', formatDate(result.timestamp)],
  ].filter(([, value]) => !!value) as Array<[string, string]>;

  return (
    <div className={`rounded-xl border p-4 ${tone.wrap}`}>
      <div className="flex items-center gap-2 mb-3">
        {tone.icon}
        <h4 className={`text-sm font-bold ${tone.title}`}>{tone.label}</h4>
        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 tabular-nums">
          <Clock className="h-3 w-3" />
          {result.durationMs} ms
        </span>
      </div>

      {rows.length > 0 ? (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-baseline gap-2 min-w-0">
              <dt className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400 shrink-0 w-32">
                {label}
              </dt>
              <dd className="text-sm font-medium text-gray-900 dark:text-white/90 truncate">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {result.error?.message ?? 'The bank did not return any readable details.'}
        </p>
      )}

      {result.error && rows.length > 0 && (
        <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">{result.error.message}</p>
      )}
    </div>
  );
}

// ─── standalone lookup panel ────────────────────────────────────────────────

export function MultiBankVerifyPanel({ onVerified }: { onVerified?: () => void }) {
  const [banks, setBanks] = useState<VerificationBank[]>([]);
  const [banksError, setBanksError] = useState<string | null>(null);
  const [bank, setBank] = useState<BankCode | 'auto'>('auto');
  const [text, setText] = useState('');
  const [account, setAccount] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BankVerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getVerificationBanks()
      .then((list) => {
        if (!cancelled) setBanks(list);
      })
      .catch((err) => {
        if (cancelled) return;
        const message =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Could not load the provider list.';
        setBanksError(message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const labels = useMemo(() => {
    const map: Record<string, string> = {};
    for (const b of banks) map[b.bank] = b.label;
    return map;
  }, [banks]);

  const needsAccount = bank !== 'auto' && NEEDS_ACCOUNT.includes(bank);
  const isLink = /^https?:\/\//i.test(text.trim());

  const submit = useCallback(async () => {
    const value = text.trim();
    if (!value) {
      setError('Paste a receipt link, or type the reference number.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    try {
      // A pasted link carries the bank and every field, so hand it to the
      // router rather than guessing which slot the number belongs in.
      const res = await verifyBankPayment(
        isLink
          ? { bank: bank === 'auto' ? undefined : bank, rawInput: value }
          : {
              bank: bank === 'auto' ? undefined : bank,
              identifiers: buildIdentifiers(bank, value, account),
            },
      );
      setResult(res);
      if (res.verified) onVerified?.();
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'The check could not be completed. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [text, bank, account, isLink, onVerified]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Provider */}
        <div className="relative sm:w-64 shrink-0">
          <Building2 className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <select
            value={bank}
            onChange={(e) => setBank(e.target.value as BankCode | 'auto')}
            className="w-full appearance-none rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 pl-9 pr-8 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="auto">
              Auto-detect{banks.length > 0 ? ` (${banks.length} providers)` : ''}
            </option>
            {banks.map((b) => (
              <option key={b.bank} value={b.bank}>
                {b.label}
              </option>
            ))}
          </select>
        </div>

        {/* Reference / link */}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit();
          }}
          placeholder="Reference number, or paste a receipt link / SMS"
          className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />

        <button
          onClick={() => void submit()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 active:scale-[0.98] transition-all"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {loading ? 'Checking…' : 'Check'}
        </button>
      </div>

      {needsAccount && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-300 sm:w-64 shrink-0">
            {bank === 'boa' ? 'Receiving account (last 5 digits used)' : 'Receiving account (last 8 digits used)'}
          </label>
          <input
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            placeholder={bank === 'boa' ? 'e.g. 1234567890123' : 'e.g. 1000734617664'}
            className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      )}

      {banksError && (
        <p className="text-xs text-amber-700 dark:text-warning-400">{banksError}</p>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 dark:border-error-500/25 bg-red-50 dark:bg-error-500/10 px-3 py-2">
          <XCircle className="h-4 w-4 text-red-600 dark:text-error-400 shrink-0 mt-0.5" />
          <p className="text-xs text-red-800 dark:text-error-300">{error}</p>
        </div>
      )}

      {result && <ResultCard result={result} labels={labels} />}

      {!result && !error && (
        <p className="flex items-start gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
          <Info className="h-3.5 w-3.5 shrink-0 mt-px" />
          Checking here never changes a deposit — it only reads the bank&apos;s own receipt.
        </p>
      )}
    </div>
  );
}

// ─── per-deposit action ─────────────────────────────────────────────────────

export function BankVerifyButton({
  depositId,
  onVerified,
  onOutcome,
  iconOnly = false,
  className = '',
}: {
  depositId: string;
  onVerified?: () => void;
  onOutcome?: (outcome: DepositAutoVerifyOutcome) => void;
  iconOnly?: boolean;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const outcome = await autoVerifyDepositWithBank(depositId);
      onOutcome?.(outcome);
      if (outcome.verified) onVerified?.();
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'The bank check could not be completed.';
      onOutcome?.({
        verified: false,
        reason: 'upstream_failed',
        message,
      });
    } finally {
      setLoading(false);
    }
  };

  if (iconOnly) {
    return (
      <button
        onClick={() => void run()}
        disabled={loading}
        className={`p-1.5 text-blue-600 dark:text-blue-light-400 hover:bg-blue-50 dark:hover:bg-brand-500/10 rounded-lg transition-colors disabled:opacity-40 ${className}`}
        title="Verify with the bank (all providers)"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ShieldCheck className="h-4 w-4" />
        )}
      </button>
    );
  }

  return (
    <button
      onClick={() => void run()}
      disabled={loading}
      className={`inline-flex items-center gap-2 rounded-lg border border-blue-200 dark:border-brand-500/30 bg-white dark:bg-gray-900 px-3 py-2 text-xs font-semibold text-blue-700 dark:text-brand-400 hover:bg-blue-50 dark:hover:bg-brand-500/10 disabled:opacity-50 transition-colors ${className}`}
      title="Check this deposit against its bank and auto-approve only on a full match"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <ShieldCheck className="h-3.5 w-3.5" />
      )}
      {loading ? 'Checking…' : 'Verify with bank'}
    </button>
  );
}
