/**
 * Paints the home page scene: Boston's Back Bay across the Charles, in ink
 * and watercolour, greys with Northeastern red.
 *
 *   node scripts/make-painting.mjs
 *
 * Writes one SVG per layer to public/art/. The page stacks them and, as you
 * scroll, only fades and slides whole layers (see "painting" in global.css),
 * so the browser paints each layer once and never repaints the brushwork.
 *
 * The painted look comes from SVG filters, not from the shapes: every wash is
 * pushed around by low-frequency noise so its edges wander, pigment pools
 * darker at the rim, and fine noise knocks holes in it like paper granulation.
 *
 * Layers, bottom to top, and what the page does with them:
 *
 *   sky        white paper, a pale wash, clouds, a pale red sun      always
 *   dusk       crimson sky and a big red sun                         fades in
 *   skyline    far towers, the Back Bay, the river, reflections      always
 *   tower      the dark new tower and its cranes                     rises
 *   night      a dark wash, multiplied over everything below         fades in
 *   smoke      smoke from the tower, over the night so it shows      fades in
 *   red        red windows, the tower's lights, red reflections      spreads
 *   boats      sailboats and birds                                   sail off
 *   drones     a flock of drones                                     arrives
 *   bank       the near bank: willows, lamps, railing, path          dims
 *   people     people on the path                                    leave
 *   deckle     a soft irregular edge, used as a mask on the whole stack
 *
 * Coordinates are a 900 x 1100 canvas. The far waterline is at y 600.
 * Change SEED for different scatter (windows, trees, strokes).
 */

import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = new URL('../public/art/', import.meta.url);
const W = 900;
const H = 1100;
const WATER = 600;
const SEED = 41;

/* --- tools ---------------------------------------------------------------- */

function prng(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = prng(SEED);
const between = (a, b) => a + rnd() * (b - a);
const n = (v) => Math.round(v * 10) / 10;

const INK = {
  paper: '#ffffff',
  w1: '#efecec',
  w2: '#e1dcdc',
  w3: '#c9c1c2',
  w4: '#a89fa0',
  i5: '#7c7274',
  i6: '#4b4244',
  i7: '#2a2325',
  red: '#c8102e',
  redHot: '#e5223e',
  redSoft: '#e88a97',
  redPale: '#f5d4d9',
};

function file(name, defs, body) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
    `<defs>${defs}</defs>${body}</svg>\n`;
  writeFileSync(new URL(name, OUT), svg);
  console.log(`${name}  ${(svg.length / 1024).toFixed(1)} KB`);
}

/* A watercolour wash: wandering edges, a darker rim, granulation. */
function wash(id, { seed = 1, warp = 8, freq = 0.02, rim = 1.6, grain = 0.8 } = {}) {
  return `<filter id="${id}" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB">
<feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="3" seed="${seed}" result="warp"/>
<feDisplacementMap in="SourceGraphic" in2="warp" scale="${warp}" xChannelSelector="R" yChannelSelector="G" result="shape"/>
<feMorphology in="shape" operator="erode" radius="${rim}" result="inner"/>
<feComposite in="shape" in2="inner" operator="out" result="edge"/>
<feGaussianBlur in="edge" stdDeviation="0.9" result="edgeSoft"/>
<feColorMatrix in="edgeSoft" type="matrix" values="0.72 0 0 0 0  0 0.72 0 0 0  0 0 0.72 0 0  0 0 0 0.6 0" result="pool"/>
<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="${seed + 7}" result="grain"/>
<feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -${grain} 1.25" result="grainMask"/>
<feComposite in="shape" in2="grainMask" operator="in" result="grainy"/>
<feMerge><feMergeNode in="grainy"/><feMergeNode in="pool"/></feMerge>
</filter>`;
}

/* Ink line work: a slight tremor, nothing more. */
function inkline(id, seed = 3) {
  return `<filter id="${id}" x="-10%" y="-10%" width="120%" height="120%">
<feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="${seed}" result="n"/>
<feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" xChannelSelector="R" yChannelSelector="G"/>
</filter>`;
}

/* Water: smears things sideways in thin horizontal bands. */
function ripple(id, seed = 5, scale = 16) {
  return `<filter id="${id}" x="-15%" y="-5%" width="130%" height="110%">
<feTurbulence type="fractalNoise" baseFrequency="0.003 0.11" numOctaves="2" seed="${seed}" result="n"/>
<feDisplacementMap in="SourceGraphic" in2="n" scale="${scale}" xChannelSelector="R" yChannelSelector="G" result="d"/>
<feGaussianBlur in="d" stdDeviation="0.8 1.6"/>
</filter>`;
}

