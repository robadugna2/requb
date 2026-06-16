'use client';

import React, { useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { uploadPhoto, getMediaUrl } from '@/lib/api';
import Button from './Button';

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
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const [uploading, setUploading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

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

  const startCamera = async () => {
    setShowCamera(true);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      setStream(mediaStream);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      }, 100);
    } catch (err) {
      alert('Could not access camera. Please check permissions.');
      setShowCamera(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setShowCamera(false);
  };

  const capturePhoto = async () => {
    if (!videoRef.current) return;
    setUploading(true);
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          async (blob) => {
            if (!blob) return;
            const file = new File([blob], 'snapshot.jpg', { type: 'image/jpeg' });
            try {
              const url = await uploadPhoto(file);
              onChange(url);
              stopCamera();
            } catch {
              alert('Upload failed. Please try again.');
            } finally {
              setUploading(false);
            }
          },
          'image/jpeg',
          0.85
        );
      }
    } catch (err) {
      console.error(err);
      setUploading(false);
    }
  };

  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2);

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`relative ${sizeClasses[size]} rounded-full overflow-hidden bg-primary-100 flex items-center justify-center`}
      >
        {value ? (
          <img src={getMediaUrl(value)} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-sm font-bold text-primary-700">{initials}</span>
        )}

        {uploading && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      <div className="flex gap-2 mt-1">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="px-2.5 py-1 text-xs font-semibold border rounded-lg border-gray-300 hover:bg-gray-50 transition-colors text-gray-700"
        >
          Upload Photo
        </button>
        <button
          type="button"
          onClick={startCamera}
          disabled={uploading}
          className="px-2.5 py-1 text-xs font-semibold border rounded-lg border-gray-300 hover:bg-gray-50 transition-colors text-gray-700 flex items-center gap-1"
        >
          <Camera className="h-3 w-3" />
          Take Photo
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {showCamera && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-2xl relative">
            <h4 className="text-base font-semibold text-gray-900 mb-4">Capture Photo</h4>
            <div className="aspect-video bg-black rounded-lg overflow-hidden relative mb-4">
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={stopCamera}>
                Cancel
              </Button>
              <Button type="button" onClick={capturePhoto} loading={uploading}>
                Capture & Upload
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
