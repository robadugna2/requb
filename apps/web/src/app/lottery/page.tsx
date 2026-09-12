'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Ticket, Trophy, Users, Sparkles, AlertCircle,
  ShieldAlert, Volume2, VolumeX, PlayCircle,
  CheckCircle2, RotateCcw, Gauge, Timer, Fingerprint, Copy, Check,
  BadgeCheck, Ban, ChevronDown, ChevronUp,
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useLanguage } from '@/components/layout/LanguageContext';
import { Button } from '@/components/ui/button';
import {
  getLotteryResults, getGroups, getLotteryEligibility, drawLottery,
  confirmLotteryDraw, redrawLotteryDraw,
} from '@/lib/api';
import type {
  LotteryResultItem, GroupListItem, LotteryEligibility, LotteryEligibilityMember,
  LotteryDrawPending, LotteryResultItem as Result,
} from '@/lib/api';
import { useAdminPermissions, hasPermission } from '@/lib/useAdminPermissions';

// ── Segment Colors ───────────────────────────────────────────────────────────
const PALETTE = [
  '#465fff', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6',
  '#ef4444', '#14b8a6', '#f43f5e', '#6366f1', '#0ea5e9', '#22c55e',
];

const METHOD_META: Record<Result['method'], { label: string; desc: string }> = {
  RANDOM: { label: 'Random', desc: 'Every eligible turn equal chance' },
  WEIGHTED: { label: 'Weighted', desc: 'More shares → more slices' },
  LIVE_DRAW: { label: 'Seeded Live', desc: 'Seed + hash published for audit' },
  FIXED_ORDER: { label: 'Fixed Order', desc: 'Strict rotation position' },
};

interface Particle {
  x: number; y: number; vx: number; vy: number;
  size: number; color: string; rotation: number; rotSpeed: number; alpha: number;
}

// ── Web Audio Synth Sounds ───────────────────────────────────────────────────
class SoundController {
  private ctx: AudioContext | null = null;
  public enabled = true;

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
  }

  public playTick() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(680, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  public playWin() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const playNote = (freq: number, start: number, duration: number, type: OscillatorType = 'sine') => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.12, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
    };
    playNote(261.63, t, 0.25);
    playNote(329.63, t + 0.15, 0.25);
    playNote(392.0, t + 0.3, 0.25);
    playNote(523.25, t + 0.45, 0.6, 'triangle');
  }
}

const sounds = new SoundController();

const initialsOf = (name: string) =>
  name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

const statusPill = (status: Result['status']) =>
  status === 'PENDING'
    ? 'bg-amber-50 dark:bg-warning-500/10 text-amber-700 dark:text-warning-400'
    : status === 'CONFIRMED'
      ? 'bg-green-50 dark:bg-success-500/10 text-green-700 dark:text-success-400'
      : 'bg-red-50 dark:bg-error-500/10 text-red-700 dark:text-error-400';

const methodPill = (method: Result['method']) =>
  'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 dark:bg-white/[0.06] text-gray-600 dark:text-gray-300';

