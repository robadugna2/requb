'use client';

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ScanLine,
  Camera,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  UserRound,
  Plus,
  Trash2,
  RefreshCw,
  Eye,
  Image as ImageIcon,
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/Toast';
import { CbeTransactionCard } from '@/components/ui/CbeVerifyPanel';
import FtScannerCamera from '@/components/scan/FtScannerCamera';
import FtImageCropper from '@/components/scan/FtImageCropper';
import MemberPickerModal from '@/components/scan/MemberPickerModal';
import {
  getGroups,
  getGroup,
  getDeposits,
  uploadPhoto,
  scanFtNumbers,
  cbeLookup,
  suggestMembers,
  createDeposit,
  autoVerifyDepositCbe,
  updateGroupCbeAccounts,
  normalizeFtNumber,
  getAiSettings,
  addPayerAlias,
} from '@/lib/api';
import type {
  GroupListItem,
  GroupDetail,
  GroupMember,
  CbeTransactionData,
  MemberSuggestion,
  FtScanResult,
} from '@/lib/api';

// ─── Types & helpers ──────────────────────────────────────────────────────────

interface ScanItem {
  ftNumber: string;
  status: 'verifying' | 'found' | 'error';
  error?: string;
  tx?: CbeTransactionData;
  /** Payer name Gemini read from the statement (fallback when the CBE
   *  lookup has no payer field) */
  geminiSender?: string;
  member: { id: string; name: string } | null;
  autoPaired: boolean;
  matchScore?: number;
  matchVia?: 'name' | 'bankAccountName' | 'history' | 'payerAlias';
  suggestions: MemberSuggestion[];
  amount?: number;
  /** yyyy-mm-dd for the date input */
  depositDate?: string;
  narrative?: string;
  cycleId?: string;
  isDuplicate: boolean;
  creating?: boolean;
  outcome?: 'verified' | 'pending' | 'failed';
  outcomeMsg?: string;
  /** Whether the detected payer name was registered as an authorized payer */
  aliasRegistered?: boolean;
  registeringAlias?: boolean;
}

const FT_REGEX = /^FT\w{10}$/i;
const ACCOUNT_REGEX = /^1000\d{9}$/;

function axiosMessage(err: unknown): string {
  const axiosErr = err as { response?: { data?: { message?: string } }; message?: string };
  return axiosErr?.response?.data?.message || axiosErr?.message || 'Something went wrong';
}