/* Soft, for smoke and glow. */
function soft(id, seed = 9, blur = 9, warp = 40) {
  return `<filter id="${id}" x="-40%" y="-40%" width="180%" height="180%">
<feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="3" seed="${seed}" result="n"/>
<feDisplacementMap in="SourceGraphic" in2="n" scale="${warp}" xChannelSelector="R" yChannelSelector="G" result="d"/>
<feGaussianBlur in="d" stdDeviation="${blur}"/>
</filter>`;
}

/* Paper: faint fibre over everything. */
const PAPER = `<filter id="paper" x="0" y="0" width="100%" height="100%">
<feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="3" seed="12"/>
<feColorMatrix type="matrix" values="0 0 0 0 0.42  0 0 0 0 0.38  0 0 0 0 0.39  0 0 0 0.09 0"/>
</filter>`;

mkdirSync(OUT, { recursive: true });

/* --- the skyline, shared by several layers ---------------------------------- */

const towers = [
  { x: 36, w: 50, top: 392 },
  { x: 96, w: 46, top: 346, crown: true },
  { x: 152, w: 58, top: 418 },
  { x: 222, w: 38, top: 468 },
  { x: 268, w: 64, top: 272, pru: true },
  { x: 344, w: 48, top: 402 },
  { x: 398, w: 34, top: 456 },
  { x: 440, w: 54, top: 252, hancock: true },
  { x: 506, w: 44, top: 374 },
  { x: 560, w: 54, top: 332, crown: true },
  { x: 702, w: 50, top: 396 },
  { x: 762, w: 60, top: 304, crown: true },
  { x: 832, w: 50, top: 384 },
];
const TOWER = { x: 640, w: 50, top: 112, cx: 665 };

function towerShape(t, fill) {
  const { x, w, top } = t;
  if (t.pru) {
    return (
      `<path d="M${x} ${WATER}V${top + 16}H${x + 9}V${top}H${x + w - 9}V${top + 16}H${x + w}V${WATER}Z" fill="${fill}"/>` +
      `<rect x="${x + w / 2 - 1.6}" y="${top - 64}" width="3.2" height="64" fill="${fill}"/>`
    );
  }
  if (t.hancock) {
    return `<path d="M${x} ${WATER}V${top + 10}L${x + w} ${top}V${WATER}Z" fill="${fill}"/>`;
  }
  if (t.crown) {
    return `<path d="M${x} ${WATER}V${top + 14}L${x + w / 2} ${top - 10}L${x + w} ${top + 14}V${WATER}Z" fill="${fill}"/>`;
  }
  return `<rect x="${x}" y="${top}" width="${w}" height="${WATER - top}" fill="${fill}"/>`;
}

/* Window positions on the mid towers, shared by the day and red layers. */
const windows = [];
for (const t of towers) {
  const cols = Math.max(2, Math.floor((t.w - 8) / 9));
  const x0 = t.x + (t.w - (cols - 1) * 9) / 2 - 1.5;
  for (let y = t.top + 22; y < WATER - 12; y += 12) {
    for (let c = 0; c < cols; c++) {
      if (rnd() < 0.3) continue;
      windows.push({ x: x0 + c * 9, y, t: rnd() });
    }
  }
}

/* The Back Bay: a low row of brownstones along the water, mansard roofs. */
const rows = [];
for (let x = -4; x < W; ) {
  const w = between(20, 34);
  rows.push({ x, w, h: between(30, 54), roof: rnd() < 0.6, chimney: rnd() < 0.5 });
  x += w + between(0, 2);
}

/* --- sky -------------------------------------------------------------------- */
{
  let clouds = '';
  for (let i = 0; i < 6; i++) {
    const cx = between(60, 840), cy = between(90, 330);
    clouds += `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(between(70, 170))}" ry="${n(between(10, 22))}" fill="${INK.w1}" opacity="${n(between(0.6, 0.95))}"/>`;
  }
  file(
    'sky.svg',
    wash('cloud', { seed: 2, warp: 26, freq: 0.012, rim: 2.2, grain: 0.5 }) +
      wash('sun', { seed: 4, warp: 10, freq: 0.03 }) +
      PAPER,
    `<rect width="${W}" height="${H}" fill="${INK.paper}"/>` +
      `<g filter="url(#cloud)">` +
      `<rect x="-40" y="420" width="${W + 80}" height="190" rx="60" fill="${INK.w1}" opacity="0.9"/>` +
      clouds +
      `</g>` +
      `<g filter="url(#sun)"><circle cx="700" cy="330" r="44" fill="${INK.redPale}"/></g>` +
      `<rect width="${W}" height="${H}" filter="url(#paper)"/>`,
  );
}

