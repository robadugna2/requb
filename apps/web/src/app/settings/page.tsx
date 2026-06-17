'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Lock, Eye, EyeOff, Shield, Globe, AlertTriangle } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Button from '@/components/ui/Button';
import { changePassword } from '@/lib/api';
import { useLanguage, Language } from '@/components/layout/LanguageContext';

export default function SettingsPage() {
  const { language, setLanguage, t } = useLanguage();
  const searchParams = useSearchParams();
  const router = useRouter();
  const mustChange = searchParams.get('mustChange') === '1';

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        <h1 className="text-2xl font-bold text-gray-900">{t('settings.title')}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {t('settings.subtitle')}
        </p>
      </div>

      {mustChange && (
        <div className="mb-6 p-4 rounded-xl bg-orange-50 border border-orange-200 flex gap-3 items-start shadow-sm max-w-xl">
          <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-orange-900">Action Required: Temporary Password Detected</h3>
            <p className="text-sm text-orange-700 mt-1 leading-relaxed">
              You are currently logged in using a temporary password set by your administrator.
              For security reasons, you must change your password before continuing.
            </p>
          </div>
        </div>
      )}

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

      <div className="space-y-6 max-w-xl">
        {/* Language Selection Card */}
        <div className="card">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-primary-50 rounded-lg">
              <Globe className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{t('settings.lang_select')}</h2>
              <p className="text-sm text-gray-500">{t('settings.lang_desc')}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Select Language / ቋንቋ ይምረጡ / Afaan Filadhaa / ቋንቋ ይምረጹ
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="input-field w-full cursor-pointer bg-white text-gray-900"
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
            <div className="p-2 bg-primary-50 rounded-lg">
              <Lock className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{t('settings.change_pwd')}</h2>
              <p className="text-sm text-gray-500">{t('settings.update_pwd_desc')}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Current Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {newPassword.length > 0 && newPassword.length < 6 && (
                <p className="mt-1 text-xs text-red-500">{t('settings.err_length')}</p>
              )}
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                <p className="mt-1 text-xs text-red-500">{t('settings.err_match')}</p>
              )}
            </div>

            {/* Security Note */}
            <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
              <Shield className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
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
