'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, X, Mail, CheckCircle, AlertCircle } from 'lucide-react';
import { login, forgotPasswordRequest } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/components/layout/LanguageContext';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────
interface Coin {
  id: number;
  x: number;
  y: number;
  size: number;
  speed: number;
  angle: number;
  opacity: number;
  rotation: number;
  rotationSpeed: number;
  targetX: number;
  targetY: number;
}

interface Bubble {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  vx: number;
  vy: number;
  life: number;
}

// ──────────────────────────────────────────────
// Ethiopian Birr Coin SVG
// ──────────────────────────────────────────────
function BirrCoin({ size, rotation }: { size: number; rotation: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      style={{ transform: `rotate(${rotation}deg)` }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Coin body */}
      <circle cx="40" cy="40" r="38" fill="url(#goldGrad)" stroke="#b8860b" strokeWidth="2" />
      <circle cx="40" cy="40" r="33" fill="none" stroke="#ffd700" strokeWidth="1" opacity="0.6" />
      {/* Birr symbol ብር */}
      <text
        x="40"
        y="32"
        textAnchor="middle"
        fontSize="13"
        fontWeight="bold"
        fill="#7a4f00"
        fontFamily="serif"
      >ብር</text>
      {/* ETH star pattern */}
      <polygon
        points="40,46 42,52 48,52 43,56 45,62 40,58 35,62 37,56 32,52 38,52"
        fill="#b8860b"
        opacity="0.8"
      />
      {/* Shine */}
      <ellipse cx="30" cy="25" rx="8" ry="4" fill="white" opacity="0.25" transform="rotate(-30 30 25)" />
      <defs>
        <radialGradient id="goldGrad" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#ffe066" />
          <stop offset="50%" stopColor="#ffc200" />
          <stop offset="100%" stopColor="#b8860b" />
        </radialGradient>
      </defs>
    </svg>
  );
}