/** Parses CBE receipt date strings like "07/04/2026, 10:45:30 AM". */
function parseCbeDate(dateStr: string): Date | undefined {
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;
    const parts = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (parts) {
      return new Date(`${parts[3]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`);
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

function toInputDate(d?: Date): string | undefined {
  if (!d || isNaN(d.getTime())) return undefined;
  return d.toLocaleDateString('en-CA');
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

interface AttachedPhoto {
  file: File;
  /** Object URL for the thumbnail preview */
  url: string;
}

/** Thumbnail strip of the extra attached statement pages, each removable. */
function AttachedPhotoThumbs({
  photos,
  onRemove,
}: {
  photos: AttachedPhoto[];
  onRemove: (index: number) => void;
}) {
  if (photos.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {photos.map((p, i) => (
        <div key={p.url} className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={p.url}
            alt={`Attached statement page ${i + 2}`}
            className="h-12 w-12 rounded-lg object-cover border border-gray-200 dark:border-gray-800"
          />
          <button
            type="button"
            onClick={() => onRemove(i)}
            aria-label={`Remove attached photo ${i + 1}`}
            className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-gray-900 text-[10px] leading-none text-white hover:bg-red-600"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ScanPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      }
    >
      <ScanPageContent />
    </Suspense>
  );
}

/**
 * The DashboardLayout hosts the ToastProvider, so the toast-consuming
 * workflow must render as its child — hooks cannot read context from a
 * descendant provider.
 */
function ScanPageContent() {
  return (
    <DashboardLayout>
      <ScanWorkflow />
    </DashboardLayout>
  );
}

function ScanWorkflow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();

  // Setup state
  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState(searchParams.get('group') || '');
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [loadingGroup, setLoadingGroup] = useState(false);
  const [accountNumber, setAccountNumber] = useState('');
  const [addingAccount, setAddingAccount] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [pendingCrop, setPendingCrop] = useState<File | null>(null);
  /** Extra statement pages attached to the batched scan (beyond the first) */
  const [attached, setAttached] = useState<AttachedPhoto[]>([]);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const galleryRef = useRef<HTMLInputElement>(null);
  const extraGalleryRef = useRef<HTMLInputElement>(null);

  // Capture state
  const [capturePreview, setCapturePreview] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [evidenceError, setEvidenceError] = useState('');
  const [uploadingEvidence, setUploadingEvidence] = useState(false);

  // Scan state
  const [scanning, setScanning] = useState(false);
  const [scanBank, setScanBank] = useState('');
  const [scanVia, setScanVia] = useState<FtScanResult['detectedVia']>('none');
  const [scanSenders, setScanSenders] = useState<Record<string, string>>({});
  const [scanNotice, setScanNotice] = useState('');
  const [manualFt, setManualFt] = useState('');

  // Review state
  const [items, setItems] = useState<ScanItem[]>([]);
  const [existingFts, setExistingFts] = useState<Set<string>>(new Set());
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);
  const [expandedRaw, setExpandedRaw] = useState<number | null>(null);

  // Confirm state
  const [creating, setCreating] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const activeCycle = useMemo(
    () => group?.cycles?.find((c) => c.status === 'ACTIVE'),
    [group],
  );
  const accountReady =
    (group?.cbeAccountNumbers?.length ?? 0) > 0 || ACCOUNT_REGEX.test(accountNumber);

  // AI detection needs at least one provider (Gemini Web proxy or Gemini key)
  useEffect(() => {
    getAiSettings()
      .then((s) =>
        setAiConfigured(Boolean(s.geminiWeb?.configured || s.gemini?.configured)),
      )
      .catch(() => setAiConfigured(null));
  }, []);

  // Fetch groups on mount
  useEffect(() => {
    let cancelled = false;
    getGroups()
      .then((data) => {
        if (!cancelled) setGroups(data);
      })
      .catch(() => {
        if (!cancelled) showToast('Failed to load groups', 'error');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch group detail whenever selection changes
  useEffect(() => {
    if (!selectedGroupId) {
      setGroup(null);
      return;
    }
    let cancelled = false;
    setLoadingGroup(true);
    getGroup(selectedGroupId)
      .then((detail) => {
        if (cancelled) return;
        setGroup(detail);
        // Preselect first configured CBE receiver account
        if (detail.cbeAccountNumbers?.length) setAccountNumber(detail.cbeAccountNumbers[0]);
      })
      .catch(() => {
        if (!cancelled) showToast('Failed to load group details', 'error');
      })
      .finally(() => {
        if (!cancelled) setLoadingGroup(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroupId]);

  const patchItem = (ft: string, patch: Partial<ScanItem>) => {
    setItems((prev) => prev.map((it) => (it.ftNumber === ft ? { ...it, ...patch } : it)));
  };

  // ─── Lookup pipeline ────────────────────────────────────────────────────────

  const runLookup = async (
    ft: string,
    grpId: string,
    account: string,
    senderFallback?: string,
  ) => {
    patchItem(ft, { status: 'verifying', error: undefined });
    try {
      const tx = await cbeLookup(ft, account);
      // CBE receipt payer is authoritative; the name Gemini read from the
      // statement is the fallback when the lookup has no payer field.
      const payerName = tx.payer || senderFallback;
      let member: ScanItem['member'] = null;
      let autoPaired = false;
      let matchScore: number | undefined;
      let matchVia: ScanItem['matchVia'];
      let suggestions: MemberSuggestion[] = [];
      if (payerName) {
        try {
          const res = await suggestMembers(grpId, payerName);
          suggestions = res.suggestions;
          if (res.bestMatch) {
            member = { id: res.bestMatch.userId, name: res.bestMatch.name };
            autoPaired = true;
            matchScore = res.bestMatch.score;
            matchVia = res.bestMatch.matchedVia;
          }
        } catch {
          /* suggestions are best-effort */
        }
      }
      setItems((prev) =>
        prev.map((it) =>
          it.ftNumber === ft
            ? {
                ...it,
                status: 'found',
                tx,
                member,
                autoPaired,
                matchScore,
                matchVia,
                suggestions,
                amount: it.amount ?? tx.amount,
                depositDate: it.depositDate ?? toInputDate(parseCbeDate(tx.date || '')),
                narrative: it.narrative ?? tx.reason ?? '',
                cycleId: it.cycleId ?? activeCycle?.id,
              }
            : it,
        ),
      );
    } catch (err: unknown) {
      patchItem(ft, { status: 'error', error: axiosMessage(err), cycleId: activeCycle?.id });
    }
  };

  const lookupsForFts = async (
    fts: string[],
    grpId: string,
    account: string,
    senders?: Record<string, string>,
  ) => {
    // Two lookups at a time — CBE and the suggestion endpoint are both IO bound
    for (let i = 0; i < fts.length; i += 2) {
      await Promise.all(
        fts.slice(i, i + 2).map((ft) => runLookup(ft, grpId, account, senders?.[ft])),
      );
    }
  };

  // ─── Capture & scan ─────────────────────────────────────────────────────────

  const loadExistingFts = async (grpId: string) => {
    try {
      const deposits = await getDeposits({ groupId: grpId });
      setExistingFts(
        new Set(deposits.map((d) => (d.ftNumber || '').toUpperCase()).filter(Boolean)),
      );
    } catch {
      /* duplicate pre-check is best-effort; server still rejects duplicates */
    }
  };

  /**
   * Persist a manually typed receiver account onto the group the first time
   * it's used, so it becomes a saved choice for every future scan. No-op when
   * the account is already configured.
   */
  const ensureAccountSaved = async (): Promise<string> => {
    if (!group || !ACCOUNT_REGEX.test(accountNumber)) return accountNumber;
    if (group.cbeAccountNumbers?.includes(accountNumber)) return accountNumber;
    const updated = [...(group.cbeAccountNumbers ?? []), accountNumber];
    try {
      await updateGroupCbeAccounts(group.id, updated);
      setGroup({ ...group, cbeAccountNumbers: updated });
      showToast('Receiver account saved to this group', 'success');
    } catch {
      showToast('Account used for this scan but could not be saved to the group', 'warning');
    }
    return accountNumber;
  };

  /** Attach image files as-is (no crop) to the current/next batched scan. */
  const attachFiles = (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (images.length === 0) return;
    setAttached((prev) => [
      ...prev,
      ...images.map((file) => ({ file, url: URL.createObjectURL(file) })),
    ]);
  };

  const removeAttached = (index: number) => {
    setAttached((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((_, i) => i !== index);
    });
  };

  /**
   * Gallery selection: with no first photo yet, the first picked file goes
   * through the crop step and any extra pages are attached to the same
   * batch. Once a session (or a pending crop) exists, everything picked is
   * attached as-is.
   */
  const handleGalleryFiles = (fileList: FileList | null) => {
    const files = fileList ? Array.from(fileList) : [];
    if (files.length === 0) return;
    if (sessionActive || pendingCrop) {
      attachFiles(files);
    } else {
      attachFiles(files.slice(1));
      setPendingCrop(files[0]);
    }
  };

  const startScanSession = async (file: File) => {
    setCameraOpen(false);
    setShowResults(false);
    setSessionActive(true);

    // Reset previous session
    setItems([]);
    setScanBank('');
    setScanVia('none');
    setScanSenders({});
    setScanNotice('');
    setEvidenceError('');
    if (capturePreview) URL.revokeObjectURL(capturePreview);
    setEvidenceUrl('');

    const preview = URL.createObjectURL(file);
    setCapturePreview(preview);

    if (!group) return;

    // The cropped first page plus any attached pages are read in ONE batched
    // request.
    const batch: File[] = [file, ...attached.map((a) => a.file)];

    // Upload evidence image and run FT detection in parallel
    setUploadingEvidence(true);
    setScanning(true);
    const uploadPromise = uploadPhoto(file)
      .then((url) => setEvidenceUrl(url))
      .catch(() => setEvidenceError('Failed to upload the statement photo. Retake or re-upload before creating deposits.'))
      .finally(() => setUploadingEvidence(false));

    const scanPromise = (async () => {
      // One automatic retry for transient failures (Render cold-start after a
      // deploy, or a brief Gemini 503) before surfacing an error.
      let result: FtScanResult;
      try {
        result = await scanFtNumbers(batch, accountNumber || undefined);
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 503 || status === 502 || status === 504 || !status) {
          await new Promise((r) => setTimeout(r, 3000));
          result = await scanFtNumbers(batch, accountNumber || undefined);
        } else {
          throw err;
        }
      }
      return result;
    })()
      .then(async (result) => {
        setScanBank(result.bankName || '');
        setScanVia(result.detectedVia ?? 'none');
        setScanSenders(result.senders ?? {});
        const fts = Array.from(new Set(result.ftNumbers.map((f) => f.toUpperCase())));
        if (fts.length === 0) {
          setScanNotice(
            result.errors?.[0] ||
              'No CBE FT numbers were detected. Try better lighting or a closer photo, or add the FT number manually below.',
          );
          return;
        }
        await loadExistingFts(selectedGroupId);
        setItems(
          fts.map((ft) => ({
            ftNumber: ft,
            status: 'verifying' as const,
            member: null,
            autoPaired: false,
            suggestions: [],
            cycleId: activeCycle?.id,
            isDuplicate: false,
          })),
        );
        const savedAccount = await ensureAccountSaved();
        await lookupsForFts(fts, selectedGroupId, savedAccount, result.senders);
      })
      .catch((err: unknown) => {
        const status = (err as { response?: { status?: number } })?.response?.status;
        const msg = axiosMessage(err);
        setScanNotice(
          status === 503 || /status code 50\d|timeout|network|failed to fetch/i.test(msg)
            ? 'The AI service is briefly unavailable (server waking up or Google is busy). Please try the scan again in a few seconds.'
            : msg,
        );
      })
      .finally(() => setScanning(false));

    await Promise.all([uploadPromise, scanPromise]);
  };

  const addManualFt = async () => {
    // Accept extended identifiers ("FT24AB123456\BNK") — the suffix is dropped
    const ft = (normalizeFtNumber(manualFt) ?? '').toUpperCase();
    if (!FT_REGEX.test(ft)) {
      showToast('Invalid FT format. Expected: FT followed by 10 alphanumeric characters', 'error');
      return;
    }
    if (items.some((it) => it.ftNumber === ft)) {
      showToast('This FT number is already in the list', 'warning');
      return;
    }
    setManualFt('');
    setScanNotice('');
    const newItem: ScanItem = {
      ftNumber: ft,
      status: 'verifying',
      member: null,
      autoPaired: false,
      suggestions: [],
      cycleId: activeCycle?.id,
      isDuplicate: existingFts.has(ft),
    };
    setItems((prev) => [...prev, newItem]);
    const savedAccount = await ensureAccountSaved();
    await runLookup(ft, selectedGroupId, savedAccount);
  };

  const removeItem = (ft: string) => {
    setItems((prev) => prev.filter((it) => it.ftNumber !== ft));
  };

  const retryItem = async (ft: string) => {
    await runLookup(ft, selectedGroupId, accountNumber, scanSenders[ft]);
  };

  // Self-learning: register the detected payer name as an authorized payer
  // for the paired member, so future scans auto-pair without a manual pick.
  const registerPayerAlias = async (ft: string, memberId: string, payerName: string) => {
    patchItem(ft, { registeringAlias: true });
    try {
      await addPayerAlias(memberId, payerName, 'registered from FT scan');
      patchItem(ft, { registeringAlias: false, aliasRegistered: true });
      showToast(`"${payerName}" registered as an authorized payer`, 'success');
    } catch (err: unknown) {
      patchItem(ft, { registeringAlias: false });
      showToast(axiosMessage(err), 'error');
    }
  };

  // ─── Confirm & create ───────────────────────────────────────────────────────

  const canCreateItem = (it: ScanItem): boolean =>
    !it.isDuplicate &&
    !it.creating &&
    !it.outcome &&
    !!it.member &&
    !!(it.cycleId || activeCycle?.id) &&
    (it.status === 'found' ? it.amount !== undefined && it.amount > 0 : !!it.amount);

  const eligibleCount = items.filter(canCreateItem).length;

  const confirmCreateAll = async () => {
    if (!group) return;
    setCreating(true);
    setShowResults(true);
    const eligible = items.filter(canCreateItem);
    let okCount = 0;
    let failCount = 0;
    for (const it of eligible) {
      patchItem(it.ftNumber, { creating: true, outcome: undefined, outcomeMsg: undefined });
      try {
        const deposit = await createDeposit({
          cycleId: it.cycleId || activeCycle?.id || '',
          userId: it.member!.id,
          groupId: group.id,
          imageUrl: evidenceUrl,
          ftNumber: it.ftNumber,
          amount: it.amount,
          bankName: 'CBE',
          depositDate: it.depositDate ? new Date(`${it.depositDate}T12:00:00`).toISOString() : undefined,
          senderName: it.tx?.payer,
          senderAccount: it.tx?.payerAccount,
          receiverAccount: it.tx?.receiverAccount,
          branch: it.tx?.branch,
          narrative: it.narrative || undefined,
        });
        try {
          const res = await autoVerifyDepositCbe(deposit.id, accountNumber || undefined);
          okCount++;
          if (res.verified) {
            patchItem(it.ftNumber, {
              creating: false,
              outcome: 'verified',
              outcomeMsg: 'Created and auto-verified against CBE',
            });
          } else {
            patchItem(it.ftNumber, {
              creating: false,
              outcome: 'pending',
              outcomeMsg: res.result?.success
                ? 'Created — PENDING review (account or amount mismatch)'
                : `Created — PENDING review (${res.result?.error || 'CBE check failed'})`,
            });
          }
        } catch (err: unknown) {
          okCount++;
          patchItem(it.ftNumber, {
            creating: false,
            outcome: 'pending',
            outcomeMsg: `Created — PENDING review (auto-verify failed: ${axiosMessage(err)})`,
          });
        }
      } catch (err: unknown) {
        failCount++;
        patchItem(it.ftNumber, {
          creating: false,
          outcome: 'failed',
          outcomeMsg: axiosMessage(err),
        });
      }
    }
    setCreating(false);
    if (failCount === 0) showToast(`${okCount} deposit(s) created`, 'success');
    else showToast(`${okCount} created, ${failCount} failed — review the details below`, 'warning');
    await loadExistingFts(selectedGroupId);
    setItems((prev) => prev.map((it) => ({ ...it, isDuplicate: false })));
  };

  const resetSession = () => {
    if (capturePreview) URL.revokeObjectURL(capturePreview);
    attached.forEach((a) => URL.revokeObjectURL(a.url));
    setAttached([]);
    setCapturePreview('');
    setEvidenceUrl('');
    setEvidenceError('');
    setItems([]);
    setScanBank('');
    setScanVia('none');
    setScanSenders({});
    setScanNotice('');
    setShowResults(false);
    setSessionActive(false);
  };

  // ─── Derived ────────────────────────────────────────────────────────────────

  const verifiedCount = items.filter((it) => it.outcome === 'verified').length;
  const pendingCount = items.filter((it) => it.outcome === 'pending').length;
  const failedCount = items.filter((it) => it.outcome === 'failed').length;

  const totalAmount = items
    .filter((it) => canCreateItem(it))
    .reduce((sum, it) => sum + (it.amount || 0), 0);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white/90 flex items-center gap-2">
              <ScanLine className="h-6 w-6 text-brand-500" />
              Scan FT Numbers
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Photograph hardcopy bank statements — FT numbers are detected, verified against CBE, and paired to members automatically.
            </p>
          </div>
          {sessionActive && (
            <Button variant="secondary" size="sm" onClick={resetSession}>
              <RefreshCw className="h-4 w-4 mr-1" /> New Scan
            </Button>
          )}
        </div>

        {/* Setup card */}
        {!sessionActive && (
          <div className="card">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white/90 mb-4">
              1. Select the equb group
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Equb Group
                </label>
                <select
                  className="input-field"
                  value={selectedGroupId}
                  onChange={(e) => {
                    setSelectedGroupId(e.target.value);
                    setAccountNumber('');
                    setAddingAccount(false);
                  }}
                >
                  <option value="">Select a group...</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.membersCount} members)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  CBE Receiver Account
                </label>
                {group?.cbeAccountNumbers?.length && !addingAccount ? (
                  <div className="flex gap-2">
                    <select
                      className="input-field font-mono"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                    >
                      {group.cbeAccountNumbers.map((acc) => (
                        <option key={acc} value={acc}>
                          {acc}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setAddingAccount(true);
                        setAccountNumber('');
                      }}
                      className="flex-shrink-0"
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add
                    </Button>
                  </div>
                ) : (
                  <input
                    className="input-field font-mono"
                    placeholder="1000123456789 (13 digits, required for verification)"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                    maxLength={13}
                    inputMode="numeric"
                    autoFocus={addingAccount}
                  />
                )}
                {group && (addingAccount || !group.cbeAccountNumbers?.length) && (
                  <p className="text-xs text-gray-400 mt-1">
                    Entered once — it is saved to this group automatically on the next scan.
                  </p>
                )}
              </div>
            </div>

            {group && !activeCycle && (
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-warning-50 dark:bg-warning-500/10 border border-warning-200 dark:border-warning-500/20 p-3">
                <AlertTriangle className="h-4 w-4 text-warning-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-warning-800 dark:text-warning-400">
                  This group has no ACTIVE cycle. Start a cycle in the group page before recording deposits.
                </p>
              </div>
            )}

            {aiConfigured === false && (
              <div className="mt-4 flex items-start gap-2 rounded-lg bg-warning-50 dark:bg-warning-500/10 border border-warning-200 dark:border-warning-500/20 p-3">
                <AlertTriangle className="h-4 w-4 text-warning-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-warning-800 dark:text-warning-400 flex-1">
                  No AI provider is configured — FT scanning is disabled. Set up the Gemini Web proxy or add the free Gemini key in Settings → AI Configuration.
                </p>
                <Button variant="secondary" size="sm" onClick={() => router.push('/settings')} className="flex-shrink-0">
                  Open Settings
                </Button>
              </div>
            )}

            <div className="mt-5 flex flex-col sm:flex-row gap-3">
              <Button onClick={() => setCameraOpen(true)} disabled={!selectedGroupId || loadingGroup || !accountReady}>
                <Camera className="h-4 w-4 mr-1" /> Open Camera
              </Button>
              <Button variant="secondary" onClick={() => galleryRef.current?.click()} disabled={!selectedGroupId || loadingGroup || !accountReady}>
                <ImageIcon className="h-4 w-4 mr-1" /> Upload Statement Photo
              </Button>
              <Button variant="secondary" onClick={() => extraGalleryRef.current?.click()}>
                <Plus className="h-4 w-4 mr-1" /> Add Another Photo
              </Button>
            </div>

            {attached.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                  {attached.length} extra page(s) attached — they are read together with the first photo in one scan.
                </p>
                <AttachedPhotoThumbs photos={attached} onRemove={removeAttached} />
              </div>
            )}
          </div>
        )}

        {/* Statement photo + detected FTs */}
        {sessionActive && capturePreview && (
          <div className="card">
            <div className="flex flex-col md:flex-row gap-5">
              <div className="md:w-56 flex-shrink-0">
                <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={capturePreview} alt="Captured statement" className="w-full max-h-64 md:max-h-40 object-cover" />
                  {uploadingEvidence && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-white" />
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Button variant="secondary" size="sm" onClick={() => setCameraOpen(true)}>
                    <Camera className="h-3.5 w-3.5 mr-1" /> Retake
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => extraGalleryRef.current?.click()}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Photo
                  </Button>
                  <Button variant="secondary" size="sm" onClick={resetSession}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Discard
                  </Button>
                </div>
                {attached.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-1">
                      +{attached.length} extra page(s) · included in Retake scans
                    </p>
                    <AttachedPhotoThumbs photos={attached} onRemove={removeAttached} />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">
                    Detected FT Numbers
                  </h3>
                  <div className="flex items-center gap-2">
                    {scanVia === 'gemini-web' && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 dark:bg-theme-purple-500/10 text-purple-700 dark:text-purple-400">
                        Detected via Gemini Web proxy
                      </span>
                    )}
                    {scanVia === 'gemini' && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 dark:bg-theme-purple-500/10 text-purple-700 dark:text-purple-400">
                        Detected via Gemini AI
                      </span>
                    )}
                    {scanBank && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/[0.06] text-gray-600 dark:text-gray-300">
                        Bank: {scanBank}
                      </span>
                    )}
                  </div>
                </div>

                {scanning ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-3 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Reading the statement for FT numbers...
                  </p>
                ) : items.length === 0 ? (
                  <div className="mt-3">
                    {/not configured/i.test(scanNotice) ? (
                      <div className="rounded-lg border border-warning-200 dark:border-warning-500/20 bg-warning-50 dark:bg-warning-500/10 p-3 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                        <p className="text-xs text-warning-800 dark:text-warning-400">{scanNotice}</p>
                        <Button variant="secondary" size="sm" onClick={() => router.push('/settings')} className="flex-shrink-0">
                          Open AI Settings
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {scanNotice || 'No FT numbers detected yet.'}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {items.map((it) => (
                      <span
                        key={it.ftNumber}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono text-xs ${
                          it.isDuplicate
                            ? 'bg-red-50 dark:bg-error-500/10 text-red-700 dark:text-error-400 border border-red-200 dark:border-error-500/20'
                            : 'bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400 border border-brand-100 dark:border-brand-500/20'
                        }`}
                      >
                        {it.ftNumber}
                        <button
                          type="button"
                          onClick={() => removeItem(it.ftNumber)}
                          className="opacity-50 hover:opacity-100"
                          aria-label={`Remove ${it.ftNumber}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {evidenceError && (
                  <p className="text-xs text-error-600 dark:text-error-400 mt-2 flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> {evidenceError}
                  </p>
                )}

                <div className="flex gap-2 mt-4">
                  <input
                    className="input-field font-mono flex-1"
                    placeholder="Add FT number manually (e.g. FT24AB12345)"
                    value={manualFt}
                    onChange={(e) => setManualFt(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addManualFt())}
                  />
                  <Button variant="secondary" onClick={addManualFt} disabled={scanning || !accountReady}>
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Review cards */}
        {items.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white/90">
              Review Transactions
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 -mt-2 mb-1">
              Members are auto-paired from the CBE payer name — only step in when a name can&apos;t be matched confidently.
            </p>

            {items.map((it, idx) => {
              const ready = canCreateItem(it);
              return (
                <div
                  key={it.ftNumber}
                  className={`card ${ready ? '' : 'border-warning-300 dark:border-warning-500/30'}`}
                >
                  {/* Card header */}
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-bold text-blue-700 dark:text-brand-400 bg-blue-50 dark:bg-brand-500/10 px-2 py-0.5 rounded-lg">
                        {it.ftNumber}
                      </span>
                      {it.isDuplicate && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 dark:bg-error-500/10 text-red-700 dark:text-error-400 font-medium">
                          Already recorded — duplicate
                        </span>
                      )}
                      {it.status === 'verifying' && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Verifying with CBE...
                        </span>
                      )}
                      {it.status === 'found' && (
                        <span className="text-xs text-green-700 dark:text-success-400 flex items-center gap-1">
                          <CheckCircle className="h-3.5 w-3.5" /> Verified from CBE
                        </span>
                      )}
                      {it.status === 'error' && (
                        <span className="text-xs text-error-600 dark:text-error-400 flex items-center gap-1">
                          <XCircle className="h-3.5 w-3.5" /> Lookup failed
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {it.tx && (
                        <Button variant="ghost" size="sm" onClick={() => setExpandedRaw(expandedRaw === idx ? null : idx)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => retryItem(it.ftNumber)} disabled={it.status === 'verifying'}>
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => removeItem(it.ftNumber)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {it.status === 'error' && (
                    <p className="text-xs text-error-600 dark:text-error-400 mb-3 flex items-start gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                      {it.error} — fill the details manually below or remove this item.
                    </p>
                  )}

                  {/* Full CBE data */}
                  {expandedRaw === idx && it.tx && (
                    <div className="mb-4">
                      <CbeTransactionCard tx={it.tx} />
                    </div>
                  )}

                  {/* Member pairing */}
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Equb Member
                    </label>
                    {(it.tx?.payer || it.geminiSender) && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                        Payer on transaction:{' '}
                        <span className="font-medium text-gray-700 dark:text-gray-200">
                          {it.tx?.payer || it.geminiSender}
                        </span>
                      </p>
                    )}
                    {it.member ? (
                      <div className="flex items-center justify-between flex-wrap gap-2 rounded-lg border border-green-200 dark:border-success-500/20 bg-green-50 dark:bg-success-500/10 px-3 py-2">
                        <span className="flex items-center gap-2 text-sm font-medium text-green-800 dark:text-success-400">
                          <UserRound className="h-4 w-4" />
                          {it.member.name}
                          {it.autoPaired && typeof it.matchScore === 'number' && (
                            <span className="text-xs font-normal text-green-600 dark:text-success-500">
                              {it.matchVia === 'history'
                                ? 'auto-paired from past deposits'
                                : it.matchVia === 'bankAccountName'
                                  ? `auto-paired via bank account name (${Math.round(it.matchScore * 100)}%)`
                                  : it.matchVia === 'payerAlias'
                                    ? 'auto-paired via authorized payer'
                                    : `auto-paired (${Math.round(it.matchScore * 100)}%)`}
                            </span>
                          )}
                          {it.autoPaired && typeof it.matchScore === 'number' && it.matchScore < 0.6 && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-warning-50 dark:bg-warning-500/10 text-warning-700 dark:text-warning-400">
                              low confidence — verify member
                            </span>
                          )}
                        </span>
                        <Button variant="ghost" size="sm" onClick={() => setPickerIndex(idx)}>
                          Change
                        </Button>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-warning-200 dark:border-warning-500/20 bg-warning-50 dark:bg-warning-500/10 p-3 space-y-2">
                        <p className="text-xs text-warning-800 dark:text-warning-400 flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                          {it.tx?.payer
                            ? `Payer "${it.tx.payer}" did not match any member clearly. Select the member manually.`
                            : 'Select the member this transaction belongs to.'}
                        </p>
                        {it.suggestions.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {it.suggestions.slice(0, 3).map((s) => (
                              <button
                                key={s.userId}
                                type="button"
                                onClick={() =>
                                  patchItem(it.ftNumber, {
                                    member: { id: s.userId, name: s.name },
                                    autoPaired: false,
                                    matchScore: s.score,
                                  })
                                }
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-white dark:bg-white/[0.06] border border-gray-200 dark:border-gray-700 hover:border-brand-300 text-gray-700 dark:text-gray-200"
                              >
                                <Plus className="h-3 w-3" />
                                {s.name} ({Math.round(s.score * 100)}%)
                              </button>
                            ))}
                          </div>
                        )}
                        <Button variant="secondary" size="sm" onClick={() => setPickerIndex(idx)}>
                          <UserRound className="h-3.5 w-3.5 mr-1" /> Choose member
                        </Button>
                      </div>
                    )}
                    {/* Self-learning: register an unmatched proxy payer name */}
                    {it.member &&
                      (it.tx?.payer || it.geminiSender) &&
                      it.matchVia !== 'payerAlias' &&
                      (it.aliasRegistered ? (
                        <p className="mt-1.5 text-xs text-green-700 dark:text-success-400 flex items-center gap-1">
                          <CheckCircle className="h-3.5 w-3.5" /> Registered as an authorized payer for {it.member.name}
                        </p>
                      ) : (
                        <button
                          type="button"
                          disabled={it.registeringAlias}
                          onClick={() =>
                            registerPayerAlias(
                              it.ftNumber,
                              it.member!.id,
                              (it.tx?.payer || it.geminiSender)!,
                            )
                          }
                          className="mt-1.5 text-xs text-brand-600 dark:text-brand-400 hover:underline disabled:opacity-50"
                        >
                          {it.registeringAlias ? 'Registering...' : `Register "${it.tx?.payer || it.geminiSender}" as an authorized payer for ${it.member.name} — future scans pair automatically`}
                        </button>
                      ))}
                  </div>

                  {/* Editable deposit fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Amount (ETB)
                      </label>
                      <input
                        className="input-field"
                        type="number"
                        min="0"
                        step="0.01"
                        value={it.amount ?? ''}
                        onChange={(e) =>
                          patchItem(it.ftNumber, {
                            amount: e.target.value === '' ? undefined : parseFloat(e.target.value),
                          })
                        }
                        placeholder={group ? `${group.contributionAmount}` : '0.00'}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Deposit Date
                      </label>
                      <input
                        className="input-field"
                        type="date"
                        value={it.depositDate ?? ''}
                        onChange={(e) => patchItem(it.ftNumber, { depositDate: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Cycle
                      </label>
                      <select
                        className="input-field"
                        value={it.cycleId ?? ''}
                        onChange={(e) => patchItem(it.ftNumber, { cycleId: e.target.value })}
                      >
                        {!group?.cycles?.length && <option value="">No cycles</option>}
                        {group?.cycles?.map((c) => (
                          <option key={c.id} value={c.id}>
                            Cycle {c.cycleNumber}
                            {c.status === 'ACTIVE' ? ' (active)' : c.status === 'COMPLETED' ? ' (completed)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Transfer Method / How
                      </label>
                      <input
                        className="input-field"
                        value={it.narrative ?? ''}
                        onChange={(e) => patchItem(it.ftNumber, { narrative: e.target.value })}
                        placeholder="e.g. via Mobile banking"
                      />
                    </div>
                  </div>

                  {group && it.member && it.amount !== undefined && Math.abs(it.amount - group.contributionAmount) > 1 && (
                    <p className="text-xs text-warning-700 dark:text-warning-400 mt-2 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                      Amount differs from the standard contribution of ETB {group.contributionAmount.toLocaleString()} — creation may be blocked by group rules.
                    </p>
                  )}

                  {/* Outcome after creation */}
                  {it.outcome && (
                    <div
                      className={`mt-3 rounded-lg px-3 py-2 text-xs flex items-start gap-1.5 ${
                        it.outcome === 'verified'
                          ? 'bg-green-50 dark:bg-success-500/10 text-green-800 dark:text-success-400'
                          : it.outcome === 'pending'
                            ? 'bg-blue-50 dark:bg-blue-light-500/10 text-blue-800 dark:text-blue-light-400'
                            : 'bg-red-50 dark:bg-error-500/10 text-error-700 dark:text-error-400'
                      }`}
                    >
                      {it.outcome === 'verified' ? (
                        <CheckCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                      ) : it.outcome === 'pending' ? (
                        <Loader2 className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                      )}
                      {it.outcomeMsg}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Confirm bar */}
            {!showResults && (
              <div className="card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sticky bottom-4 shadow-theme-lg">
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  <span className="font-semibold text-gray-900 dark:text-white/90">{eligibleCount}</span> of{' '}
                  {items.length} transaction(s) ready to record
                  {eligibleCount > 0 && (
                    <span className="text-gray-500 dark:text-gray-400">
                      {' '}· Total ETB {totalAmount.toLocaleString()}
                    </span>
                  )}
                </div>
                <Button onClick={confirmCreateAll} loading={creating} disabled={eligibleCount === 0 || !evidenceUrl}>
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Create {eligibleCount > 0 ? eligibleCount : ''} Deposit{eligibleCount === 1 ? '' : 's'}
                </Button>
              </div>
            )}

            {/* Results summary */}
            {showResults && !creating && (
              <div className="card">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90 mb-3">
                  Scan Complete
                </h3>
                <div className="flex flex-wrap gap-4 text-sm">
                  <span className="flex items-center gap-1.5 text-green-700 dark:text-success-400">
                    <CheckCircle className="h-4 w-4" /> {verifiedCount} auto-verified
                  </span>
                  <span className="flex items-center gap-1.5 text-blue-700 dark:text-blue-light-400">
                    <Loader2 className="h-4 w-4" /> {pendingCount} pending review
                  </span>
                  {failedCount > 0 && (
                    <span className="flex items-center gap-1.5 text-error-600 dark:text-error-400">
                      <XCircle className="h-4 w-4" /> {failedCount} failed
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-3 mt-4">
                  <Button size="sm" onClick={() => router.push('/receipts')}>
                    Go to Receipts
                  </Button>
                  <Button variant="secondary" size="sm" onClick={resetSession}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1" /> Scan Another Statement
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Member picker */}
        {pickerIndex !== null && items[pickerIndex] && (
          <MemberPickerModal
            isOpen
            onClose={() => setPickerIndex(null)}
            members={(group?.members ?? []) as GroupMember[]}
            payerName={items[pickerIndex].tx?.payer}
            onSelect={(m) => {
              const ft = items[pickerIndex].ftNumber;
              patchItem(ft, {
                member: { id: m.id, name: m.name },
                autoPaired: false,
                matchScore: undefined,
              });
            }}
          />
        )}

        {/* Camera overlay — captures route through the manual crop step */}
        {cameraOpen && (
          <FtScannerCamera
            onCapture={(file) => {
              setCameraOpen(false);
              setPendingCrop(file);
            }}
            onClose={() => setCameraOpen(false)}
          />
        )}

        {/* Manual crop step before processing */}
        {pendingCrop && !cameraOpen && (
          <FtImageCropper
            file={pendingCrop}
            onCancel={() => setPendingCrop(null)}
            onConfirm={(cropped) => {
              setPendingCrop(null);
              startScanSession(cropped);
            }}
          />
        )}

        <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => {
          handleGalleryFiles(e.target.files);
          e.target.value = '';
        }} />

        {/* Extra statement pages — attached as-is (no crop) to the batched scan */}
        <input ref={extraGalleryRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => {
          handleGalleryFiles(e.target.files);
          e.target.value = '';
        }} />
      </div>
  );
}