/* --- dusk ------------------------------------------------------------------- */
{
  let streaks = '';
  for (let i = 0; i < 9; i++) {
    streaks += `<ellipse cx="${n(between(0, 900))}" cy="${n(between(120, 470))}" rx="${n(between(90, 240))}" ry="${n(between(5, 12))}" fill="#4d0c18" opacity="${n(between(0.25, 0.55))}"/>`;
  }
  file(
    'dusk.svg',
    `<linearGradient id="dsky" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#2a070e"/><stop offset="0.45" stop-color="#7a1426"/>
<stop offset="0.85" stop-color="#c22d44"/><stop offset="1" stop-color="#e05a6c"/></linearGradient>` +
      wash('dwash', { seed: 6, warp: 30, freq: 0.01, rim: 3, grain: 0.6 }) +
      wash('dsun', { seed: 8, warp: 12, freq: 0.025 }) +
      soft('halo', 3, 28, 30) +
      PAPER,
    `<g filter="url(#dwash)"><rect x="-30" y="-30" width="${W + 60}" height="${WATER + 40}" fill="url(#dsky)"/></g>` +
      `<g filter="url(#halo)"><circle cx="700" cy="500" r="180" fill="${INK.redHot}" opacity="0.35"/></g>` +
      `<g filter="url(#dsun)"><circle cx="700" cy="500" r="92" fill="${INK.redHot}"/></g>` +
      `<g filter="url(#dwash)">${streaks}</g>` +
      `<rect width="${W}" height="${WATER + 10}" filter="url(#paper)"/>`,
  );
}

