'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { ShieldAlert, CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

type ToastVariant = 'error' | 'warning' | 'success' | 'info';

interface ToastMessage {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showToast: (message: string, variant: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: string) => void }) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    timerRef.current = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDismiss(toast.id), 300);
    }, 5000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [toast.id, onDismiss]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => onDismiss(toast.id), 300);
  };

  const variantStyles: Record<ToastVariant, { bg: string; border: string; icon: React.ReactNode; text: string }> = {
    warning: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      icon: <ShieldAlert className="h-5 w-5 text-amber-600 flex-shrink-0" />,
      text: 'text-amber-900',
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      icon: <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />,
      text: 'text-red-900',
    },
    success: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      icon: <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />,
      text: 'text-green-900',
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      icon: <Info className="h-5 w-5 text-blue-600 flex-shrink-0" />,
      text: 'text-blue-900',
    },
  };

  const style = variantStyles[toast.variant];

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg max-w-sm w-full transition-all duration-300 ${style.bg} ${style.border} ${
        visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'
      }`}
    >
      {style.icon}
      <p className={`text-sm font-medium flex-1 ${style.text}`}>{toast.message}</p>
      <button
        onClick={handleClose}
        className="p-1 rounded hover:bg-black/5 transition-colors flex-shrink-0"
      >
        <X className="h-4 w-4 text-gray-500" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, variant: ToastVariant) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setToasts((prev) => [...prev, { id, message, variant }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Listen for permission-denied custom events dispatched from the API interceptor
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ message?: string }>).detail;
      const msg = detail?.message || 'You do not have permission to perform this action.';
      showToast(msg, 'warning');
    };
    window.addEventListener('equb-permission-denied', handler);
    return () => window.removeEventListener('equb-permission-denied', handler);
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast container - fixed top-right */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} onDismiss={dismissToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
