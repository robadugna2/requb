'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Lock, Eye, EyeOff, Shield, Globe, AlertTriangle, Sun, Moon, MonitorSmartphone, Palette, Bot } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { changePassword, getAiSettings, setGeminiKey, clearGeminiKey, testGeminiKey, GeminiSettingStatus, setGeminiWeb, clearGeminiWeb, testGeminiWeb, GeminiWebStatus } from '@/lib/api';
import { useAdminPermissions } from '@/lib/useAdminPermissions';
import { useLanguage, Language } from '@/components/layout/LanguageContext';
import { useTheme, Theme } from '@/components/layout/ThemeContext';

export default function SettingsPage() {
  return (
    <Suspense fallback={<DashboardLayout><div className="flex items-center justify-center h-64"><p className="text-gray-500 dark:text-gray-400">Loading settings...</p></div></DashboardLayout>}>
      <SettingsContent />
    </Suspense>
  );
}

function SettingsContent() {
  const { language, setLanguage, t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { role } = useAdminPermissions();
  const searchParams = useSearchParams();
  const router = useRouter();
  const mustChange = searchParams.get('mustChange') === '1';
  const isSuperAdmin = role === 'SUPER_ADMIN';

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // AI Configuration (super admin only) — status of both providers
  const [aiSettings, setAiSettings] = useState<{
    gemini: GeminiSettingStatus | null;
    geminiWeb: GeminiWebStatus | null;
  }>({ gemini: null, geminiWeb: null });
  const [aiStatusLoading, setAiStatusLoading] = useState(false);

  // Gemini (recommended, free tier) — per-provider input/UI state
  const [geminiKeyInput, setGeminiKeyInput] = useState('');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [savingGemini, setSavingGemini] = useState(false);
  const [testingGemini, setTestingGemini] = useState(false);
  const [geminiTestResult, setGeminiTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Gemini Web proxy (primary, self-hosted) — input/UI state
  const [webBaseUrl, setWebBaseUrl] = useState('');
  const [webModel, setWebModel] = useState('');
  const [webApiKey, setWebApiKey] = useState('');
  const [showWebApiKey, setShowWebApiKey] = useState(false);
  const [webEnabled, setWebEnabled] = useState(true);
  const [savingWeb, setSavingWeb] = useState(false);
  const [testingWeb, setTestingWeb] = useState(false);
  const [webTestResult, setWebTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (!isSuperAdmin) return;
    let cancelled = false;
    setAiStatusLoading(true);
    getAiSettings()
      .then((settings) => {
        if (cancelled) return;
        setAiSettings({ gemini: settings.gemini ?? null, geminiWeb: settings.geminiWeb ?? null });
        // Seed the proxy form from the saved status
        const web = settings.geminiWeb;
        if (web) {
          setWebBaseUrl(web.baseUrl ?? '');
          setWebModel(web.model ?? '');
          setWebEnabled(web.enabled);
        }
      })
      .catch(() => {
        if (!cancelled) setAiSettings({ gemini: null, geminiWeb: null });
      })
      .finally(() => {
        if (!cancelled) setAiStatusLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isSuperAdmin]);

  const refreshAiStatus = async () => {
    try {
      const settings = await getAiSettings();
      setAiSettings({ gemini: settings.gemini ?? null, geminiWeb: settings.geminiWeb ?? null });
    } catch {
      setAiSettings({ gemini: null, geminiWeb: null });
    }
  };

  /** Per-provider state + API handles so the handlers below stay shared. */
  const providerSlice = (_provider: AiProvider) => ({
      label: 'Gemini',
      status: aiSettings.gemini,
      keyValue: geminiKeyInput,
      setKeyValue: setGeminiKeyInput,
      showValue: showGeminiKey,
      setShowValue: setShowGeminiKey,
      saving: savingGemini,
      setSaving: setSavingGemini,
      testing: testingGemini,
      setTesting: setTestingGemini,
      testResult: geminiTestResult,
      setTestResult: setGeminiTestResult,
      save: setGeminiKey,
      clear: clearGeminiKey,
      test: testGeminiKey,
      removeConfirm:
        'Remove the saved Gemini API key? Camera FT scanning and receipt OCR will stop working until a key is added again.',
  });

  const handleSaveKey = async (provider: AiProvider, e: React.FormEvent) => {
    e.preventDefault();
    const p = providerSlice(provider);
    if (!p.keyValue.trim()) return;

    p.setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await p.save(p.keyValue.trim());
      p.setKeyValue('');
      p.setShowValue(false);
      await refreshAiStatus();
      setSuccess(`${p.label} API key saved and active.`);
      setTimeout(() => setSuccess(null), 5000);

      // Validate the just-saved key, but never present a test hiccup as a
      // save failure — the save succeeded and the status row above already
      // reflects it. The inline test banner carries the test result.
      p.setTesting(true);
      try {
        const result = await p.test();
        p.setTestResult(result);
      } catch (err: unknown) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        p.setTestResult({ ok: false, message: axiosErr?.response?.data?.message || 'Test failed' });
      } finally {
        p.setTesting(false);
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      const msg =
        axiosErr.response?.data?.message || 'Failed to save the API key. Please try again.';
      setError(msg);
      // Surface inline too — the top banner can be off-screen on mobile,
      // which made a failed save look like "nothing happened".
      p.setTestResult({ ok: false, message: `Save failed: ${msg}` });
    } finally {
      p.setSaving(false);
    }
  };

  const handleTestKey = async (provider: AiProvider) => {
    const p = providerSlice(provider);
    p.setTesting(true);
    p.setTestResult(null);

    try {
      // Prefer the key currently typed in the input (not yet saved) so the
      // admin can validate before committing; fall back to the saved one.
      const typed = p.keyValue.trim();
      const result = await p.test(typed || undefined);
      p.setTestResult(result);

      // A typed key that verified gets saved right away — one action does
      // everything and the status row reflects it immediately.
      if (typed && result.ok) {
        try {
          await p.save(typed);
          p.setKeyValue('');
          p.setShowValue(false);
          await refreshAiStatus();
          setSuccess(`${p.label} API key saved.`);
          setTimeout(() => setSuccess(null), 4000);
        } catch (err: unknown) {
          const axiosErr = err as { response?: { data?: { message?: string } } };
          const msg = axiosErr.response?.data?.message || 'Key verified but saving failed.';
          setError(msg);
          // Show it inline too — the top banner can be off-screen on mobile.
          p.setTestResult({ ok: false, message: `Save failed: ${msg}` });
        }
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      p.setTestResult({
        ok: false,
        message: axiosErr.response?.data?.message || 'Test request failed. Please try again.',
      });
    } finally {
      p.setTesting(false);
    }
  };

  const handleRemoveKey = async (provider: AiProvider) => {
    const p = providerSlice(provider);
    if (!window.confirm(p.removeConfirm)) {
      return;
    }

    p.setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await p.clear();
      p.setTestResult(null);
      await refreshAiStatus();
      setSuccess(`${p.label} API key removed.`);
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(
        axiosErr.response?.data?.message || 'Failed to remove the API key. Please try again.'
      );
    } finally {
      p.setSaving(false);
    }
  };

  // ─── Gemini Web proxy handlers ──────────────────────────────────────────────

  const handleSaveGeminiWeb = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webBaseUrl.trim()) return;

    setSavingWeb(true);
    setError(null);
    setSuccess(null);
    setWebTestResult(null);

    try {
      await setGeminiWeb({
        baseUrl: webBaseUrl.trim(),
        apiKey: webApiKey.trim() || undefined,
        model: webModel.trim() || undefined,
        enabled: webEnabled,
      });
      setWebApiKey('');
      setShowWebApiKey(false);
      await refreshAiStatus();
      setSuccess('Gemini Web proxy saved.');
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      const msg = axiosErr.response?.data?.message || 'Failed to save the Gemini Web proxy settings.';
      setError(msg);
      setWebTestResult({ ok: false, message: `Save failed: ${msg}` });
    } finally {
      setSavingWeb(false);
    }
  };

  const handleTestGeminiWeb = async () => {
    setTestingWeb(true);
    setWebTestResult(null);
    try {
      const result = await testGeminiWeb();
      setWebTestResult(result);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setWebTestResult({
        ok: false,
        message: axiosErr.response?.data?.message || 'Test request failed. Please try again.',
      });
    } finally {
      setTestingWeb(false);
    }
  };

  const handleRemoveGeminiWeb = async () => {
    if (
      !window.confirm(
        'Remove the saved Gemini Web proxy configuration? Camera FT scanning will fall back to the official Gemini key until the proxy is set up again.',
      )
    ) {
      return;
    }

    setSavingWeb(true);
    setError(null);
    setSuccess(null);

    try {
      await clearGeminiWeb();
      setWebBaseUrl('');
      setWebModel('');
      setWebApiKey('');
      setWebTestResult(null);
      await refreshAiStatus();
      setSuccess('Gemini Web proxy removed.');
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(
        axiosErr.response?.data?.message || 'Failed to remove the Gemini Web proxy configuration.'
      );
    } finally {
      setSavingWeb(false);
    }
  };

  const isValid =
    currentPassword.length > 0 &&
    newPassword.length >= 6 &&
    newPassword === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await changePassword(currentPassword, newPassword);
      setSuccess('Password changed successfully!');
      
      if (mustChange) {
        setTimeout(() => {
          router.push('/dashboard');
        }, 1500);
      } else {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setSuccess(null), 4000);
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(
        axiosErr.response?.data?.message || 'Failed to change password. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white/90">{t('settings.title')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('settings.subtitle')}
        </p>
      </div>

      {mustChange && (
        <div className="mb-6 p-4 rounded-xl bg-orange-50 dark:bg-orange-500/10 border border-orange-200 flex gap-3 items-start shadow-sm max-w-xl">
          <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-orange-900">Action Required: Temporary Password Detected</h3>
            <p className="text-sm text-orange-700 dark:text-orange-400 mt-1 leading-relaxed">
              You are currently logged in using a temporary password set by your administrator.
              For security reasons, you must change your password before continuing.
            </p>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 rounded-lg bg-green-50 dark:bg-success-500/10 text-green-700 dark:text-success-400 text-sm font-medium border border-green-100 flex items-center justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="text-green-500 hover:text-green-700 font-bold text-lg">×</button>
        </div>
      )}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-error-500/10 text-red-700 dark:text-error-400 text-sm font-medium border border-red-100 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 dark:text-error-400 hover:text-red-700 dark:hover:text-red-400 font-bold text-lg">×</button>
        </div>
      )}

      <div className="space-y-6 max-w-xl">
        {/* Appearance Card */}
        <div className="card">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-primary-50 dark:bg-brand-500/10 rounded-lg">
              <Palette className="h-5 w-5 text-primary-600 dark:text-brand-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">Appearance</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Choose how the dashboard looks</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {([
              { value: 'light', label: 'Light', icon: Sun, desc: 'Bright and clean' },
              { value: 'dark', label: 'Dark', icon: Moon, desc: 'Easy on the eyes' },
              { value: 'system', label: 'System', icon: MonitorSmartphone, desc: 'Follows your OS' },
            ] as const).map(({ value, label, icon: Icon, desc }) => {
              const active = theme === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTheme(value as Theme)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border text-center transition-all duration-200 ${
                    active
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/[0.12] ring-2 ring-brand-500/20'
                      : 'border-gray-200 dark:border-gray-800 hover:border-brand-300 hover:bg-gray-50 dark:hover:bg-white/[0.04]'
                  }`}
                >
                  <Icon className={`h-5 w-5 ${active ? 'text-brand-500' : 'text-gray-500 dark:text-gray-400'}`} />
                  <span className={`text-sm font-medium ${active ? 'text-brand-600 dark:text-brand-400' : 'text-gray-700 dark:text-gray-300'}`}>{label}</span>
                  <span className="text-[11px] text-gray-400 dark:text-gray-500 leading-tight">{desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* AI Configuration Card (super admin only) */}
        {isSuperAdmin && (
          <div className="card">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-primary-50 dark:bg-brand-500/10 rounded-lg">
                <Bot className="h-5 w-5 text-primary-600 dark:text-brand-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">AI Configuration</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  A self-hosted Gemini Web proxy (primary) or Google Gemini (free tier) powers camera FT scanning and receipt OCR.
                </p>
              </div>
            </div>

            {/* Gemini Web proxy — primary self-hosted provider */}
            <GeminiWebSection
              status={aiSettings.geminiWeb}
              statusLoading={aiStatusLoading}
              baseUrl={webBaseUrl}
              onBaseUrlChange={setWebBaseUrl}
              model={webModel}
              onModelChange={setWebModel}
              apiKey={webApiKey}
              onApiKeyChange={setWebApiKey}
              showApiKey={showWebApiKey}
              onToggleShowApiKey={() => setShowWebApiKey(!showWebApiKey)}
              enabled={webEnabled}
              onEnabledChange={setWebEnabled}
              saving={savingWeb}
              testing={testingWeb}
              testResult={webTestResult}
              onSave={handleSaveGeminiWeb}
              onTest={handleTestGeminiWeb}
              onRemove={handleRemoveGeminiWeb}
            />

            <hr className="my-6 border-gray-200 dark:border-gray-800" />

            {/* Gemini — recommended free-tier provider */}
            <AiProviderSection
              title="Google Gemini"
              description="Reads FT numbers and receipt details. Free daily quota is plenty for scanning."
              badge="Recommended — free tier"
              placeholder="AIza..."
              status={aiSettings.gemini}
              statusLoading={aiStatusLoading}
              keyValue={geminiKeyInput}
              onKeyValueChange={setGeminiKeyInput}
              showValue={showGeminiKey}
              onToggleShow={() => setShowGeminiKey(!showGeminiKey)}
              saving={savingGemini}
              testing={testingGemini}
              testResult={geminiTestResult}
              onSave={(e) => handleSaveKey('gemini', e)}
              onTest={() => handleTestKey('gemini')}
              onRemove={() => handleRemoveKey('gemini')}
            />

            {/* Privacy note */}
            <p className="mt-4 text-xs text-gray-400">
              Stored encrypted in the database. Never displayed in full; only the last 4 characters are shown.
            </p>
          </div>
        )}

        {/* Language Selection Card */}
        <div className="card">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-primary-50 dark:bg-brand-500/10 rounded-lg">
              <Globe className="h-5 w-5 text-primary-600 dark:text-brand-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">{t('settings.lang_select')}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('settings.lang_desc')}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Select Language / ቋንቋ ይምረጡ / Afaan Filadhaa / ቋንቋ ይምረጹ
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="input-field w-full cursor-pointer bg-white dark:bg-gray-900 text-gray-900 dark:text-white/90"
            >
              <option value="en">English 🇺🇸</option>
              <option value="am">አማርኛ (Amharic) 🇪🇹</option>
              <option value="om">Afaan Oromoo (Oromo) 🇪🇹</option>
              <option value="ti">ትግርኛ (Tigrinya) 🇪🇹</option>
            </select>
          </div>
        </div>

        {/* Change Password Card */}
        <div className="card">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-primary-50 dark:bg-brand-500/10 rounded-lg">
              <Lock className="h-5 w-5 text-primary-600 dark:text-brand-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white/90">{t('settings.change_pwd')}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('settings.update_pwd_desc')}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Current Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t('settings.curr_pwd')}
              </label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="input-field pr-10"
                  placeholder="Enter current password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600"
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t('settings.new_pwd')}
              </label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="input-field pr-10"
                  placeholder="Enter new password (min 6 characters)"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600"
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {newPassword.length > 0 && newPassword.length < 6 && (
                <p className="mt-1 text-xs text-red-500 dark:text-error-400">{t('settings.err_length')}</p>
              )}
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t('settings.confirm_pwd')}
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input-field pr-10"
                  placeholder="Confirm new password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                <p className="mt-1 text-xs text-red-500 dark:text-error-400">{t('settings.err_match')}</p>
              )}
            </div>

            {/* Security Note */}
            <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-light-500/10 rounded-lg">
              <Shield className="h-4 w-4 text-blue-600 dark:text-blue-light-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-blue-700">
                {t('settings.sec_note')}
              </p>
            </div>

            {/* Submit */}
            <div className="flex justify-end pt-2">
              <Button type="submit" loading={loading} disabled={!isValid}>
                <Lock className="h-4 w-4 mr-2" />
                {t('settings.btn_change')}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}

type AiProvider = 'gemini';

interface AiProviderSectionProps {
  title: string;
  description: string;
  badge?: string;
  placeholder: string;
  status: GeminiSettingStatus | null;
  statusLoading: boolean;
  keyValue: string;
  onKeyValueChange: (value: string) => void;
  showValue: boolean;
  onToggleShow: () => void;
  saving: boolean;
  testing: boolean;
  testResult: { ok: boolean; message: string } | null;
  onSave: (e: React.FormEvent) => void;
  onTest: () => void;
  onRemove: () => void;
}

/** The Gemini provider inside the AI Configuration card. */
function AiProviderSection({
  title,
  description,
  badge,
  placeholder,
  status,
  statusLoading,
  keyValue,
  onKeyValueChange,
  showValue,
  onToggleShow,
  saving,
  testing,
  testResult,
  onSave,
  onTest,
  onRemove,
}: AiProviderSectionProps) {
  return (
    <div>
      {/* Header row */}
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">{title}</h3>
        {badge && (
          <span className="bg-green-50 dark:bg-success-500/10 text-green-700 dark:text-success-400 text-xs px-2 py-0.5 rounded-full">
            {badge}
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 mb-3">{description}</p>

      {/* Status */}
      {statusLoading ? (
        <div className="flex items-center gap-2 mb-4">
          <div className="h-3.5 w-3.5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-gray-500 dark:text-gray-400">Checking configuration...</span>
        </div>
      ) : status?.configured ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-4">
          <span className="h-2 w-2 rounded-full bg-green-500 flex-shrink-0" />
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
            Configured via {status.source === 'database' ? 'Settings (database)' : 'environment variable'}
          </span>
          {status.keyHint && (
            <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{status.keyHint}</span>
          )}
          {status.source === 'database' && status.updatedAt && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              Updated {new Date(status.updatedAt).toLocaleDateString()}
            </span>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 mb-4">
          <span className="h-2 w-2 rounded-full bg-amber-500 flex-shrink-0" />
          <span className="text-xs font-medium text-amber-700 dark:text-warning-400">Not configured</span>
        </div>
      )}

      {/* Update API key form */}
      <form onSubmit={onSave} className="space-y-3">
        <div className="relative">
          <input
            type={showValue ? 'text' : 'password'}
            value={keyValue}
            onChange={(e) => onKeyValueChange(e.target.value)}
            className="input-field font-mono pr-10"
            placeholder={placeholder}
            autoComplete="off"
            aria-label={`${title} API key`}
          />
          <button
            type="button"
            onClick={onToggleShow}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600"
          >
            {showValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" loading={saving} disabled={!keyValue.trim()}>
            <Lock className="h-4 w-4 mr-2" />
            Save Key
          </Button>
          <Button type="button" variant="secondary" onClick={onTest} loading={testing} disabled={testing}>
            {keyValue.trim() ? 'Test & Save' : 'Test Key'}
          </Button>
          {status?.source === 'database' && (
            <Button type="button" variant="danger" onClick={onRemove} disabled={saving}>
              Remove Saved Key
            </Button>
          )}
        </div>
      </form>

      {/* Test result (inline, inside section) */}
      {testResult && (
        <div
          className={`mt-3 p-3 rounded-lg text-xs font-medium border ${
            testResult.ok
              ? 'bg-green-50 dark:bg-success-500/10 text-green-700 dark:text-success-400 border-green-100'
              : 'bg-red-50 dark:bg-error-500/10 text-red-700 dark:text-error-400 border-red-100'
          }`}
        >
          {testResult.message}
        </div>
      )}
    </div>
  );
}

interface GeminiWebSectionProps {
  status: GeminiWebStatus | null;
  statusLoading: boolean;
  baseUrl: string;
  onBaseUrlChange: (value: string) => void;
  model: string;
  onModelChange: (value: string) => void;
  apiKey: string;
  onApiKeyChange: (value: string) => void;
  showApiKey: boolean;
  onToggleShowApiKey: () => void;
  enabled: boolean;
  onEnabledChange: (value: boolean) => void;
  saving: boolean;
  testing: boolean;
  testResult: { ok: boolean; message: string } | null;
  onSave: (e: React.FormEvent) => void;
  onTest: () => void;
  onRemove: () => void;
}

/** The self-hosted Gemini Web proxy provider section (primary, no billing). */
function GeminiWebSection({
  status,
  statusLoading,
  baseUrl,
  onBaseUrlChange,
  model,
  onModelChange,
  apiKey,
  onApiKeyChange,
  showApiKey,
  onToggleShowApiKey,
  enabled,
  onEnabledChange,
  saving,
  testing,
  testResult,
  onSave,
  onTest,
  onRemove,
}: GeminiWebSectionProps) {
  return (
    <div>
      {/* Header row */}
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">Gemini Web (proxy)</h3>
        <span className="bg-green-50 dark:bg-success-500/10 text-green-700 dark:text-success-400 text-xs px-2 py-0.5 rounded-full">
          Primary — no billing
        </span>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 mb-3">
        Point the app at your own self-hosted OpenAI-compatible Gemini proxy (e.g. gemini-web2api).
        No API key or billing; highest quota.
      </p>

      {/* Status */}
      {statusLoading ? (
        <div className="flex items-center gap-2 mb-4">
          <div className="h-3.5 w-3.5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-gray-500 dark:text-gray-400">Checking configuration...</span>
        </div>
      ) : status?.configured ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-4">
          <span className="h-2 w-2 rounded-full bg-green-500 flex-shrink-0" />
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
            Configured — {status.baseUrl} · {status.model}
          </span>
          {!status.enabled && (
            <span className="text-xs font-medium text-amber-700 dark:text-warning-400">disabled</span>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 mb-4">
          <span className="h-2 w-2 rounded-full bg-amber-500 flex-shrink-0" />
          <span className="text-xs font-medium text-amber-700 dark:text-warning-400">Not configured</span>
        </div>
      )}

      {/* Proxy configuration form */}
      <form onSubmit={onSave} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Base URL
          </label>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => onBaseUrlChange(e.target.value)}
            className="input-field font-mono"
            placeholder="http://localhost:8081/v1 or https://your-proxy/v1"
            autoComplete="off"
            aria-label="Gemini Web proxy base URL"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Model
          </label>
          <input
            type="text"
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            className="input-field font-mono"
            placeholder="gemini-3.6-flash"
            autoComplete="off"
            aria-label="Gemini Web proxy model"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            API key (optional)
          </label>
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
              className="input-field font-mono pr-10"
              placeholder={status?.hasKey ? 'optional — leave blank to keep current' : 'not set'}
              autoComplete="off"
              aria-label="Gemini Web proxy API key"
            />
            <button
              type="button"
              onClick={onToggleShowApiKey}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600"
            >
              {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer select-none w-fit">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onEnabledChange(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-brand-500 focus:ring-brand-500"
            aria-label="Enable Gemini Web proxy"
          />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Enabled</span>
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" loading={saving} disabled={!baseUrl.trim()}>
            <Lock className="h-4 w-4 mr-2" />
            Save
          </Button>
          <Button type="button" variant="secondary" onClick={onTest} loading={testing} disabled={testing}>
            Test
          </Button>
          {status?.configured && (
            <Button type="button" variant="danger" onClick={onRemove} disabled={saving}>
              Remove
            </Button>
          )}
        </div>
      </form>

      {/* Test result (inline, inside section) */}
      {testResult && (
        <div
          className={`mt-3 p-3 rounded-lg text-xs font-medium border ${
            testResult.ok
              ? 'bg-green-50 dark:bg-success-500/10 text-green-700 dark:text-success-400 border-green-100'
              : 'bg-red-50 dark:bg-error-500/10 text-red-700 dark:text-error-400 border-red-100'
          }`}
        >
          {testResult.message}
        </div>
      )}
    </div>
  );
}