/* --- skyline and river -------------------------------------------------------- */
{
  let far = '';
  for (let i = 0; i < 44; i++) {
    const w = between(16, 42), x = between(-10, 900), top = between(430, 548);
    far += `<rect x="${n(x)}" y="${n(top)}" width="${n(w)}" height="${n(WATER - top)}" fill="${INK.w2}"/>`;
  }

  const SHADES = ['#d3cccd', '#c6bebf', '#bab1b2', '#cdc6c7', '#b2a9aa'];
  let mid = '';
  let shade = '';
  for (const t of towers) {
    mid += towerShape(t, t.hancock ? '#c3c1c6' : SHADES[Math.floor(rnd() * SHADES.length)]);
    // the side away from the sun, a shade darker
    shade += `<rect x="${n(t.x + t.w * 0.66)}" y="${t.top + 18}" width="${n(t.w * 0.34)}" height="${WATER - t.top - 18}" fill="#8f8586" opacity="0.28"/>`;
  }

  let lights = '';
  for (const w of windows) {
    lights += `<rect x="${n(w.x)}" y="${n(w.y)}" width="3" height="5" fill="${INK.w4}" opacity="0.55"/>`;
  }
  // the Prudential's bands
  const pru = towers.find((t) => t.pru);
  let bands = '';
  for (let y = pru.top + 24; y < WATER - 8; y += 14) {
    bands += `<rect x="${pru.x + 3}" y="${y}" width="${pru.w - 6}" height="1.6" fill="${INK.w1}" opacity="0.7"/>`;
  }

  let brown = '';
  let brownWin = '';
  for (const r of rows) {
    const top = WATER - r.h;
    brown += `<rect x="${n(r.x)}" y="${n(top)}" width="${n(r.w)}" height="${n(r.h)}" fill="${INK.w4}"/>`;
    if (r.roof) brown += `<path d="M${n(r.x)} ${n(top)}L${n(r.x + 3)} ${n(top - 7)}H${n(r.x + r.w - 3)}L${n(r.x + r.w)} ${n(top)}Z" fill="${INK.i5}"/>`;
    if (r.chimney) brown += `<rect x="${n(r.x + r.w * 0.7)}" y="${n(top - 13)}" width="4" height="9" fill="${INK.i5}"/>`;
    for (let y = top + 7; y < WATER - 8; y += 10) {
      for (let x = r.x + 4; x < r.x + r.w - 5; x += 7) {
        brownWin += `<rect x="${n(x)}" y="${n(y)}" width="3" height="5" fill="${INK.paper}" opacity="0.55"/>`;
      }
    }
  }

  // a line of trees along the far bank, in front of the brownstones
  let trees = '';
  for (let x = -10; x < W; x += between(14, 30)) {
    trees += `<ellipse cx="${n(x)}" cy="${n(WATER - between(4, 10))}" rx="${n(between(9, 16))}" ry="${n(between(7, 12))}" fill="${INK.i5}" opacity="0.85"/>`;
  }

  // the river and its reflections
  let strokes = '';
  for (let i = 0; i < 46; i++) {
    const y = between(WATER + 8, 845), x = between(-60, 880), len = between(40, 220);
    const light = rnd() < 0.35;
    strokes += `<rect x="${n(x)}" y="${n(y)}" width="${n(len)}" height="${n(between(1.2, 3.2))}" rx="1.5" fill="${light ? INK.paper : INK.w2}" opacity="${n(between(0.5, 0.9))}"/>`;
  }
  let reflect = '';
  for (const t of towers) {
    reflect += `<rect x="${t.x}" y="${WATER + 2}" width="${t.w}" height="${n((WATER - t.top) * 0.55)}" fill="${INK.w3}" opacity="0.5"/>`;
  }
  reflect += `<rect x="-10" y="${WATER + 1}" width="${W + 20}" height="38" fill="${INK.w4}" opacity="0.45"/>`;

  file(
    'skyline.svg',
    wash('far', { seed: 14, warp: 7, freq: 0.03, rim: 1.2, grain: 0.6 }) +
      wash('mid', { seed: 15, warp: 6, freq: 0.035, rim: 1.4 }) +
      wash('near', { seed: 16, warp: 5, freq: 0.04, rim: 1.2 }) +
      wash('river', { seed: 17, warp: 14, freq: 0.01, rim: 2, grain: 0.5 }) +
      ripple('ripple', 18, 18) +
      inkline('ink', 19) +
      PAPER,
    `<g filter="url(#far)">${far}</g>` +
      `<g filter="url(#mid)">${mid}</g>` +
      `<g filter="url(#far)">${shade}</g>` +
      `<g filter="url(#ink)">${lights}${bands}</g>` +
      `<g filter="url(#near)">${brown}</g>` +
      `<g filter="url(#ink)">${brownWin}</g>` +
      `<g filter="url(#near)">${trees}</g>` +
      `<g filter="url(#river)"><rect x="-20" y="${WATER}" width="${W + 40}" height="${H - WATER}" fill="#f2f0f0"/></g>` +
      `<g filter="url(#ripple)">${reflect}${strokes}</g>` +
      `<rect y="${WATER}" width="${W}" height="${H - WATER}" filter="url(#paper)"/>`,
  );
}

/* --- the tower --------------------------------------------------------------- */
{
  const { x, w, top, cx } = TOWER;
  const body =
    `<path d="M${x} ${WATER}L${x + 3} ${top + 20}L${cx} ${top}L${x + w - 3} ${top + 20}L${x + w} ${WATER}Z" fill="#3a3234"/>` +
    `<rect x="${cx - 1}" y="${top - 46}" width="2" height="48" fill="#3a3234"/>`;
  let lines = '';
  for (let y = top + 34; y < WATER - 6; y += 16) {
    lines += `<rect x="${x + 6}" y="${y}" width="${w - 12}" height="1.2" fill="#5a5052" opacity="0.8"/>`;
  }
  const crane = (mx, dir) =>
    `<path d="M${mx} ${WATER}V150M${mx - 4} ${WATER}V150M${mx} 150H${mx + dir * 110}M${mx} 150H${mx - dir * 34}` +
    `M${mx + dir * 80} 150V${210}M${mx} 138L${mx + dir * 60} 150M${mx} 138L${mx - dir * 30} 150" stroke="${INK.i6}" stroke-width="1.6" fill="none"/>` +
    `<rect x="${mx - dir * 34 - (dir > 0 ? 0 : 12)}" y="150" width="12" height="8" fill="${INK.i6}"/>` +
    `<rect x="${mx + dir * 80 - 4}" y="210" width="8" height="6" fill="${INK.i6}"/>`;
  file(
    'tower.svg',
    wash('tw', { seed: 21, warp: 4, freq: 0.04, rim: 1.4, grain: 0.7 }) + inkline('tink', 22),
    `<g filter="url(#tw)">${body}</g>` +
      `<g filter="url(#tink)">${lines}${crane(720, 1)}${crane(612, -1)}</g>`,
  );
  file(
    'tower-reflect.svg',
    ripple('trip', 23, 20),
    `<g filter="url(#trip)"><rect x="${x}" y="${WATER + 2}" width="${w}" height="${n((WATER - top) * 0.5)}" fill="#3a3234" opacity="0.45"/></g>`,
  );
}

