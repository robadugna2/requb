'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Filter,
  CheckCircle,
  XCircle,
  Image as ImageIcon,
  FileText,
  AlertCircle,
  Zap,
  Search,
  ChevronDown,
  ChevronUp,
  ScanLine,
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useLanguage } from '@/components/layout/LanguageContext';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/ui/StatusBadge';
import Modal from '@/components/ui/Modal';
import { AutoVerifyButton, CbeLookupPanel } from '@/components/ui/CbeVerifyPanel';
import {
  getDeposits,
  verifyDeposit,
  rejectDeposit,
  getMediaUrl,
  autoVerifyDepositCbe,
  cbeLookup,
  getGroups,
} from '@/lib/api';
import type { ReceiptItem, GroupListItem } from '@/lib/api';
import { useAdminPermissions, hasPermission } from '@/lib/useAdminPermissions';

export default function ReceiptsPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const permissions = useAdminPermissions();
  const [receipts, setReceipts] = useState<ReceiptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptItem | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Group CBE accounts map: groupId -> cbeAccountNumbers
  const [groupCbeAccounts, setGroupCbeAccounts] = useState<Record<string, string[]>>({});

  // Manual FT lookup panel
  const [showLookupPanel, setShowLookupPanel] = useState(false);

  const fetchReceipts = async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: { status?: string; groupId?: string } = {};
      if (statusFilter !== 'all') filters.status = statusFilter;
      const data = await getDeposits(filters);
      setReceipts(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load receipts. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const fetchGroupCbeAccounts = async () => {
    try {
      const groups = await getGroups();
      const map: Record<string, string[]> = {};
      groups.forEach((g: GroupListItem & { cbeAccountNumbers?: string[] }) => {
        if (g.cbeAccountNumbers?.length) {
          map[g.id] = g.cbeAccountNumbers;
        }
      });
      setGroupCbeAccounts(map);
    } catch {
      // silently fail - CBE accounts are optional
    }
  };

  useEffect(() => {
    fetchReceipts();
    fetchGroupCbeAccounts();
  }, [statusFilter]);

  const handleVerify = async (id: string) => {
    setError(null);
    try {
      await verifyDeposit(id);
      setReceipts(
        receipts.map((r) =>
          r.id === id ? { ...r, status: 'verified' as const } : r
        )
      );
      if (selectedReceipt?.id === id) setSelectedReceipt({ ...selectedReceipt, status: 'verified' });
      setSuccess('Receipt verified successfully!');
      setTimeout(() => setSuccess(null), 4000);
      setShowDetailModal(false);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(
        axiosErr.response?.data?.message || 'Failed to verify receipt. Please try again.'
      );
    }
  };

  const handleReject = async (id: string) => {
    setError(null);
    try {
      await rejectDeposit(id);
      setReceipts(
        receipts.map((r) =>
          r.id === id ? { ...r, status: 'rejected' as const } : r
        )
      );
      if (selectedReceipt?.id === id) setSelectedReceipt({ ...selectedReceipt, status: 'rejected' });
      setSuccess('Receipt rejected successfully.');
      setTimeout(() => setSuccess(null), 4000);
      setShowDetailModal(false);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(
        axiosErr.response?.data?.message || 'Failed to reject receipt. Please try again.'
      );
    }
  };

  const handleAutoVerified = (receiptId: string) => {
    setReceipts((prev) =>
      prev.map((r) =>
        r.id === receiptId ? { ...r, status: 'verified' as const, autoVerified: true } : r
      )
    );
    if (selectedReceipt?.id === receiptId) {
      setSelectedReceipt({ ...selectedReceipt, status: 'verified', autoVerified: true });
    }
    setSuccess('✅ Deposit auto-verified via CBE Direct!');
    setTimeout(() => setSuccess(null), 5000);
  };

  const filteredReceipts = receipts.filter((receipt) => {
    if (groupFilter !== 'all' && receipt.groupName !== groupFilter) return false;
    return true;
  });

  const uniqueGroups = [...new Set(receipts.map((r) => r.groupName))];
  const pendingCount = receipts.filter((r) => r.status === 'pending').length;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('receipts.loading')}</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {success && (
        <div className="mb-6 p-4 rounded-lg bg-green-50 dark:bg-success-500/10 text-green-700 dark:text-success-400 text-sm font-medium border border-green-100 flex items-center justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="text-green-500 hover:text-green-700 font-bold text-lg">×</button>
        </div>
      )}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-error-500/10 text-red-700 dark:text-error-400 text-sm font-medium border border-red-100 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-500 dark:text-error-400 hover:text-red-700 dark:hover:text-red-400 font-bold text-lg">×</button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white/90">{t('receipts.title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('receipts.subtitle_pending')} ({pendingCount})
          </p>
        </div>

        {/* Camera FT scanner + Manual FT Lookup toggle */}
        <div className="flex gap-2">
          <Button onClick={() => router.push('/scan')} className="gap-2">
            <ScanLine className="h-4 w-4" />
            Scan FT
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowLookupPanel((v) => !v)}
            className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"
          >
          <Search className="h-4 w-4" />
          FT Lookup
          {showLookupPanel ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* CBE Manual FT Lookup Panel */}
      {showLookupPanel && (
        <div className="mb-6 p-5 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-blue-900">CBE Direct — Manual FT Lookup</h3>
              <p className="text-xs text-blue-600 dark:text-blue-light-400">Verify any transaction using FT number + CBE account</p>
            </div>
          </div>
          <CbeLookupPanel
            defaultAccount={Object.values(groupCbeAccounts)[0]?.[0] || ''}
            onLookupFn={cbeLookup}
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400 dark:text-gray-500" />
          <span className="text-sm text-gray-500 dark:text-gray-400">{t('receipts.filter')}</span>
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input-field w-auto"
        >
          <option value="all">{t('receipts.all_status')}</option>
          <option value="pending">{t('receipts.pending')}</option>
          <option value="verified">{t('receipts.verified')}</option>
          <option value="rejected">{t('receipts.rejected')}</option>
        </select>

        <select
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
          className="input-field w-auto"
        >
          <option value="all">{t('receipts.all_groups')}</option>
          {uniqueGroups.map((group) => (
            <option key={group} value={group}>
              {group}
            </option>
          ))}
        </select>

        {/* Status summary pills */}
        <div className="flex items-center gap-2 ml-auto">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-50 dark:bg-warning-500/10 text-yellow-700">
            {receipts.filter((r) => r.status === 'pending').length} {t('receipts.pending')}
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 dark:bg-success-500/10 text-green-700 dark:text-success-400">
            {receipts.filter((r) => r.status === 'verified').length} {t('receipts.verified')}
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 dark:bg-error-500/10 text-red-700 dark:text-error-400">
            {receipts.filter((r) => r.status === 'rejected').length} {t('receipts.rejected')}
          </span>
        </div>
      </div>

      {/* Receipts Grid */}
      {filteredReceipts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredReceipts.map((receipt) => (
            <div
              key={receipt.id}
              className="card-hover cursor-pointer relative"
              onClick={() => {
                setSelectedReceipt(receipt);
                setShowDetailModal(true);
              }}
            >
              {/* Auto-verified badge */}
              {receipt.autoVerified && (
                <div className="absolute top-2 right-2 flex items-center gap-1 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">
                  <Zap className="h-2.5 w-2.5" /> CBE Auto
                </div>
              )}

              {/* Receipt thumbnail */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gray-100 dark:bg-white/[0.08] rounded-lg flex items-center justify-center flex-shrink-0">
                  {receipt.receiptImageUrl ? (
                    <ImageIcon className="h-6 w-6 text-gray-400 dark:text-gray-500" />
                  ) : (
                    <FileText className="h-6 w-6 text-gray-400 dark:text-gray-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white/90 truncate">
                    {receipt.memberName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{receipt.groupName}</p>
                  {receipt.ftNumber && (
                    <p className="text-[10px] text-blue-600 dark:text-blue-light-400 font-mono truncate">{receipt.ftNumber}</p>
                  )}
                </div>
                <StatusBadge status={receipt.status} />
              </div>

              {/* OCR Data */}
              {receipt.ocrData && (
                <div className="space-y-2 p-3 bg-gray-50 dark:bg-white/[0.04] rounded-lg">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500 dark:text-gray-400">{t('receipts.bank')}</span>
                    <span className="font-medium text-gray-700 dark:text-gray-300 truncate ml-2">
                      {receipt.ocrData.bankName}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500 dark:text-gray-400">Ref</span>
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {receipt.ocrData.transactionRef}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500 dark:text-gray-400">{t('group.col_amount')}</span>
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      ETB {receipt.ocrData.extractedAmount.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
                <span className="text-xs text-gray-500 dark:text-gray-400">{receipt.date}</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white/90">
                  ETB {receipt.amount.toLocaleString()}
                </span>
              </div>

              {/* CBE auto-verify hint for pending + has FT */}
              {receipt.status === 'pending' && receipt.ftNumber && (
                <div className="mt-2 flex items-center gap-1.5 text-[10px] text-blue-600 dark:text-blue-light-400">
                  <Zap className="h-3 w-3" />
                  CBE auto-verify available
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 card">
          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white/90 mb-1">{t('receipts.no_receipts')}</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {t('receipts.no_receipts_desc')}
          </p>
        </div>
      )}

      {/* Receipt Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title={t('receipts.modal_title')}
        size="lg"
      >
        {selectedReceipt && (
          <div className="space-y-6">
            {/* Member & Group Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('member.name')}</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white/90">
                  {selectedReceipt.memberName}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('groups.title')}</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white/90">
                  {selectedReceipt.groupName}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('group.col_amount')}</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white/90">
                  ETB {selectedReceipt.amount.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('group.col_date')}</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white/90">
                  {selectedReceipt.date}
                </p>
              </div>
              {selectedReceipt.ftNumber && (
                <div className="col-span-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">FT Transaction Number</p>
                  <p className="text-sm font-mono font-semibold text-blue-700 bg-blue-50 dark:bg-blue-light-500/10 px-2 py-1 rounded-md inline-block">
                    {selectedReceipt.ftNumber}
                  </p>
                </div>
              )}
            </div>

            {/* Receipt Image */}
            {selectedReceipt.receiptImageUrl ? (
              <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800">
                <img
                  src={getMediaUrl(selectedReceipt.receiptImageUrl)}
                  alt="Receipt"
                  className="w-full max-h-80 object-contain bg-gray-50 dark:bg-white/[0.04]"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl p-8 text-center">
                <ImageIcon className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('receipts.no_image')}</p>
              </div>
            )}

            {/* OCR Data */}
            {selectedReceipt.ocrData && (
              <div className="bg-gray-50 dark:bg-white/[0.04] rounded-xl p-4">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  {t('receipts.ocr_title')}
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('receipts.bank_name')}</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white/90">
                      {selectedReceipt.ocrData.bankName}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('receipts.ocr_ref')}</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white/90">
                      {selectedReceipt.ocrData.transactionRef}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('receipts.extracted_amount')}</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white/90">
                      ETB {selectedReceipt.ocrData.extractedAmount.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('receipts.ocr_date')}</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white/90">
                      {selectedReceipt.ocrData.extractedDate}
                    </p>
                  </div>
                </div>

                {/* Amount mismatch warning */}
                {selectedReceipt.ocrData.extractedAmount !== selectedReceipt.amount && (
                  <div className="mt-3 p-2 bg-yellow-50 dark:bg-warning-500/10 border border-yellow-200 rounded-lg">
                    <p className="text-xs text-yellow-700 font-medium">
                      Amount mismatch: contribution is ETB {selectedReceipt.amount.toLocaleString()} but receipt shows ETB {selectedReceipt.ocrData.extractedAmount.toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ─── CBE Auto-Verification Section ─── */}
            {selectedReceipt.status === 'pending' && (
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 bg-blue-600 rounded-md flex items-center justify-center">
                    <Zap className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-blue-900">CBE Auto-Verification</h4>
                    <p className="text-xs text-blue-600 dark:text-blue-light-400">
                      Verify via CBE Direct API using the FT number
                    </p>
                  </div>
                </div>
                <AutoVerifyButton
                  depositId={selectedReceipt.id}
                  ftNumber={selectedReceipt.ftNumber}
                  groupId={selectedReceipt.groupId}
                  cbeAccountNumbers={groupCbeAccounts[selectedReceipt.groupId] || []}
                  expectedAmount={selectedReceipt.amount}
                  onVerified={() => handleAutoVerified(selectedReceipt.id)}
                  onAutoVerifyFn={autoVerifyDepositCbe}
                  onManualVerify={() => handleVerify(selectedReceipt.id)}
                  onManualReject={() => handleReject(selectedReceipt.id)}
                  canManage={hasPermission(permissions, selectedReceipt.groupId, 'canManageDeposits')}
                />
              </div>
            )}

            {/* Status & Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">Status:</span>
                <StatusBadge status={selectedReceipt.status} />
                {selectedReceipt.autoVerified && (
                  <span className="text-xs bg-blue-100 dark:bg-blue-light-500/20 text-blue-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Zap className="h-3 w-3" /> CBE Auto-Verified
                  </span>
                )}
              </div>
              {selectedReceipt.status === 'pending' && !selectedReceipt.ftNumber && hasPermission(permissions, selectedReceipt.groupId, 'canManageDeposits') && (
                <div className="flex gap-3">
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleReject(selectedReceipt.id)}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    {t('receipts.reject')}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleVerify(selectedReceipt.id)}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    {t('receipts.verify')}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}
