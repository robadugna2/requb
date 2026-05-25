'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Eye,
  Image as ImageIcon,
  FileText,
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import { getDeposits, verifyDeposit, rejectDeposit } from '@/lib/api';

interface Receipt {
  id: string;
  memberName: string;
  groupName: string;
  amount: number;
  status: 'verified' | 'pending' | 'rejected';
  date: string;
  receiptImageUrl?: string;
  ocrData?: {
    bankName: string;
    transactionRef: string;
    extractedAmount: number;
    extractedDate: string;
  };
}

const mockReceipts: Receipt[] = [
  {
    id: '1',
    memberName: 'Abebe Kebede',
    groupName: 'Weekly Equb #1',
    amount: 5000,
    status: 'pending',
    date: '2024-03-12',
    receiptImageUrl: '/receipts/receipt1.jpg',
    ocrData: {
      bankName: 'Commercial Bank of Ethiopia',
      transactionRef: 'TXN-2024-001234',
      extractedAmount: 5000,
      extractedDate: '2024-03-12',
    },
  },
  {
    id: '2',
    memberName: 'Meron Tadesse',
    groupName: 'Weekly Equb #1',
    amount: 5000,
    status: 'verified',
    date: '2024-03-11',
    receiptImageUrl: '/receipts/receipt2.jpg',
    ocrData: {
      bankName: 'Awash Bank',
      transactionRef: 'TXN-2024-001235',
      extractedAmount: 5000,
      extractedDate: '2024-03-11',
    },
  },
  {
    id: '3',
    memberName: 'Dawit Haile',
    groupName: 'Bi-Weekly Equb #5',
    amount: 2500,
    status: 'pending',
    date: '2024-03-12',
    ocrData: {
      bankName: 'Dashen Bank',
      transactionRef: 'TXN-2024-001236',
      extractedAmount: 2500,
      extractedDate: '2024-03-12',
    },
  },
  {
    id: '4',
    memberName: 'Sara Tekle',
    groupName: 'Weekly Equb #1',
    amount: 5000,
    status: 'rejected',
    date: '2024-03-10',
    ocrData: {
      bankName: 'Commercial Bank of Ethiopia',
      transactionRef: 'TXN-2024-001237',
      extractedAmount: 3000,
      extractedDate: '2024-03-10',
    },
  },
  {
    id: '5',
    memberName: 'Yohannes Gebre',
    groupName: 'Monthly Savings Group',
    amount: 10000,
    status: 'pending',
    date: '2024-03-11',
    ocrData: {
      bankName: 'Bank of Abyssinia',
      transactionRef: 'TXN-2024-001238',
      extractedAmount: 10000,
      extractedDate: '2024-03-11',
    },
  },
  {
    id: '6',
    memberName: 'Tigist Alemu',
    groupName: 'Premium Monthly',
    amount: 25000,
    status: 'verified',
    date: '2024-03-10',
    ocrData: {
      bankName: 'Dashen Bank',
      transactionRef: 'TXN-2024-001239',
      extractedAmount: 25000,
      extractedDate: '2024-03-10',
    },
  },
  {
    id: '7',
    memberName: 'Bekele Wolde',
    groupName: 'Bi-Weekly Equb #5',
    amount: 2500,
    status: 'pending',
    date: '2024-03-12',
    ocrData: {
      bankName: 'Zemen Bank',
      transactionRef: 'TXN-2024-001240',
      extractedAmount: 2500,
      extractedDate: '2024-03-12',
    },
  },
  {
    id: '8',
    memberName: 'Hanna Yosef',
    groupName: 'Monthly Savings Group',
    amount: 10000,
    status: 'verified',
    date: '2024-03-09',
    ocrData: {
      bankName: 'Commercial Bank of Ethiopia',
      transactionRef: 'TXN-2024-001241',
      extractedAmount: 10000,
      extractedDate: '2024-03-09',
    },
  },
];

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<Receipt[]>(mockReceipts);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReceipts = async () => {
      try {
        const filters: any = {};
        if (statusFilter !== 'all') filters.status = statusFilter;
        if (groupFilter !== 'all') filters.groupId = groupFilter;
        const data = await getDeposits(filters);
        if (data && data.length > 0) setReceipts(data);
      } catch (error) {
        console.log('Using mock data');
      } finally {
        setLoading(false);
      }
    };
    fetchReceipts();
  }, [statusFilter, groupFilter]);

  const handleVerify = async (id: string) => {
    setError(null);
    try {
      await verifyDeposit(id);
      setReceipts(
        receipts.map((r) =>
          r.id === id ? { ...r, status: 'verified' as const } : r
        )
      );
      setSuccess('Receipt verified successfully!');
      setTimeout(() => setSuccess(null), 4000);
      setShowDetailModal(false);
    } catch (err: any) {
      setError(
        err.response?.data?.message || 'Failed to verify receipt. Please try again.'
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
      setSuccess('Receipt rejected successfully.');
      setTimeout(() => setSuccess(null), 4000);
      setShowDetailModal(false);
    } catch (err: any) {
      setError(
        err.response?.data?.message || 'Failed to reject receipt. Please try again.'
      );
    }
  };

  const filteredReceipts = receipts.filter((receipt) => {
    if (statusFilter !== 'all' && receipt.status !== statusFilter) return false;
    if (groupFilter !== 'all' && receipt.groupName !== groupFilter) return false;
    return true;
  });

  const uniqueGroups = [...new Set(receipts.map((r) => r.groupName))];

  const pendingCount = receipts.filter((r) => r.status === 'pending').length;

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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Receipts</h1>
          <p className="mt-1 text-sm text-gray-500">
            Verify deposit receipts ({pendingCount} pending review)
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-500">Filter:</span>
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input-field w-auto"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="verified">Verified</option>
          <option value="rejected">Rejected</option>
        </select>

        <select
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
          className="input-field w-auto"
        >
          <option value="all">All Groups</option>
          {uniqueGroups.map((group) => (
            <option key={group} value={group}>
              {group}
            </option>
          ))}
        </select>

        {/* Status summary pills */}
        <div className="flex items-center gap-2 ml-auto">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700">
            {receipts.filter((r) => r.status === 'pending').length} Pending
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700">
            {receipts.filter((r) => r.status === 'verified').length} Verified
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700">
            {receipts.filter((r) => r.status === 'rejected').length} Rejected
          </span>
        </div>
      </div>

      {/* Receipts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredReceipts.map((receipt) => (
          <div
            key={receipt.id}
            className="card-hover cursor-pointer"
            onClick={() => {
              setSelectedReceipt(receipt);
              setShowDetailModal(true);
            }}
          >
            {/* Receipt thumbnail */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                {receipt.receiptImageUrl ? (
                  <ImageIcon className="h-6 w-6 text-gray-400" />
                ) : (
                  <FileText className="h-6 w-6 text-gray-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {receipt.memberName}
                </p>
                <p className="text-xs text-gray-500">{receipt.groupName}</p>
              </div>
              <Badge status={receipt.status} />
            </div>

            {/* OCR Data */}
            {receipt.ocrData && (
              <div className="space-y-2 p-3 bg-gray-50 rounded-lg">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Bank</span>
                  <span className="font-medium text-gray-700 truncate ml-2">
                    {receipt.ocrData.bankName}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Ref</span>
                  <span className="font-medium text-gray-700">
                    {receipt.ocrData.transactionRef}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Amount</span>
                  <span className="font-medium text-gray-700">
                    ETB {receipt.ocrData.extractedAmount.toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
              <span className="text-xs text-gray-500">{receipt.date}</span>
              <span className="text-sm font-semibold text-gray-900">
                ETB {receipt.amount.toLocaleString()}
              </span>
            </div>
          </div>
        ))}
      </div>

      {filteredReceipts.length === 0 && (
        <div className="text-center py-16 card">
          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No receipts found with current filters.</p>
        </div>
      )}

      {/* Receipt Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="Receipt Details"
        size="lg"
      >
        {selectedReceipt && (
          <div className="space-y-6">
            {/* Member & Group Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Member</p>
                <p className="text-sm font-medium text-gray-900">
                  {selectedReceipt.memberName}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Group</p>
                <p className="text-sm font-medium text-gray-900">
                  {selectedReceipt.groupName}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Amount</p>
                <p className="text-sm font-medium text-gray-900">
                  ETB {selectedReceipt.amount.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Date</p>
                <p className="text-sm font-medium text-gray-900">
                  {selectedReceipt.date}
                </p>
              </div>
            </div>

            {/* Receipt Image Placeholder */}
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
              <ImageIcon className="h-12 w-12 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Receipt Image</p>
              <p className="text-xs text-gray-400 mt-1">
                {selectedReceipt.receiptImageUrl || 'No image uploaded'}
              </p>
            </div>

            {/* OCR Extracted Data */}
            {selectedReceipt.ocrData && (
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">
                  OCR Extracted Data
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500">Bank Name</p>
                    <p className="text-sm font-medium text-gray-900">
                      {selectedReceipt.ocrData.bankName}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Transaction Ref</p>
                    <p className="text-sm font-medium text-gray-900">
                      {selectedReceipt.ocrData.transactionRef}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Extracted Amount</p>
                    <p className="text-sm font-medium text-gray-900">
                      ETB{' '}
                      {selectedReceipt.ocrData.extractedAmount.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Extracted Date</p>
                    <p className="text-sm font-medium text-gray-900">
                      {selectedReceipt.ocrData.extractedDate}
                    </p>
                  </div>
                </div>

                {/* Amount mismatch warning */}
                {selectedReceipt.ocrData.extractedAmount !==
                  selectedReceipt.amount && (
                  <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-xs text-yellow-700 font-medium">
                      ⚠️ Amount mismatch: Expected ETB{' '}
                      {selectedReceipt.amount.toLocaleString()} but extracted ETB{' '}
                      {selectedReceipt.ocrData.extractedAmount.toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Status & Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Status:</span>
                <Badge status={selectedReceipt.status} />
              </div>

              {selectedReceipt.status === 'pending' && (
                <div className="flex gap-3">
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleReject(selectedReceipt.id)}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleVerify(selectedReceipt.id)}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Verify
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
