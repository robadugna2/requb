'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CircleDollarSign, Eye, EyeOff } from 'lucide-react';
import { login } from '@/lib/api';
import Button from '@/components/ui/Button';
import { useLanguage } from '@/components/layout/LanguageContext';

export default function LoginPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await login(email, password);
      localStorage.setItem('equb_token', data.accessToken);
      router.push('/dashboard');
    } catch (err: any) {
      setError(
        err.response?.data?.message || 'Invalid credentials. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 gradient-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <div className="flex items-center gap-3 mb-8">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm">
              <CircleDollarSign className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Equb</h1>
              <p className="text-sm text-white/70">{t('login.subtitle')}</p>
            </div>
          </div>
          <h2 className="text-4xl font-bold leading-tight mb-4">
            Manage Your Rotating
            <br />
            {t('login.savings')}
          </h2>
          <p className="text-lg text-white/80 max-w-md">
            A modern platform for managing traditional Ethiopian Equb savings
            circles. Track deposits, verify receipts, and manage lottery draws
            all in one place.
          </p>

          {/* Decorative elements */}
          <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-white/5 rounded-full" />
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full" />
          <div className="absolute bottom-20 right-20 w-20 h-20 bg-white/10 rounded-full" />
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md">
          {/* Mobile brand */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl gradient-primary">
              <CircleDollarSign className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gradient">Equb</h1>
          </div>

          <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 p-8">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900">{t('login.welcome')}</h2>
              <p className="mt-2 text-sm text-gray-500">
                {t('login.welcome')}
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  {t('login.email')}
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                  placeholder="admin@equb.et"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  {t('login.password')}
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field pr-10"
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-600">{t('login.remember')}</span>
                </label>
                <a
                  href="#"
                  className="text-sm font-medium text-primary-600 hover:text-primary-500"
                >
                  Forgot password?
                </a>
              </div>

              <Button
                type="submit"
                loading={loading}
                className="w-full"
                size="lg"
              >
                {t('login.signin')}
              </Button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-gray-400">
            © 2024 Equb Platform. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