/* --- smoke ------------------------------------------------------------------ */
{
  let puffs = '';
  for (let i = 0; i < 26; i++) {
    const k = i / 25;
    const x = TOWER.cx - k * 560 + between(-30, 30);
    const y = TOWER.top - 40 - k * 220 + between(-30, 30);
    puffs += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(18 + k * 110)}" fill="#1e0c10" opacity="${n(0.3 + (1 - k) * 0.3)}"/>`;
  }
  file('smoke.svg', soft('smk', 25, 12, 60), `<g filter="url(#smk)">${puffs}</g>`);
}

/* --- night ------------------------------------------------------------------ */
file(
  'night.svg',
  `<linearGradient id="ng" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#1b0a0e" stop-opacity="0.92"/><stop offset="0.4" stop-color="#2c0c13" stop-opacity="0.86"/>
<stop offset="0.56" stop-color="#2a0b12" stop-opacity="0.8"/><stop offset="1" stop-color="#14070a" stop-opacity="0.9"/></linearGradient>`,
  `<rect width="${W}" height="${H}" fill="url(#ng)"/>`,
);

/* --- red --------------------------------------------------------------------- */
{
  const { x, w, top, cx } = TOWER;
  let dabs = '';
  for (const win of windows) {
    if (win.t < 0.25) continue;
    dabs += `<rect x="${n(win.x)}" y="${n(win.y)}" width="3.2" height="5.2" fill="${INK.redHot}"/>`;
  }
  let rowRed = '';
  for (const r of rows) {
    const top = WATER - r.h;
    for (let y = top + 7; y < WATER - 8; y += 10) {
      for (let xx = r.x + 4; xx < r.x + r.w - 5; xx += 7) {
        if (rnd() < 0.45) rowRed += `<rect x="${n(xx)}" y="${n(y)}" width="3" height="5" fill="${INK.redHot}"/>`;
      }
    }
  }
  let bands = '';
  for (let y = top + 34; y < WATER - 6; y += 16) {
    bands += `<rect x="${x + 7}" y="${y}" width="${w - 14}" height="2" fill="${INK.redHot}" opacity="0.9"/>`;
  }
  let reflect = '';
  for (const t of towers) {
    reflect += `<rect x="${t.x + t.w * 0.3}" y="${WATER + 4}" width="${n(t.w * 0.4)}" height="${n((WATER - t.top) * 0.4)}" fill="${INK.redHot}" opacity="0.35"/>`;
  }
  reflect += `<rect x="${cx - 9}" y="${WATER + 3}" width="18" height="230" fill="${INK.redHot}" opacity="0.6"/>`;
  file(
    'red.svg',
    soft('rglow', 31, 22, 20) + inkline('rink', 32) + ripple('rrip', 33, 18),
    `<g filter="url(#rglow)"><circle cx="${cx}" cy="${top - 40}" r="70" fill="${INK.redHot}" opacity="0.55"/>` +
      `<ellipse cx="${cx}" cy="420" rx="60" ry="240" fill="${INK.redHot}" opacity="0.18"/></g>` +
      `<g filter="url(#rink)">${dabs}${rowRed}${bands}` +
      `<rect x="${cx - 1.3}" y="${top}" width="2.6" height="${WATER - top}" fill="${INK.redHot}"/>` +
      `<circle cx="${cx}" cy="${top - 44}" r="6" fill="#ff5a6e"/></g>` +
      `<g filter="url(#rrip)">${reflect}</g>`,
  );
}

