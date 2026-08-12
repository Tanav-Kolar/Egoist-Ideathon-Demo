// Real, in-browser perceptual hash (DCT-based pHash) + Hamming matching.
//
// This is the credibility core of the demo (see build-spec.md §8 and CLAUDE.md):
// the fingerprint must be derived from pixel content, never from filename or any
// stored association, so a recompressed/renamed/resized copy of an image still
// resolves to the same fingerprint within a small Hamming distance.
//
// Algorithm:
//   1. Draw the image to a 32x32 canvas (down-sampling does the anti-aliasing for us).
//   2. Convert to luma (grayscale) via ITU-R BT.601 weights.
//   3. Run a 2D DCT-II over the 32x32 luma block.
//   4. Keep the top-left 8x8 low-frequency block, EXCLUDING the DC term (index 0,0) —
//      the DC term just encodes overall brightness and would bias the threshold.
//   5. Threshold the remaining 63 coefficients against their median -> 64th bit is
//      fixed to keep a clean 64-bit fingerprint (see below).
//   6. Hamming distance between two 64-bit strings gives the match distance.

const HASH_SIZE = 32;   // input block fed to the DCT
const LOW_FREQ = 8;     // keep an 8x8 low-frequency block -> 64 coefficients

/** Draw any drawable image source to a HASH_SIZE x HASH_SIZE grayscale luma array. */
function toLumaBlock(imgSource) {
  const c = document.createElement('canvas');
  c.width = HASH_SIZE;
  c.height = HASH_SIZE;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(imgSource, 0, 0, HASH_SIZE, HASH_SIZE);
  const { data } = ctx.getImageData(0, 0, HASH_SIZE, HASH_SIZE);
  const luma = new Float64Array(HASH_SIZE * HASH_SIZE);
  for (let i = 0; i < HASH_SIZE * HASH_SIZE; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    luma[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return luma;
}

// Precomputed DCT-II basis cosines for an N-point transform, cached per N.
const cosCache = new Map();
function dctBasis(N) {
  if (cosCache.has(N)) return cosCache.get(N);
  const table = new Float64Array(N * N);
  for (let k = 0; k < N; k++) {
    for (let n = 0; n < N; n++) {
      table[k * N + n] = Math.cos(((2 * n + 1) * k * Math.PI) / (2 * N));
    }
  }
  cosCache.set(N, table);
  return table;
}

/** 2D separable DCT-II over an N x N block, returned as an N x N Float64Array. */
function dct2d(block, N) {
  const basis = dctBasis(N);
  const tmp = new Float64Array(N * N);
  // rows
  for (let y = 0; y < N; y++) {
    for (let k = 0; k < N; k++) {
      let sum = 0;
      for (let x = 0; x < N; x++) sum += block[y * N + x] * basis[k * N + x];
      tmp[y * N + k] = sum;
    }
  }
  // columns
  const out = new Float64Array(N * N);
  for (let x = 0; x < N; x++) {
    for (let k = 0; k < N; k++) {
      let sum = 0;
      for (let y = 0; y < N; y++) sum += tmp[y * N + x] * basis[k * N + y];
      out[k * N + x] = sum;
    }
  }
  return out;
}

/**
 * Compute the 64-bit perceptual hash of an image source (an HTMLImageElement,
 * HTMLCanvasElement, or ImageBitmap — anything drawImage() accepts).
 * Returns a 64-character string of '0'/'1'.
 */
export function phash(imgSource) {
  const luma = toLumaBlock(imgSource);
  const freq = dct2d(luma, HASH_SIZE);

  // Pull the top-left LOW_FREQ x LOW_FREQ block, skip the DC term (0,0).
  const coeffs = [];
  for (let y = 0; y < LOW_FREQ; y++) {
    for (let x = 0; x < LOW_FREQ; x++) {
      if (x === 0 && y === 0) continue; // drop DC — pure brightness, not structure
      coeffs.push(freq[y * HASH_SIZE + x]);
    }
  }
  // 63 coefficients; append one more (the next lowest-frequency term just outside
  // the block) so the fingerprint is a clean 64 bits.
  coeffs.push(freq[0 * HASH_SIZE + LOW_FREQ]); // (0, LOW_FREQ)

  const sorted = [...coeffs].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  let bits = '';
  for (const c of coeffs) bits += c > median ? '1' : '0';
  return bits;
}

/** Average-hash fallback / secondary readout — simple 8x8 mean threshold. */
export function ahash(imgSource) {
  const size = 8;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(imgSource, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);
  const lum = [];
  for (let i = 0; i < size * size; i++) {
    lum.push(0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]);
  }
  const mean = lum.reduce((a, b) => a + b, 0) / lum.length;
  let bits = '';
  for (const v of lum) bits += v >= mean ? '1' : '0';
  return bits;
}

/** Hamming distance between two equal-length bit strings. */
export function hamming(a, b) {
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d;
}

/** Bit indices where two equal-length bit strings differ. */
export function diffBits(a, b) {
  const out = [];
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) out.push(i);
  return out;
}

/** 64-bit binary string -> uppercase hex string (16 chars). */
export function toHex(bits) {
  let hex = '';
  for (let i = 0; i < bits.length; i += 4) {
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  }
  return hex.toUpperCase();
}

/** '7A3EC1190B8DABCD' -> '7A3E·C119·0B8D·ABCD' */
export function prettyHex(hex) {
  return hex.match(/.{1,4}/g).join('·');
}

/**
 * Render the 64-bit fingerprint as an 8x8 pixelated glyph on the given canvas.
 * If diffAgainst is supplied (another 64-bit string), differing bits are painted
 * in the "rust" diff color instead of ink/paper — used in the Verifier lens to make
 * the Hamming distance visible, not just numeric.
 */
export function drawGlyph(canvas, bits, opts = {}) {
  const { diffAgainst = null, ink = '#11100e', paper = '#fafaf7', rust = '#d85f4a' } = opts;
  canvas.width = 8;
  canvas.height = 8;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(8, 8);
  const inkRGB = hexToRgb(ink), paperRGB = hexToRgb(paper), rustRGB = hexToRgb(rust);
  for (let i = 0; i < 64; i++) {
    const on = bits[i] === '1';
    const differs = diffAgainst && diffAgainst[i] !== bits[i];
    const rgb = differs ? rustRGB : (on ? inkRGB : paperRGB);
    img.data[i * 4] = rgb[0];
    img.data[i * 4 + 1] = rgb[1];
    img.data[i * 4 + 2] = rgb[2];
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Match threshold in bits out of 64 (see build-spec.md §8). */
export const MATCH_THRESHOLD = 10;

export function loadImageFromURL(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
