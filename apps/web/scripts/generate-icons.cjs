#!/usr/bin/env node
/**
 * Pure-Node PNG icon generator for the Equb PWA (no external dependencies).
 *
 * Implements a minimal PNG encoder:
 *   - CRC-32 (IEEE) hand-rolled with a lookup table
 *   - IHDR: 8-bit depth, color type 6 (RGBA)
 *   - IDAT: raw scanlines (each prefixed with filter byte 0) compressed
 *     with zlib.deflateSync
 *   - IEND
 *
 * Drawing is done on a Uint8Array RGBA raster by filling axis-aligned
 * rectangles; rounded corners use a simple per-pixel corner-circle test.
 *
 * Outputs (in apps/web/public/):
 *   icon-192.png          rounded-square brand background, "E" at ~44%
 *   icon-512.png          rounded-square brand background, "E" at ~44%
 *   icon-maskable-512.png FULL-BLEED background, "E" at ~55% (maskable safe zone)
 *   apple-touch-icon.png  180x180 full-bleed background, no transparency
 *
 * Regenerate with:  cd apps/web && node scripts/generate-icons.cjs
 */

'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const BRAND = [0x46, 0x5f, 0xff, 0xff]; // #465fff, opaque
const WHITE = [0xff, 0xff, 0xff, 0xff];

/* ---------------------------------------------------------------- PNG encoding */

let CRC_TABLE = null;
function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), Buffer.from(data)]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([len, typeAndData, crc]);
}

function encodePng(raster) {
  const { size, data } = raster;
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); // width
  ihdr.writeUInt32BE(size, 4); // height
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression: deflate
  ihdr[11] = 0; // filter method: adaptive
  ihdr[12] = 0; // interlace: none

  // `data` already contains every scanline prefixed with filter byte 0.
  const idat = zlib.deflateSync(Buffer.from(data), { level: 9 });

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', new Uint8Array(0)),
  ]);
}

/* ---------------------------------------------------------------- raster + drawing */

function createRaster(size) {
  const stride = size * 4 + 1; // +1 filter byte per scanline
  return { size, stride, data: new Uint8Array(stride * size) };
}

function setPixel(r, x, y, color) {
  if (x < 0 || y < 0 || x >= r.size || y >= r.size) return;
  const o = y * r.stride + 1 + x * 4;
  r.data[o] = color[0];
  r.data[o + 1] = color[1];
  r.data[o + 2] = color[2];
  r.data[o + 3] = color[3];
}

/**
 * Fill an axis-aligned rounded rect. A pixel (sampled at its center
 * x+0.5 / y+0.5) is inside if it lies in the rect and, when it falls in one of
 * the four corner zones, within that corner's circle of `radius`.
 */
function fillRoundedRect(r, x0, y0, x1, y1, radius, color) {
  const xa = Math.max(0, Math.floor(x0));
  const xb = Math.min(r.size, Math.ceil(x1));
  const ya = Math.max(0, Math.floor(y0));
  const yb = Math.min(r.size, Math.ceil(y1));

  const cxl = x0 + radius;
  const cxr = x1 - radius;
  const cyt = y0 + radius;
  const cyb = y1 - radius;
  const r2 = radius * radius;

  for (let y = ya; y < yb; y++) {
    const py = y + 0.5;
    for (let x = xa; x < xb; x++) {
      const px = x + 0.5;
      let dx = 0;
      let dy = 0;
      if (px < cxl && py < cyt) {
        dx = cxl - px;
        dy = cyt - py;
      } else if (px > cxr && py < cyt) {
        dx = px - cxr;
        dy = cyt - py;
      } else if (px < cxl && py > cyb) {
        dx = cxl - px;
        dy = py - cyb;
      } else if (px > cxr && py > cyb) {
        dx = px - cxr;
        dy = py - cyb;
      }
      if (dx * dx + dy * dy <= r2) setPixel(r, x, y, color);
    }
  }
}

function fillRect(r, x0, y0, x1, y1, color) {
  fillRoundedRect(r, x0, y0, x1, y1, 0, color);
}

/** Bold geometric "E": vertical stem + 3 horizontal bars, centered at (cx, cy). */
function drawE(r, cx, cy, box) {
  const left = cx - box / 2;
  const top = cy - box / 2;
  const stemW = box * 0.24;
  const barH = box * 0.18;

  fillRect(r, left, top, left + stemW, top + box, WHITE); // stem
  fillRect(r, left, top, left + box, top + barH, WHITE); // top bar
  fillRect(r, left, cy - barH / 2, left + box * 0.86, cy + barH / 2, WHITE); // middle bar
  fillRect(r, left, top + box - barH, left + box, top + box, WHITE); // bottom bar
}

/* ---------------------------------------------------------------- icon variants */

function roundedIcon(size) {
  const r = createRaster(size);
  const radius = size * 0.19; // ~19% corner radius, corners fully transparent
  fillRoundedRect(r, 0, 0, size, size, radius, BRAND);
  drawE(r, size / 2, size / 2, size * 0.44);
  return r;
}

function fullBleedIcon(size, eRatio) {
  const r = createRaster(size);
  fillRect(r, 0, 0, size, size, BRAND); // no transparent corners
  drawE(r, size / 2, size / 2, size * eRatio);
  return r;
}

/* ---------------------------------------------------------------- main */

const outDir = path.join(__dirname, '..', 'public');
fs.mkdirSync(outDir, { recursive: true });

const targets = [
  { file: 'icon-192.png', raster: roundedIcon(192) },
  { file: 'icon-512.png', raster: roundedIcon(512) },
  { file: 'icon-maskable-512.png', raster: fullBleedIcon(512, 0.55) },
  { file: 'apple-touch-icon.png', raster: fullBleedIcon(180, 0.5) },
];

for (const t of targets) {
  const png = encodePng(t.raster);
  fs.writeFileSync(path.join(outDir, t.file), png);
  console.log(`wrote public/${t.file} (${png.length} bytes)`);
}
