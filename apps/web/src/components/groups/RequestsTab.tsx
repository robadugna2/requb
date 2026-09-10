'use client';

import React, { useState, useEffect } from 'react';
import {
  Gavel,
  ArrowLeftRight,
  Shield,
  Plus,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/ui/StatusBadge';
import Modal from '@/components/ui/Modal';
import {
  getGroupDisputes,
  fileDispute,
  resolveDispute,
  getGroupTurnSwaps,
  respondTurnSwap,
  requestTurnSwap,
  getGroupGuarantors,
  addGuarantor,
  updateGuarantorStatus,
  deleteGuarantor,
} from '@/lib/api';
import type { GroupDetail, DisputeItem, TurnSwapRequest, GuarantorItem } from '@/lib/api';

interface RequestsTabProps {
  group: GroupDetail;
  groupId: string;
  refreshKey: number;
  notifySuccess: (msg: string) => void;
  notifyError: (msg: string) => void;
}

function SectionCard({
  icon,
  title,
  subtitle,
  count,
  pendingCount,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  count: number;
  pendingCount?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-gray-50 dark:bg-white/[0.04] rounded-lg flex-shrink-0">{icon}</div>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white/90 flex items-center gap-2 flex-wrap">
              {title}
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-white/[0.08] px-2 py-0.5 rounded-full">{count}</span>
              {pendingCount != null && pendingCount > 0 && (
                <span className="text-xs font-semibold text-amber-700 dark:text-warning-400 bg-amber-100 dark:bg-warning-500/20 px-2 py-0.5 rounded-full">
                  {pendingCount} pending
                </span>
              )}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
          </div>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function EmptyState({ icon, title, hint }: { icon: React.ReactNode; title: string; hint?: string }) {
  return (
    <div className="text-center py-12">
      <div className="flex justify-center mb-3 text-gray-300">{icon}</div>
      <p className="text-gray-500 dark:text-gray-400 text-sm">{title}</p>
      {hint && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}

export default function RequestsTab({
  group,
  groupId,
  refreshKey,
  notifySuccess,
  notifyError,
}: RequestsTabProps) {
  const [disputes, setDisputes] = useState<DisputeItem[]>([]);
  const [disputesLoading, setDisputesLoading] = useState(false);
  const [swaps, setSwaps] = useState<TurnSwapRequest[]>([]);
  const [swapsLoading, setSwapsLoading] = useState(false);
  const [guarantors, setGuarantors] = useState<GuarantorItem[]>([]);
  const [guarantorsLoading, setGuarantorsLoading] = useState(false);

  // Modals & forms
  const [showFileDisputeModal, setShowFileDisputeModal] = useState(false);
  const [disputeForm, setDisputeForm] = useState({ type: 'PAYMENT', description: '', againstUserId: '' });
  const [filingDispute, setFilingDispute] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState<string | null>(null);
  const [resolveText, setResolveText] = useState('');
  const [resolving, setResolving] = useState(false);
  const [showRequestSwapModal, setShowRequestSwapModal] = useState(false);
  const [swapForm, setSwapForm] = useState({ targetId: '', reason: '' });
  const [requestingSwap, setRequestingSwap] = useState(false);
  const [showAssignGuarantorModal, setShowAssignGuarantorModal] = useState(false);
  const [guarantorForm, setGuarantorForm] = useState({ guarantorUserId: '', guaranteedUserId: '', notes: '' });
  const [assigningGuarantor, setAssigningGuarantor] = useState(false);
  const [updatingGuarantorId, setUpdatingGuarantorId] = useState<string | null>(null);

  const fetchDisputes = async () => {
    setDisputesLoading(true);
    try { const data = await getGroupDisputes(groupId); setDisputes(data); } catch {} finally { setDisputesLoading(false); }
  };
  const fetchSwaps = async () => {
    setSwapsLoading(true);
    try { const data = await getGroupTurnSwaps(groupId); setSwaps(data); } catch {} finally { setSwapsLoading(false); }
  };
  const fetchGuarantors = async () => {
    setGuarantorsLoading(true);
    try { const data = await getGroupGuarantors(groupId); setGuarantors(data); } catch {} finally { setGuarantorsLoading(false); }
  };

  useEffect(() => {
    fetchDisputes();
    fetchSwaps();
    fetchGuarantors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, refreshKey]);

  const handleFileDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    setFilingDispute(true);
    try {
      await fileDispute({ groupId, type: disputeForm.type, description: disputeForm.description, againstUserId: disputeForm.againstUserId || undefined });
      setShowFileDisputeModal(false); setDisputeForm({ type: 'PAYMENT', description: '', againstUserId: '' });
      notifySuccess('Dispute filed.'); await fetchDisputes();
    } catch { notifyError('Failed to file dispute.'); } finally { setFilingDispute(false); }
  };

  const handleResolveDispute = async () => {
    if (!showResolveModal) return;
    setResolving(true);
    try {
      await resolveDispute(showResolveModal, resolveText, 'RESOLVED');
      setShowResolveModal(null); setResolveText('');
      notifySuccess('Dispute resolved.'); await fetchDisputes();
    } catch { notifyError('Failed to resolve dispute.'); } finally { setResolving(false); }
  };

  const handleRespondSwap = async (swapId: string, approve: boolean) => {
    try {
      await respondTurnSwap(swapId, approve);
      notifySuccess(approve ? 'Swap approved.' : 'Swap rejected.'); await fetchSwaps();
    } catch { notifyError('Failed to respond to swap.'); }
  };

  const handleRequestSwap = async (e: React.FormEvent) => {
    e.preventDefault();
    setRequestingSwap(true);
    try {
      await requestTurnSwap({ groupId, targetId: swapForm.targetId, reason: swapForm.reason || undefined });
      setShowRequestSwapModal(false); setSwapForm({ targetId: '', reason: '' });
      notifySuccess('Swap request sent successfully.'); await fetchSwaps();
    } catch { notifyError('Failed to send swap request.'); } finally { setRequestingSwap(false); }
  };

  const handleAssignGuarantor = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssigningGuarantor(true);
    try {
      await addGuarantor({ groupId, guarantorUserId: guarantorForm.guarantorUserId, guaranteedUserId: guarantorForm.guaranteedUserId, notes: guarantorForm.notes || undefined });
      setShowAssignGuarantorModal(false);
      setGuarantorForm({ guarantorUserId: '', guaranteedUserId: '', notes: '' });
      notifySuccess('Guarantor (ዋስ) assigned successfully!'); await fetchGuarantors();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      notifyError(axiosErr.response?.data?.message || 'Failed to assign guarantor.');
    } finally { setAssigningGuarantor(false); }
  };

  const handleUpdateGuarantorStatus = async (guarantorId: string, status: 'ACTIVE' | 'RELEASED' | 'CALLED') => {
    setUpdatingGuarantorId(guarantorId);
    try {
      await updateGuarantorStatus(guarantorId, status);
      notifySuccess(`Guarantor status updated to ${status}.`); await fetchGuarantors();
    } catch { notifyError('Failed to update guarantor status.'); } finally { setUpdatingGuarantorId(null); }
  };

  const handleDeleteGuarantor = async (guarantorId: string) => {
    if (!window.confirm('Remove this guarantor arrangement?')) return;
    try {
      await deleteGuarantor(guarantorId);
      notifySuccess('Guarantor arrangement removed.'); await fetchGuarantors();
    } catch { notifyError('Failed to remove guarantor.'); }
  };

  const openDisputes = disputes.filter((d) => d.status === 'OPEN').length;
  const pendingSwaps = swaps.filter((s) => s.status === 'PENDING').length;
  const activeGuarantors = guarantors.filter((g) => g.status === 'ACTIVE').length;

  return (
    <div className="space-y-6">
      {/* Ethiopian context note for Wase */}
      <div className="card bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-amber-100 dark:bg-warning-500/20 rounded-lg flex-shrink-0">
            <Shield className="h-5 w-5 text-amber-700 dark:text-warning-400" />
          </div>
          <div>
            <h4 className="font-semibold text-amber-900">Wase / ዋስ (Guarantor)</h4>
            <p className="text-sm text-amber-700 dark:text-warning-400 mt-0.5">
              In traditional Equb, a guarantor vouches for a member&apos;s reliability and can be called upon if they default.
            </p>
          </div>
        </div>
      </div>

      {/* Disputes */}
      <SectionCard
        icon={<Gavel className="h-5 w-5 text-orange-500 dark:text-orange-400" />}
        title="Disputes"
        subtitle="Member conflicts requiring resolution"
        count={disputes.length}
        pendingCount={openDisputes}
        action={
          <Button size="sm" onClick={() => setShowFileDisputeModal(true)}>
            <Gavel className="h-4 w-4 mr-1.5" />
            File Dispute
          </Button>
        }
      >
        {disputesLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          </div>
        ) : disputes.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-white/[0.04] border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th className="table-header">Filed By</th>
                  <th className="table-header">Against</th>
                  <th className="table-header">Type</th>
                  <th className="table-header">Description</th>
                  <th className="table-header">Status</th>
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {disputes.map((dispute) => (
                  <tr key={dispute.id} className="hover:bg-gray-50/30 transition-colors">
                    <td className="table-cell font-medium text-gray-900 dark:text-white/90">
                      {dispute.filedBy?.name || 'Unknown'}
                    </td>
                    <td className="table-cell text-gray-500 dark:text-gray-400">
                      {dispute.againstUser?.name || 'Group / General'}
                    </td>
                    <td className="table-cell">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-white/[0.08] text-gray-800 dark:text-white/90 uppercase">
                        {dispute.type}
                      </span>
                    </td>
                    <td className="table-cell text-gray-500 dark:text-gray-400 max-w-xs truncate" title={dispute.description}>
                      {dispute.description}
                    </td>
                    <td className="table-cell">
                      <StatusBadge
                        status={
                          dispute.status === 'RESOLVED'
                            ? 'verified'
                            : dispute.status === 'OPEN'
                            ? 'rejected'
                            : 'pending'
                        }
                      >
                        {dispute.status}
                      </StatusBadge>
                    </td>
                    <td className="table-cell text-right">
                      {dispute.status === 'OPEN' && (
                        <Button size="sm" variant="default" onClick={() => setShowResolveModal(dispute.id)}>
                          Resolve
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={<Gavel className="h-10 w-10" />} title="No disputes filed." hint="Disputes about payments, rules or the lottery appear here." />
        )}
      </SectionCard>

      {/* Turn Swaps */}
      <SectionCard
        icon={<ArrowLeftRight className="h-5 w-5 text-blue-500" />}
        title="Turn Swaps"
        subtitle="Requests to exchange payout turn positions"
        count={swaps.length}
        pendingCount={pendingSwaps}
        action={
          <Button size="sm" onClick={() => setShowRequestSwapModal(true)}>
            <ArrowLeftRight className="h-4 w-4 mr-1.5" />
            Request Swap
          </Button>
        }
      >
        {swapsLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          </div>
        ) : swaps.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-white/[0.04] border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th className="table-header">Requester</th>
                  <th className="table-header">Target</th>
                  <th className="table-header text-center">Req. Turn</th>
                  <th className="table-header text-center">Tgt. Turn</th>
                  <th className="table-header">Reason</th>
                  <th className="table-header">Status</th>
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {swaps.map((swap) => (
                  <tr key={swap.id} className="hover:bg-gray-50/30 transition-colors">
                    <td className="table-cell font-medium text-gray-900 dark:text-white/90">
                      {swap.requester?.name || 'Unknown'}
                    </td>
                    <td className="table-cell text-gray-900 dark:text-white/90">
                      {swap.target?.name || 'Unknown'}
                    </td>
                    <td className="table-cell text-center text-gray-500 dark:text-gray-400 font-semibold">{swap.requesterTurn}</td>
                    <td className="table-cell text-center text-gray-500 dark:text-gray-400 font-semibold">{swap.targetTurn}</td>
                    <td className="table-cell text-gray-500 dark:text-gray-400 max-w-xs truncate" title={swap.reason}>
                      {swap.reason || '-'}
                    </td>
                    <td className="table-cell">
                      <StatusBadge
                        status={
                          swap.status === 'APPROVED'
                            ? 'verified'
                            : swap.status === 'REJECTED'
                            ? 'rejected'
                            : 'pending'
                        }
                      >
                        {swap.status}
                      </StatusBadge>
                    </td>
                    <td className="table-cell text-right">
                      {swap.status === 'PENDING' && (
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" variant="default" onClick={() => handleRespondSwap(swap.id, true)}>
                            Approve
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => handleRespondSwap(swap.id, false)}>
                            Reject
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={<ArrowLeftRight className="h-10 w-10" />} title="No turn swap requests." />
        )}
      </SectionCard>

      {/* Guarantors (Wase / ዋስ) */}
      <SectionCard
        icon={<Shield className="h-5 w-5 text-amber-600 dark:text-warning-400" />}
        title="Guarantors (ዋስ)"
        subtitle="Traditional guarantor arrangements"
        count={guarantors.length}
        pendingCount={activeGuarantors}
        action={
          <Button size="sm" onClick={() => setShowAssignGuarantorModal(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Assign
          </Button>
        }
      >
        {guarantorsLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          </div>
        ) : guarantors.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-white/[0.04] border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th className="table-header">Guarantor</th>
                  <th className="table-header">Guaranteed</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Notes</th>
                  <th className="table-header">Assigned On</th>
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {guarantors.map((g) => (
                  <tr key={g.id} className="hover:bg-gray-50/30 transition-colors">
                    <td className="table-cell">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white/90">{g.guarantorUser?.name}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">{g.guarantorUser?.phone}</p>
                      </div>
                    </td>
                    <td className="table-cell">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white/90">{g.guaranteedUser?.name}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">{g.guaranteedUser?.phone}</p>
                      </div>
                    </td>
                    <td className="table-cell">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          g.status === 'ACTIVE'
                            ? 'bg-green-100 dark:bg-success-500/20 text-green-700 dark:text-success-400'
                            : g.status === 'CALLED'
                            ? 'bg-red-100 dark:bg-error-500/20 text-red-700 dark:text-error-400'
                            : 'bg-gray-100 dark:bg-white/[0.08] text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        {g.status === 'ACTIVE' ? `✅ Active` : g.status === 'CALLED' ? `🚨 Called` : `⚪ Released`}
                      </span>
                    </td>
                    <td className="table-cell text-gray-500 dark:text-gray-400 text-sm max-w-xs truncate" title={g.notes}>
                      {g.notes || '-'}
                    </td>
                    <td className="table-cell text-gray-500 dark:text-gray-400 text-sm">
                      {new Date(g.createdAt).toLocaleDateString()}
                    </td>
                    <td className="table-cell text-right">
                      <div className="flex justify-end gap-1.5">
                        {g.status === 'ACTIVE' && (
                          <>
                            <Button
                              size="sm"
                              variant="secondary"
                              loading={updatingGuarantorId === g.id}
                              onClick={() => handleUpdateGuarantorStatus(g.id, 'RELEASED')}
                            >
                              Release
                            </Button>
                            <Button
                              size="sm"
                              variant="default"
                              loading={updatingGuarantorId === g.id}
                              onClick={() => handleUpdateGuarantorStatus(g.id, 'CALLED')}
                            >
                              Call
                            </Button>
                          </>
                        )}
                        {(g.status === 'RELEASED' || g.status === 'CALLED') && (
                          <button
                            onClick={() => handleDeleteGuarantor(g.id)}
                            className="p-1.5 text-red-500 dark:text-error-400 hover:bg-red-50 dark:hover:bg-error-500/10 rounded-lg transition-colors"
                            title="Remove record"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={<Shield className="h-10 w-10" />} title="No guarantor arrangements." hint="Assign a guarantor when the group rules require one." />
        )}
      </SectionCard>

      {/* ─── Modals ─────────────────────────────────────────── */}

      {/* File Dispute Modal */}
      <Modal
        isOpen={showFileDisputeModal}
        onClose={() => {
          setShowFileDisputeModal(false);
          setDisputeForm({ type: 'PAYMENT', description: '', againstUserId: '' });
        }}
        title="File a Dispute"
        size="sm"
      >
        <form onSubmit={handleFileDispute} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Dispute Type</label>
            <select
              value={disputeForm.type}
              onChange={(e) => setDisputeForm({ ...disputeForm, type: e.target.value })}
              className="input-field"
              required
            >
              <option value="PAYMENT">Payment Issue</option>
              <option value="RULE_VIOLATION">Rule Violation</option>
              <option value="LOTTERY">Lottery Issue</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Against Member</label>
            <select
              value={disputeForm.againstUserId}
              onChange={(e) => setDisputeForm({ ...disputeForm, againstUserId: e.target.value })}
              className="input-field"
            >
              <option value="">General dispute (no specific member)</option>
              {group?.members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Description</label>
            <textarea
              value={disputeForm.description}
              onChange={(e) => setDisputeForm({ ...disputeForm, description: e.target.value })}
              className="input-field"
              rows={4}
              placeholder="Describe the issue in detail…"
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowFileDisputeModal(false);
                setDisputeForm({ type: 'PAYMENT', description: '', againstUserId: '' });
              }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={filingDispute}>
              Submit Dispute
            </Button>
          </div>
        </form>
      </Modal>

      {/* Resolve Dispute Modal */}
      <Modal
        isOpen={!!showResolveModal}
        onClose={() => {
          setShowResolveModal(null);
          setResolveText('');
        }}
        title="Resolve Dispute"
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Resolution Notes</label>
            <textarea
              value={resolveText}
              onChange={(e) => setResolveText(e.target.value)}
              className="input-field"
              rows={4}
              placeholder="How was this dispute resolved?"
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowResolveModal(null);
                setResolveText('');
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleResolveDispute} loading={resolving} disabled={!resolveText.trim()}>
              Mark Resolved
            </Button>
          </div>
        </div>
      </Modal>

      {/* Request Turn Swap Modal */}
      <Modal
        isOpen={showRequestSwapModal}
        onClose={() => {
          setShowRequestSwapModal(false);
          setSwapForm({ targetId: '', reason: '' });
        }}
        title="Request Turn Swap"
        size="sm"
      >
        <form onSubmit={handleRequestSwap} className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Request to exchange payout turn positions with another member.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Target Member</label>
            <select
              value={swapForm.targetId}
              onChange={(e) => setSwapForm({ ...swapForm, targetId: e.target.value })}
              className="input-field"
              required
            >
              <option value="" disabled>Select a member…</option>
              {group?.members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Reason</label>
            <textarea
              value={swapForm.reason}
              onChange={(e) => setSwapForm({ ...swapForm, reason: e.target.value })}
              className="input-field"
              rows={3}
              placeholder="Why do you want to swap turns?"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowRequestSwapModal(false);
                setSwapForm({ targetId: '', reason: '' });
              }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={requestingSwap} disabled={!swapForm.targetId}>
              Send Request
            </Button>
          </div>
        </form>
      </Modal>

      {/* Assign Guarantor (Wase) Modal */}
      <Modal
        isOpen={showAssignGuarantorModal}
        onClose={() => {
          setShowAssignGuarantorModal(false);
          setGuarantorForm({ guarantorUserId: '', guaranteedUserId: '', notes: '' });
        }}
        title="Assign Guarantor (ዋስ)"
        size="sm"
      >
        <form onSubmit={handleAssignGuarantor} className="space-y-4">
          <div className="p-3 bg-amber-50 dark:bg-warning-500/10 rounded-lg border border-amber-100">
            <p className="text-sm text-amber-700 dark:text-warning-400">
              <strong>Rule:</strong> A member who has already won cannot act as a guarantor.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Guarantor</label>
            <select
              value={guarantorForm.guarantorUserId}
              onChange={(e) => setGuarantorForm({ ...guarantorForm, guarantorUserId: e.target.value })}
              className="input-field"
              required
            >
              <option value="" disabled>Select guarantor…</option>
              {group?.members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}{member.hasWon ? ` ⚠️ already won` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Guaranteed Member</label>
            <select
              value={guarantorForm.guaranteedUserId}
              onChange={(e) => setGuarantorForm({ ...guarantorForm, guaranteedUserId: e.target.value })}
              className="input-field"
              required
            >
              <option value="" disabled>Select member…</option>
              {group?.members
                .filter((m) => m.id !== guarantorForm.guarantorUserId)
                .map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Notes</label>
            <textarea
              value={guarantorForm.notes}
              onChange={(e) => setGuarantorForm({ ...guarantorForm, notes: e.target.value })}
              className="input-field"
              rows={2}
              placeholder="Optional notes…"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowAssignGuarantorModal(false);
                setGuarantorForm({ guarantorUserId: '', guaranteedUserId: '', notes: '' });
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={assigningGuarantor}
              disabled={!guarantorForm.guarantorUserId || !guarantorForm.guaranteedUserId}
            >
              <Shield className="h-4 w-4 mr-1.5" />
              Assign
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
