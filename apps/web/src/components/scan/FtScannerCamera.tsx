'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, X, Zap, ZapOff, ImagePlus, ScanLine } from 'lucide-react';

interface FtScannerCameraProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

/**
 * Fullscreen rear-camera viewfinder for photographing hardcopy bank
 * statements / receipts. Falls back to a gallery file picker on devices
 * without a camera or when permission is denied.
 */
export default function FtScannerCamera({ onCapture, onClose }: FtScannerCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } },
          audio: false,
        });
        if (cancelled) {
          mediaStream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
        const track = mediaStream.getVideoTracks()[0];
        const caps = (track.getCapabilities?.() ?? {}) as unknown as { torch?: boolean };
        if (caps.torch) setTorchSupported(true);
      } catch {
        if (!cancelled) {
          setError(
            'Camera unavailable. Check camera permissions, or use "Choose from gallery" below.',
          );
        }
      }
    };

    start();
    return () => {
      cancelled = true;
      stopStream();
    };
  }, [stopStream]);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn }] } as unknown as MediaTrackConstraints);
      setTorchOn((v) => !v);
    } catch {
      setTorchSupported(false);
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        stopStream();
        onCapture(new File([blob], `statement-${Date.now()}.jpg`, { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.9,
    );
  };

  const handleGallery = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    stopStream();
    onCapture(file);
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black flex flex-col">
      {/* Viewfinder */}
      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />

        {/* Framing guides */}
        {videoRef.current && !error && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-[86%] max-w-md aspect-[3/4] border-2 border-white/70 rounded-2xl relative">
              <span className="absolute -top-px -left-px w-8 h-8 border-t-4 border-l-4 border-brand-400 rounded-tl-2xl" />
              <span className="absolute -top-px -right-px w-8 h-8 border-t-4 border-r-4 border-brand-400 rounded-tr-2xl" />
              <span className="absolute -bottom-px -left-px w-8 h-8 border-b-4 border-l-4 border-brand-400 rounded-bl-2xl" />
              <span className="absolute -bottom-px -right-px w-8 h-8 border-b-4 border-r-4 border-brand-400 rounded-br-2xl" />
            </div>
          </div>
        )}

        {/* Top bar */}
        <div className="absolute top-0 inset-x-0 flex items-center justify-between p-4 bg-gradient-to-b from-black/70 to-transparent">
          <span className="flex items-center gap-2 text-white text-sm font-medium">
            <ScanLine className="h-5 w-5" />
            Position the bank statement inside the frame
          </span>
          <button
            type="button"
            onClick={() => {
              stopStream();
              onClose();
            }}
            className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70"
            aria-label="Close camera"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-sm text-center shadow-2xl">
              <Camera className="h-8 w-8 mx-auto text-gray-400 mb-3" />
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">{error}</p>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full py-2.5 rounded-lg bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600"
              >
                Choose from gallery
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div className="bg-black/85 px-6 pt-4 pb-8">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="p-3 rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label="Choose from gallery"
          >
            <ImagePlus className="h-6 w-6" />
          </button>

          <button
            type="button"
            onClick={capturePhoto}
            disabled={!!error}
            className="w-20 h-20 rounded-full bg-white border-4 border-white/30 shadow-lg disabled:opacity-40 active:scale-95 transition-transform flex items-center justify-center"
            aria-label="Capture"
          >
            <span className="w-14 h-14 rounded-full bg-brand-500" />
          </button>

          <button
            type="button"
            onClick={toggleTorch}
            disabled={!torchSupported}
            className={`p-3 rounded-full ${
              torchOn ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white'
            } hover:bg-white/20 disabled:opacity-30`}
            aria-label="Toggle torch"
          >
            {torchOn ? <Zap className="h-6 w-6" /> : <ZapOff className="h-6 w-6" />}
          </button>
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" onChange={handleGallery} className="hidden" />
    </div>
  );
}