/* --- boats and birds -------------------------------------------------------------- */
{
  const boat = (x, y, s, sail) => {
    const hull = `M${n(x - 20 * s)} ${n(y)}L${n(x + 26 * s)} ${n(y)}L${n(x + 20 * s)} ${n(y + 6 * s)}L${n(x - 14 * s)} ${n(y + 6 * s)}Z`;
    const main = `M${n(x)} ${n(y - 64 * s)}L${n(x)} ${n(y - 4 * s)}L${n(x + 30 * s)} ${n(y - 6 * s)}Z`;
    const jib = `M${n(x - 2 * s)} ${n(y - 56 * s)}L${n(x - 2 * s)} ${n(y - 6 * s)}L${n(x - 18 * s)} ${n(y - 6 * s)}Z`;
    return (
      `<g filter="url(#bw)"><path d="${main}" fill="${sail}"/><path d="${jib}" fill="${sail === INK.paper ? INK.w1 : sail}" opacity="0.9"/></g>` +
      `<g filter="url(#bink)"><path d="${main}" fill="none" stroke="${INK.i6}" stroke-width="1"/>` +
      `<path d="M${n(x)} ${n(y - 66 * s)}V${n(y)}" stroke="${INK.i7}" stroke-width="1.4"/>` +
      `<path d="${hull}" fill="${INK.i6}"/></g>` +
      `<g filter="url(#brip)"><path d="M${n(x)} ${n(y + 8 * s)}L${n(x)} ${n(y + 50 * s)}L${n(x + 26 * s)} ${n(y + 8 * s)}Z" fill="${sail === INK.paper ? INK.w3 : INK.redSoft}" opacity="0.35"/></g>`
    );
  };
  const birds = [
    [190, 200, 1], [216, 214, 0.8], [240, 192, 0.9], [520, 150, 1.1], [548, 166, 0.8], [360, 250, 0.7],
  ]
    .map(([x, y, s]) => `<path d="M${x - 8 * s} ${y - 3 * s}Q${x - 4 * s} ${y - 7 * s} ${x} ${y}Q${x + 4 * s} ${y - 7 * s} ${x + 8 * s} ${y - 3 * s}" fill="none" stroke="${INK.i6}" stroke-width="1.5" stroke-linecap="round"/>`)
    .join('');
  file(
    'boats.svg',
    wash('bw', { seed: 41, warp: 3, freq: 0.05, rim: 1, grain: 0.4 }) + inkline('bink', 42) + ripple('brip', 43, 12),
    boat(180, 700, 1, INK.paper) +
      boat(372, 752, 1.2, INK.red) +
      boat(540, 690, 0.8, INK.paper) +
      boat(770, 738, 1.05, INK.paper) +
      boat(92, 784, 1.3, INK.redSoft) +
      `<g filter="url(#bink)">${birds}</g>`,
  );
}

/* --- drones ------------------------------------------------------------------ */
{
  const drone = (x, y, s) =>
    `<g transform="translate(${n(x)} ${n(y)}) scale(${n(s)})">` +
    `<path d="M-9 -5L9 5M9 -5L-9 5" stroke="${INK.i6}" stroke-width="1.6"/>` +
    `<ellipse cx="-9" cy="-6.5" rx="5.5" ry="1.4" fill="${INK.i5}"/><ellipse cx="9" cy="-6.5" rx="5.5" ry="1.4" fill="${INK.i5}"/>` +
    `<ellipse cx="-9" cy="3.5" rx="5.5" ry="1.4" fill="${INK.i5}"/><ellipse cx="9" cy="3.5" rx="5.5" ry="1.4" fill="${INK.i5}"/>` +
    `<rect x="-5" y="-2.5" width="10" height="5" rx="1.5" fill="${INK.i7}"/>` +
    `<circle cx="0" cy="3.6" r="2" fill="#ff4a60"/></g>`;
  let flock = '';
  // a loose V heading left, and a few stragglers
  for (let i = 0; i < 6; i++) {
    flock += drone(590 + i * 44 + between(-6, 6), 210 + i * 20 + between(-5, 5), 1.7 + rnd() * 0.4);
    if (i) flock += drone(590 + i * 44 + between(-6, 6), 210 - i * 8 + between(-5, 5), 1.5 + rnd() * 0.4);
  }
  for (let i = 0; i < 7; i++) flock += drone(between(80, 860), between(130, 480), 1.1 + rnd() * 0.9);
  file('drones.svg', inkline('dink', 51), `<g filter="url(#dink)">${flock}</g>`);
}