export default function LotteryPage() {
  const { t } = useLanguage();
  const permissions = useAdminPermissions();
  const [results, setResults] = useState<LotteryResultItem[]>([]);
  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [redrawing, setRedrawing] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [eligibility, setEligibility] = useState<LotteryEligibility | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [pending, setPending] = useState<LotteryDrawPending | null>(null);
  const [method, setMethod] = useState<Result['method']>('RANDOM');
  const [speed, setSpeed] = useState<number>(1.4); // revolutions per second
  const [duration, setDuration] = useState<number>(4.5); // seconds
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [showMembers, setShowMembers] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<'all' | Result['status']>('all');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const slicesRef = useRef<string[]>([]);
  const animRef = useRef<number>(0);
  const currentAngleRef = useRef(0);
  const spinningRef = useRef(false);
  const particlesRef = useRef<Particle[]>([]);
  const lastTickAngleRef = useRef(0);

  useEffect(() => { sounds.enabled = soundOn; }, [soundOn]);

  // Persist spin feel across sessions
  useEffect(() => {
    const s = parseFloat(localStorage.getItem('lottery_speed') || '');
    const d = parseFloat(localStorage.getItem('lottery_duration') || '');
    if (!isNaN(s) && s >= 0.5 && s <= 4) setSpeed(s);
    if (!isNaN(d) && d >= 2 && d <= 10) setDuration(d);
  }, []);
  useEffect(() => { localStorage.setItem('lottery_speed', String(speed)); }, [speed]);
  useEffect(() => { localStorage.setItem('lottery_duration', String(duration)); }, [duration]);

  const refreshData = useCallback(async () => {
    const [resultsData, groupsData] = await Promise.allSettled([getLotteryResults(), getGroups()]);
    if (resultsData.status === 'fulfilled') setResults(resultsData.value);
    if (groupsData.status === 'fulfilled') setGroups(groupsData.value);
    return groupsData.status === 'fulfilled' ? groupsData.value : [];
  }, []);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        await refreshData();
      } catch {
        setError('Failed to load lottery data.');
      } finally {
        setLoading(false);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Eligibility board for the selected group
  const refreshEligibility = useCallback(async (groupId: string) => {
    setDetailsLoading(true);
    setError(null);
    try {
      const board = await getLotteryEligibility(groupId);
      setEligibility(board);
      setMethod(board.defaultMethod);
      slicesRef.current = board.members.filter((m) => m.eligible).map((m) => m.name);
      if (board.pendingResultId) {
        const res = await getLotteryResults(groupId);
        const p = res.find((r) => r.id === board.pendingResultId);
        if (p && p.status === 'PENDING') {
          setPending({
            id: p.id, cycleId: p.cycleId, winnerId: p.winnerId, winnerName: p.winnerName,
            method: p.method, attempt: p.attempt, status: 'PENDING', gross: p.amount,
            adminFee: p.adminFee ?? 0, net: p.net ?? p.amount, eligibleCount: board.eligibleCount,
            amount: p.amount, seed: p.seed, resultHash: p.resultHash, awaitingConfirmation: true,
          });
        }
      } else {
        setPending(null);
      }
    } catch (err: any) {
      setEligibility(null);
      slicesRef.current = [];
      setPending(null);
      if (err?.response?.status !== 404) {
        setError(err?.response?.data?.message || 'Failed to load eligibility.');
      }
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  useEffect(() => {
    setPending(null);
    setEligibility(null);
    if (selectedGroupId) void refreshEligibility(selectedGroupId);
  }, [selectedGroupId, refreshEligibility]);

  // ── Canvas rendering (DPR-sharp, glow rim, pro segments) ────────────────────
  const drawWheel = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const cssSize = canvas.clientWidth || 320;
    const pxSize = Math.round(cssSize * dpr);
    if (canvas.width !== pxSize) {
      canvas.width = pxSize;
      canvas.height = pxSize;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const names = slicesRef.current;
    const count = names.length;
    const cx = cssSize / 2;
    const cy = cssSize / 2;
    const radius = cssSize / 2 - 18;

    ctx.clearRect(0, 0, cssSize, cssSize);

    // Backdrop
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 8, 0, 2 * Math.PI);
    ctx.fillStyle = '#0b1120';
    ctx.fill();

    if (count === 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
      const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, radius);
      g.addColorStop(0, '#1e293b');
      g.addColorStop(1, '#0f172a');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('No eligible members', cx, cy - 8);
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillStyle = '#475569';
      ctx.fillText('Verify deposits to open the draw', cx, cy + 12);
    } else {
      const arcSize = (2 * Math.PI) / count;
      const startAngle = currentAngleRef.current;

      for (let i = 0; i < count; i++) {
        const angle = startAngle + i * arcSize;
        const grad = ctx.createRadialGradient(cx, cy, radius * 0.15, cx, cy, radius);
        grad.addColorStop(0, PALETTE[i % PALETTE.length] + 'cc');
        grad.addColorStop(1, PALETTE[i % PALETTE.length]);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, angle, angle + arcSize);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.lineWidth = count > 24 ? 0.5 : 1.5;
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.stroke();

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle + arcSize / 2);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.font =
          count > 24 ? 'bold 8px system-ui, sans-serif'
          : count > 16 ? 'bold 10px system-ui, sans-serif'
          : 'bold 12px system-ui, sans-serif';
        const label = names[i].length > 16 ? names[i].slice(0, 14) + '…' : names[i];
        ctx.fillText(label, radius - 12, 0);
        ctx.restore();
      }

      // Gloss arc (3D depth)
      const gloss = ctx.createLinearGradient(0, 0, 0, cssSize);
      gloss.addColorStop(0, 'rgba(255,255,255,0.16)');
      gloss.addColorStop(0.5, 'rgba(255,255,255,0)');
      gloss.addColorStop(1, 'rgba(0,0,0,0.25)');
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
      ctx.fillStyle = gloss;
      ctx.fill();
    }

    // Glow ring
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 6, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(34,211,238,0.55)';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(34,211,238,0.8)';
    ctx.shadowBlur = 14;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.arc(cx, cy, radius + 2, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Pointer (top, 12 o'clock)
    ctx.save();
    ctx.translate(cx, cy - radius - 10);
    ctx.shadowColor = 'rgba(239,68,68,0.6)';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(0, 2);
    ctx.lineTo(-11, -16);
    ctx.lineTo(11, -16);
    ctx.closePath();
    ctx.fillStyle = '#ef4444';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ffffffcc';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // Hub
    ctx.beginPath();
    ctx.arc(cx, cy, 24, 0, 2 * Math.PI);
    const hubG = ctx.createLinearGradient(cx - 24, cy - 24, cx + 24, cy + 24);
    hubG.addColorStop(0, '#f8fafc');
    hubG.addColorStop(1, '#cbd5e1');
    ctx.fillStyle = hubG;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, 17, 0, 2 * Math.PI);
    ctx.fillStyle = '#1e1b4b';
    ctx.fill();
    ctx.fillStyle = '#818cf8';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('EQUB', cx, cy);

    // Confetti
    if (particlesRef.current.length > 0) {
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08;
        p.rotation += p.rotSpeed;
        p.alpha -= 0.008;
        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
  }, []);

  useEffect(() => {
    const loop = () => {
      drawWheel();
      animRef.current = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(animRef.current);
  }, [drawWheel]);

  const spawnConfetti = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cx = canvas.clientWidth / 2;
    const cy = canvas.clientHeight / 2;
    const list: Particle[] = [];
    const colors = ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6', '#ef4444'];
    for (let i = 0; i < 130; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed2 = 2 + Math.random() * 6;
      list.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed2,
        vy: Math.sin(angle) * speed2 - 2,
        size: 5 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI,
        rotSpeed: (Math.random() - 0.5) * 0.2,
        alpha: 1.0,
      });
    }
    particlesRef.current = list;
  };

  // ── Draw + spin (phase 1) ────────────────────────────────────────────────────
  const spinToWinner = (winnerName: string, onDone: () => void) => {
    const slices = slicesRef.current;
    const count = slices.length;
    const winnerIdx = slices.indexOf(winnerName);

    if (count === 0 || winnerIdx === -1) {
      // Winner isn't rendered (shouldn't happen — pool is server-built); skip animation
      onDone();
      return;
    }

    const sliceSize = (2 * Math.PI) / count;
    const winnerMid = winnerIdx * sliceSize + sliceSize / 2;
    const finalAngle = 1.5 * Math.PI - winnerMid;
    // User-controlled feel: speed (rev/s) × duration (s) = total revolutions
    const extraRotations = speed * duration * 2 * Math.PI;
    const finalTarget = finalAngle + extraRotations;

    spinningRef.current = true;
    const start = performance.now();
    const durationMs = duration * 1000;
    const initialAngle = currentAngleRef.current;
    lastTickAngleRef.current = initialAngle;

    const animateSpin = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / durationMs, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentVal = initialAngle + (finalTarget - initialAngle) * easeOut;
      currentAngleRef.current = currentVal;

      const angleDiff = currentVal - lastTickAngleRef.current;
      if (angleDiff * count / (2 * Math.PI) >= 1) {
        sounds.playTick();
        lastTickAngleRef.current = currentVal;
      }

      if (progress < 1) {
        requestAnimationFrame(animateSpin);
      } else {
        spinningRef.current = false;
        onDone();
      }
    };
    requestAnimationFrame(animateSpin);
  };

  const handleDraw = async () => {
    if (!eligibility || spinningRef.current) return;
    setIsDrawing(true);
    setPending(null);
    setError(null);
    setSuccess(null);
    try {
      const drawn = await drawLottery(eligibility.cycleId, method === eligibility.defaultMethod ? undefined : method);
      spinToWinner(drawn.winnerName, () => {
        setIsDrawing(false);
        setPending(drawn);
        spawnConfetti();
        sounds.playWin();
      });
    } catch (err: any) {
      setError(
        err.response?.data?.message || err.message ||
        'Lottery draw failed. Check verified deposits for the current cycle.'
      );
      setIsDrawing(false);
    }
  };

  const handleConfirm = async () => {
    if (!pending || !selectedGroupId) return;
    setConfirming(true);
    setError(null);
    try {
      await confirmLotteryDraw(pending.id, selectedGroupId);
      setSuccess(`${pending.winnerName} confirmed as the official winner! Payout scheduled.`);
      setTimeout(() => setSuccess(null), 5000);
      setPending(null);
      await refreshData();
      await refreshEligibility(selectedGroupId);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to confirm the draw.');
    } finally {
      setConfirming(false);
    }
  };

  const handleRedraw = async () => {
    if (!pending || !selectedGroupId || spinningRef.current) return;
    setRedrawing(true);
    setError(null);
    try {
      const next = await redrawLotteryDraw(pending.id, selectedGroupId);
      setPending(null);
      sounds.playTick();
      spinToWinner(next.winnerName, () => {
        setRedrawing(false);
        setPending(next);
        spawnConfetti();
        sounds.playWin();
      });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to re-draw.');
      setRedrawing(false);
    }
  };

  const copySeed = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(text.slice(0, 12));
    setTimeout(() => setCopied(null), 1500);
  };

  const eligibleMembers = eligibility?.members.filter((m) => m.eligible) ?? [];
  const unpaidCount = eligibility?.members.filter((m) => !m.eligible && m.verifiedAmount <= 0).length ?? 0;
  const rotationDoneCount = eligibility?.members.filter((m) => !m.eligible && m.verifiedAmount > 0).length ?? 0;
  const canDraw = !!eligibility && !detailsLoading && eligibleMembers.length > 0 && !pending &&
    hasPermission(permissions, selectedGroupId, 'canTriggerLottery');

  const filteredResults = useMemo(
    () => (historyFilter === 'all' ? results : results.filter((r) => r.status === historyFilter)),
    [results, historyFilter],
  );
  const statusCounts = useMemo(() => ({
    all: results.length,
    CONFIRMED: results.filter((r) => r.status === 'CONFIRMED').length,
    PENDING: results.filter((r) => r.status === 'PENDING').length,
    VOID: results.filter((r) => r.status === 'VOID').length,
  }), [results]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('lottery.loading')}</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {success && (
        <div className="mb-4 p-3 rounded-xl bg-green-50 dark:bg-success-500/10 text-green-700 dark:text-success-400 text-sm font-medium border border-green-100 flex items-center justify-between">
          <span className="flex items-center gap-2"><BadgeCheck className="h-4 w-4" />{success}</span>
          <button onClick={() => setSuccess(null)} className="font-bold hover:text-green-900 dark:hover:text-green-300 text-lg leading-none">×</button>
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-error-500/10 text-red-700 dark:text-error-400 text-sm font-medium border border-red-100 flex items-center gap-3">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="font-bold hover:text-red-900 dark:hover:text-red-300 text-lg leading-none">×</button>
        </div>
      )}

      {/* Header */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white/90 truncate">Lottery Draw Arena</h1>
          <p className="mt-0.5 text-xs md:text-sm text-gray-500 dark:text-gray-400 truncate">
            Transparent seeded draws · admin-confirmed winners · full audit history
          </p>
        </div>
        <button
          onClick={() => setSoundOn(!soundOn)}
          className={`shrink-0 p-2.5 rounded-xl border transition-all ${
            soundOn
              ? 'bg-indigo-50 dark:bg-brand-500/10 text-indigo-600 dark:text-brand-400 border-indigo-200 dark:border-brand-500/20'
              : 'bg-white dark:bg-gray-900 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-800'
          }`}
          title="Toggle Sound FX"
        >
          {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </button>
      </div>

      {/* ── Arena ─────────────────────────────────────────────────────────── */}
      <div className="card mb-5 p-0 bg-slate-900 border border-slate-800 text-slate-100 relative overflow-hidden rounded-2xl shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/25 via-slate-900 to-cyan-950/15 pointer-events-none" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent pointer-events-none" />

        <div className="relative z-10 p-4 md:p-6 flex flex-col lg:flex-row items-center gap-6 lg:gap-10">
          {/* Wheel */}
          <div className="flex-shrink-0 flex flex-col items-center gap-3">
            <div className="relative p-2 bg-slate-800/60 rounded-full border border-slate-700 shadow-[0_0_40px_-10px_rgba(34,211,238,0.35)]">
              <canvas
                ref={canvasRef}
                className="w-[260px] h-[260px] sm:w-[300px] sm:h-[300px] lg:w-[320px] lg:h-[320px] rounded-full bg-slate-950"
              />
              {isDrawing && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="px-3 py-1 rounded-full bg-slate-950/80 border border-cyan-400/40 text-cyan-300 text-[11px] font-bold tracking-widest uppercase">
                    Drawing…
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 text-[10px] text-slate-500">
              <span className="flex items-center gap-1"><Gauge className="h-3 w-3" />{speed.toFixed(1)} rev/s</span>
              <span className="flex items-center gap-1"><Timer className="h-3 w-3" />{duration.toFixed(1)}s</span>
              <span className="flex items-center gap-1"><Users className="h-3 w-3" />{eligibleMembers.length} in pool</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex-1 w-full space-y-4">
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-2">
                <PlayCircle className="h-3.5 w-3.5" />
                Live Drawing Arena
              </span>
              <h3 className="text-lg md:text-xl font-bold text-white">
                {pending ? 'Confirm the Lucky Member' : 'Initiate Turn Draw'}
              </h3>
            </div>

            {pending ? (
              /* ── Pending result: admin decision ── */
              <div className="bg-slate-950/70 border border-amber-500/30 rounded-2xl p-4 md:p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Trophy className="h-20 w-20 text-amber-400" />
                </div>
                <div className="relative">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="h-4 w-4 text-amber-400" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                      Awaiting your decision · Attempt #{pending.attempt}
                    </span>
                  </div>
                  <p className="text-xl md:text-2xl font-black text-white">
                    {pending.winnerName} <span className="text-amber-400">🎉</span>
                  </p>
                  <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                    <div className="bg-slate-900/80 rounded-lg py-2">
                      <p className="text-[9px] uppercase tracking-wide text-slate-500">Gross Pool</p>
                      <p className="text-sm font-bold text-white tabular-nums">ETB {pending.gross.toLocaleString()}</p>
                    </div>
                    <div className="bg-slate-900/80 rounded-lg py-2">
                      <p className="text-[9px] uppercase tracking-wide text-slate-500">Admin Fee</p>
                      <p className="text-sm font-bold text-rose-400 tabular-nums">-ETB {pending.adminFee.toLocaleString()}</p>
                    </div>
                    <div className="bg-slate-900/80 rounded-lg py-2">
                      <p className="text-[9px] uppercase tracking-wide text-slate-500">Net Payout</p>
                      <p className="text-sm font-bold text-emerald-400 tabular-nums">ETB {pending.net.toLocaleString()}</p>
                    </div>
                  </div>
                  {pending.seed && (
                    <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-500 bg-slate-900/60 rounded-lg px-2.5 py-1.5">
                      <Fingerprint className="h-3 w-3 shrink-0 text-cyan-400" />
                      <span className="font-mono truncate" title={`seed: ${pending.seed} · hash: ${pending.resultHash}`}>
                        seed {pending.seed} · {pending.resultHash?.slice(0, 18)}…
                      </span>
                      <button onClick={() => copySeed(pending.seed || '')} className="ml-auto shrink-0 text-slate-400 hover:text-cyan-300" title="Copy seed">
                        {copied === pending.seed.slice(0, 12) ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row gap-2 mt-4">
                    <Button
                      onClick={handleConfirm}
                      loading={confirming}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Confirm {pending.winnerName.split(' ')[0]} as Winner
                    </Button>
                    <Button
                      onClick={handleRedraw}
                      loading={redrawing}
                      variant="secondary"
                      className="flex-1 bg-slate-800 hover:bg-slate-700 text-white rounded-xl border border-slate-700"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Re-draw
                    </Button>
                  </div>
                  <p className="mt-2 text-[10px] text-slate-500">
                    Confirming completes the cycle, locks the winner and schedules the payout. Re-draw voids this attempt and spins again.
                  </p>
                </div>
              </div>
            ) : (
              /* ── Draw controls ── */
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                    Saving Group
                  </label>
                  <select
                    value={selectedGroupId}
                    onChange={(e) => setSelectedGroupId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Choose an active group</option>
                    {groups
                      .filter((g) => g.status === 'active' && hasPermission(permissions, g.id, 'canTriggerLottery'))
                      .map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name} (Cycle {group.currentCycle})
                        </option>
                      ))}
                  </select>
                </div>

                {/* Method selection */}
                {eligibility && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                      Draw Method <span className="text-slate-600 normal-case font-medium">(group default: {METHOD_META[eligibility.defaultMethod].label})</span>
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(Object.keys(METHOD_META) as Result['method'][]).map((m) => (
                        <button
                          key={m}
                          onClick={() => setMethod(m)}
                          className={`text-left px-3 py-2 rounded-xl border transition-all ${
                            method === m
                              ? 'bg-indigo-500/15 border-indigo-400/60 ring-1 ring-indigo-400/40'
                              : 'bg-slate-950/60 border-slate-800 hover:border-slate-600'
                          }`}
                        >
                          <p className={`text-xs font-bold ${method === m ? 'text-indigo-300' : 'text-slate-300'}`}>
                            {METHOD_META[m].label}
                          </p>
                          <p className="text-[10px] text-slate-500 leading-tight mt-0.5">{METHOD_META[m].desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Spin feel controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                      <span className="flex items-center gap-1"><Gauge className="h-3 w-3" />Rotation Speed</span>
                      <span className="text-cyan-400 font-mono">{speed.toFixed(1)} rev/s</span>
                    </label>
                    <input
                      type="range" min={0.5} max={4} step={0.1} value={speed}
                      onChange={(e) => setSpeed(parseFloat(e.target.value))}
                      className="w-full accent-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                      <span className="flex items-center gap-1"><Timer className="h-3 w-3" />Spin Duration</span>
                      <span className="text-cyan-400 font-mono">{duration.toFixed(1)}s</span>
                    </label>
                    <input
                      type="range" min={2} max={10} step={0.5} value={duration}
                      onChange={(e) => setDuration(parseFloat(e.target.value))}
                      className="w-full accent-cyan-400"
                    />
                  </div>
                </div>

                <Button
                  onClick={handleDraw}
                  loading={isDrawing}
                  disabled={!canDraw}
                  size="lg"
                  className="w-full bg-gradient-to-r from-indigo-600 to-brand-500 hover:from-indigo-500 hover:to-brand-400 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/30"
                >
                  <Ticket className="h-5 w-5 mr-2" />
                  {isDrawing ? 'Spinning…' : pending ? 'Draw already pending' : 'Draw Now'}
                </Button>
                {!pending && !eligibility && selectedGroupId && !detailsLoading && (
                  <p className="text-[11px] text-slate-500">
                    No active cycle for this group — a draw cannot run right now.
                  </p>
                )}
              </div>
            )}

            {/* Eligibility review */}
            {eligibility && !pending && (
              <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 mt-2">
                <div className="flex flex-wrap items-center gap-1.5 mb-3">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">
                    <CheckCircle2 className="h-3 w-3" /> {eligibility.eligibleCount} eligible
                  </span>
                  {unpaidCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 text-[10px] font-bold">
                      <Ban className="h-3 w-3" /> {unpaidCount} unpaid
                    </span>
                  )}
                  {rotationDoneCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-400 text-[10px] font-bold">
                      <RotateCcw className="h-3 w-3" /> {rotationDoneCount} rotation done
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 text-[10px] font-bold">
                    Pool ETB {eligibility.totalPool.toLocaleString()}
                  </span>
                  <button
                    onClick={() => setShowMembers((v) => !v)}
                    className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-slate-200"
                  >
                    {showMembers ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    {showMembers ? 'Hide' : 'Review'} members
                  </button>
                </div>

                {eligibility.violations.length > 0 && (
                  <div className="mb-3 space-y-1.5">
                    {eligibility.violations.map((v) => (
                      <div
                        key={v.rule}
                        className={`flex items-start gap-1.5 text-[11px] rounded-lg px-2.5 py-1.5 ${
                          v.severity === 'ERROR'
                            ? 'bg-rose-500/10 text-rose-300'
                            : 'bg-amber-500/10 text-amber-300'
                        }`}
                      >
                        <ShieldAlert className="h-3 w-3 mt-0.5 shrink-0" />
                        {v.message}
                      </div>
                    ))}
                  </div>
                )}

                {showMembers && (
                  <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                    {eligibility.members.map((m) => (
                      <EligibilityRow key={m.userId} member={m} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── History ───────────────────────────────────────────────────────── */}
      <div className="card overflow-hidden p-0 rounded-2xl">
        <div className="p-4 md:p-6 border-b border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white/90">Winners History</h3>
            <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Full audit grounds — method, fees, payout state and draw seeds for every attempt.
            </p>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {(['all', 'CONFIRMED', 'PENDING', 'VOID'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setHistoryFilter(f)}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all ${
                  historyFilter === f
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-white/[0.08] text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/[0.12]'
                }`}
              >
                {f === 'all' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
                <span className="ml-1 opacity-70">{statusCounts[f]}</span>
              </button>
            ))}
          </div>
        </div>

        {filteredResults.length > 0 ? (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-white/[0.04] border-b border-gray-100 dark:border-gray-800">
                  <tr>
                    <th className="table-header">Winner</th>
                    <th className="table-header">Group / Cycle</th>
                    <th className="table-header">Method</th>
                    <th className="table-header text-right">Gross</th>
                    <th className="table-header text-right">Net</th>
                    <th className="table-header">Payout</th>
                    <th className="table-header">Status</th>
                    <th className="table-header text-right">Audit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {filteredResults.map((r) => (
                    <React.Fragment key={r.id}>
                      <tr
                        className={`hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer ${r.status === 'VOID' ? 'opacity-60' : ''}`}
                        onClick={() => setExpandedRow(expandedRow === r.id ? null : r.id)}
                      >
                        <td className="table-cell">
                          <div className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                              {initialsOf(r.winnerName)}
                            </span>
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900 dark:text-white/90 truncate">{r.winnerName}</p>
                              {r.attempt > 1 && <p className="text-[10px] text-gray-400">attempt #{r.attempt}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="table-cell">
                          <p className="font-medium text-gray-900 dark:text-white/90">{r.groupName}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Cycle {r.cycle}</p>
                        </td>
                        <td className="table-cell">
                          <span className={methodPill(r.method)}>{METHOD_META[r.method].label}</span>
                        </td>
                        <td className="table-cell text-right tabular-nums text-gray-700 dark:text-gray-300">
                          {r.amount.toLocaleString()}
                        </td>
                        <td className="table-cell text-right tabular-nums font-semibold text-gray-900 dark:text-white/90">
                          {r.net != null ? r.net.toLocaleString() : '—'}
                        </td>
                        <td className="table-cell">
                          {r.payout ? (
                            <span className={`text-xs font-semibold ${r.payout.status === 'COMPLETED' ? 'text-green-600 dark:text-success-400' : 'text-amber-600 dark:text-warning-400'}`}>
                              {r.payout.status === 'COMPLETED' ? 'Paid' : 'Scheduled'}
                              {r.payout.payoutDate ? ` · ${r.payout.payoutDate}` : ''}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="table-cell">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusPill(r.status)}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="table-cell text-right">
                          {expandedRow === r.id ? <ChevronUp className="h-4 w-4 inline text-gray-400" /> : <ChevronDown className="h-4 w-4 inline text-gray-400" />}
                        </td>
                      </tr>
                      {expandedRow === r.id && (
                        <tr className="bg-gray-50/70 dark:bg-white/[0.03]">
                          <td colSpan={8} className="px-6 py-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                              <AuditCell label="Drawn by" value={r.drawnByName || '—'} />
                              <AuditCell label="Drawn at" value={new Date(r.drawnAt).toLocaleString()} />
                              <AuditCell label="Confirmed by" value={r.confirmedByName || '—'} />
                              <AuditCell label="Confirmed at" value={r.confirmedAt ? new Date(r.confirmedAt).toLocaleString() : '—'} />
                              <AuditCell label="Admin fee" value={r.adminFee != null ? `ETB ${r.adminFee.toLocaleString()}` : '—'} />
                              <AuditCell label="Payout amount" value={r.payout?.amount != null ? `ETB ${r.payout.amount.toLocaleString()}` : '—'} />
                              <div className="col-span-2">
                                <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-0.5 flex items-center gap-1">
                                  <Fingerprint className="h-3 w-3" /> Fairness seed / hash
                                </p>
                                {r.seed ? (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); copySeed(r.seed || ''); }}
                                    className="font-mono text-[10px] text-left text-gray-600 dark:text-gray-300 break-all hover:text-cyan-600 dark:hover:text-cyan-400"
                                    title="Click to copy seed"
                                  >
                                    {copied === r.seed.slice(0, 12) ? 'copied ✓ · ' : ''}seed {r.seed}
                                    {r.resultHash ? ` · sha256 ${r.resultHash.slice(0, 24)}…` : ''}
                                  </button>
                                ) : (
                                  <p className="text-[10px] text-gray-400 dark:text-gray-500">Fixed-order draw (no seed)</p>
                                )}
                              </div>
                              {r.status === 'VOID' && (
                                <AuditCell label="Voided" value={`${r.voidedAt ? new Date(r.voidedAt).toLocaleString() : ''} — ${r.voidReason || ''}`} />
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-gray-50 dark:divide-gray-800">
              {filteredResults.map((r) => (
                <div
                  key={r.id}
                  className={`px-3 py-3 ${r.status === 'VOID' ? 'opacity-60' : ''}`}
                  onClick={() => setExpandedRow(expandedRow === r.id ? null : r.id)}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
                      {initialsOf(r.winnerName)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white/90 truncate flex items-center gap-1.5">
                        {r.winnerName}
                        {r.attempt > 1 && <span className="text-[10px] font-medium text-gray-400">#{r.attempt}</span>}
                      </p>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">
                        {r.groupName} · C{r.cycle} · {r.date}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-gray-900 dark:text-white/90 tabular-nums">
                        ETB {(r.net ?? r.amount).toLocaleString()}
                      </p>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${statusPill(r.status)}`}>
                        {r.status}
                      </span>
                    </div>
                  </div>
                  {expandedRow === r.id && (
                    <div className="mt-2.5 grid grid-cols-2 gap-2 text-[11px] bg-gray-50 dark:bg-white/[0.03] rounded-xl p-3">
                      <AuditCell label="Method" value={METHOD_META[r.method].label} />
                      <AuditCell label="Gross / Net" value={`ETB ${r.amount.toLocaleString()} / ${r.net != null ? r.net.toLocaleString() : '—'}`} />
                      <AuditCell label="Drawn by" value={r.drawnByName || '—'} />
                      <AuditCell label="Confirmed by" value={r.confirmedByName || '—'} />
                      <AuditCell label="Payout" value={r.payout ? `${r.payout.status === 'COMPLETED' ? 'Paid' : 'Scheduled'}${r.payout.payoutDate ? ` · ${r.payout.payoutDate}` : ''}` : '—'} />
                      <AuditCell label="Seed" value={r.seed ? `${r.seed.slice(0, 10)}…` : 'fixed-order'} />
                      {r.status === 'VOID' && (
                        <div className="col-span-2">
                          <AuditCell label="Voided" value={`${r.voidedAt ? new Date(r.voidedAt).toLocaleString() : ''} — ${r.voidReason || ''}`} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-14">
            <Ticket className="h-12 w-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400 font-medium">No draw results found</p>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
              {results.length > 0 ? 'Try a different status filter.' : 'Select a group above and trigger the draw.'}
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function EligibilityRow({ member }: { member: LotteryEligibilityMember }) {
  return (
    <div className="flex items-center gap-2 p-2 bg-slate-900 border border-slate-800 rounded-lg">
      <span
        className={`w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${
          member.eligible
            ? 'bg-gradient-to-br from-indigo-500 to-cyan-500 text-white'
            : 'bg-slate-800 text-slate-500 ring-1 ring-slate-700'
        }`}
      >
        {initialsOf(member.name)}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-300 truncate">{member.name}</p>
        <p className="text-[10px] text-slate-500">
          {member.shares} share{member.shares !== 1 ? 's' : ''} · {member.confirmedWins} won
          {member.verifiedAmount > 0 && ` · paid ${member.verifiedAmount.toLocaleString()}`}
        </p>
      </div>
      <span
        className={`px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${
          member.eligible
            ? 'bg-emerald-500/10 text-emerald-400'
            : 'bg-slate-800 text-slate-500'
        }`}
        title={member.reason}
      >
        {member.eligible ? 'IN' : member.verifiedAmount <= 0 ? 'UNPAID' : 'DONE'}
      </span>
    </div>
  );
}

function AuditCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-0.5">{label}</p>
      <p className="font-medium text-gray-700 dark:text-gray-200 break-words">{value}</p>
    </div>
  );
}
