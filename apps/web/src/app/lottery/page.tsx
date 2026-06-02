'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Ticket, Trophy, Users, Calendar, Sparkles, AlertCircle,
  ShieldAlert, ListOrdered, Volume2, VolumeX, PlayCircle
} from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useLanguage } from '@/components/layout/LanguageContext';
import Button from '@/components/ui/Button';
import { getLotteryResults, triggerLottery, getGroups, getGroup, getGroupRules } from '@/lib/api';
import type { LotteryResultItem, GroupListItem, GroupDetail, GroupRules } from '@/lib/api';

// ── Segment Colors ───────────────────────────────────────────────────────────
const PALETTE = [
  '#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6',
  '#ef4444', '#14b8a6', '#f43f5e', '#6366f1', '#0ea5e9', '#10b981'
];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  rotSpeed: number;
  alpha: number;
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

    playNote(261.63, t, 0.25); // C4
    playNote(329.63, t + 0.15, 0.25); // E4
    playNote(392.00, t + 0.3, 0.25); // G4
    playNote(523.25, t + 0.45, 0.6, 'triangle'); // C5
  }
}

const sounds = new SoundController();

export default function LotteryPage() {
  const { t } = useLanguage();
  const [results, setResults] = useState<LotteryResultItem[]>([]);
  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [selectedGroupDetail, setSelectedGroupDetail] = useState<GroupDetail | null>(null);
  const [selectedGroupRules, setSelectedGroupRules] = useState<GroupRules | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [drawResult, setDrawResult] = useState<{ winner: string; amount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(true);

  // Canvas Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const eligibleRef = useRef<string[]>([]);
  const animRef = useRef<number>(0);

  // Spin variables
  const currentAngleRef = useRef(0);
  const targetAngleRef = useRef(0);
  const spinningRef = useRef(false);
  const particlesRef = useRef<Particle[]>([]);

  // Sound sync trigger threshold
  const lastTickAngleRef = useRef(0);

  useEffect(() => {
    sounds.enabled = soundOn;
  }, [soundOn]);

  // Fetch initial list
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [resultsData, groupsData] = await Promise.allSettled([
          getLotteryResults(),
          getGroups(),
        ]);
        if (resultsData.status === 'fulfilled') setResults(resultsData.value);
        if (groupsData.status === 'fulfilled') setGroups(groupsData.value);

        if (resultsData.status === 'rejected' && groupsData.status === 'rejected') {
          setError('Failed to load lottery data. Please check your connection.');
        }
      } catch {
        setError('Failed to load lottery data.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Fetch group details and rules
  useEffect(() => {
    const fetchGroupDetails = async () => {
      if (!selectedGroupId) {
        setSelectedGroupDetail(null);
        setSelectedGroupRules(null);
        eligibleRef.current = [];
        return;
      }
      setDetailsLoading(true);
      setDrawResult(null);
      setError(null);
      try {
        const [detail, rules] = await Promise.all([
          getGroup(selectedGroupId),
          getGroupRules(selectedGroupId),
        ]);
        setSelectedGroupDetail(detail);
        setSelectedGroupRules(rules);
        const candidates = detail.members.filter(m => !m.hasWon).map(m => m.name);
        eligibleRef.current = candidates;
      } catch (err) {
        console.error('Failed to load group detail/rules:', err);
      } finally {
        setDetailsLoading(false);
      }
    };
    fetchGroupDetails();
  }, [selectedGroupId]);

  // ── Canvas Drawing / Animation Loop ──────────────────────────────────────────
  const drawWheel = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const names = eligibleRef.current;
    const count = names.length;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const radius = Math.min(cx, cy) - 24;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (count === 0) {
      // Empty wheel placeholder
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
      ctx.fillStyle = '#1e293b';
      ctx.fill();
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('No eligible members', cx, cy);
      return;
    }

    const arcSize = (2 * Math.PI) / count;
    const startAngle = currentAngleRef.current;

    // Draw slices
    for (let i = 0; i < count; i++) {
      const angle = startAngle + i * arcSize;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, angle, angle + arcSize);
      ctx.closePath();

      ctx.fillStyle = PALETTE[i % PALETTE.length];
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#ffffff50';
      ctx.stroke();

      // Add text label
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle + arcSize / 2);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.font = count > 12 ? 'bold 10px system-ui, sans-serif' : 'bold 13px system-ui, sans-serif';

      const label = names[i].length > 15 ? names[i].substring(0, 13) + '..' : names[i];
      ctx.fillText(label, radius - 15, 0);
      ctx.restore();
    }

    // Outer ring decoration
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 4, 0, 2 * Math.PI);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, radius + 10, 0, 2 * Math.PI);
    ctx.strokeStyle = '#4f46e540';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw pointer at top center (12 o'clock = -PI/2)
    ctx.save();
    ctx.translate(cx, cy - radius - 12);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-12, -18);
    ctx.lineTo(12, -18);
    ctx.closePath();
    ctx.fillStyle = '#ef4444';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Inner hub
    ctx.beginPath();
    ctx.arc(cx, cy, 26, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, 2 * Math.PI);
    ctx.fillStyle = '#1e1b4b';
    ctx.fill();

    // Draw confetti particles if active
    if (particlesRef.current.length > 0) {
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08; // gravity
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

  // Anim frame tick
  useEffect(() => {
    const loop = () => {
      drawWheel();
      animRef.current = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(animRef.current);
  }, [drawWheel]);

  // ── Spawn Confetti ───────────────────────────────────────────────────────────
  const spawnConfetti = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    const list: Particle[] = [];
    const colors = ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6', '#ef4444'];
    for (let i = 0; i < 120; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 6;
      list.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        size: 5 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * Math.PI,
        rotSpeed: (Math.random() - 0.5) * 0.2,
        alpha: 1.0,
      });
    }
    particlesRef.current = list;
  };

  // ── Trigger Draw & Spin ──────────────────────────────────────────────────────
  const handleDraw = async () => {
    if (!selectedGroupId || spinningRef.current) return;

    setIsDrawing(true);
    setDrawResult(null);
    setError(null);
    setSuccess(null);

    try {
      const result = await triggerLottery(selectedGroupId);

      // Extract winner info
      const winnerName = result.winner?.name || 'Winner';
      const winnerIdx = eligibleRef.current.indexOf(winnerName);

      if (winnerIdx === -1) {
        throw new Error('Drawn winner is not in the eligible members list.');
      }

      // Calculate exact stop angle
      // Winner slice must align at pointer position (-PI/2)
      const count = eligibleRef.current.length;
      const sliceSize = (2 * Math.PI) / count;

      // Slice center for winner
      const winnerMid = winnerIdx * sliceSize + sliceSize / 2;

      // Target angle needs to bring winnerMid pointing straight up (-PI/2)
      // Pointer is at 1.5 * PI (top). So target = 1.5 * PI - winnerMid
      const finalAngle = 1.5 * Math.PI - winnerMid;

      // Spin at least 5 full rotations (10 * PI)
      const extraRotations = 8 * Math.PI;
      const finalTarget = finalAngle + extraRotations;

      // Start easing animation
      spinningRef.current = true;
      let start = performance.now();
      const duration = 4500; // 4.5 seconds spin
      const initialAngle = currentAngleRef.current % (2 * Math.PI);
      lastTickAngleRef.current = initialAngle;

      const animateSpin = (now: number) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);

        // Cubic ease out deceleration
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const currentVal = initialAngle + (finalTarget - initialAngle) * easeOut;
        currentAngleRef.current = currentVal;

        // Play clicking sounds as segments pass the top pointer
        const angleDiff = currentVal - lastTickAngleRef.current;
        if (angleDiff * count / (2 * Math.PI) >= 1) {
          sounds.playTick();
          lastTickAngleRef.current = currentVal;
        }

        if (progress < 1) {
          requestAnimationFrame(animateSpin);
        } else {
          // Finished spin
          spinningRef.current = false;
          setIsDrawing(false);
          setDrawResult({ winner: winnerName, amount: result.amount });
          spawnConfetti();
          sounds.playWin();
          setSuccess('Lottery draw completed successfully!');
          setTimeout(() => setSuccess(null), 4000);

          // Update records
          getLotteryResults().then(setResults).catch(() => {});
          getGroup(selectedGroupId).then(setSelectedGroupDetail).catch(() => {});
        }
      };

      requestAnimationFrame(animateSpin);

    } catch (err: any) {
      setError(
        err.response?.data?.message || err.message || 'Lottery draw failed. Check verified deposits for current cycle.'
      );
      setIsDrawing(false);
    }
  };

  const getPayoutPreview = () => {
    if (!selectedGroupDetail || !selectedGroupRules) return null;
    const gross = selectedGroupDetail.contributionAmount * selectedGroupDetail.membersCount;
    let fee = 0;
    if (selectedGroupRules.adminFeeType === 'FIXED') {
      fee = selectedGroupRules.adminFeeAmount || 0;
    } else if (selectedGroupRules.adminFeeType === 'PERCENTAGE') {
      fee = gross * ((selectedGroupRules.adminFeePercent || 0) / 100);
    }
    const net = gross - fee;
    return { gross, fee, net };
  };

  const payoutPreview = getPayoutPreview();

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
            <p className="text-sm text-gray-500">{t('lottery.loading')}</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {success && (
        <div className="mb-6 p-4 rounded-xl bg-green-50 text-green-700 text-sm font-medium border border-green-100 flex items-center justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="text-green-500 hover:text-green-700 font-bold text-lg leading-none">×</button>
        </div>
      )}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-700 text-sm font-medium border border-red-100 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700 font-bold text-lg leading-none">×</button>
        </div>
      )}

      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lottery Draw Arena</h1>
          <p className="mt-1 text-sm text-gray-500">Run transparency-focused live draws for active saving circles.</p>
        </div>
        <button
          onClick={() => setSoundOn(!soundOn)}
          className={`p-2.5 rounded-xl border border-gray-200 transition-all ${
            soundOn ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-white text-gray-400'
          }`}
          title="Toggle Sound FX"
        >
          {soundOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
        </button>
      </div>

      {/* Draw Section */}
      <div className="card mb-8 p-6 bg-slate-900 border border-slate-800 text-slate-100 relative overflow-hidden shadow-2xl rounded-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/20 via-slate-900 to-emerald-950/10 pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-center gap-10 relative z-10">
          {/* Visual Canvas Wheel */}
          <div className="flex-shrink-0 flex flex-col items-center">
            <div className="relative p-2 bg-slate-800/50 rounded-full border border-slate-700 shadow-inner">
              <canvas
                ref={canvasRef}
                width={320}
                height={320}
                className="w-80 h-80 max-w-full rounded-full bg-slate-950"
              />
            </div>
          </div>

          {/* Draw Controls */}
          <div className="flex-1 w-full space-y-5">
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-3">
                <PlayCircle className="h-3.5 w-3.5" />
                Live Drawing Arena
              </span>
              <h3 className="text-xl font-bold text-white">
                {drawResult ? 'Draw Result Announcement' : 'Initiate Turn Draw'}
              </h3>
            </div>

            {drawResult ? (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Trophy className="h-24 w-24 text-emerald-400" />
                </div>
                <div className="flex items-center gap-3 mb-3">
                  <Sparkles className="h-6 w-6 text-amber-400 animate-pulse" />
                  <span className="text-xl font-black text-emerald-300">
                    Winner: {drawResult.winner} 🎉
                  </span>
                </div>
                <div className="space-y-1.5 text-sm text-emerald-400">
                  <p>
                    Pool Gross: <span className="font-semibold text-white">ETB {drawResult.amount.toLocaleString()}</span>
                  </p>
                  {payoutPreview && payoutPreview.fee > 0 && (
                    <>
                      <p>
                        Admin Fee: <span className="font-semibold text-rose-400">- ETB {payoutPreview.fee.toLocaleString()}</span>
                      </p>
                      <p className="text-lg font-extrabold text-white mt-3 pt-2 border-t border-emerald-500/20">
                        Net Winner Payout: <span>ETB {payoutPreview.net.toLocaleString()}</span>
                      </p>
                    </>
                  )}
                </div>
                <button
                  className="mt-5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-all border border-slate-700"
                  onClick={() => {
                    setDrawResult(null);
                  }}
                >
                  Draw Again
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Select an active Equb circle below to enter candidates list. The wheel will generate segment areas proportional to eligible circle members.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">
                      Choose Saving Group
                    </label>
                    <select
                      value={selectedGroupId}
                      onChange={(e) => setSelectedGroupId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">Choose an active group</option>
                      {groups
                        .filter((g) => g.status === 'active')
                        .map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.name} (Cycle {group.currentCycle})
                          </option>
                        ))}
                    </select>
                  </div>
                  <Button
                    onClick={handleDraw}
                    loading={isDrawing}
                    disabled={!selectedGroupId || detailsLoading || eligibleRef.current.length === 0}
                    size="lg"
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/30"
                  >
                    <Ticket className="h-5 w-5 mr-2" />
                    {isDrawing ? 'Spinning...' : 'Draw Now'}
                  </Button>
                </div>

                {/* Rules & Eligibility Preview */}
                {selectedGroupId && !detailsLoading && selectedGroupDetail && selectedGroupRules && (
                  <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-2 gap-6 mt-4 text-xs">
                    <div>
                      <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4 text-indigo-400" />
                        Pool Strategy & Deductions
                      </h4>
                      <ul className="space-y-2 text-slate-400">
                        <li className="flex justify-between border-b border-slate-900 pb-1.5">
                          <span>Group Status:</span>
                          <span className="font-semibold text-slate-200 capitalize">
                            {selectedGroupRules.allowMidCycleJoin ? 'Flexi Join' : 'Strict Cycle'}
                          </span>
                        </li>
                        {payoutPreview && (
                          <>
                            <li className="flex justify-between border-b border-slate-900 pb-1.5">
                              <span>Gross Pool:</span>
                              <span className="font-semibold text-slate-200">
                                ETB {payoutPreview.gross.toLocaleString()}
                              </span>
                            </li>
                            <li className="flex justify-between border-b border-slate-900 pb-1.5">
                              <span>Fee Structure:</span>
                              <span className="font-semibold text-slate-200 capitalize">
                                {selectedGroupRules.adminFeeType.toLowerCase()}
                              </span>
                            </li>
                            <li className="flex justify-between border-b border-slate-900 pb-1.5 text-rose-400">
                              <span>Admin Deduction:</span>
                              <span className="font-bold">
                                - ETB {payoutPreview.fee.toLocaleString()}
                              </span>
                            </li>
                            <li className="flex justify-between pt-1 text-sm font-bold text-emerald-400">
                              <span>Winner Net Payout:</span>
                              <span>
                                ETB {payoutPreview.net.toLocaleString()}
                              </span>
                            </li>
                          </>
                        )}
                      </ul>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <ListOrdered className="h-4 w-4 text-indigo-400" />
                        Member Segment Allocation
                      </h4>
                      <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                        {selectedGroupDetail.members.map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center justify-between p-2 bg-slate-900 border border-slate-800 rounded-lg"
                          >
                            <span className="font-medium text-slate-300">{member.name}</span>
                            <div>
                              {member.hasWon ? (
                                <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 text-[10px] font-bold">
                                  Already Won (C{member.cycleWon})
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">
                                  Eligible (1 Slice)
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Past Results */}
      <div className="card overflow-hidden p-0 bg-white border border-gray-100 rounded-2xl shadow-sm">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">Past Draw Results</h3>
          <p className="text-sm text-gray-500 mt-1">Audit log of all rotating pool wins generated across all saving circles.</p>
        </div>
        {results.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="table-header">Group</th>
                  <th className="table-header">Cycle</th>
                  <th className="table-header">Winner</th>
                  <th className="table-header">Amount</th>
                  <th className="table-header">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {results.map((result) => (
                  <tr key={result.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-gray-400" />
                        <span className="font-medium text-gray-900">{result.groupName}</span>
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold">
                        Cycle {result.cycle}
                      </span>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-yellow-500" />
                        <span className="font-medium text-gray-900">{result.winnerName}</span>
                      </div>
                    </td>
                    <td className="table-cell font-semibold text-gray-900">
                      ETB {result.amount.toLocaleString()}
                    </td>
                    <td className="table-cell text-gray-500">
                      <div className="flex items-center gap-1.5 text-xs">
                        <Calendar className="h-3.5 w-3.5 text-gray-400" />
                        {result.date}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-16">
            <Ticket className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No draw results found</p>
            <p className="text-gray-400 text-sm mt-1">Select a group above and trigger the draw.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
