'use client';

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ScanLine,
  ArrowLeftRight,
  Send,
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
  Sparkles,
  Crosshair,
  FileUp,
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { enhanceFile, cropAndEnhance } from '@/lib/imageEnhance';
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
  queueUnknownSender,
  resolveUnknownSender,
  createDeposit,
  autoVerifyDepositCbe,
  updateGroupCbeAccounts,
  normalizeFtNumber,
  getAiSettings,
  addPayerAlias,
  getGroupRules,
} from '@/lib/api';
import type {
  GroupListItem,
  GroupDetail,
  GroupMember,
  CbeTransactionData,
  MemberSuggestion,
  FtScanResult,
  GroupRules,
} from '@/lib/api';

// ─── Types & helpers ──────────────────────────────────────────────────────────

interface ScanItem {
  ftNumber: string;
  status: 'verifying' | 'found' | 'error';
  /** deposit = member payment; payout/transfer = group-side money movement */
  kind?: 'deposit' | 'payout' | 'transfer';
  error?: string;
  tx?: CbeTransactionData;
  /** For payout items: member identified by the receiver's bank account */
  receiverMember?: { name: string } | null;
  /** Payer name Gemini read from the statement (fallback when the CBE
   *  lookup has no payer field) */
  geminiSender?: string;
  member: { id: string; name: string } | null;
  autoPaired: boolean;
  matchScore?: number;
  matchVia?: 'name' | 'bankAccountName' | 'history' | 'payerAlias';
  /** Pairing strictness tier returned by the server */
  tier?: 'AUTO' | 'SUGGEST' | 'UNKNOWN';
  /** Confident-but-not-exact candidate offered as a one-click accept */
  suggestCandidate?: MemberSuggestion;
  queueing?: boolean;
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
  if (!dateStr) return undefined;
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;
    const cleaned = dateStr.replace(/,/g, ' ').trim();
    const d2 = new Date(cleaned);
    if (!isNaN(d2.getTime())) return d2;
    const parts = cleaned.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
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
  /** Preprocess every photo (contrast stretch + sharpen) before FT detection */
  const [autoEnhance, setAutoEnhance] = useState(true);
  /** Normalized FT locations from the last scan — powers focus-box overlay */
  const [ftRegions, setFtRegions] = useState<Record<string, [number, number, number, number]>>({});
  const [rescanningFt, setRescanningFt] = useState<string | null>(null);
  const [lastCaptureFile, setLastCaptureFile] = useState<File | null>(null);
  /** Bulk import: one FT per line, verified sequentially */
  const [bulkText, setBulkText] = useState('');
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });
  const bulkFileRef = useRef<HTMLInputElement>(null);
  /** member name by bank account, learned from the group's past deposits */
  const [memberAccountByAccount, setMemberAccountByAccount] = useState<Map<string, string>>(new Map());
  const [rules, setRules] = useState<GroupRules | null>(null);
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
  // Quick-create a brand-new member from an unknown payer (scan flow)
  const [createMemberIndex, setCreateMemberIndex] = useState<number | null>(null);
  const [cmName, setCmName] = useState('');
  const [cmPhone, setCmPhone] = useState('');
  const [cmShares, setCmShares] = useState('1');
  const [cmGovernmentId, setCmGovernmentId] = useState('');
  const [cmSaving, setCmSaving] = useState(false);
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
      .then(async (detail) => {
        if (cancelled) return;
        setGroup(detail);
        // Preselect first configured CBE receiver account
        if (detail.cbeAccountNumbers?.length) setAccountNumber(detail.cbeAccountNumbers[0]);
        // Load the group's amount policy (strict vs partial/over allowed)
        try {
          const r = await getGroupRules(detail.id);
          if (!cancelled) setRules(r);
        } catch {
          if (!cancelled) setRules(null);
        }
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
    // Duplicate pre-check FIRST: an FT already recorded in this group needs
    // neither the bank lookup nor member pairing — flag it instantly instead
    // of spending seconds of bank-API round-trips per duplicate.
    if (existingFtsRef.current.has(ft.toUpperCase())) {
      patchItem(ft, { status: 'found', isDuplicate: true, error: undefined });
      return;
    }
    patchItem(ft, { status: 'verifying', error: undefined });
    try {
      const tx = await cbeLookup(ft, account);

      // Admin-side money movements: sender is one of the group's own CBE
      // accounts. Two cases — both group accounts = the collector account is
      // being switched mid-cycle; group → a member = the winner receiving a
      // payout. Neither is a member deposit, so neither enters the pairing
      // pipeline or the Unknown Senders queue.
      const groupAccounts = new Set([
        ...(group?.cbeAccountNumbers ?? []),
        ...(account ? [account] : []),
      ]);
      const payerIsGroup = !!(tx.payerAccount && groupAccounts.has(tx.payerAccount));
      const receiverIsGroup = !!(tx.receiverAccount && groupAccounts.has(tx.receiverAccount));
      if (payerIsGroup) {
        const kind: ScanItem['kind'] = receiverIsGroup ? 'transfer' : 'payout';
        const receiverMember =
          kind === 'payout' && tx.receiverAccount
            ? { name: memberAccountByAccount.get(tx.receiverAccount) ?? '' }
            : null;
        patchItem(ft, {
          status: 'found',
          kind,
          tx,
          receiverMember,
          member: null,
          autoPaired: false,
          suggestions: [],
          amount: tx.amount ?? 0,
          depositDate: toInputDate(parseCbeDate(tx.date || '')),
          cycleId: activeCycle?.id,
        });
        return;
      }

      // CBE receipt payer is authoritative; the name Gemini read from the
      // statement is the fallback when the lookup has no payer field.
      const payerName = tx.payer || senderFallback;
      let member: ScanItem['member'] = null;
      let autoPaired = false;
      let matchScore: number | undefined;
      let matchVia: ScanItem['matchVia'];
      let suggestions: MemberSuggestion[] = [];
      let tier: 'AUTO' | 'SUGGEST' | 'UNKNOWN' = 'UNKNOWN';
      let suggestCandidate: MemberSuggestion | undefined;
      if (payerName) {
        try {
          const res = await suggestMembers(grpId, payerName, tx?.payerAccount);
          tier = res.tier ?? 'UNKNOWN';
          suggestions = res.suggestions;
          // AUTO only: deterministic identity. SUGGEST stays one-click.
          if (res.bestMatch && res.bestMatch.autoPaired) {
            member = { id: res.bestMatch.userId, name: res.bestMatch.name };
            autoPaired = true;
            matchScore = res.bestMatch.score;
            matchVia = res.bestMatch.matchedVia;
          } else if (res.bestMatch && res.tier === 'SUGGEST') {
            suggestCandidate = res.bestMatch;
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
                tier,
                suggestCandidate,
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

  /**
   * Already-recorded FT numbers for the selected group, mirrored in a ref so
   * the duplicate pre-check reads fresh data even inside tight bulk loops
   * where the state update hasn't flushed yet.
   */
  const existingFtsRef = useRef<Set<string>>(new Set());

  const loadExistingFts = async (grpId: string): Promise<Set<string>> => {
    try {
      const deposits = await getDeposits({ groupId: grpId });
      const set = new Set(deposits.map((d) => (d.ftNumber || '').toUpperCase()).filter(Boolean));
      setExistingFts(set);
      existingFtsRef.current = set;
      // Members' bank accounts, learned from their past deposits — lets a
      // detected payout name the winning member by receiver account.
      setMemberAccountByAccount(
        new Map(
          deposits
            .filter((d) => d.senderAccount && d.memberName)
            .map((d) => [d.senderAccount as string, d.memberName]),
        ),
      );
      return set;
    } catch {
      /* duplicate pre-check is best-effort; server still rejects duplicates */
      return existingFts;
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
    setFtRegions({});
    setLastCaptureFile(file);
    if (capturePreview) URL.revokeObjectURL(capturePreview);
    setEvidenceUrl('');

    const preview = URL.createObjectURL(file);
    setCapturePreview(preview);

    if (!group) return;

    // The cropped first page plus any attached pages are read in ONE batched
    // request. With auto-enhance on, every page is preprocessed (grayscale,
    // contrast stretch, sharpen) first — faint print reads far more reliably.
    const rawBatch: File[] = [file, ...attached.map((a) => a.file)];
    const batch = autoEnhance
      ? await Promise.all(rawBatch.map((f) => enhanceFile(f, 'auto').catch(() => f)))
      : rawBatch;

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
        setFtRegions(result.regions ?? {});
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
            // Duplicates skip the bank lookup entirely inside runLookup —
            // flagged here so they render as recorded immediately.
            status: (existingFtsRef.current.has(ft) ? 'found' : 'verifying') as ScanItem['status'],
            isDuplicate: existingFtsRef.current.has(ft),
            member: null,
            autoPaired: false,
            suggestions: [],
            cycleId: activeCycle?.id,
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

  /**
   * Adds one manually typed FT to the session — identical verification and
   * pairing pipeline as scanned FTs (CBE lookup → auto-pairing). Works with
   * or without a statement photo: typing the first FT from the setup section
   * starts a manual session (no evidence image needed — the CBE verification
   * IS the evidence). Duplicates are warned and rejected/flagged by reason.
   */
  const addManualFt = async (): Promise<boolean> => {
    // Accept extended identifiers ("FT24AB123456\BNK") — the suffix is dropped
    const ft = (normalizeFtNumber(manualFt) ?? '').toUpperCase();
    if (!FT_REGEX.test(ft)) {
      showToast('Invalid FT format. Expected: FT followed by 10 alphanumeric characters', 'error');
      return false;
    }
    if (items.some((it) => it.ftNumber === ft)) {
      showToast(`FT ${ft} is already in this scan — flagged as duplicate`, 'warning');
      return false;
    }
    if (!selectedGroupId) {
      showToast('Select the equb group first', 'error');
      return false;
    }
    if (!accountReady) {
      showToast('Select or enter the CBE receiver account first', 'error');
      return false;
    }

    const fresh = sessionActive ? existingFts : await loadExistingFts(selectedGroupId);
    const isDuplicate = fresh.has(ft);

    setManualFt('');
    setScanNotice('');
    if (!sessionActive) {
      setSessionActive(true);
      setShowResults(false);
    }
    setItems((prev) => [
      ...prev,
      {
        ftNumber: ft,
        status: 'verifying' as const,
        member: null,
        autoPaired: false,
        suggestions: [],
        cycleId: activeCycle?.id,
        isDuplicate,
      },
    ]);
    if (isDuplicate) {
      showToast(`FT ${ft} is already recorded in this group — flagged as duplicate, it will not be created`, 'warning');
    }
    const savedAccount = await ensureAccountSaved();
    await runLookup(ft, selectedGroupId, savedAccount);
    return true;
  };

  const removeItem = (ft: string) => {
    setItems((prev) => prev.filter((it) => it.ftNumber !== ft));
  };

  /** One-click account migration: register the new receiver account on the group. */
  const addReceiverAccountToGroup = async (acct: string) => {
    if (!group) return;
    try {
      const updated = [...(group.cbeAccountNumbers ?? []), acct];
      await updateGroupCbeAccounts(group.id, updated);
      setGroup({ ...group, cbeAccountNumbers: updated });
      showToast(`Receiver account ${acct} added to ${group.name}`, 'success');
    } catch (err: unknown) {
      showToast(axiosMessage(err), 'error');
    }
  };

  const retryItem = async (ft: string) => {
    await runLookup(ft, selectedGroupId, accountNumber, scanSenders[ft]);
  };

  /**
   * Focus & re-scan: the admin tapped an FT focus box on the captured photo.
   * That region is cropped (with context padding), heavily enhanced (2×
   * upscale + contrast + sharpen) and re-read on its own — the precise second
   * pass for FTs the full-page scan misread or missed.
   */
  const rescanRegion = async (ft: string) => {
    const region = ftRegions[ft];
    if (!lastCaptureFile || !region) return;
    if (!selectedGroupId || !accountReady) {
      showToast('Select the equb group and receiver account first', 'error');
      return;
    }
    setRescanningFt(ft);
    try {
      const [x, y, w, h] = region;
      const crop = await cropAndEnhance(lastCaptureFile, { x, y, w, h });
      const result = await scanFtNumbers([crop], accountNumber || undefined);
      const found = Array.from(new Set(result.ftNumbers.map((f) => f.toUpperCase())));

      if (found.length === 0) {
        showToast(`Focus re-scan could not read ${ft} — try dragging a wider crop`, 'warning');
        return;
      }

      await loadExistingFts(selectedGroupId);
      const savedAccount = await ensureAccountSaved();
      const senders = { ...scanSenders, ...(result.senders ?? {}) };
      setScanSenders(senders);

      // Merge: re-verify the tapped FT and add any new ones read from the crop
      for (const foundFt of found) {
        if (items.some((it) => it.ftNumber === foundFt)) {
          await runLookup(foundFt, selectedGroupId, savedAccount, senders[foundFt]);
        } else {
          const fresh = sessionActive ? existingFts : await loadExistingFts(selectedGroupId);
          setItems((prev) => [
            ...prev,
            {
              ftNumber: foundFt,
              status: 'verifying' as const,
              member: null,
              autoPaired: false,
              suggestions: [],
              cycleId: activeCycle?.id,
              isDuplicate: fresh.has(foundFt),
            },
          ]);
          await runLookup(foundFt, selectedGroupId, savedAccount, senders[foundFt]);
        }
      }
      showToast(`Focus re-scan read ${found.length} FT${found.length === 1 ? '' : 's'} from the selected area`, 'success');
    } catch (err: unknown) {
      showToast(axiosMessage(err), 'error');
    } finally {
      setRescanningFt(null);
    }
  };

  /**
   * Bulk FT import: a .txt file (or pasted text) with one FT number per line.
   * Every line is validated, de-duplicated, and then verified ONE AT A TIME
   * through the same pipeline as scanned FTs (CBE lookup → auto-pairing), so
   * each number gets its own precise result.
   */
  const parseBulkFts = (text: string): string[] =>
    Array.from(
      new Set(
        text
          .split(/[\r\n,;\t]+/)
          .map((line) => (normalizeFtNumber(line.trim()) ?? '').toUpperCase())
          .filter((ft) => FT_REGEX.test(ft)),
      ),
    );

  const handleBulkFile = async (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;
    const text = await file.text();
    const fts = parseBulkFts(text);
    if (fts.length === 0) {
      showToast('No valid FT numbers found in that file (one FT per line, e.g. FT253126QXMJ)', 'error');
      return;
    }
    setBulkText((prev) => (prev ? prev + '\n' + fts.join('\n') : fts.join('\n')));
    showToast(`${fts.length} valid FT number${fts.length === 1 ? '' : 's'} loaded from ${file.name}`, 'success');
  };

  const processBulkFts = async () => {
    const fts = parseBulkFts(bulkText);
    if (fts.length === 0) {
      showToast('Enter or upload FT numbers first (one per line)', 'error');
      return;
    }
    if (!selectedGroupId) {
      showToast('Select the equb group first', 'error');
      return;
    }
    if (!accountReady) {
      showToast('Select or enter the CBE receiver account first', 'error');
      return;
    }

    const fresh = sessionActive ? existingFts : await loadExistingFts(selectedGroupId);
    if (!sessionActive) {
      setSessionActive(true);
      setShowResults(false);
    }

    // Skip ones already queued in this session, warn about already-recorded ones
    const queue = fts.filter((ft) => {
      if (items.some((it) => it.ftNumber === ft)) {
        showToast(`FT ${ft} is already in this scan — skipped`, 'warning');
        return false;
      }
      return true;
    });

    setBulkRunning(true);
    setBulkProgress({ done: 0, total: queue.length });
    const savedAccount = await ensureAccountSaved();

    let done = 0;
    for (const ft of queue) {
      const isDuplicate = fresh.has(ft);
      setItems((prev) =>
        prev.some((it) => it.ftNumber === ft)
          ? prev
          : [
              ...prev,
              {
                ftNumber: ft,
                status: 'verifying' as const,
                member: null,
                autoPaired: false,
                suggestions: [],
                cycleId: activeCycle?.id,
                isDuplicate,
              },
            ],
      );
      if (isDuplicate) {
        showToast(`FT ${ft} is already recorded in this group — flagged as duplicate`, 'warning');
      }
      // One at a time — each FT gets a clean, precise CBE lookup + pairing
      await runLookup(ft, selectedGroupId, savedAccount);
      done += 1;
      setBulkProgress({ done, total: queue.length });
    }

    setBulkRunning(false);
    setBulkText('');
    showToast(`Bulk import finished — ${done} FT number${done === 1 ? '' : 's'} processed`, 'success');
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

  // ─── Unknown Senders actions ────────────────────────────────────────────────

  /** Shared payload describing an unpaired transaction for the queue. */
  const unknownPayloadFor = (it: ScanItem, reason: string) => ({
    groupId: group!.id,
    payerName: it.tx?.payer || it.geminiSender || 'Unknown payer',
    amount: it.amount ?? it.tx?.amount ?? 0,
    ftNumber: it.ftNumber,
    transferDate: it.depositDate
      ? new Date(`${it.depositDate}T12:00:00`).toISOString()
      : undefined,
    senderAccount: it.tx?.payerAccount,
    bankName: 'CBE',
    imageUrl: evidenceUrl || undefined,
    reason,
    cbeData: (it.tx ?? {}) as unknown as Record<string, unknown>,
  });

  /** Park an unpaired transaction in the Unknown Senders queue (Receipts page). */
  const queueToUnknown = async (it: ScanItem, reason: string) => {
    patchItem(it.ftNumber, { queueing: true });
    try {
      await queueUnknownSender(unknownPayloadFor(it, reason));
      removeItem(it.ftNumber);
      showToast('Stored in Unknown Senders — resolve it from the Receipts page', 'success');
    } catch (err: unknown) {
      patchItem(it.ftNumber, { queueing: false });
      showToast(axiosMessage(err), 'error');
    }
  };

  /** Quick-create a member from the payer identity, then record + auto-verify. */
  const createMemberAndRecord = async () => {
    const idx = createMemberIndex;
    if (idx === null || !group) return;
    const it = items[idx];
    if (!it || !cmName.trim() || !cmPhone.trim()) {
      showToast('Payer name and phone are required to create a member', 'warning');
      return;
    }
    setCmSaving(true);
    try {
      // One pipeline for everything: queue keeps the evidence, resolve creates
      // the member + membership + deposit and registers the payer alias.
      const queued = await queueUnknownSender(
        unknownPayloadFor(it, 'Admin quick-created a member from this payer'),
      );
      const resolved = await resolveUnknownSender(queued.id, {
        createMember: {
          name: cmName.trim(),
          phone: cmPhone.trim(),
          shares: parseFloat(cmShares) || 1,
          governmentId: cmGovernmentId.trim() || undefined,
        },
      });
      // Resolved queue entries are born-verified — the CBE lookup confirmed
      // the transaction at scan time and the pairing was the only decision.
      const outcome: ScanItem['outcome'] = 'verified';
      let outcomeMsg = `Member "${cmName.trim()}" created — deposit verified against CBE`;
      if (resolved.ruleOverrides?.includes('REQUIRE_GUARANTOR')) {
        outcomeMsg += ' — guarantor still required: assign one from the group page (Requests tab)';
      }
      patchItem(it.ftNumber, { creating: false, outcome, outcomeMsg });
      setCreateMemberIndex(null);
      setCmName(''); setCmPhone(''); setCmShares('1'); setCmGovernmentId('');
      showToast(outcomeMsg, 'success');
      await loadExistingFts(selectedGroupId);
    } catch (err: unknown) {
      showToast(axiosMessage(err), 'error');
    } finally {
      setCmSaving(false);
    }
  };

  // ─── Confirm & create ───────────────────────────────────────────────────────

  const canCreateItem = (it: ScanItem): boolean =>
    (it.kind ?? 'deposit') === 'deposit' &&
    !it.isDuplicate &&
    !it.creating &&
    !it.outcome &&
    !!it.member &&
    !!(it.cycleId || activeCycle?.id) &&
    (it.status === 'found' ? it.amount !== undefined && it.amount > 0 : !!it.amount);

  /** Human-readable list of what's missing before this item can be recorded. */
  const itemBlockers = (it: ScanItem): string[] => {
    const b: string[] = [];
    if (it.isDuplicate) b.push('already recorded — duplicate');
    if (it.status === 'verifying') b.push('verifying with CBE…');
    if (it.status === 'error') b.push('CBE lookup failed');
    if (!it.member) b.push('member not paired');
    if (!it.cycleId && !activeCycle) b.push('no cycle selected');
    if (it.amount === undefined || it.amount <= 0) b.push('amount missing');
    return b;
  };

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
          imageUrl: evidenceUrl || undefined,
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
              <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg bg-warning-50 dark:bg-warning-500/10 border border-warning-200 dark:border-warning-500/20 p-3">
                <div className="flex items-start gap-2 flex-1">
                  <AlertTriangle className="h-4 w-4 text-warning-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-warning-800 dark:text-warning-400">
                    {group.cycles?.length
                      ? 'No ACTIVE cycle — pick one of the existing cycles for each transaction below (deposits must belong to a cycle), or start a new cycle on the group page.'
                      : 'This group has no cycles yet. Open the group page and start a cycle — deposits must belong to a cycle.'}
                  </p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => router.push('/groups/' + group.id)} className="flex-shrink-0">
                  Open group page
                </Button>
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

            {/* Auto-enhance toggle */}
            <label className="mt-3 inline-flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoEnhance}
                onChange={(e) => setAutoEnhance(e.target.checked)}
                className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              />
              <Sparkles className="h-3.5 w-3.5 text-brand-500" />
              Auto-enhance photos before scanning (grayscale + contrast + sharpen)
            </label>

            {/* Manual FT entry — same CBE verification + pairing pipeline, no photo needed */}
            <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-800">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Or enter FT numbers manually — same CBE verification and member pairing, no photo needed
              </label>
              <div className="flex gap-2">
                <input
                  className="input-field font-mono flex-1"
                  placeholder="FT + 10 characters (e.g. FT253126QXMJ)"
                  value={manualFt}
                  onChange={(e) => setManualFt(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addManualFt();
                    }
                  }}
                  disabled={!selectedGroupId || !accountReady || loadingGroup}
                  maxLength={40}
                />
                <Button
                  variant="secondary"
                  onClick={() => addManualFt()}
                  disabled={!selectedGroupId || !accountReady || loadingGroup || !manualFt.trim()}
                  className="flex-shrink-0"
                >
                  <Plus className="h-4 w-4 mr-1" /> Add FT
                </Button>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Each FT is verified against CBE and auto-paired instantly. Duplicates are flagged and never recorded twice.
              </p>
            </div>

            {/* Bulk FT import — one number per line, verified one at a time */}
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Bulk import — paste or upload FT numbers, one per line
                </label>
                <input
                  ref={bulkFileRef}
                  type="file"
                  accept=".txt,text/plain"
                  className="hidden"
                  onChange={(e) => {
                    handleBulkFile(e.target.files);
                    e.target.value = '';
                  }}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => bulkFileRef.current?.click()}
                  disabled={bulkRunning}
                  className="flex-shrink-0"
                >
                  <FileUp className="h-3.5 w-3.5 mr-1" /> Upload .txt
                </Button>
              </div>
              <textarea
                className="input-field font-mono text-xs"
                rows={4}
                placeholder={'FT253126QXMJ\nFT253127ABCD\nFT253128WXYZ'}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                disabled={bulkRunning}
              />
              <div className="flex items-center justify-between mt-2 gap-3 flex-wrap">
                <p className="text-xs text-gray-400">
                  {(() => {
                    const fts = parseBulkFts(bulkText);
                    return fts.length > 0
                      ? `${fts.length} valid FT number${fts.length === 1 ? '' : 's'} detected`
                      : 'Invalid lines are ignored automatically';
                  })()}
                  {bulkRunning && ` — processing ${bulkProgress.done}/${bulkProgress.total}…`}
                </p>
                <Button
                  onClick={processBulkFts}
                  loading={bulkRunning}
                  disabled={bulkRunning || !parseBulkFts(bulkText).length || !selectedGroupId || !accountReady}
                  size="sm"
                  className="flex-shrink-0"
                >
                  {bulkRunning ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      {bulkProgress.done}/{bulkProgress.total}
                    </>
                  ) : (
                    <>
                      <Crosshair className="h-3.5 w-3.5 mr-1" /> Verify All
                    </>
                  )}
                </Button>
              </div>
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

        {/* Detected FTs (with statement photo when one was captured) */}
        {sessionActive && (
          <div className="card">
            <div className="flex flex-col md:flex-row gap-5">
              {capturePreview && (
              <div className="md:w-56 flex-shrink-0">
                <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={capturePreview} alt="Captured statement" className="w-full max-h-64 md:max-h-40 object-cover" />
                  {/* FT focus boxes — tap one to crop, enhance and re-scan just that cell */}
                  {Object.entries(ftRegions).map(([ft, [x, y, w, h]]) => (
                    <button
                      key={ft}
                      onClick={() => rescanRegion(ft)}
                      disabled={rescanningFt !== null || scanning}
                      title={`Focus & re-scan ${ft} precisely`}
                      className={`absolute rounded-md border-2 transition-all ${
                        rescanningFt === ft
                          ? 'border-warning-500 bg-warning-500/20 animate-pulse'
                          : 'border-brand-500 bg-brand-500/10 hover:bg-brand-500/25 hover:border-brand-600'
                      }`}
                      style={{
                        left: `${x * 100}%`,
                        top: `${y * 100}%`,
                        width: `${Math.max(w, 0.04) * 100}%`,
                        height: `${Math.max(h, 0.025) * 100}%`,
                      }}
                    >
                      <span className="absolute -top-4 left-0 text-[9px] font-bold text-white bg-brand-500 rounded px-1 whitespace-nowrap">
                        {rescanningFt === ft ? 'scanning…' : ft}
                      </span>
                    </button>
                  ))}
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
                {Object.keys(ftRegions).length > 0 && (
                  <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400 flex items-start gap-1">
                    <Crosshair className="h-3.5 w-3.5 text-brand-500 flex-shrink-0 mt-px" />
                    <span>
                      Tap a highlighted FT box on the photo to crop, enhance and re-scan just that area precisely.
                    </span>
                  </p>
                )}
                {attached.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-1">
                      +{attached.length} extra page(s) · included in Retake scans
                    </p>
                    <AttachedPhotoThumbs photos={attached} onRemove={removeAttached} />
                  </div>
                )}
              </div>
              )}

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

              // Group-side money movement — informational only, never a deposit
              if (it.status === 'found' && (it.kind === 'payout' || it.kind === 'transfer')) {
                const isTransfer = it.kind === 'transfer';
                return (
                  <div key={it.ftNumber} className="card border-brand-300 dark:border-brand-500/30">
                    <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-bold text-blue-700 dark:text-brand-400 bg-blue-50 dark:bg-brand-500/10 px-2 py-0.5 rounded-lg">
                          {it.ftNumber}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${isTransfer ? 'bg-amber-50 dark:bg-warning-500/10 text-amber-700 dark:text-warning-400' : 'bg-green-50 dark:bg-success-500/10 text-green-700 dark:text-success-400'}`}>
                          {isTransfer ? <ArrowLeftRight className="h-3 w-3" /> : <Send className="h-3 w-3" />}
                          {isTransfer ? 'Group account transfer' : 'Payout to member'}
                        </span>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeItem(it.ftNumber)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-gray-800 dark:text-gray-200 mb-2">
                      <b>ETB {(it.tx?.amount ?? it.amount ?? 0).toLocaleString()}</b>
                      {it.depositDate && <> · {it.depositDate}</>}
                    </p>
                    {isTransfer ? (
                      <>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                          Money moved between the group&apos;s own accounts
                          {it.tx?.payerAccount && <> (<b>{it.tx.payerAccount}</b>)</>}
                          {it.tx?.receiverAccount && <> → (<b>{it.tx.receiverAccount}</b>)</>}
                          . This usually means the collector account is changing mid-cycle — the transaction is
                          internal, so it is not recorded as a member deposit.
                        </p>
                        {it.tx?.receiverAccount && group && !group.cbeAccountNumbers?.includes(it.tx.receiverAccount) && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => void addReceiverAccountToGroup(it.tx!.receiverAccount!)}
                          >
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            Add {it.tx.receiverAccount} to this group&apos;s accounts
                          </Button>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Sent <b>from the group&apos;s collection account</b>
                        {it.tx?.payerAccount && <> ({it.tx.payerAccount})</>}{' '}
                        to <b>{it.receiverMember?.name || it.tx?.receiver || it.tx?.receiverAccount || 'a recipient'}</b> —
                        the winner receiving their payout, not a member deposit. Nothing was recorded; keep this for
                        your payout records.
                      </p>
                    )}
                  </div>
                );
              }

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
                      {it.status === 'found' && !it.isDuplicate && (
                        <span className="text-xs text-green-700 dark:text-success-400 flex items-center gap-1">
                          <CheckCircle className="h-3.5 w-3.5" /> Verified from CBE
                        </span>
                      )}
                      {it.status === 'found' && it.isDuplicate && !it.tx && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          <CheckCircle className="h-3.5 w-3.5" /> Already in database — bank lookup skipped
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

                  {/* What's missing before this can be recorded */}
                  {!ready && !it.outcome && itemBlockers(it).length > 0 && (
                    <p className="text-xs text-warning-800 dark:text-warning-400 mb-3 flex flex-wrap items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="font-medium mr-1">To record:</span>
                      {itemBlockers(it).map((b) => (
                        <span
                          key={b}
                          className="px-1.5 py-0.5 rounded bg-warning-50 dark:bg-warning-500/10 border border-warning-200 dark:border-warning-500/20"
                        >
                          {b}
                        </span>
                      ))}
                    </p>
                  )}

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
                        </span>
                        <Button variant="ghost" size="sm" onClick={() => setPickerIndex(idx)}>
                          Change
                        </Button>
                      </div>
                    ) : it.tier === 'SUGGEST' && it.suggestCandidate ? (
                      <div className="rounded-lg border border-amber-200 dark:border-warning-500/20 bg-amber-50 dark:bg-warning-500/10 p-3 space-y-2">
                        <p className="text-xs text-warning-800 dark:text-warning-400 flex items-start gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                          <span>
                            Possible match:{' '}
                            <b>{it.suggestCandidate.name}</b>{' '}
                            ({Math.round(it.suggestCandidate.score * 100)}% via{' '}
                            {it.suggestCandidate.matchedVia === 'bankAccountName'
                              ? 'bank account name'
                              : it.suggestCandidate.matchedVia === 'payerAlias'
                                ? 'authorized payer'
                                : 'name similarity'}). Accept it, or choose differently.
                          </span>
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            onClick={() =>
                              patchItem(it.ftNumber, {
                                member: {
                                  id: it.suggestCandidate!.userId,
                                  name: it.suggestCandidate!.name,
                                },
                                autoPaired: false,
                                matchScore: it.suggestCandidate!.score,
                                matchVia: it.suggestCandidate!.matchedVia,
                                suggestCandidate: undefined,
                              })
                            }
                          >
                            <CheckCircle className="h-3.5 w-3.5 mr-1" /> Accept pairing
                          </Button>
                          <Button variant="secondary" size="sm" onClick={() => setPickerIndex(idx)}>
                            <UserRound className="h-3.5 w-3.5 mr-1" /> Different member
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2 pt-1 border-t border-warning-200/60 dark:border-warning-500/10">
                          <button
                            type="button"
                            className="text-[11px] text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 underline underline-offset-2 disabled:opacity-50"
                            disabled={it.queueing}
                            onClick={() => {
                              setCmName(it.tx?.payer || it.geminiSender || '');
                              setCreateMemberIndex(idx);
                            }}
                          >
                            New member? Create &amp; record
                          </button>
                          <button
                            type="button"
                            className="text-[11px] text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 underline underline-offset-2 disabled:opacity-50"
                            disabled={it.queueing}
                            onClick={() => queueToUnknown(it, 'Admin declined the suggested pairing')}
                          >
                            {it.queueing ? 'Saving…' : 'Send to Unknown Senders'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-error-200 dark:border-error-500/20 bg-error-50 dark:bg-error-500/10 p-3 space-y-2">
                        <p className="text-xs text-error-700 dark:text-error-400 flex items-start gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                          <span>
                            <b>Unknown sender.</b>{' '}
                            {it.tx?.payer
                              ? `"${it.tx.payer}" does not confidently match any member.`
                              : 'No payer name was detected.'}{' '}
                            Pair it, create a new member, or park it for later.
                          </span>
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
                        <div className="flex flex-wrap gap-2">
                          <Button variant="secondary" size="sm" onClick={() => setPickerIndex(idx)}>
                            <UserRound className="h-3.5 w-3.5 mr-1" /> Choose member
                          </Button>
                          <Button variant="ghost" size="sm" disabled={it.queueing} onClick={() => { setCmName(it.tx?.payer || it.geminiSender || ''); setCreateMemberIndex(idx); }}>
                            <Plus className="h-3.5 w-3.5 mr-1" /> Create new member
                          </Button>
                          <button
                            type="button"
                            className="text-[11px] text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 underline underline-offset-2 disabled:opacity-50 self-center"
                            disabled={it.queueing}
                            onClick={() => queueToUnknown(it, 'No member matched the confident tier')}
                          >
                            {it.queueing ? 'Saving…' : 'Send to Unknown Senders'}
                          </button>
                        </div>
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

                  {group && it.member && it.amount !== undefined && (() => {
                    const strict = rules ? rules.requireExactAmount && !rules.allowPartialPayments && !rules.allowOverpayment : true;
                    if (Math.abs(it.amount - group.contributionAmount) <= 1) return null;
                    if (strict) {
                      return (
                        <p className="text-xs text-warning-700 dark:text-warning-400 mt-2 flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                          Amount differs from the expected contribution of ETB {group.contributionAmount.toLocaleString()} — the strict amount rule may block this deposit.
                        </p>
                      );
                    }
                    const under = it.amount < group.contributionAmount;
                    return (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex items-center gap-1.5">
                        <CheckCircle className="h-3.5 w-3.5 flex-shrink-0 text-green-600" />
                        {under
                          ? `Partial payment — shortfall of ETB ${(group.contributionAmount - it.amount).toLocaleString()} recorded for this cycle (group rules allow catch-up later).`
                          : `Overpayment — surplus of ETB ${(it.amount - group.contributionAmount).toLocaleString()} recorded (carries toward upcoming cycles).`}
                      </p>
                    );
                  })()}

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
                  {eligibleCount === 0 && (
                    <span className="block text-xs text-warning-700 dark:text-warning-400 mt-1">
                      {uploadingEvidence
                        ? 'Statement photo still uploading…'
                        : !evidenceUrl && capturePreview
                          ? evidenceError || 'Statement photo upload failed — retake or re-upload (the evidence image is required).'
                          : !group?.cycles?.length
                            ? 'This group has no cycles yet — open the group page and start a cycle first.'
                            : !activeCycle
                              ? 'No ACTIVE cycle — pick a cycle for each transaction below, or start a new one on the group page.'
                              : 'Fix the highlighted items above — each needs member, cycle and amount.'}
                    </span>
                  )}
                </div>
                <Button onClick={confirmCreateAll} loading={creating} disabled={eligibleCount === 0 || (!evidenceUrl && !!capturePreview)}>
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

        {/* Quick-create a member from an unknown payer */}
        {createMemberIndex !== null && items[createMemberIndex] && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-gray-900/60 backdrop-blur-sm p-0 sm:p-4"
            onClick={() => !cmSaving && setCreateMemberIndex(null)}
          >
            <div
              className="w-full sm:max-w-md bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl border border-gray-200 dark:border-gray-800 p-5 space-y-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white/90">Create new member</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Absolutely new payer? Create the member and record this verified transaction under them.
                </p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Member name</label>
                  <input
                    className="input-field"
                    value={cmName}
                    onChange={(e) => setCmName(e.target.value)}
                    placeholder="Full name (prefilled from the payer)"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Phone *</label>
                  <input
                    className="input-field"
                    value={cmPhone}
                    onChange={(e) => setCmPhone(e.target.value)}
                    placeholder="09xxxxxxxx"
                    inputMode="tel"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Government ID <span className="text-gray-400">(required by this group's rules)</span>
                  </label>
                  <input
                    className="input-field"
                    value={cmGovernmentId}
                    onChange={(e) => setCmGovernmentId(e.target.value)}
                    placeholder="ID number"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Shares</label>
                  <input
                    className="input-field"
                    type="number"
                    min={0.25}
                    max={10}
                    step={0.25}
                    value={cmShares}
                    onChange={(e) => setCmShares(e.target.value)}
                  />
                </div>
                <p className="text-[11px] text-gray-400 dark:text-gray-500">
                  Group: {group?.name}. The payer name is saved as an authorized payer automatically, so future payments pair instantly.
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                <Button variant="secondary" size="sm" disabled={cmSaving} onClick={() => setCreateMemberIndex(null)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  loading={cmSaving}
                  disabled={!cmName.trim() || !cmPhone.trim()}
                  onClick={createMemberAndRecord}
                >
                  Create &amp; record
                </Button>
              </div>
            </div>
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
