'use client';

import React, { useState } from 'react';
import { X, CheckCircle, AlertTriangle, Info, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CbeTransactionData } from '@/lib/api';

/** A receiver account the admin can pick from in the lookup panel. */
export interface ReceiverAccountOption {
  account: string;
  /** Saved on the group's CBE settings. */
  configured: boolean;
  /** Times this account was seen on a stored deposit. */
  count: number;
}

// ─── CBE Transaction Detail Card ─────────────────────────────────────────────

interface CbeTransactionCardProps {
  tx: CbeTransactionData;
  accountMatched?: boolean;
  amountMatched?: boolean;
  autoApproved?: boolean;
  expectedAmount?: number;
}

export function CbeTransactionCard({
  tx,
  accountMatched,
  amountMatched,
  autoApproved,
  expectedAmount,
}: CbeTransactionCardProps) {
  const [showRaw, setShowRaw] = useState(false);

  const rows: Array<[string, string | undefined]> = [
    ['FT Reference', tx.reference || tx.ftNumber],
    ['Amount', tx.amount !== undefined ? `ETB ${tx.amount.toLocaleString()}` : undefined],
    ['Payer', tx.payer],
    ['Payer Account', tx.payerAccount],
    ['Receiver', tx.receiver],
    ['Receiver Account', tx.receiverAccount],
    ['Date', tx.date],
    ['Reason', tx.reason],
    ['Branch', tx.branch],
  ];

  const breakdown: Array<[string, string | undefined]> = [
    ['Commission', tx.commission ? `ETB ${tx.commission}` : undefined],
    ['VAT (15%)', tx.vatOnCommission ? `ETB ${tx.vatOnCommission}` : undefined],
    ['Total Debited', tx.totalDebited ? `ETB ${tx.totalDebited}` : undefined],
    ['Amount in Words', tx.amountInWords],
  ];

  const hasBreakdown = breakdown.some(([, v]) => v);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden text-sm">
      {/* Status header */}
      <div
        className={`flex items-center justify-between px-4 py-3 font-semibold ${
          autoApproved
            ? 'bg-green-50 dark:bg-success-500/10 text-green-800 border-b border-green-100'
            : 'bg-blue-50 dark:bg-blue-light-500/10 text-blue-800 border-b border-blue-100'
        }`}
      >
        <span className="flex items-center gap-2">
          {autoApproved ? (
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-success-400" />
          ) : (
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-light-400" />
          )}
          {autoApproved ? '✅ Auto-Verified by CBE' : '📄 CBE Transaction Data'}
        </span>
        {autoApproved && (
          <span className="text-xs font-normal bg-green-100 dark:bg-success-500/20 text-green-700 dark:text-success-400 px-2 py-0.5 rounded-full">
            Automatically Verified
          </span>
        )}
      </div>

      {/* Validation banners */}
      {(accountMatched === false || amountMatched === false) && (
        <div className="bg-yellow-50 dark:bg-warning-500/10 border-b border-yellow-100 px-4 py-2 space-y-1">
          {accountMatched === false && (
            <p className="text-xs text-yellow-800 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-yellow-600" />
              Receiver account in receipt does not match the group's configured CBE account.
            </p>
          )}
          {amountMatched === false && (
            <p className="text-xs text-yellow-800 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-yellow-600" />
              Amount mismatch: CBE shows ETB {tx.amount?.toLocaleString()} but expected ETB {expectedAmount?.toLocaleString()}.
            </p>
          )}
        </div>
      )}

      {/* Transaction details */}
      <div className="px-4 py-3 bg-white dark:bg-gray-900 space-y-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1.5">Transaction Details</p>
        <table className="w-full">
          <tbody>
            {rows.map(([label, value]) =>
              value ? (
                <tr key={label} className="border-b border-gray-50 dark:border-gray-800 last:border-0">
                  <td className="py-1.5 pr-3 text-gray-500 dark:text-gray-400 font-medium w-36 align-top">{label}</td>
                  <td className="py-1.5 text-gray-800 dark:text-white/90 break-all">{value}</td>
                </tr>
              ) : null
            )}
          </tbody>
        </table>
      </div>

      {/* Financial breakdown */}
      {hasBreakdown && (
        <div className="px-4 py-3 bg-gray-50 dark:bg-white/[0.04] border-t border-gray-100 dark:border-gray-800">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1.5">Financial Breakdown</p>
          <table className="w-full">
            <tbody>
              {breakdown.map(([label, value]) =>
                value ? (
                  <tr key={label} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                    <td className="py-1.5 pr-3 text-gray-500 dark:text-gray-400 font-medium w-36">{label}</td>
                    <td className="py-1.5 text-gray-800 dark:text-white/90">{value}</td>
                  </tr>
                ) : null
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Raw text toggle */}
      <div className="px-4 py-2 bg-gray-50 dark:bg-white/[0.04] border-t border-gray-100 dark:border-gray-800">
        <button
          onClick={() => setShowRaw((v) => !v)}
          className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1"
        >
          {showRaw ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {showRaw ? 'Hide' : 'View'} raw PDF text
        </button>
        {showRaw && (
          <pre className="mt-2 text-[10px] text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md p-2 max-h-40 overflow-auto whitespace-pre-wrap">
            {tx.rawText}
          </pre>
        )}
      </div>
    </div>
  );
}

// ─── CBE Account Settings Panel ───────────────────────────────────────────────

interface CbeAccountSettingsProps {
  groupId: string;
  accounts: string[];
  onSaveFn: (groupId: string, accounts: string[]) => Promise<unknown>;
  onSaved: (accounts: string[]) => void;
}

export function CbeAccountSettings({ groupId, accounts, onSaveFn, onSaved }: CbeAccountSettingsProps) {
  const [list, setList] = useState<string[]>(accounts);
  const [newAccount, setNewAccount] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isValidCbeAccount = (acc: string) => /^1000\d{9}$/.test(acc);

  const handleAdd = () => {
    const trimmed = newAccount.trim();
    if (!isValidCbeAccount(trimmed)) {
      setError('Invalid account number. Must be 13 digits starting with 1000.');
      return;
    }
    if (list.includes(trimmed)) {
      setError('This account number is already added.');
      return;
    }
    setList((prev) => [...prev, trimmed]);
    setNewAccount('');
    setError(null);
  };

  const handleRemove = (acc: string) => {
    setList((prev) => prev.filter((a) => a !== acc));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await onSaveFn(groupId, list);
      onSaved(list);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr?.response?.data?.message || 'Failed to save accounts.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          Add the CBE receiver account numbers for this group. These will be used to auto-verify
          member deposits via the <strong>CBE Direct API</strong> using FT numbers.
        </p>

        {/* Configured accounts */}
        {list.length > 0 ? (
          <div className="space-y-2 mb-4">
            {list.map((acc) => (
              <div
                key={acc}
                className="flex items-center justify-between px-3 py-2 bg-blue-50 dark:bg-blue-light-500/10 border border-blue-100 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-blue-400 uppercase">CBE</span>
                  <span className="text-sm font-mono font-semibold text-blue-800">{acc}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(acc)}
                  className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 dark:hover:bg-error-500/10 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="mb-4 p-3 bg-amber-50 dark:bg-warning-500/10 border border-amber-100 rounded-lg text-xs text-amber-700 dark:text-warning-400 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            No CBE accounts configured yet. Auto-verification will be unavailable until at least one account is added.
          </div>
        )}

        {/* Add new account */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newAccount}
            onChange={(e) => { setNewAccount(e.target.value); setError(null); }}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="1000XXXXXXXXX (13 digits)"
            maxLength={13}
            className="flex-1 text-sm border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
          />
          <Button type="button" variant="outline" onClick={handleAdd} disabled={!newAccount.trim()}>
            Add
          </Button>
        </div>

        {error && (
          <p className="text-xs text-red-600 dark:text-error-400 mt-1.5 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> {error}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
        >
          {saving ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
          ) : (
            'Save CBE Accounts'
          )}
        </Button>
        {success && (
          <span className="text-sm text-green-600 dark:text-success-400 flex items-center gap-1">
            <CheckCircle className="h-4 w-4" /> Saved successfully!
          </span>
        )}
      </div>
    </div>
  );
}
