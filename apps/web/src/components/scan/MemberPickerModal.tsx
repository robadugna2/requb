'use client';

import React, { useMemo, useState } from 'react';
import { Search, UserRound } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import type { GroupMember } from '@/lib/api';

interface MemberPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: GroupMember[];
  payerName?: string;
  onSelect: (member: GroupMember) => void;
}

/**
 * Manual member selection for scanned transactions whose payer name could
 * not be auto-paired (or where the admin wants to override the suggestion).
 */
export default function MemberPickerModal({
  isOpen,
  onClose,
  members,
  payerName,
  onSelect,
}: MemberPickerModalProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) => m.name.toLowerCase().includes(q) || m.phone.includes(q),
    );
  }, [members, search]);

  const initials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Select Member" size="md">
      <div>
        {payerName && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Bank payer name: <span className="font-semibold text-gray-700 dark:text-gray-200">{payerName}</span>
          </p>
        )}
        <div className="relative mb-3">
          <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            className="input-field pl-10"
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800 rounded-xl border border-gray-200 dark:border-gray-800">
          {filtered.length === 0 && (
            <p className="p-4 text-sm text-gray-500 dark:text-gray-400 text-center">
              No members match your search.
            </p>
          )}
          {filtered.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                onSelect(m);
                onClose();
              }}
              className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-white/[0.04] text-left transition-colors"
            >
              {m.photoUrl ? (
                <img src={m.photoUrl} alt={m.name} className="w-9 h-9 rounded-full object-cover" />
              ) : (
                <span className="w-9 h-9 rounded-full bg-brand-50 dark:bg-brand-500/15 flex items-center justify-center text-xs font-bold text-brand-600 dark:text-brand-400">
                  {initials(m.name)}
                </span>
              )}
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium text-gray-800 dark:text-white/90 truncate">
                  {m.name}
                </span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">{m.phone}</span>
              </span>
              <UserRound className="h-4 w-4 text-gray-300 dark:text-gray-600" />
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
