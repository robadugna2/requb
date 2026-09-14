/**
 * Canvas-based image enhancement for FT scanning.
 *
 * Bank-statement photos are often dim, shaded, or shot at an angle, which is
 * the top cause of missed FT numbers. Two profiles:
 *   - 'auto': mild cleanup applied to every capture before upload — grayscale,
 *     per-channel min/max contrast stretch, and mild sharpening. Keeps the
 *     photo readable for both the AI and the on-screen preview.
 *   - 'heavy': aggressive normalization for small crops around a single FT
 *     cell — grayscale, contrast stretch, adaptive-ish local threshold via
 *     unsharp contrast boost, and 2× nearest-neighbor upscale so short
 *     reference strings have enough pixels for OCR.
 */

export type EnhanceMode = 'auto' | 'heavy';

export interface EnhanceOptions {
  /** Multiply output size (heavy crops benefit from 2x upscale) */
  scale?: number;
  /** JPEG quality of the output blob */
  quality?: number;
}

async function loadImage(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Could not read image'));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Grayscale + min/max stretch over the whole canvas.
 * Returns the put-ready ImageData (mutated in place).
 */
function stretchContrast(ctx: CanvasRenderingContext2D, w: number, h: number, mix = 1): ImageData {
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;

  // Pass 1: luminance histogram min/max
  let min = 255;
  let max = 0;
  for (let i = 0; i < px.length; i += 4) {
    const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    if (lum < min) min = lum;
    if (lum > max) max = lum;
  }
  const range = Math.max(1, max - min);

  // Pass 2: apply stretched grayscale, blended by `mix` against the original
  for (let i = 0; i < px.length; i += 4) {
    const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    const stretched = ((lum - min) / range) * 255;
    const out = lum + (stretched - lum) * mix;
    px[i] = out;
    px[i + 1] = out;
    px[i + 2] = out;
  }
  return data;
}

/** 3x3 unsharp mask; amount 0..1 */
function sharpen(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number) {
  const src = ctx.getImageData(0, 0, w, h);
  const out = ctx.createImageData(w, h);
  const s = src.data;
  const o = out.data;
  const idx = (x: number, y: number) => (y * w + x) * 4;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = idx(x, y);
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) {
        o[i] = s[i]; o[i + 1] = s[i + 1]; o[i + 2] = s[i + 2]; o[i + 3] = s[i + 3];
        continue;
      }
      // 3x3 mean of luminance-ish (channels are equal post-grayscale)
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          sum += s[idx(x + dx, y + dy)];
        }
      }
      const blur = sum / 9;
      const val = s[i] + (s[i] - blur) * amount;
      const clamped = Math.max(0, Math.min(255, val));
      o[i] = clamped; o[i + 1] = clamped; o[i + 2] = clamped; o[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas encode failed'))),
      'image/jpeg',
      quality,
    );
  });
}

/** Enhance a whole image file. Returns a JPEG File (same base name). */
export async function enhanceFile(
  file: File | Blob,
  mode: EnhanceMode = 'auto',
  options: EnhanceOptions = {},
): Promise<File> {
  const { scale = 1, quality = 0.9 } = options;
  const img = await loadImage(file);

  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return file instanceof File ? file : new File([file], 'photo.jpg', { type: 'image/jpeg' });
  ctx.imageSmoothingEnabled = scale > 1; // keep smoothing for down/upscale, nearest for 1x crops
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);

  if (mode === 'auto') {
    ctx.putImageData(stretchContrast(ctx, w, h, 0.75), 0, 0);
    sharpen(ctx, w, h, 0.35);
  } else {
    ctx.putImageData(stretchContrast(ctx, w, h, 1), 0, 0);
    sharpen(ctx, w, h, 0.8);
    // Second contrast pass pushes faint thermal-print text to full black/white
    ctx.putImageData(stretchContrast(ctx, w, h, 0.6), 0, 0);
  }

  const blob = await canvasToBlob(canvas, quality);
  const name = file instanceof File ? file.name.replace(/\.[^.]+$/, '') + '-enhanced.jpg' : 'enhanced.jpg';
  return new File([blob], name, { type: 'image/jpeg' });
}

/**
 * Crop a normalized [x, y, w, h] (0–1) region with padding and enhance it
 * heavily — used when the admin taps an FT focus box to re-scan just that
 * cell, or drags a custom selection.
 */
export async function cropAndEnhance(
  file: File | Blob,
  region: { x: number; y: number; w: number; h: number },
  pad = 0.35,
  options: EnhanceOptions = { scale: 2 },
): Promise<File> {
  const img = await loadImage(file);
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;

  // Pad around the box so neighboring context (labels, row separators) that
  // helps the model stays visible, clamped to the image bounds.
  const px = region.w * iw * pad;
  const py = region.h * ih * pad;
  const sx = Math.max(0, Math.round(region.x * iw - px));
  const sy = Math.max(0, Math.round(region.y * ih - py));
  const sw = Math.min(iw - sx, Math.round(region.w * iw + px * 2));
  const sh = Math.min(ih - sy, Math.round(region.h * ih + py * 2));

  const scale = options.scale ?? 2;
  const canvas = document.createElement('canvas');
  canvas.width = sw * scale;
  canvas.height = sh * scale;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return file instanceof File ? file : new File([file], 'crop.jpg', { type: 'image/jpeg' });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw * scale, sh * scale);

  const w = canvas.width;
  const h = canvas.height;
  ctx.putImageData(stretchContrast(ctx, w, h, 1), 0, 0);
  sharpen(ctx, w, h, 0.8);
  ctx.putImageData(stretchContrast(ctx, w, h, 0.6), 0, 0);

  const blob = await canvasToBlob(canvas, options.quality ?? 0.92);
  return new File([blob], 'ft-crop-enhanced.jpg', { type: 'image/jpeg' });
}