/* --- the near bank -------------------------------------------------------------- */
{
  const ground =
    `<path d="M-20 846C150 834 320 852 470 842S760 836 920 848V${H + 20}H-20Z" fill="${INK.w2}"/>` +
    `<path d="M-20 906C220 900 520 914 920 904V958C560 966 260 954 -20 962Z" fill="${INK.paper}" opacity="0.85"/>` +
    `<path d="M-20 1040C300 1030 600 1046 920 1034V${H + 20}H-20Z" fill="${INK.w3}"/>`;
  let rail = `<path d="M-10 857H910M-10 867H910" stroke="${INK.i6}" stroke-width="1.4"/>`;
  for (let x = 0; x < W; x += 26) rail += `<path d="M${x} 852V872" stroke="${INK.i6}" stroke-width="1.6"/>`;
  const lamp = (x) =>
    `<path d="M${x} 905V786M${x} 790Q${x + 10} 780 ${x + 16} 790" stroke="${INK.i7}" stroke-width="2.6" fill="none"/>` +
    `<rect x="${x + 11}" y="789" width="10" height="13" rx="2" fill="${INK.i7}"/>`;
  const bench = `<path d="M548 930H612M552 930V946M608 930V946M548 920H612M550 920V930M610 920V930" stroke="${INK.i7}" stroke-width="2.4" fill="none"/>`;

  // willows: a trunk, a canopy of washes, and drooping strands
  const willow = (tx, ty, cx, cy, spread, dir) => {
    // a few faint washes for the mass of the crown
    let canopy = '';
    for (let i = 0; i < 7; i++) {
      canopy += `<ellipse cx="${n(cx + between(-spread, spread))}" cy="${n(cy + between(-40, 70))}" rx="${n(between(50, 90))}" ry="${n(between(40, 80))}" fill="${INK.w3}" opacity="${n(between(0.25, 0.45))}"/>`;
    }
    // arching branches, and long strands hanging from them
    let branches = '';
    let strands = '';
    for (let b = 0; b < 7; b++) {
      const ex = cx + between(-spread * 1.1, spread * 1.1);
      const ey = cy - between(10, 70);
      const bx = n((tx + cx) / 2 + between(-10, 10)), by = n(ty + between(40, 140));
      branches += `<path d="M${bx} ${by}Q${n((bx + ex) / 2)} ${n(ey - 50)} ${n(ex)} ${n(ey)}" stroke="${INK.i6}" stroke-width="${n(between(1.2, 2.6))}" fill="none"/>`;
      for (let k = 0; k < 16; k++) {
        const t = between(0.35, 1);
        const sx = bx + (ex - bx) * t, sy = by + (ey - 50 - by) * 2 * t * (1 - t) + (ey - by) * t * t;
        const len = between(70, 200);
        strands += `<path d="M${n(sx)} ${n(sy)}q${n(dir * between(2, 12))} ${n(len * 0.5)} ${n(dir * between(-2, 8))} ${n(len)}" stroke="${rnd() < 0.5 ? INK.i5 : INK.w4}" stroke-width="${n(between(0.7, 1.5))}" fill="none" opacity="${n(between(0.45, 0.85))}"/>`;
      }
    }
    const trunk = `<path d="M${tx} ${H + 10}C${tx + 10} ${ty + 180} ${tx - 8} ${ty + 90} ${n((tx + cx) / 2)} ${ty + 70}" stroke="${INK.i7}" stroke-width="12" fill="none" stroke-linecap="round"/>`;
    return { canopy, strands: branches + strands, trunk };
  };
  const left = willow(70, 760, 130, 650, 120, 1);
  const right = willow(850, 760, 790, 660, 110, -1);

  let tufts = '';
  for (let i = 0; i < 60; i++) {
    const x = between(0, 900), y = between(846, 900);
    tufts += `<path d="M${n(x)} ${n(y)}l${n(between(-3, 3))} ${n(between(-8, -4))}" stroke="${INK.i5}" stroke-width="1" opacity="0.6"/>`;
  }

  file(
    'bank.svg',
    wash('gw', { seed: 61, warp: 12, freq: 0.015, rim: 2, grain: 0.6 }) +
      wash('cw', { seed: 62, warp: 22, freq: 0.02, rim: 2.4, grain: 0.7 }) +
      inkline('bk', 63) +
      PAPER,
    `<g filter="url(#gw)">${ground}</g>` +
      `<g filter="url(#bk)">${tufts}${rail}${lamp(250)}${lamp(560)}${bench}${left.trunk}${right.trunk}</g>` +
      `<g filter="url(#cw)">${left.canopy}${right.canopy}</g>` +
      `<g filter="url(#bk)">${left.strands}${right.strands}</g>` +
      `<rect y="830" width="${W}" height="${H - 830}" filter="url(#paper)"/>`,
  );
}

