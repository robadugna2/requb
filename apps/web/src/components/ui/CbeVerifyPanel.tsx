'use client';

import React, { useState } from 'react';
import { Zap, Search, X, CheckCircle, AlertTriangle, Info, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CbeTransactionData, CbeAutoVerifyResult } from '@/lib/api';

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
    <div className="rounded-xl border border-gray-200 overflow-hidden text-sm">
      {/* Status header */}
      <div
        className={`flex items-center justify-between px-4 py-3 font-semibold ${
          autoApproved
            ? 'bg-green-50 text-green-800 border-b border-green-100'
            : 'bg-blue-50 text-blue-800 border-b border-blue-100'
        }`}
      >
        <span className="flex items-center gap-2">
          {autoApproved ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <Info className="h-4 w-4 text-blue-600" />
          )}
          {autoApproved ? '✅ Auto-Verified by CBE' : '📄 CBE Transaction Data'}
        </span>
        {autoApproved && (
          <span className="text-xs font-normal bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
            Automatically Verified
          </span>
        )}
      </div>

      {/* Validation banners */}
      {(accountMatched === false || amountMatched === false) && (
        <div className="bg-yellow-50 border-b border-yellow-100 px-4 py-2 space-y-1">
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
      <div className="px-4 py-3 bg-white space-y-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Transaction Details</p>
        <table className="w-full">
          <tbody>
            {rows.map(([label, value]) =>
              value ? (
                <tr key={label} className="border-b border-gray-50 last:border-0">
                  <td className="py-1.5 pr-3 text-gray-500 font-medium w-36 align-top">{label}</td>
                  <td className="py-1.5 text-gray-800 break-all">{value}</td>
                </tr>
              ) : null
            )}
          </tbody>
        </table>
      </div>

      {/* Financial breakdown */}
      {hasBreakdown && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Financial Breakdown</p>
          <table className="w-full">
            <tbody>
              {breakdown.map(([label, value]) =>
                value ? (
                  <tr key={label} className="border-b border-gray-100 last:border-0">
                    <td className="py-1.5 pr-3 text-gray-500 font-medium w-36">{label}</td>
                    <td className="py-1.5 text-gray-800">{value}</td>
                  </tr>
                ) : null
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Raw text toggle */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
        <button
          onClick={() => setShowRaw((v) => !v)}
          className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          {showRaw ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {showRaw ? 'Hide' : 'View'} raw PDF text
        </button>
        {showRaw && (
          <pre className="mt-2 text-[10px] text-gray-600 bg-white border border-gray-200 rounded-md p-2 max-h-40 overflow-auto whitespace-pre-wrap">
            {tx.rawText}
          </pre>
        )}
      </div>
    </div>
  );
}

// ─── Auto-Verify Button + Result Panel ───────────────────────────────────────

interface AutoVerifyButtonProps {
  depositId: string;
  ftNumber?: string;
  groupId: string;
  cbeAccountNumbers: string[];
  expectedAmount: number;
  onVerified: () => void;
  onAutoVerifyFn: (depositId: string, accountNumber?: string) => Promise<CbeAutoVerifyResult>;
  onManualVerify: () => void;
  onManualReject: () => void;
  canManage: boolean;
}

export function AutoVerifyButton({
  depositId,
  ftNumber,
  cbeAccountNumbers,
  expectedAmount,
  onVerified,
  onAutoVerifyFn,
  onManualVerify,
  onManualReject,
  canManage,
}: AutoVerifyButtonProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CbeAutoVerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState(cbeAccountNumbers[0] || '');
  const [customAccount, setCustomAccount] = useState('');
  const [showAccountPicker, setShowAccountPicker] = useState(false);

  const hasCbeAccount = cbeAccountNumbers.length > 0;
  const accountToUse = customAccount.trim() || selectedAccount;

  const handleAutoVerify = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await onAutoVerifyFn(depositId, accountToUse || undefined);
      setResult(res);
      if (res.verified) {
        onVerified();
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr?.response?.data?.message || (err instanceof Error ? err.message : 'CBE verification failed'));
    } finally {
      setLoading(false);
    }
  };

  if (!ftNumber) {
    return (
      <p className="text-xs text-gray-400 italic">No FT number — CBE auto-verify unavailable</p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Account selector */}
      {showAccountPicker && (
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 space-y-2">
          <p className="text-xs font-semibold text-blue-800">Select CBE Receiver Account</p>
          {cbeAccountNumbers.length > 0 && (
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="w-full text-xs border border-blue-200 rounded-md px-2 py-1.5 bg-white text-gray-700"
            >
              {cbeAccountNumbers.map((acc) => (
                <option key={acc} value={acc}>{acc}</option>
              ))}
            </select>
          )}
          <input
            type="text"
            placeholder="Or enter account manually (1000XXXXXXXXX)"
            value={customAccount}
            onChange={(e) => setCustomAccount(e.target.value)}
            maxLength={13}
            className="w-full text-xs border border-blue-200 rounded-md px-2 py-1.5 bg-white text-gray-700 placeholder-gray-400"
          />
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {canManage && (
          <>
            <Button
              size="sm"
              onClick={handleAutoVerify}
              disabled={loading || (!hasCbeAccount && !customAccount.trim())}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm"
            >
              {loading ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Verifying via CBE...</>
              ) : (
                <><Zap className="h-3.5 w-3.5 mr-1.5" /> Auto Verify CBE</>
              )}
            </Button>

            <button
              onClick={() => setShowAccountPicker((v) => !v)}
              className="text-xs text-blue-600 hover:text-blue-800 underline"
            >
              {showAccountPicker ? 'Hide account' : (hasCbeAccount ? 'Change account' : 'Enter account')}
            </button>

            {!hasCbeAccount && !showAccountPicker && (
              <span className="text-xs text-amber-600 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> No group CBE account configured
              </span>
            )}
          </>
        )}

        {canManage && (
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={onManualReject} className="text-red-600 border-red-200 hover:bg-red-50">
              <X className="h-3.5 w-3.5 mr-1" /> Reject
            </Button>
            <Button variant="outline" size="sm" onClick={onManualVerify} className="text-green-600 border-green-200 hover:bg-green-50">
              <CheckCircle className="h-3.5 w-3.5 mr-1" /> Manual Verify
            </Button>
          </div>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">CBE Verification Failed</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Result */}
      {result && result.result.transaction && (
        <CbeTransactionCard
          tx={result.result.transaction}
          accountMatched={result.result.accountMatched}
          amountMatched={result.result.amountMatched}
          autoApproved={result.verified}
          expectedAmount={expectedAmount}
        />
      )}

      {result && !result.result.success && !error && (
        <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-100 rounded-lg text-xs text-orange-700">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <p>{result.result.error || 'Verification returned no data.'}</p>
        </div>
      )}
    </div>
  );
}

// ─── Standalone FT Lookup Panel ───────────────────────────────────────────────

interface CbeLookupPanelProps {
  defaultAccount?: string;
  onLookupFn: (ftNumber: string, accountNumber: string) => Promise<CbeTransactionData>;
}

export function CbeLookupPanel({ defaultAccount = '', onLookupFn }: CbeLookupPanelProps) {
  const [ftNumber, setFtNumber] = useState('');
  const [accountNumber, setAccountNumber] = useState(defaultAccount);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CbeTransactionData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLookup = async () => {
    if (!ftNumber.trim() || !accountNumber.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await onLookupFn(ftNumber.trim().toUpperCase(), accountNumber.trim());
      setResult(data);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr?.response?.data?.message || (err instanceof Error ? err.message : 'Lookup failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">FT Transaction ID</label>
          <input
            type="text"
            value={ftNumber}
            onChange={(e) => setFtNumber(e.target.value.toUpperCase())}
            placeholder="e.g. FT1234567890"
            onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          />
          <p className="text-[10px] text-gray-400 mt-1">Format: FT + 10 alphanumeric chars</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Receiver Account Number</label>
          <input
            type="text"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            placeholder="e.g. 1000123456789"
            maxLength={13}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          />
          <p className="text-[10px] text-gray-400 mt-1">13-digit CBE account starting with 1000</p>
        </div>
      </div>

      <Button
        onClick={handleLookup}
        disabled={loading || !ftNumber.trim() || !accountNumber.trim()}
        className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white"
      >
        {loading ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Looking up...</>
        ) : (
          <><Search className="h-4 w-4 mr-2" /> Look Up Transaction</>
        )}
      </Button>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Lookup Failed</p>
            <p className="text-xs">{error}</p>
          </div>
        </div>
      )}

      {result && (
        <CbeTransactionCard tx={result} />
      )}
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
        <p className="text-sm text-gray-600 mb-3">
          Add the CBE receiver account numbers for this group. These will be used to auto-verify
          member deposits via the <strong>CBE Direct API</strong> using FT numbers.
        </p>

        {/* Configured accounts */}
        {list.length > 0 ? (
          <div className="space-y-2 mb-4">
            {list.map((acc) => (
              <div
                key={acc}
                className="flex items-center justify-between px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-blue-400 uppercase">CBE</span>
                  <span className="text-sm font-mono font-semibold text-blue-800">{acc}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(acc)}
                  className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-700 flex items-center gap-2">
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
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
          />
          <Button type="button" variant="outline" onClick={handleAdd} disabled={!newAccount.trim()}>
            Add
          </Button>
        </div>

        {error && (
          <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
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
          <span className="text-sm text-green-600 flex items-center gap-1">
            <CheckCircle className="h-4 w-4" /> Saved successfully!
          </span>
        )}
      </div>
    </div>
  );
}
