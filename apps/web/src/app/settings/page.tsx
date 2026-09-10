'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Lock, Eye, EyeOff, Shield, Globe, AlertTriangle, Sun, Moon, MonitorSmartphone, Palette, Bot } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { changePassword, getOpenAiSetting, setOpenAiKey, clearOpenAiKey, testOpenAiKey, OpenAiSettingStatus } from '@/lib/api';
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

  // AI Configuration (super admin only)
  const [aiStatus, setAiStatus] = useState<OpenAiSettingStatus | null>(null);
  const [aiStatusLoading, setAiStatusLoading] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [testingKey, setTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (!isSuperAdmin) return;
    let cancelled = false;
    setAiStatusLoading(true);
    getOpenAiSetting()
      .then((status) => {
        if (!cancelled) setAiStatus(status);
      })
      .catch(() => {
        if (!cancelled) setAiStatus(null);
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
      const status = await getOpenAiSetting();
      setAiStatus(status);
    } catch {
      setAiStatus(null);
    }
  };

  const handleSaveApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKeyInput.trim()) return;

    setSavingKey(true);
    setError(null);
    setSuccess(null);

    try {
      await setOpenAiKey(apiKeyInput.trim());
      setApiKeyInput('');
      setShowApiKey(false);
      setTestResult(null);
      await refreshAiStatus();
      setSuccess('API key saved.');
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(
        axiosErr.response?.data?.message || 'Failed to save the API key. Please try again.'
      );
    } finally {
      setSavingKey(false);
    }
  };

  const handleTestApiKey = async () => {
    setTestingKey(true);
    setTestResult(null);

    try {
      const result = await testOpenAiKey();
      setTestResult(result);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setTestResult({
        ok: false,
        message: axiosErr.response?.data?.message || 'Test request failed. Please try again.',
      });
    } finally {
      setTestingKey(false);
    }
  };

  const handleRemoveApiKey = async () => {
    if (
      !window.confirm(
        'Remove the saved OpenAI API key? OCR will fall back to the environment key or become disabled.'
      )
    ) {
      return;
    }

    setSavingKey(true);
    setError(null);
    setSuccess(null);

    try {
      await clearOpenAiKey();
      setTestResult(null);
      await refreshAiStatus();
      setSuccess('API key removed.');
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(
        axiosErr.response?.data?.message || 'Failed to remove the API key. Please try again.'
      );
    } finally {
      setSavingKey(false);
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
                <p className="text-sm text-gray-500 dark:text-gray-400">OpenAI powers receipt OCR and camera FT scanning.</p>
              </div>
            </div>

            {/* Status */}
            {aiStatusLoading ? (
              <div className="flex items-center gap-2 mb-4">
                <div className="h-3.5 w-3.5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-gray-500 dark:text-gray-400">Checking AI configuration...</span>
              </div>
            ) : aiStatus?.configured ? (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-4">
                <span className="h-2 w-2 rounded-full bg-green-500 flex-shrink-0" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Configured via {aiStatus.source === 'database' ? 'Settings (database)' : 'environment variable'}
                </span>
                {aiStatus.keyHint && (
                  <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{aiStatus.keyHint}</span>
                )}
                {aiStatus.source === 'database' && aiStatus.updatedAt && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    Updated {new Date(aiStatus.updatedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-start gap-2 p-3 bg-orange-50 dark:bg-orange-500/10 rounded-lg mb-4">
                <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-orange-700 dark:text-orange-400">
                  Not configured — OCR and FT scanning are disabled.
                </p>
              </div>
            )}

            {/* Update API key form */}
            <form onSubmit={handleSaveApiKey} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Update API key
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    className="input-field font-mono pr-10"
                    placeholder="sk-..."
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600"
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" loading={savingKey} disabled={!apiKeyInput.trim()}>
                  <Lock className="h-4 w-4 mr-2" />
                  Save Key
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleTestApiKey}
                  loading={testingKey}
                  disabled={testingKey}
                >
                  Test Key
                </Button>
                {aiStatus?.source === 'database' && (
                  <Button type="button" variant="danger" onClick={handleRemoveApiKey} disabled={savingKey}>
                    Remove Saved Key
                  </Button>
                )}
              </div>
            </form>

            {/* Test result (inline, inside card) */}
            {testResult && (
              <div
                className={`mt-4 p-3 rounded-lg text-xs font-medium border ${
                  testResult.ok
                    ? 'bg-green-50 dark:bg-success-500/10 text-green-700 dark:text-success-400 border-green-100'
                    : 'bg-red-50 dark:bg-error-500/10 text-red-700 dark:text-error-400 border-red-100'
                }`}
              >
                {testResult.message}
              </div>
            )}

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
