/**
 * Dark-surface variants of the brand assets.
 *
 * Recolours the existing PNGs rather than re-rendering them, so the letterforms
 * and the layout are pixel-identical to the versions already in circulation.
 *
 * Each source pixel is decomposed into (foreground colour, coverage) against the
 * background it was drawn on, then recomposited on the new background. Doing it
 * that way keeps the anti-aliased edges clean; a straight channel inversion
 * leaves a light halo around the accent dot.
 */
import sharp from 'sharp';

const INK = [20, 22, 26];       // #14161a
const ACCENT = [200, 16, 46];   // #c8102e
const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const isAccent = (r, g, b) => r - (g + b) / 2 > 30;

const SRC = 'brand';
const OUT = SRC;

/** Transparent source, dark marks. Ink becomes white, the accent stays. */
async function inverseTransparent(src, dest, { flat = false } = {}) {
  const img = sharp(src).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    if (isAccent(r, g, b)) continue;
    // A flat mark keeps its coverage in the alpha channel, so the ink can go
    // straight to pure white. Artwork with several neutral tones needs the
    // luminance flipped instead, or its light fills would blow out to solid white.
    const v = flat ? 255 : clamp(255 - luma(r, g, b));
    data[i] = data[i + 1] = data[i + 2] = v;
  }
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(dest);
  return info;
}

/** Opaque source drawn on white. Reconstructs coverage, repaints on black. */
async function inverseOnWhite(src, dest) {
  const { data, info } = await sharp(src).removeAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height * 3);
  for (let i = 0, o = 0; i < data.length; i += info.channels, o += 3) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    if (isAccent(r, g, b)) {
      const a = Math.max(0, Math.min(1, (255 - b) / (255 - ACCENT[2])));
      out[o] = clamp(ACCENT[0] * a);
      out[o + 1] = clamp(ACCENT[1] * a);
      out[o + 2] = clamp(ACCENT[2] * a);
    } else {
      const a = Math.max(0, Math.min(1, (255 - luma(r, g, b)) / (255 - luma(...INK))));
      out[o] = out[o + 1] = out[o + 2] = clamp(255 * a);
    }
  }
  await sharp(out, { raw: { width: info.width, height: info.height, channels: 3 } })
    .png({ compressionLevel: 9 })
    .toFile(dest);
  return info;
}

// 1. Wordmark, transparent, white text.
const wm = await inverseTransparent(`${SRC}/logo-wordmark.png`, `${OUT}/logo-wordmark-inverse.png`, { flat: true });

// 2. Same wordmark on black, padded to match the white-background version.
const PAD_X = 80, PAD_Y = 60;
await sharp({
  create: {
    width: wm.width + PAD_X * 2,
    height: wm.height + PAD_Y * 2,
    channels: 3,
    background: { r: 0, g: 0, b: 0 },
  },
})
  .composite([{ input: `${OUT}/logo-wordmark-inverse.png`, left: PAD_X, top: PAD_Y }])
  .png({ compressionLevel: 9 })
  .toFile(`${OUT}/logo-wordmark-black.png`);

// 3. Square avatar on black.
await inverseOnWhite(`${SRC}/logo-square.png`, `${OUT}/logo-square-black.png`);

// 4. Hero diagram for dark slides. Transparent, so it sits on any dark surface.
await inverseTransparent(`${SRC}/perceptron.png`, `${OUT}/perceptron-inverse.png`);

console.log('wrote logo-wordmark-inverse, logo-wordmark-black, logo-square-black, perceptron-inverse');