// ──────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────
export default function LoginPage() {
  const { t } = useLanguage();
  const router = useRouter();

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotLoading(true);
    try {
      await forgotPasswordRequest(forgotEmail);
      setForgotSuccess(true);
    } catch {
      setForgotError('Something went wrong. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  const openForgotModal = () => {
    setForgotEmail('');
    setForgotError('');
    setForgotSuccess(false);
    setShowForgotModal(true);
  };

  const closeForgotModal = () => {
    setShowForgotModal(false);
  };

  // Animation state
  const [coins, setCoins] = useState<Coin[]>([]);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [mousePos, setMousePos] = useState({ x: -999, y: -999 });
  const formRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);
  const coinsRef = useRef<Coin[]>([]);
  const bubblesRef = useRef<Bubble[]>([]);
  const nextIdRef = useRef(0);
  const mousePosRef = useRef({ x: -999, y: -999 });

  // ── Form submit ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(email, password);
      localStorage.setItem('equb_token', data.accessToken);
      if (data.admin?.mustChangePassword) {
        router.push('/settings?mustChange=1');
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Spawn initial coins ──
  useEffect(() => {
    const initial: Coin[] = Array.from({ length: 22 }, (_, i) => spawnCoin(i));
    coinsRef.current = initial;
    setCoins([...initial]);
    nextIdRef.current = 22;
  }, []);

  function spawnCoin(id: number): Coin {
    const edge = Math.floor(Math.random() * 4);
    let x = 0, y = 0;
    const w = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const h = typeof window !== 'undefined' ? window.innerHeight : 800;
    if (edge === 0) { x = Math.random() * w; y = -60; }
    else if (edge === 1) { x = w + 60; y = Math.random() * h; }
    else if (edge === 2) { x = Math.random() * w; y = h + 60; }
    else { x = -60; y = Math.random() * h; }
    // target near center-right (login form area)
    const targetX = w * 0.72 + (Math.random() - 0.5) * 180;
    const targetY = h * 0.50 + (Math.random() - 0.5) * 160;
    const dx = targetX - x, dy = targetY - y;
    const angle = Math.atan2(dy, dx);
    return {
      id,
      x, y,
      size: 32 + Math.random() * 36,
      speed: 0.6 + Math.random() * 1.2,
      angle,
      opacity: 0.55 + Math.random() * 0.45,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 3,
      targetX,
      targetY,
    };
  }

  // ── Mouse move handler ──
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    mousePosRef.current = { x: e.clientX, y: e.clientY };
    setMousePos({ x: e.clientX, y: e.clientY });

    // Spawn bubble on move
    if (Math.random() < 0.35) {
      const b: Bubble = {
        id: nextIdRef.current++,
        x: e.clientX + (Math.random() - 0.5) * 30,
        y: e.clientY + (Math.random() - 0.5) * 30,
        size: 12 + Math.random() * 38,
        opacity: 0.55,
        vx: (Math.random() - 0.5) * 2,
        vy: -1.5 - Math.random() * 2,
        life: 1,
      };
      bubblesRef.current = [...bubblesRef.current.slice(-30), b];
      setBubbles([...bubblesRef.current]);
    }
  }, []);

  // ── Animation loop ──
  useEffect(() => {
    let running = true;

    function tick() {
      if (!running) return;

      const w = typeof window !== 'undefined' ? window.innerWidth : 1200;
      const h = typeof window !== 'undefined' ? window.innerHeight : 800;
      const formCenterX = w * 0.72;
      const formCenterY = h * 0.50;

      // Update coins
      const updatedCoins = coinsRef.current.map(c => {
        const dx = c.targetX - c.x;
        const dy = c.targetY - c.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Mouse repulsion
        const mx = mousePosRef.current.x, my = mousePosRef.current.y;
        const mdx = c.x - mx, mdy = c.y - my;
        const mDist = Math.sqrt(mdx * mdx + mdy * mdy);
        let rx = 0, ry = 0;
        if (mDist < 120 && mDist > 0) {
          const force = (120 - mDist) / 120 * 3;
          rx = (mdx / mDist) * force;
          ry = (mdy / mDist) * force;
        }

        if (dist < 5) {
          // respawn
          return spawnCoin(c.id);
        }

        const nx = c.x + Math.cos(c.angle) * c.speed + rx;
        const ny = c.y + Math.sin(c.angle) * c.speed + ry;
        const newAngle = Math.atan2(c.targetY - ny, c.targetX - nx);

        return {
          ...c,
          x: nx,
          y: ny,
          angle: newAngle,
          rotation: c.rotation + c.rotationSpeed,
        };
      });

      coinsRef.current = updatedCoins;
      setCoins([...updatedCoins]);

      // Update bubbles
      const updatedBubbles = bubblesRef.current
        .map(b => ({
          ...b,
          x: b.x + b.vx,
          y: b.y + b.vy,
          opacity: b.opacity - 0.018,
          size: b.size + 0.5,
          life: b.life - 0.018,
        }))
        .filter(b => b.life > 0);

      bubblesRef.current = updatedBubbles;
      setBubbles([...updatedBubbles]);

      animFrameRef.current = requestAnimationFrame(tick);
    }

    animFrameRef.current = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative min-h-screen flex overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0a0f2c 0%, #1a2456 40%, #0d1a3a 100%)' }}
      onMouseMove={handleMouseMove}
    >
      {/* ── Animated coin layer ── */}
      <div className="absolute inset-0 pointer-events-none z-0" aria-hidden="true">
        {coins.map(c => (
          <div
            key={c.id}
            style={{
              position: 'absolute',
              left: c.x - c.size / 2,
              top: c.y - c.size / 2,
              opacity: c.opacity,
              filter: 'drop-shadow(0 0 6px rgba(255,200,0,0.6))',
              willChange: 'transform',
            }}
          >
            <BirrCoin size={c.size} rotation={c.rotation} />
          </div>
        ))}
      </div>

      {/* ── Balloon / bubble hover layer ── */}
      <div className="absolute inset-0 pointer-events-none z-10" aria-hidden="true">
        {bubbles.map(b => (
          <div
            key={b.id}
            style={{
              position: 'absolute',
              left: b.x - b.size / 2,
              top: b.y - b.size / 2,
              width: b.size,
              height: b.size,
              borderRadius: '50%',
              background: `radial-gradient(circle at 35% 35%, rgba(255,215,0,0.55), rgba(255,165,0,0.12))`,
              border: '1.5px solid rgba(255,215,0,0.45)',
              opacity: b.opacity,
              boxShadow: '0 0 12px rgba(255,200,0,0.3)',
              willChange: 'transform, opacity',
            }}
          />
        ))}
      </div>

      {/* ── Radial glow near login card ── */}
      <div
        className="absolute pointer-events-none z-0"
        style={{
          right: '5%',
          top: '50%',
          transform: 'translateY(-50%)',
          width: 520,
          height: 520,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />

      {/* ── Left branding panel ── */}
      <div className="hidden lg:flex lg:w-1/2 relative z-20 flex-col justify-center px-16">
        <div className="flex items-center gap-4 mb-10">
          <div
            style={{
              width: 60, height: 60, borderRadius: 18,
              background: 'linear-gradient(135deg,#ffd700,#ff8c00)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(255,180,0,0.4)',
            }}
          >
            <span style={{ fontSize: 28, fontWeight: 900, color: '#1a1a00' }}>ብ</span>
          </div>
          <div>
            <h1 style={{ fontSize: 34, fontWeight: 900, color: '#fff', letterSpacing: '-1px' }}>Equb</h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{t('login.subtitle')}</p>
          </div>
        </div>

        <h2 style={{ fontSize: 42, fontWeight: 800, color: '#fff', lineHeight: 1.15, marginBottom: 20 }}>
          Manage Your<br />
          <span style={{ background: 'linear-gradient(90deg,#ffd700,#ff8c00)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {t('login.savings')}
          </span>
        </h2>
        <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.72)', maxWidth: 420, lineHeight: 1.7 }}>
          A modern platform for managing traditional Ethiopian Equb savings circles.
          Track deposits, verify receipts, and manage lottery draws — all in one place.
        </p>

        {/* Feature pills */}
        <div style={{ display: 'flex', gap: 12, marginTop: 36, flexWrap: 'wrap' }}>
          {['💰 Deposits', '🎰 Lottery', '📋 Receipts', '🔔 Alerts'].map(f => (
            <span key={f} style={{
              padding: '6px 16px', borderRadius: 999, fontSize: 13, fontWeight: 600,
              background: 'rgba(255,215,0,0.12)', color: '#ffd700',
              border: '1px solid rgba(255,215,0,0.25)',
            }}>{f}</span>
          ))}
        </div>
      </div>

      {/* ── Right login form ── */}
      <div className="flex-1 flex items-center justify-center p-6 relative z-20" ref={formRef}>
        <div style={{ width: '100%', maxWidth: 440 }}>

          {/* Mobile brand */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: 'linear-gradient(135deg,#ffd700,#ff8c00)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 22, fontWeight: 900, color: '#1a1a00' }}>ብ</span>
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 900, color: '#fff' }}>Equb</h1>
          </div>

          {/* Glass card */}
          <div style={{
            background: 'rgba(255,255,255,0.07)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1.5px solid rgba(255,215,0,0.18)',
            borderRadius: 24,
            padding: '40px 36px',
            boxShadow: '0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
          }}>
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 26, fontWeight: 800, color: '#fff' }}>{t('login.welcome')}</h2>
              <p style={{ marginTop: 6, fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>
                Sign in to your Equb account
              </p>
            </div>

            {error && (
              <div style={{
                marginBottom: 20, padding: '12px 16px',
                background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 10,
              }}>
                <p style={{ fontSize: 13, color: '#fca5a5' }}>{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Email */}
              <div>
                <label htmlFor="email" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.75)', marginBottom: 8 }}>
                  {t('login.email')}
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@equb.et"
                  required
                  style={{
                    display: 'block', width: '100%', boxSizing: 'border-box',
                    padding: '11px 14px', borderRadius: 10, fontSize: 14,
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: '#fff', outline: 'none',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                  }}
                  onFocus={e => {
                    e.target.style.borderColor = 'rgba(255,215,0,0.6)';
                    e.target.style.boxShadow = '0 0 0 3px rgba(255,215,0,0.15)';
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = 'rgba(255,255,255,0.15)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.75)', marginBottom: 8 }}>
                  {t('login.password')}
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    style={{
                      display: 'block', width: '100%', boxSizing: 'border-box',
                      padding: '11px 40px 11px 14px', borderRadius: 10, fontSize: 14,
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: '#fff', outline: 'none',
                      transition: 'border-color 0.2s, box-shadow 0.2s',
                    }}
                    onFocus={e => {
                      e.target.style.borderColor = 'rgba(255,215,0,0.6)';
                      e.target.style.boxShadow = '0 0 0 3px rgba(255,215,0,0.15)';
                    }}
                    onBlur={e => {
                      e.target.style.borderColor = 'rgba(255,255,255,0.15)';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'rgba(255,255,255,0.45)', padding: 0,
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Remember / Forgot */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    style={{ accentColor: '#ffd700', width: 15, height: 15 }}
                  />
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{t('login.remember')}</span>
                </label>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openForgotModal();
                    }}
                    style={{ fontSize: 13, fontWeight: 600, color: '#ffd700', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 8px', position: 'relative', zIndex: 50 }}
                  >
                    Forgot password?
                  </button>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%', padding: '13px', borderRadius: 12, fontSize: 15, fontWeight: 700,
                  background: loading ? 'rgba(255,180,0,0.4)' : 'linear-gradient(135deg,#ffd700,#ff8c00)',
                  color: loading ? 'rgba(255,255,255,0.6)' : '#1a0a00',
                  border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: loading ? 'none' : '0 8px 24px rgba(255,140,0,0.45)',
                  transition: 'all 0.25s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
                onMouseEnter={e => {
                  if (!loading) {
                    (e.target as HTMLButtonElement).style.transform = 'translateY(-2px)';
                    (e.target as HTMLButtonElement).style.boxShadow = '0 12px 32px rgba(255,140,0,0.6)';
                  }
                }}
                onMouseLeave={e => {
                  (e.target as HTMLButtonElement).style.transform = 'translateY(0)';
                  (e.target as HTMLButtonElement).style.boxShadow = loading ? 'none' : '0 8px 24px rgba(255,140,0,0.45)';
                }}
              >
                {loading ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 0.8s linear infinite' }}>
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                    Signing in...
                  </>
                ) : t('login.signin')}
              </button>
            </form>
          </div>

          <p style={{ marginTop: 20, textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
            © 2024 Equb Platform. All rights reserved.
          </p>
        </div>
      </div>

      {/* ── Forgot Password Modal ── */}
      {showForgotModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
            animation: 'fadeIn 0.2s ease',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) closeForgotModal(); }}
        >
          <div style={{
            width: '100%', maxWidth: 420,
            background: 'rgba(20,28,70,0.98)',
            backdropFilter: 'blur(32px)',
            WebkitBackdropFilter: 'blur(32px)',
            border: '1.5px solid rgba(255,215,0,0.3)',
            borderRadius: 20,
            padding: '36px 32px',
            boxShadow: '0 32px 80px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.1)',
            animation: 'slideUp 0.25s ease',
            position: 'relative',
          }}>
            {/* Close button */}
            <button
              onClick={closeForgotModal}
              style={{
                position: 'absolute', top: 16, right: 16,
                background: 'rgba(255,255,255,0.08)', border: 'none',
                borderRadius: 8, width: 32, height: 32,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'rgba(255,255,255,0.6)',
                transition: 'background 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.16)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
            >
              <X size={16} />
            </button>

            {forgotSuccess ? (
              /* ── Success state ── */
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <div style={{
                  width: 64, height: 64, borderRadius: '50%',
                  background: 'rgba(34,197,94,0.15)', border: '2px solid rgba(34,197,94,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 20px',
                }}>
                  <CheckCircle size={32} color="#4ade80" />
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 12 }}>
                  Request Sent!
                </h3>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, marginBottom: 24 }}>
                  Your password reset request has been sent to your administrator.
                  They will set a temporary password and inform you directly.
                </p>
                <button
                  onClick={closeForgotModal}
                  style={{
                    padding: '10px 28px', borderRadius: 10, fontSize: 14, fontWeight: 700,
                    background: 'linear-gradient(135deg,#ffd700,#ff8c00)',
                    color: '#1a0a00', border: 'none', cursor: 'pointer',
                  }}
                >
                  Back to Login
                </button>
              </div>
            ) : (
              /* ── Form state ── */
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 12,
                    background: 'rgba(255,215,0,0.12)', border: '1px solid rgba(255,215,0,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Mail size={20} color="#ffd700" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 2 }}>
                      Forgot Password?
                    </h3>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                      Enter your email — we&apos;ll route the request to your admin
                    </p>
                  </div>
                </div>

                {forgotError && (
                  <div style={{
                    marginBottom: 16, padding: '10px 14px',
                    background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <AlertCircle size={14} color="#fca5a5" />
                    <p style={{ fontSize: 13, color: '#fca5a5', margin: 0 }}>{forgotError}</p>
                  </div>
                )}

                <form onSubmit={handleForgotSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.75)', marginBottom: 8 }}>
                      Email address
                    </label>
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={e => setForgotEmail(e.target.value)}
                      placeholder="your@email.com"
                      required
                      autoFocus
                      style={{
                        display: 'block', width: '100%', boxSizing: 'border-box',
                        padding: '11px 14px', borderRadius: 10, fontSize: 14,
                        background: 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        color: '#fff', outline: 'none',
                        transition: 'border-color 0.2s, box-shadow 0.2s',
                      }}
                      onFocus={e => {
                        e.target.style.borderColor = 'rgba(255,215,0,0.6)';
                        e.target.style.boxShadow = '0 0 0 3px rgba(255,215,0,0.15)';
                      }}
                      onBlur={e => {
                        e.target.style.borderColor = 'rgba(255,255,255,0.15)';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={forgotLoading}
                    style={{
                      width: '100%', padding: '12px', borderRadius: 10, fontSize: 14, fontWeight: 700,
                      background: forgotLoading ? 'rgba(255,180,0,0.4)' : 'linear-gradient(135deg,#ffd700,#ff8c00)',
                      color: forgotLoading ? 'rgba(255,255,255,0.6)' : '#1a0a00',
                      border: 'none', cursor: forgotLoading ? 'not-allowed' : 'pointer',
                      boxShadow: forgotLoading ? 'none' : '0 6px 20px rgba(255,140,0,0.4)',
                      transition: 'all 0.25s',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}
                  >
                    {forgotLoading ? (
                      <>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 0.8s linear infinite' }}>
                          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                        </svg>
                        Sending...
                      </>
                    ) : 'Send Reset Request'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        input::placeholder { color: rgba(255,255,255,0.3); }
      `}</style>
    </div>
  );
}
