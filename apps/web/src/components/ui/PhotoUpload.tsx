'use client';

import React, { useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { uploadPhoto, getMediaUrl } from '@/lib/api';

interface PhotoUploadProps {
  value: string;
  onChange: (url: string) => void;
  name: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'w-12 h-12',
  md: 'w-20 h-20',
  lg: 'w-28 h-28',
};

const iconSizes = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
};

export default function PhotoUpload({ value, onChange, name, size = 'md' }: PhotoUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const url = await uploadPhoto(file);
      onChange(url);
    } catch {
      // silently fail — user can retry
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2);

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className={`relative ${sizeClasses[size]} rounded-full overflow-hidden bg-primary-100 flex items-center justify-center group transition-all hover:ring-2 hover:ring-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500`}
      >
        {value ? (
          <img src={getMediaUrl(value)} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-sm font-bold text-primary-700">{initials}</span>
        )}

        {/* Overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          {uploading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Camera className={`${iconSizes[size]} text-white`} />
          )}
        </div>

        {uploading && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </button>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      <span className="text-xs text-gray-500">
        {uploading ? 'Uploading...' : 'Click to upload'}
      </span>
    </div>
  );
}
