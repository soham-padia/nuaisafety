/**
 * Render the link preview image, public/og.jpg: the home page's street print,
 * first plate ("Today"), 1200 × 630, the whole width of the street as the
 * full-screen opening shows it.
 *
 *   npm run og
 *
 * It draws with the site's own code (scripts/street.ts and scripts/riso.ts),
 * bundled by esbuild and run on @napi-rs/canvas, so the preview always
 * matches the print. Rerun it after changing the first plate.
 */
import { build } from 'esbuild';
import { createCanvas, Path2D, ImageData } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';

// what the drawing code expects of a browser
globalThis.OffscreenCanvas = class {
  constructor(w, h) {
    return createCanvas(w, h);
  }
};
globalThis.Path2D = Path2D;
globalThis.ImageData = ImageData;

const bundle = await build({
  stdin: {
    contents: `export { drawPlate } from './src/scripts/street.ts';
               export { print, screens, WORLD } from './src/scripts/riso.ts';`,
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  write: false,
});
const { drawPlate, print, screens, WORLD } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`
);

const W = 1200, H = 630;
// the whole world across, cropped top and bottom, a little more street than sky
const pw = W, ph = Math.round((W * WORLD.h) / WORLD.w);
const plate = print(drawPlate(0, pw, ph), screens(pw, ph, 3.4));
const full = createCanvas(pw, ph);
full.getContext('2d').putImageData(plate, 0, 0);
const out = createCanvas(W, H);
out.getContext('2d').drawImage(full, 0, -Math.round((ph - H) * 0.6));
writeFileSync('public/og.jpg', await out.encode('jpeg', 88));
console.log(`public/og.jpg  ${W}×${H}`);
