'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FtImageCropperProps {
  file: File;
  onCancel: () => void;
  /** Receives the cropped JPEG (or the original file when nothing was cropped) */
  onConfirm: (cropped: File) => void;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

type DragMode = 'move' | 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';

const MIN_SIZE = 48;

const clamp = (v: number, min: number, max: number) =>
  Math.min(Math.max(v, min), max);

const HANDLES: Array<{ mode: DragMode; label: string }> = [
  { mode: 'nw', label: 'top-left' },
  { mode: 'n', label: 'top' },
  { mode: 'ne', label: 'top-right' },
  { mode: 'e', label: 'right' },
  { mode: 'se', label: 'bottom-right' },
  { mode: 's', label: 'bottom' },
  { mode: 'sw', label: 'bottom-left' },
  { mode: 'w', label: 'left' },
];

/**
 * Fullscreen manual crop step between camera capture / gallery pick and
 * processing: drag the frame or its 8 handles to lock onto the FT area of the
 * shot; the cropped region is what gets uploaded and scanned.
 * Selection is tracked in on-screen pixels and mapped to natural image
 * coordinates on confirm, so crops are always full resolution.
 */
export default function FtImageCropper({ file, onCancel, onConfirm }: FtImageCropperProps) {
  const [url, setUrl] = useState('');
  const [natural, setNatural] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [display, setDisplay] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [sel, setSel] = useState<Rect>({ x: 0, y: 0, w: 0, h: 0 });
  const [working, setWorking] = useState(false);
  const dragRef = useRef<{ mode: DragMode; startX: number; startY: number; orig: Rect } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const measure = () => {
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    setDisplay({ w: rect.width, h: rect.height });
    setSel({ x: 0, y: 0, w: rect.width, h: rect.height });
  };

  const resetSelection = () => setSel({ x: 0, y: 0, w: display.w, h: display.h });

  const startDrag = (mode: DragMode) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { mode, startX: e.clientX, startY: e.clientY, orig: { ...sel } };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || display.w === 0) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const o = drag.orig;
    let { x, y, w, h } = o;

    if (drag.mode === 'move') {
      x = clamp(x + dx, 0, display.w - w);
      y = clamp(y + dy, 0, display.h - h);
    } else {
      if (drag.mode.includes('e')) w = clamp(w + dx, MIN_SIZE, display.w - x);
      if (drag.mode.includes('s')) h = clamp(h + dy, MIN_SIZE, display.h - y);
      if (drag.mode.includes('w')) {
        const nx = clamp(x + dx, 0, x + w - MIN_SIZE);
        w = w + (x - nx);
        x = nx;
      }
      if (drag.mode.includes('n')) {
        const ny = clamp(y + dy, 0, y + h - MIN_SIZE);
        h = h + (y - ny);
        y = ny;
      }
    }
    setSel({ x, y, w, h });
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const confirmCrop = () => {
    if (!natural.w || !display.w || sel.w <= 0) {
      onConfirm(file);
      return;
    }
    setWorking(true);
    const scaleX = natural.w / display.w;
    const scaleY = natural.h / display.h;
    const sx = Math.max(0, Math.round(sel.x * scaleX));
    const sy = Math.max(0, Math.round(sel.y * scaleY));
    const sw = Math.max(1, Math.min(Math.round(sel.w * scaleX), natural.w - sx));
    const sh = Math.max(1, Math.min(Math.round(sel.h * scaleY), natural.h - sy));

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setWorking(false);
        onConfirm(file);
        return;
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      canvas.toBlob(
        (blob) => {
          setWorking(false);
          if (!blob) {
            onConfirm(file);
            return;
          }
          onConfirm(new File([blob], `statement-crop-${Date.now()}.jpg`, { type: 'image/jpeg' }));
        },
        'image/jpeg',
        0.92,
      );
    };
    img.onerror = () => {
      setWorking(false);
      onConfirm(file);
    };
    img.src = url;
  };

  const handlePos = (mode: DragMode): { left: number; top: number } => ({
    left: mode.includes('w') ? sel.x : mode.includes('e') ? sel.x + sel.w : sel.x + sel.w / 2,
    top: mode.includes('n') ? sel.y : mode.includes('s') ? sel.y + sel.h : sel.y + sel.h / 2,
  });

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/95 flex flex-col touch-none select-none"
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {/* Hint */}
      <div className="px-5 pt-4 pb-2 text-center">
        <p className="text-sm font-medium text-white">
          Drag the frame to lock onto the FT area
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          Only the selected area is scanned — crop tightly for the best results.
        </p>
      </div>

      {/* Image + selection */}
      <div className="flex-1 min-h-0 flex items-center justify-center px-4">
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={url}
            alt="Captured statement"
            onLoad={measure}
            draggable={false}
            className="block max-h-[58vh] max-w-full rounded-lg"
          />
          {sel.w > 0 && (
            <>
              <div
                className="absolute cursor-move rounded-sm border-2 border-brand-400"
                style={{
                  left: sel.x,
                  top: sel.y,
                  width: sel.w,
                  height: sel.h,
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.62)',
                }}
                onPointerDown={startDrag('move')}
              >
                {/* rule-of-thirds guides */}
                <div className="absolute inset-y-0 left-1/3 w-px bg-white/30" />
                <div className="absolute inset-y-0 left-2/3 w-px bg-white/30" />
                <div className="absolute inset-x-0 top-1/3 h-px bg-white/30" />
                <div className="absolute inset-x-0 top-2/3 h-px bg-white/30" />
              </div>
              {HANDLES.map(({ mode, label }) => {
                const pos = handlePos(mode);
                return (
                  <div
                    key={mode}
                    role="slider"
                    aria-label={`Resize handle ${label}`}
                    onPointerDown={startDrag(mode)}
                    className={`absolute z-10 w-9 h-9 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white border-[3px] border-brand-500 shadow-lg touch-none ${
                      mode === 'move' ? '' : mode.includes('n') ? 'cursor-n-resize' : ''
                    } ${mode === 'nw' || mode === 'se' ? 'cursor-nwse-resize' : ''} ${
                      mode === 'ne' || mode === 'sw' ? 'cursor-nesw-resize' : ''
                    } ${mode === 'e' || mode === 'w' ? 'cursor-ew-resize' : ''} ${
                      mode === 'n' || mode === 's' ? 'cursor-ns-resize' : ''
                    }`}
                    style={{ left: pos.left, top: pos.top }}
                  />
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="px-6 pt-3 pb-[max(env(safe-area-inset-bottom),12px)]">
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          <Button variant="secondary" onClick={onCancel} className="flex-shrink-0">
            <X className="h-4 w-4 mr-1" /> Cancel
          </Button>
          <Button variant="secondary" onClick={resetSelection} className="flex-shrink-0">
            <RotateCcw className="h-4 w-4 mr-1" /> Full Image
          </Button>
          <Button onClick={confirmCrop} loading={working} className="flex-shrink-0">
            <Check className="h-4 w-4 mr-1" /> Use Area
          </Button>
        </div>
      </div>
    </div>
  );
}