/* --- people ------------------------------------------------------------------ */
{
  const BASE = 950;
  const person = (x, { h = 34, scarf, stride = 3 } = {}) => {
    const top = BASE - h;
    return (
      `<circle cx="${x}" cy="${top + 4}" r="4.2" fill="${INK.i7}"/>` +
      `<path d="M${x - 5} ${top + 10}L${x + 5} ${top + 10}L${x + 7} ${BASE - 12}L${x - 7} ${BASE - 12}Z" fill="${INK.i7}"/>` +
      `<path d="M${x - 2} ${BASE - 12}L${x - stride} ${BASE}M${x + 2} ${BASE - 12}L${x + stride} ${BASE}" stroke="${INK.i7}" stroke-width="2.4" stroke-linecap="round"/>` +
      (scarf ? `<rect x="${x - 5}" y="${top + 9}" width="10" height="3" fill="${scarf}"/>` : '')
    );
  };
  const umbrella = (x) =>
    `<path d="M${x - 15} ${BASE - 40}Q${x} ${BASE - 58} ${x + 15} ${BASE - 40}Z" fill="${INK.red}"/>` +
    `<path d="M${x} ${BASE - 48}V${BASE - 26}" stroke="${INK.i7}" stroke-width="1.2"/>`;
  const balloon = (x) =>
    `<path d="M${x + 4} ${BASE - 18}Q${x + 12} ${BASE - 40} ${x + 8} ${BASE - 60}" stroke="${INK.i6}" stroke-width="0.8" fill="none"/>` +
    `<ellipse cx="${x + 8}" cy="${BASE - 67}" rx="6" ry="7.5" fill="${INK.red}"/>`;
  const dog = (x) =>
    `<path d="M${x - 9} ${BASE - 8}h16v-6h-16z" fill="${INK.i7}"/><circle cx="${x + 9}" cy="${BASE - 15}" r="3.4" fill="${INK.i7}"/>` +
    `<path d="M${x - 8} ${BASE - 2}V${BASE}M${x - 3} ${BASE - 2}V${BASE}M${x + 2} ${BASE - 2}V${BASE}M${x + 6} ${BASE - 2}V${BASE}M${x - 9} ${BASE - 12}l-4 -3" stroke="${INK.i7}" stroke-width="1.8"/>`;
  const sitter =
    `<circle cx="580" cy="903" r="4.2" fill="${INK.i7}"/>` +
    `<path d="M575 909H585L586 928H574Z" fill="${INK.i7}"/>` +
    `<path d="M576 928H592V945" stroke="${INK.i7}" stroke-width="2.4" fill="none"/>`;
  const child = (x) =>
    `<circle cx="${x}" cy="${BASE - 22}" r="3.4" fill="${INK.i7}"/>` +
    `<path d="M${x - 4} ${BASE - 18}L${x + 4} ${BASE - 18}L${x + 5} ${BASE - 8}L${x - 5} ${BASE - 8}Z" fill="${INK.i7}"/>` +
    `<path d="M${x - 2} ${BASE - 8}L${x - 3} ${BASE}M${x + 2} ${BASE - 8}L${x + 3} ${BASE}M${x + 3} ${BASE - 16}L${x + 7} ${BASE - 20}" stroke="${INK.i7}" stroke-width="1.8" stroke-linecap="round"/>`;
  const leash = `<path d="M478 930Q490 940 498 936" stroke="${INK.i6}" stroke-width="0.8" fill="none"/>`;

  file(
    'people.svg',
    inkline('pink', 71),
    `<g filter="url(#pink)">` +
      person(318, { scarf: INK.red }) +
      person(334, { h: 31, stride: 2 }) +
      person(410, { stride: 4 }) +
      umbrella(410) +
      person(472, { h: 33 }) +
      leash +
      dog(506) +
      person(668, { stride: 7 }) +
      sitter +
      child(720) +
      balloon(720) +
      person(760, { h: 35, stride: 2 }) +
      `</g>`,
  );
}

/* --- the edge ------------------------------------------------------------------ */
file(
  'deckle.svg',
  `<filter id="dk" x="-5%" y="-5%" width="110%" height="110%">
<feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="4" seed="81" result="n"/>
<feDisplacementMap in="SourceGraphic" in2="n" scale="34" xChannelSelector="R" yChannelSelector="G" result="d"/>
<feGaussianBlur in="d" stdDeviation="3"/></filter>`,
  `<rect x="26" y="26" width="${W - 52}" height="${H - 52}" rx="14" fill="#fff" filter="url(#dk)"/>`,
);
