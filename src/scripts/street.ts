/**
 * The home page print: one corner of Boston's Back Bay, printed six times.
 * The same brownstones, office tower, café and crossing in every plate; what
 * changes is the light, the people, the windows, the screen on the tower and
 * whatever else each risk brings onto the street.
 * The order and the captions are in data/story.ts.
 *
 * Drawing goes through the riso press in scripts/riso.ts. Each plate is drawn
 * in two passes, like a real scene: everything lit by the sky, then the mood
 * of the plate printed over it (dusk, night), then everything that
 * gives off its own light (screens, lamps, lit windows, torches), so that a
 * lit window stays bright at night.
 *
 * Nothing here touches the page: street.worker.ts prints the plates off the
 * main thread, and street-view.ts shows them.
 */
import { Plate, type Ink, type Spec, type Tone, seeded } from './riso';

type P = [number, number];
type R = () => number;

/* --- colour, as ink amounts ----------------------------------------------- */

const DARK: Spec = { r: 0.72, b: 0.95 }; // the riso "black": red over blue
const BRICK: Spec = { r: 0.62, y: 0.52, b: 0.07 };
const STONE: Spec = { r: 0.3, y: 0.42, b: 0.12 };
const CORNICE: Spec = { r: 0.55, y: 0.35, b: 0.55 };
const GLASS: Spec = { b: 0.48, r: 0.04 };
const GLASS_DARK: Spec = { b: 0.85, r: 0.5 };
const SIDEWALK: Spec = { r: 0.12, y: 0.22, b: 0.12 };
const ROAD: Spec = { b: 0.45, r: 0.32, y: 0.12 };
const LEAF: Spec = { b: 0.6, y: 0.95 };
const LEAF_DARK: Spec = { b: 0.88, y: 0.9, r: 0.18 };
const LEAF_LIGHT: Spec = { b: 0.32, y: 0.85 };
const BARK: Spec = { r: 0.55, y: 0.45, b: 0.55 };
const WHITE: Spec = {};

const SKIN: Spec[] = [
  { y: 0.32, r: 0.16 },
  { y: 0.5, r: 0.4, b: 0.1 },
  { y: 0.55, r: 0.55, b: 0.32 },
  { y: 0.42, r: 0.26, b: 0.03 },
];
const HAIR: Spec[] = [DARK, { r: 0.62, y: 0.75, b: 0.32 }, { y: 0.85, r: 0.32 }, { r: 0.4, b: 0.75 }];

const COAT = {
  red: { r: 0.95 } as Spec,
  blue: { b: 0.9 } as Spec,
  yellow: { y: 0.95 } as Spec,
  green: { b: 0.62, y: 0.95 } as Spec,
  orange: { r: 0.6, y: 0.95 } as Spec,
  pink: { r: 0.38 } as Spec,
  sky: { b: 0.42 } as Spec,
  plum: { r: 0.55, b: 0.62 } as Spec,
  grey: { b: 0.3, r: 0.22, y: 0.1 } as Spec,
};

const lin = (from: number, to: number, y0 = 0, y1 = 900): Tone => ({ y0, y1, from, to });

/* --- paths --------------------------------------------------------------- */

const jit = (r: R, a: number) => (r() - 0.5) * 2 * a;
const still: R = () => 0.5;

function quad(r: R, x: number, y: number, w: number, h: number, j = 1.2) {
  const p = new Path2D();
  p.moveTo(x + jit(r, j), y + jit(r, j));
  p.lineTo(x + w + jit(r, j), y + jit(r, j));
  p.lineTo(x + w + jit(r, j), y + h + jit(r, j));
  p.lineTo(x + jit(r, j), y + h + jit(r, j));
  p.closePath();
  return p;
}

function poly(pts: number[], close = true) {
  const p = new Path2D();
  p.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) p.lineTo(pts[i], pts[i + 1]);
  if (close) p.closePath();
  return p;
}

function circle(x: number, y: number, rad: number) {
  const p = new Path2D();
  p.arc(x, y, rad, 0, Math.PI * 2);
  return p;
}

function ellipse(x: number, y: number, rx: number, ry: number) {
  const p = new Path2D();
  p.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  return p;
}

function round(x: number, y: number, w: number, h: number, rad: number) {
  const p = new Path2D();
  p.roundRect(x, y, w, h, rad);
  return p;
}

/** A soft, irregular round shape: foliage, clouds. */
function blob(r: R, cx: number, cy: number, rx: number, ry: number, n = 12, j = 0.14) {
  const pts: P[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + jit(r, j);
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  const p = new Path2D();
  const mid = (a: P, b: P): P => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const m0 = mid(pts[n - 1], pts[0]);
  p.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) {
    const a = pts[i], m = mid(a, pts[(i + 1) % n]);
    p.quadraticCurveTo(a[0], a[1], m[0], m[1]);
  }
  p.closePath();
  return p;
}

function line(pts: number[]) {
  return poly(pts, false);
}

/* --- the fixed street ------------------------------------------------------
   Built once, from one seed, so the architecture is identical in every plate. */

const GROUND = 900;
const BILL = { x: 632, y: 262, w: 280, h: 186 };

interface Win { path: Path2D; inner: Path2D; frame: Path2D; x: number; y: number; w: number; h: number }

function buildStreet() {
  const r = seeded(11);
  const sky = poly([-600, -400, 1600, -400, 1600, GROUND, -600, GROUND]);

  // far city, seen over the roofs and in the gap between the houses and the tower
  const far: { body: Path2D; dots: Path2D }[] = [];
  for (let x = -520; x < 1520; ) {
    const w = 46 + r() * 70, top = 270 + r() * 140;
    const dots = new Path2D();
    for (let yy = top + 16; yy < GROUND - 20; yy += 22)
      for (let xx = x + 9; xx < x + w - 8; xx += 14) if (r() > 0.25) dots.rect(xx, yy, 5, 8);
    far.push({ body: quad(r, x, top, w, GROUND - top, 1), dots });
    x += w - 4 + r() * 10;
  }
  // the Prudential, with its crown and mast, and the slanted Hancock
  const pru = poly([478, 190, 548, 190, 548, GROUND, 478, GROUND]);
  const pruCrown = poly([484, 190, 490, 168, 536, 168, 542, 190]);
  const pruMast = line([513, 168, 513, 92]);
  const pruBands = new Path2D();
  for (let yy = 206; yy < GROUND; yy += 18) pruBands.rect(482, yy, 62, 6);
  const hancock = poly([382, 205, 452, 224, 452, GROUND, 382, GROUND]);
  const hancockLines = new Path2D();
  for (let xx = 392; xx < 452; xx += 12) { hancockLines.moveTo(xx, 210 + (xx - 382) * 0.27); hancockLines.lineTo(xx, GROUND); }

  // the office tower and its windows
  const tower = quad(r, 600, 112, 420, GROUND - 112, 0.8);
  const towerCap = quad(r, 596, 104, 428, 16, 0.6);
  const cells: Win[] = [];
  for (let y = 134; y < 680; y += 46)
    for (let x = 612; x < 1000; x += 50) {
      if (x + 44 > BILL.x - 14 && x < BILL.x + BILL.w + 14 && y + 40 > BILL.y - 14 && y < BILL.y + BILL.h + 14) continue;
      const p = quad(r, x, y, 44, 40, 0.8);
      cells.push({ path: p, inner: p, frame: p, x, y, w: 44, h: 40 });
    }
  const billFrame = quad(r, BILL.x - 12, BILL.y - 12, BILL.w + 24, BILL.h + 24, 1);
  const billScreen = quad(r, BILL.x, BILL.y, BILL.w, BILL.h, 0.6);

  // the café at the foot of the tower
  const cafeSign = quad(r, 608, 700, 392, 40, 0.8);
  const awning: Path2D[] = [];
  for (let i = 0; i < 10; i++) {
    const x = 604 + i * 40;
    awning.push(poly([x, 744, x + 40, 744, x + 44, 790, x + 22, 800, x - 4, 790]));
  }
  const cafeGlass = quad(r, 620, 802, 236, 98, 0.8);
  const cafeDoor = quad(r, 872, 802, 70, 98, 0.8);
  const counter = quad(r, 632, 862, 210, 38, 0.8);

  // three brownstones
  const houses = [
    { x0: -470, x1: -318, top: 402, paint: { y: 0.95 } as Spec },
    { x0: -318, x1: -160, top: 372, paint: { r: 0.55, b: 0.62 } as Spec },
    { x0: -160, x1: -12, top: 414, paint: { r: 0.95 } as Spec },
    { x0: -12, x1: 166, top: 392, paint: { b: 0.9 } as Spec },
    { x0: 166, x1: 326, top: 424, paint: { r: 0.95 } as Spec },
    { x0: 326, x1: 480, top: 376, paint: { b: 0.62, y: 0.95 } as Spec },
  ].map((h) => {
    const w = h.x1 - h.x0;
    const wins: Win[] = [];
    const lintels = new Path2D();
    const ww = (w - 54) / 3 - 10;
    for (let y = h.top + 50; y + 64 < 770; y += 100)
      for (let c = 0; c < 3; c++) {
        const x = h.x0 + 22 + c * (ww + 15);
        const frame = new Path2D();
        frame.rect(x, y, ww, 64);
        frame.moveTo(x, y + 30);
        frame.lineTo(x + ww, y + 30);
        wins.push({ path: quad(r, x, y, ww, 64, 1), inner: quad(r, x + 3, y + 3, ww - 6, 58, 0.6), frame, x, y, w: ww, h: 64 });
        lintels.addPath(quad(r, x - 4, y - 11, ww + 8, 9, 0.8));
      }
    const doorX = h.x0 + w * 0.6;
    const stoop = new Path2D();
    for (let s = 0; s < 5; s++) stoop.addPath(quad(r, doorX - 14 - s * 12, 848 + s * 10.5, 64 + s * 12, 11, 0.6));
    return {
      ...h,
      facade: quad(r, h.x0, h.top, w, GROUND - h.top, 1.4),
      cornice: quad(r, h.x0 - 6, h.top - 10, w + 12, 26, 1.2),
      bay: quad(r, h.x0 + 14, h.top + 36, w - 28, 740 - h.top, 1.2),
      bayShade: quad(r, h.x0 + 14, h.top + 36, 10, 740 - h.top, 0.8),
      wins,
      lintels,
      door: quad(r, doorX, 778, 38, 70, 0.8),
      doorArch: quad(r, doorX - 6, 768, 50, 12, 0.6),
      stoop,
      rail: line([doorX - 16, 812, doorX - 16 - 50, 892]),
      garden: quad(r, h.x0 + 22, 858, 46, 34, 0.8),
      seat: [doorX - 14 - 12 * 1.5, 862] as P,
    };
  });

  // street furniture and the street
  const sidewalk = quad(r, -540, GROUND, 2080, 52, 0.5);
  const curb = quad(r, -540, 950, 2080, 12, 0.5);
  const road = poly([-540, 962, 1540, 962, 1540, 1600, -540, 1600]);
  const zebra = new Path2D();
  const bands = [[975, 990], [1004, 1024], [1042, 1068], [1090, 1122], [1146, 1186]];
  for (const [y0, y1] of bands) {
    const k0 = (y0 - 962) / 240, k1 = (y1 - 962) / 240;
    zebra.addPath(poly([560 - 40 * k0, y0, 760 + 40 * k0, y0, 760 + 40 * k1, y1, 560 - 40 * k1, y1]));
  }
  const laneMarks = new Path2D();
  for (let x = -500; x < 1520; x += 120) if (x < 470 || x > 820) laneMarks.addPath(quad(r, x, 1088, 64, 7, 0.6));
  // street lamps; the one at 520, by the crossing, is the one each plate changes
  const lamps = [-200, 520, 1170].map((x) => ({
    x,
    pole: line([x, 942, x, 600]),
    arm: line([x, 612, x + 8, 596, x + 16, 590]),
    lantern: poly([x - 14, 560, x + 14, 560, x + 18, 596, x - 18, 596]),
    cap: poly([x - 20, 562, x, 544, x + 20, 562]),
  }));

  // trees: a big one in front of the first house, a small one by the third
  const tree = (cx: number, cy: number, rx: number, ry: number, trunkX: number) => {
    const leaves = [blob(r, cx, cy, rx, ry, 14, 0.12)];
    const dark: Path2D[] = [], light: Path2D[] = [];
    for (let i = 0; i < 9; i++) {
      const a = r() * Math.PI * 2, d = r() * 0.6;
      const x = cx + Math.cos(a) * rx * d, y = cy + Math.sin(a) * ry * d;
      (y > cy - ry * 0.1 && x > cx - rx * 0.3 ? dark : light).push(blob(r, x, y, rx * (0.22 + r() * 0.14), ry * (0.2 + r() * 0.12), 9, 0.2));
    }
    const trunk = poly([trunkX - 7, 944, trunkX - 4, cy + ry * 0.2, trunkX + 4, cy + ry * 0.2, trunkX + 7, 944]);
    const branches = new Path2D();
    const grow = (x: number, y: number, a: number, len: number, depth: number) => {
      const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
      branches.moveTo(x, y);
      branches.lineTo(x2, y2);
      if (depth > 0) {
        grow(x2, y2, a - 0.35 - r() * 0.3, len * (0.66 + r() * 0.1), depth - 1);
        grow(x2, y2, a + 0.35 + r() * 0.3, len * (0.66 + r() * 0.1), depth - 1);
      }
    };
    grow(trunkX, cy + ry * 0.4, -Math.PI / 2, ry * 0.55, 5);
    return { leaves, dark, light, trunk, branches };
  };
  const trees = [tree(-300, 640, 112, 104, -300), tree(96, 610, 128, 120, 96), tree(418, 690, 78, 74, 418)];

  // Trinity Church, across the square to the right of the tower
  const arch = (x: number, y: number, w: number, h: number) => {
    const p = new Path2D();
    p.moveTo(x, y + h);
    p.lineTo(x, y + w / 2);
    p.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0);
    p.lineTo(x + w, y + h);
    p.closePath();
    return p;
  };
  const churchArches = new Path2D();
  for (const x of [1066, 1112, 1376, 1422]) churchArches.addPath(arch(x, 700, 28, 70));
  for (const x of [1206, 1244, 1282]) churchArches.addPath(arch(x, 452, 22, 92));
  const churchDoors = new Path2D();
  for (const x of [1196, 1240, 1284]) churchDoors.addPath(arch(x, 806, 36, 94));
  const church = {
    nave: quad(r, 1040, 646, 440, GROUND - 646, 1),
    gable: poly([1030, 650, 1262, 524, 1494, 650]),
    tower: quad(r, 1180, 404, 164, 250, 1),
    roof: poly([1166, 408, 1262, 252, 1358, 408]),
    turrets: [poly([1170, 410, 1182, 360, 1194, 410]), poly([1330, 410, 1342, 360, 1354, 410])],
    band: quad(r, 1040, 790, 440, 10, 0.6),
    rose: circle(1262, 600, 26),
    arches: churchArches,
    doors: churchDoors,
  };

  return { sky, far, church, pru, pruCrown, pruMast, pruBands, hancock, hancockLines, tower, towerCap, cells, billFrame, billScreen, cafeSign, awning, cafeGlass, cafeDoor, counter, houses, sidewalk, curb, road, zebra, laneMarks, lamps, trees };
}

let street: ReturnType<typeof buildStreet> | null = null;

/* --- people and things ------------------------------------------------------ */

interface Who {
  x: number;
  y: number; // feet, or the seat when sitting
  s?: number;
  dir?: 1 | -1;
  pose?: 'walk' | 'stand' | 'sit';
  coat: Spec;
  legs?: Spec;
  skin?: number;
  hair?: number;
  phone?: boolean;
  mask?: boolean;
  torch?: boolean;
  book?: boolean;
  reach?: boolean;
  bag?: boolean;
  box?: boolean; // carrying a cardboard box of their things out of work
  slump?: boolean; // head hung
  lit?: boolean; // face lit by the phone they are staring into
  uniform?: boolean; // a peaked cap and the emblem on the chest
  hazmat?: boolean; // a protective suit, hood and visor
  stoop?: number; // sitting on this house's stoop (x and y are then ignored)
}
interface Drawn { who: Who; hand: P; head: P; H: number; d: number }

function person(pl: Plate, w: Who): Drawn {
  const H = 118 * (w.s ?? 1), d = w.dir ?? 1, x = w.x, pose = w.pose ?? 'walk';
  const legs = w.legs ?? (w.hazmat ? w.coat : DARK);
  const sit = pose === 'sit';
  const hipY = sit ? w.y - 0.02 * H : w.y - 0.46 * H;
  const top = hipY - 0.33 * H;
  const bot = sit ? hipY + 0.02 * H : hipY + 0.08 * H;

  // legs and shoes
  const lp = new Path2D();
  const feet: P[] = [];
  if (sit) {
    for (const o of [-0.03, 0.03]) {
      const k: P = [x + d * 0.2 * H + o * H, hipY - 0.01 * H];
      const f: P = [x + d * 0.24 * H + o * H, w.y + 0.26 * H];
      lp.moveTo(x + o * H, hipY); lp.lineTo(k[0], k[1]); lp.lineTo(f[0], f[1]);
      feet.push(f);
    }
  } else {
    const spread = pose === 'walk' ? [0.13, -0.11] : [0.045, -0.045];
    for (const o of spread) {
      const f: P = [x + d * o * H, w.y];
      lp.moveTo(x + d * o * 0.25 * H, hipY); lp.lineTo(f[0], f[1]);
      feet.push(f);
    }
  }
  pl.stroke(legs, lp, 0.085 * H);
  for (const f of feet) pl.fill(DARK, ellipse(f[0] + d * 0.03 * H, f[1], 0.06 * H, 0.028 * H));

  // arms: the back one behind the coat, the front one over it
  const shF: P = [x + d * 0.1 * H, top + 0.05 * H];
  const shB: P = [x - d * 0.1 * H, top + 0.05 * H];
  let handB: P = pose === 'walk' ? [x - d * 0.15 * H, hipY + 0.01 * H] : [x - d * 0.12 * H, hipY + 0.04 * H];
  let hand: P = pose === 'walk' ? [x + d * 0.17 * H, hipY + 0.02 * H] : [x + d * 0.12 * H, hipY + 0.05 * H];
  if (sit) hand = [x + d * 0.2 * H, hipY - 0.07 * H];
  if (w.phone || w.book) hand = [x + d * 0.13 * H, top + 0.13 * H];
  if (w.torch) hand = [x + d * 0.27 * H, hipY - 0.07 * H];
  if (w.reach) hand = [x + d * 0.2 * H, top - 0.3 * H];
  if (w.box) {
    hand = [x + d * 0.2 * H, top + 0.3 * H];
    handB = [x + d * 0.06 * H, top + 0.32 * H];
  }
  // gloves on a protective suit
  const skin = w.hazmat ? DARK : SKIN[w.skin ?? 0];
  pl.stroke(w.coat, line([shB[0], shB[1], handB[0], handB[1]]), 0.075 * H);
  pl.stroke({ b: 0.18 }, line([shB[0], shB[1], handB[0], handB[1]]), 0.075 * H, true);
  pl.fill(skin, circle(handB[0], handB[1], 0.035 * H));
  if (w.bag) pl.fill({ y: 0.35, r: 0.2 }, quad(still, handB[0] - 0.07 * H, handB[1], 0.14 * H, 0.16 * H, 0.5));

  const torso = new Path2D();
  torso.moveTo(x - 0.13 * H, top + 0.05 * H);
  torso.quadraticCurveTo(x - 0.13 * H, top, x - 0.07 * H, top);
  torso.lineTo(x + 0.07 * H, top);
  torso.quadraticCurveTo(x + 0.13 * H, top, x + 0.13 * H, top + 0.05 * H);
  torso.lineTo(x + 0.16 * H, bot);
  torso.lineTo(x - 0.16 * H, bot);
  torso.closePath();
  pl.fill(w.coat, torso);

  pl.stroke(w.coat, line([shF[0], shF[1], hand[0], hand[1]]), 0.075 * H);
  pl.fill(skin, circle(hand[0], hand[1], 0.035 * H));
  if (w.phone) pl.fill(DARK, round(hand[0] - 0.025 * H, hand[1] - 0.07 * H, 0.05 * H, 0.08 * H, 0.01 * H));
  if (w.book) pl.fill({ r: 0.95 }, quad(still, hand[0] - 0.06 * H, hand[1] - 0.05 * H, 0.12 * H, 0.09 * H, 0.3));
  if (w.torch) pl.fill(DARK, round(hand[0] - 0.02 * H, hand[1] - 0.02 * H, 0.07 * H, 0.04 * H, 0.01 * H));
  if (w.uniform) emblem(pl, x + d * 0.05 * H, top + 0.12 * H, 0.1 * H, DARK, WHITE);
  if (w.box) {
    // a desk plant, then the box it sits in
    const bx = x + d * 0.17 * H;
    pl.fill(LEAF, blob(still, bx - d * 0.05 * H, top + 0.05 * H, 0.07 * H, 0.1 * H, 8, 0));
    pl.fill(LEAF_DARK, blob(still, bx + d * 0.05 * H, top + 0.08 * H, 0.05 * H, 0.07 * H, 8, 0));
    pl.fill({ y: 0.62, r: 0.42, b: 0.14 }, quad(still, bx - 0.17 * H, top + 0.12 * H, 0.34 * H, 0.26 * H, 0));
    pl.stroke({ y: 0.7, r: 0.55, b: 0.3 }, line([bx - 0.17 * H, top + 0.17 * H, bx + 0.17 * H, top + 0.17 * H]), 0.025 * H);
  }

  // head: the hair is a circle behind the face, set back
  const down = (w.phone || w.book ? 0.02 : 0) + (w.slump ? 0.04 : 0);
  const hx = x + d * (0.01 + (w.slump ? 0.035 : 0)) * H;
  const hy = top - 0.12 * H + down * H;
  if (w.hazmat) {
    // a hood, a dark visor and a filter
    pl.fill(w.coat, circle(hx, hy, 0.11 * H));
    pl.fill(GLASS_DARK, ellipse(hx + d * 0.035 * H, hy - 0.005 * H, 0.06 * H, 0.045 * H));
    pl.fill(DARK, circle(hx + d * 0.07 * H, hy + 0.06 * H, 0.032 * H));
    return { who: w, hand, head: [hx, hy], H, d };
  }
  pl.fill(HAIR[w.hair ?? 0], circle(hx - d * 0.016 * H, hy - 0.014 * H, 0.1 * H));
  pl.fill(skin, circle(hx + d * 0.014 * H, hy + 0.012 * H, 0.084 * H));
  if (w.mask) pl.fill({ b: 0.06 }, round(hx + d * 0.03 * H - 0.055 * H, hy + 0.02 * H, 0.11 * H, 0.06 * H, 0.02 * H));
  if (w.uniform) {
    // a peaked cap
    pl.fill(DARK, round(hx - 0.1 * H, hy - 0.11 * H, 0.2 * H, 0.08 * H, 0.02 * H));
    pl.fill(DARK, poly([hx, hy - 0.04 * H, hx + d * 0.15 * H, hy - 0.035 * H, hx + d * 0.08 * H, hy - 0.06 * H]));
  }
  return { who: w, hand, head: [hx, hy], H, d };
}

/** The glow a person carries: a phone screen, a torch beam. */
function personGlow(pl: Plate, p: Drawn) {
  const [x, y] = p.hand, H = p.H, d = p.d;
  if (p.who.phone) {
    pl.fill({ b: 0.2 }, round(x - 0.018 * H, y - 0.062 * H, 0.036 * H, 0.06 * H, 0.006 * H));
    if (p.who.lit) {
      // the cold light of the screen on the face
      const [hx, hy] = p.head;
      pl.fill({ b: 0.3, y: 0.04 }, circle(hx + d * 0.014 * H, hy + 0.012 * H, 0.084 * H));
      pl.fill({ b: 0.08 }, round(x - 0.03 * H, y - 0.08 * H, 0.06 * H, 0.09 * H, 0.01 * H));
    }
  }
  if (p.who.torch) {
    const beam = poly([x + d * 0.05 * H, y - 0.01 * H, x + d * 0.75 * H, y - 0.2 * H, x + d * 0.8 * H, y + 0.32 * H]);
    pl.fill({ y: { x, y, r: 0.85 * H, from: 0.8, to: 0.08 }, b: { x, y, r: 0.85 * H, from: 0, to: 0.45 }, r: { x, y, r: 0.85 * H, from: 0, to: 0.2 } }, beam);
  }
}

function rover(pl: Plate, x: number, y: number, s = 1) {
  pl.fill({ b: 0.14 }, round(x - 26 * s, y - 40 * s, 52 * s, 30 * s, 7 * s));
  pl.stroke(DARK, line([x - 22 * s, y - 31 * s, x + 22 * s, y - 31 * s]), 2 * s);
  for (const o of [-16, 0, 16]) pl.fill(DARK, circle(x + o * s, y - 6 * s, 7 * s));
  pl.stroke(DARK, line([x + 18 * s, y - 40 * s, x + 18 * s, y - 84 * s]), 2 * s);
  pl.fill({ r: 0.95 }, poly([x + 18 * s, y - 84 * s, x + 38 * s, y - 78 * s, x + 18 * s, y - 72 * s]));
}

/** A robot on two legs, walking to work: the one that took the job. */
function bot(pl: Plate, x: number, y: number, s = 1, d: 1 | -1 = 1, briefcase = false) {
  const H = 118 * s;
  const METAL: Spec = { y: 0.9, r: 0.22 };
  const hipY = y - 0.46 * H, top = hipY - 0.33 * H;
  const lp = new Path2D();
  for (const o of [0.12, -0.1]) { lp.moveTo(x + d * o * 0.25 * H, hipY); lp.lineTo(x + d * o * H, y); }
  pl.stroke(DARK, lp, 0.07 * H);
  for (const o of [0.12, -0.1]) pl.fill(DARK, round(x + d * o * H - 0.05 * H, y - 0.03 * H, 0.11 * H, 0.04 * H, 0.01 * H));
  const shB: P = [x - d * 0.12 * H, top + 0.06 * H], shF: P = [x + d * 0.12 * H, top + 0.06 * H];
  const handB: P = [x - d * 0.15 * H, hipY + 0.02 * H], hand: P = [x + d * 0.16 * H, hipY + 0.04 * H];
  pl.stroke(DARK, line([shB[0], shB[1], handB[0], handB[1]]), 0.055 * H);
  pl.fill(METAL, round(x - 0.15 * H, top, 0.3 * H, 0.4 * H, 0.05 * H));
  pl.over({ r: 0.3 }, round(x - d * 0.15 * H - (d < 0 ? 0.06 * H : 0), top, 0.06 * H, 0.4 * H, 0.03 * H));
  pl.fill(DARK, round(x - 0.07 * H, top + 0.1 * H, 0.14 * H, 0.08 * H, 0.015 * H));
  pl.stroke(DARK, line([shF[0], shF[1], hand[0], hand[1]]), 0.055 * H);
  if (briefcase) pl.fill(DARK, round(hand[0] - 0.08 * H, hand[1], 0.16 * H, 0.12 * H, 0.015 * H));
  // the face from the screen on the tower: dark, two lit eyes, a mouth, an antenna
  const hx = x + d * 0.01 * H, hy = top - 0.13 * H;
  pl.stroke(DARK, line([hx, hy - 0.1 * H, hx, hy - 0.2 * H]), 0.025 * H);
  pl.fill({ r: 0.95 }, circle(hx, hy - 0.21 * H, 0.035 * H));
  pl.fill(DARK, round(hx - 0.11 * H, hy - 0.1 * H, 0.22 * H, 0.2 * H, 0.04 * H));
  pl.glow(() => {
    for (const o of [-0.045, 0.045]) pl.fill({ y: 0.95 }, circle(hx + d * 0.015 * H + o * H, hy - 0.025 * H, 0.025 * H));
    pl.fill({ y: 0.95 }, round(hx + d * 0.015 * H - 0.04 * H, hy + 0.04 * H, 0.08 * H, 0.018 * H, 0.009 * H));
  });
}

function drone(pl: Plate, x: number, y: number, s = 1, load = false) {
  if (load) {
    // a parcel on a line
    pl.stroke(DARK, line([x, y, x, y + 14 * s]), 1.5 * s);
    pl.fill({ y: 0.62, r: 0.42, b: 0.14 }, quad(still, x - 10 * s, y + 14 * s, 20 * s, 16 * s, 0));
  }
  const arms = new Path2D();
  arms.moveTo(x - 30 * s, y - 6 * s); arms.lineTo(x + 30 * s, y - 6 * s);
  pl.stroke(DARK, arms, 4 * s);
  pl.fill(DARK, round(x - 12 * s, y - 10 * s, 24 * s, 12 * s, 4 * s));
  for (const o of [-30, 30]) pl.fill({ b: 0.3 }, ellipse(x + o * s, y - 10 * s, 18 * s, 3.5 * s));
  pl.stroke(DARK, line([x - 4 * s, y + 2 * s, x - 2 * s, y + 10 * s]), 2 * s);
}

function camera(pl: Plate, x: number, y: number, d: 1 | -1) {
  pl.stroke(DARK, line([x, y, x + d * 10, y + 8]), 3);
  pl.fill(DARK, poly([x + d * 6, y + 2, x + d * 34, y + 10, x + d * 32, y + 24, x + d * 4, y + 16]));
}

/** A beam of attention: from a camera or a drone down to whoever it is on. */
function watch(pl: Plate, from: P, to: P, spread: number) {
  const [x0, y0] = from, [x1, y1] = to;
  const a = Math.atan2(y1 - y0, x1 - x0) + Math.PI / 2;
  const dx = Math.cos(a) * spread, dy = Math.sin(a) * spread;
  pl.over({ y: 0.7 }, poly([x0, y0, x1 + dx, y1 + dy, x1 - dx, y1 - dy]));
}

/** The one emblem: an eye, on everything. */
function emblem(pl: Plate, x: number, y: number, w: number, ink: Spec, ground: Spec) {
  const p = new Path2D();
  p.moveTo(x - w / 2, y);
  p.quadraticCurveTo(x, y - w * 0.62, x + w / 2, y);
  p.quadraticCurveTo(x, y + w * 0.62, x - w / 2, y);
  p.closePath();
  pl.fill(ground, p);
  pl.stroke(ink, p, Math.max(1.5, w * 0.07));
  pl.fill(ink, circle(x, y, w * 0.19));
  pl.fill(ground, circle(x + w * 0.05, y - w * 0.05, w * 0.06));
}

/** The biohazard sign, roughly: three hooked crescents round a ring. */
function biohazard(pl: Plate, x: number, y: number, R: number, ink: Spec, ground: Spec) {
  const at = (k: number, dist: number): P => {
    const a = -Math.PI / 2 + (k * Math.PI * 2) / 3;
    return [x + Math.cos(a) * dist, y + Math.sin(a) * dist];
  };
  for (let k = 0; k < 3; k++) pl.fill(ink, circle(...at(k, R * 0.45), R * 0.55));
  for (let k = 0; k < 3; k++) pl.fill(ground, circle(...at(k, R * 0.62), R * 0.4));
  pl.stroke(ink, circle(x, y, R * 0.36), R * 0.12);
  pl.fill(ground, circle(x, y, R * 0.16));
  for (let k = 0; k < 3; k++) {
    const [ex, ey] = at(k + 0.5, R * 0.5);
    pl.stroke(ground, line([x, y, ex, ey]), R * 0.07);
  }
}

/** A car; `a` tilts it, for one that has been knocked sideways. */
function car(pl: Plate, x: number, y: number, d: 1 | -1, paint: Spec, a = 0, lights = false) {
  const c = Math.cos(a), sn = Math.sin(a);
  const at = (px: number, py: number): P => [x + d * px * c - py * sn, y + d * px * sn + py * c];
  const shape = (pts: number[]) => poly(pts.flatMap((v, k) => (k % 2 ? [] : at(v, pts[k + 1]))));
  pl.fill(paint, shape([0, -16, 2, -50, 40, -58, 196, -58, 228, -46, 230, -16]));
  pl.fill(paint, shape([52, -56, 78, -94, 156, -94, 182, -56]));
  pl.fill(GLASS_DARK, shape([62, -58, 82, -88, 114, -88, 114, -58]));
  pl.fill(GLASS_DARK, shape([122, -58, 122, -88, 152, -88, 172, -58]));
  pl.fill(DARK, shape([0, -26, 230, -26, 230, -16, 0, -16]));
  for (const wx of [48, 182]) {
    pl.fill(DARK, circle(...at(wx, -12), 21));
    pl.fill({ b: 0.2, r: 0.1 }, circle(...at(wx, -12), 8));
  }
  pl.glow(() => {
    // hazard lights, and headlights still on
    for (const hx of [4, 226]) pl.fill({ y: 0.95, r: 0.55 }, circle(...at(hx, -42), 7));
    if (lights) {
      const [lx, ly] = at(228, -40);
      const [fx, fy] = at(420, 10), [gx, gy] = at(420, -90);
      pl.over({ y: { x: lx, y: ly, r: 200, from: 0.55, to: 0 } }, poly([lx, ly, fx, fy, gx, gy]));
      pl.fill({ y: 0.6 }, circle(lx, ly, 8));
    }
  });
}

/** A striped barrier on two legs, with a lamp on top. */
function barrier(pl: Plate, x: number, y: number, w: number) {
  pl.stroke(DARK, line([x + 10, y, x + 22, y - 62, x + 34, y]), 5);
  pl.stroke(DARK, line([x + w - 34, y, x + w - 22, y - 62, x + w - 10, y]), 5);
  const board = quad(still, x, y - 70, w, 24, 0.6);
  pl.fill(WHITE, board);
  pl.clip(board, () => {
    for (let sx = x - 30; sx < x + w; sx += 36) pl.fill({ r: 0.95 }, poly([sx, y - 46, sx + 18, y - 46, sx + 42, y - 70, sx + 24, y - 70]));
  });
  pl.stroke(DARK, board, 2.5);
  pl.glow(() => pl.fill({ y: 0.95, r: 0.45 }, circle(x + 22, y - 78, 7)));
}

function ambulance(pl: Plate, x: number, y: number, flashing = false) {
  if (flashing) {
    // the lights on the roof, flashing red and blue
    pl.fill(DARK, quad(still, x + 120, y - 162, 60, 12, 0));
    pl.glow(() => {
      pl.over({ r: { x: x + 130, y: y - 166, r: 90, from: 0.75, to: 0 } }, circle(x + 130, y - 166, 90));
      pl.over({ b: { x: x + 172, y: y - 166, r: 90, from: 0.75, to: 0 } }, circle(x + 172, y - 166, 90));
      pl.fill({ r: 0.95 }, round(x + 120, y - 174, 20, 14, 4));
      pl.fill({ b: 0.95 }, round(x + 160, y - 174, 20, 14, 4));
    });
  }
  pl.fill({ b: 0.05 }, round(x, y - 150, 190, 124, 10));
  pl.fill({ b: 0.05 }, poly([x + 190, y - 108, x + 236, y - 108, x + 262, y - 66, x + 262, y - 26, x + 190, y - 26]));
  pl.fill({ b: 0.55, r: 0.06 }, poly([x + 198, y - 100, x + 232, y - 100, x + 252, y - 68, x + 198, y - 68]));
  pl.fill({ r: 0.95 }, quad(still, x, y - 62, 262, 14, 0.4));
  pl.fill({ r: 0.95 }, poly([x + 80, y - 118, x + 100, y - 118, x + 100, y - 104, x + 114, y - 104, x + 114, y - 84, x + 100, y - 84, x + 100, y - 70, x + 80, y - 70, x + 80, y - 84, x + 66, y - 84, x + 66, y - 104, x + 80, y - 104]));
  for (const wx of [50, 214]) {
    pl.fill(DARK, circle(x + wx, y - 22, 26));
    pl.fill({ b: 0.2, r: 0.1 }, circle(x + wx, y - 22, 10));
  }
}

/* --- the screen on the tower ------------------------------------------------ */

type Bill = (pl: Plate, r: R) => void;
const B = BILL, cx = B.x + B.w / 2, cy = B.y + B.h / 2;
const screen = (pl: Plate, spec: Spec) => pl.fill(spec, street!.billScreen);

// Pictures, not words: the captions do the talking.
const BILLS: Record<string, Bill> = {
  // an assistant, typing
  assistant: (pl) => {
    screen(pl, { b: 0.62 });
    pl.fill(WHITE, round(B.x + 44, B.y + 40, B.w - 88, 88, 22));
    pl.fill(WHITE, poly([B.x + 80, B.y + 124, B.x + 112, B.y + 124, B.x + 70, B.y + 154]));
    for (const dx of [-38, 0, 38]) pl.fill(DARK, circle(cx + dx, B.y + 84, 11));
  },
  // a robot's face
  robot: (pl) => {
    screen(pl, { y: 0.95 });
    pl.stroke(DARK, line([cx, B.y + 52, cx, B.y + 26]), 6);
    pl.fill({ r: 0.95 }, circle(cx, B.y + 22, 10));
    pl.fill(DARK, round(cx - 92, B.y + 92, 20, 40, 6));
    pl.fill(DARK, round(cx + 72, B.y + 92, 20, 40, 6));
    pl.fill(DARK, round(cx - 72, B.y + 50, 144, 116, 22));
    for (const dx of [-32, 32]) pl.fill({ y: 0.95 }, circle(cx + dx, B.y + 96, 15));
    pl.fill({ y: 0.95 }, round(cx - 34, B.y + 132, 68, 12, 6));
  },
  // a ballot going into a box, struck through: no say
  noSay: (pl) => {
    screen(pl, { b: 0.85, r: 0.2 });
    pl.fill(WHITE, quad(still, cx - 30, B.y + 26, 60, 64, 0));
    pl.stroke(DARK, line([cx - 16, B.y + 56, cx - 4, B.y + 70, cx + 18, B.y + 40]), 7);
    pl.fill(WHITE, quad(still, cx - 70, B.y + 80, 140, 84, 0));
    pl.fill(DARK, quad(still, cx - 42, B.y + 80, 84, 9, 0));
    pl.stroke({ r: 0.95, y: 0.2 }, circle(cx, cy + 4, 82), 14);
    pl.stroke({ r: 0.95, y: 0.2 }, line([cx - 58, cy + 62, cx + 58, cy - 54]), 14);
  },
  // the emblem, watching
  eye: (pl) => {
    screen(pl, { y: 0.06 });
    emblem(pl, cx, cy, 210, { b: 0.95 }, { y: 0.06 });
  },
  // garbled, and the lock open
  breach: (pl, r) => {
    screen(pl, { b: 0.7, r: 0.6 });
    const tones: Spec[] = [{ b: 0.5 }, { r: 0.6 }, { y: 0.9 }, WHITE, { b: 0.95, r: 0.2 }];
    for (let i = 0; i < 60; i++) {
      const y = B.y + r() * B.h, h = 2 + r() * 9;
      pl.fill(tones[(r() * tones.length) | 0], quad(r, B.x + r() * B.w * 0.5, y, 30 + r() * B.w * 0.5, h, 0.5));
    }
    // a padlock, its shackle sprung loose
    const sh = new Path2D();
    sh.moveTo(cx - 30, cy - 10);
    sh.lineTo(cx - 30, cy - 50);
    sh.arc(cx + 2, cy - 50, 32, Math.PI, 0);
    sh.lineTo(cx + 34, cy - 36);
    pl.stroke(DARK, sh, 18);
    pl.stroke(WHITE, sh, 9);
    pl.fill(DARK, round(cx - 52, cy - 16, 104, 84, 12));
    pl.fill({ r: 0.95 }, round(cx - 44, cy - 8, 88, 68, 9));
    pl.fill(DARK, circle(cx, cy + 18, 10));
    pl.fill(DARK, poly([cx - 5, cy + 20, cx + 5, cy + 20, cx + 8, cy + 44, cx - 8, cy + 44]));
  },
  // the biohazard sign
  biohazard: (pl) => {
    screen(pl, { y: 0.92 });
    biohazard(pl, cx, cy + 8, 78, DARK, { y: 0.92 });
  },
};

/* --- the plates -------------------------------------------------------------- */

type Mood = 'day' | 'dusk' | 'night' | 'gloom' | 'sick';
type WinState = 'day' | 'dark' | 'warm' | 'screen' | 'logo' | 'candle' | 'robot' | 'glitch';

interface Scene {
  mood: Mood;
  bill: keyof typeof BILLS;
  cafe: 'open' | 'auto' | 'closed' | 'dark';
  lamp: 'off' | 'on' | 'spark';
  trees: 'summer' | 'bare';
  windows: (r: R, kind: 'house' | 'tower') => WinState;
  farLights?: boolean;
  clouds?: boolean;
  people: Who[];
  /** things over the far city, behind the street */
  behind?: (pl: Plate, r: R) => void;
  /** things on the buildings, behind the trees: banners, boarded windows */
  facade?: (pl: Plate, r: R) => void;
  /** things on the street behind the people: benches, barriers */
  ground?: (pl: Plate, r: R) => void;
  /** things in front: robots, drones, cars, cameras */
  front?: (pl: Plate, r: R, drawn: Drawn[]) => void;
}

const pick = (r: R, odds: number, a: WinState, b: WinState) => (r() < odds ? a : b);

const SCENES: Scene[] = [
  // Today
  {
    mood: 'day', bill: 'assistant', cafe: 'open', lamp: 'off', trees: 'summer', clouds: true,
    windows: () => 'day',
    people: [
      { x: 170, y: 940, coat: COAT.red, dir: 1, hair: 1 },
      { x: 300, y: 930, coat: COAT.yellow, dir: -1, s: 0.94, skin: 2 },
      { x: 430, y: 938, coat: COAT.pink, dir: 1, s: 0.96, skin: 1, hair: 2, book: true },
      { x: 600, y: 1058, coat: COAT.blue, dir: 1, s: 1.25, skin: 3, hair: 3 },
      { x: 700, y: 1094, coat: COAT.green, dir: -1, s: 1.34, skin: 1 },
      { x: 880, y: 946, coat: COAT.orange, pose: 'stand', dir: -1, phone: true, hair: 1 },
      // further along, seen only in the full-screen opening
      { x: -380, y: 942, coat: COAT.green, dir: 1, skin: 2, hair: 3 },
      { x: -110, y: 946, coat: COAT.sky, pose: 'stand', dir: -1, phone: true, skin: 1 },
      { x: 1110, y: 946, coat: COAT.red, dir: -1, hair: 2 },
      { x: 1330, y: 940, coat: COAT.yellow, dir: 1, s: 0.96, skin: 3 },
      { x: 1250, y: 1060, coat: COAT.plum, dir: -1, s: 1.25, skin: 1 },
    ],
  },
  // Automation: robots cross to work where the commuters crossed; a robot at
  // every desk in the tower; the people leave with their things in a box
  {
    mood: 'day', bill: 'robot', cafe: 'auto', lamp: 'off', trees: 'summer', clouds: true,
    windows: (r, k) => (k === 'tower' ? pick(r, 0.8, 'robot', 'day') : 'day'),
    people: [
      { x: 900, y: 948, coat: COAT.grey, dir: -1, box: true, slump: true, hair: 2 },
      { x: 380, y: 942, coat: COAT.orange, dir: -1, box: true, slump: true, skin: 2 },
      { x: 200, y: 944, coat: COAT.pink, dir: -1, s: 0.96, box: true, slump: true, hair: 1 },
      { x: 0, y: 0, stoop: 3, coat: COAT.sky, dir: -1, slump: true, skin: 1, hair: 3 },
      { x: -380, y: 942, coat: COAT.green, dir: -1, box: true, slump: true, skin: 3 },
      { x: 1250, y: 946, coat: COAT.red, dir: -1, box: true, slump: true, hair: 2 },
    ],
    front: (pl) => {
      bot(pl, 600, 1058, 1.25, 1, true);
      bot(pl, 700, 1094, 1.34, -1, true);
      bot(pl, 1110, 946, 1, 1, true);
      rover(pl, 290, 948, 0.9);
      drone(pl, 240, 312, 1.1, true);
      drone(pl, 560, 236, 0.9, true);
      drone(pl, 420, 372, 0.7, true);
    },
  },
  // Gradual disempowerment: dusk, a screen in every window, everyone sitting
  // still in the blue light of a phone, while machines do the moving
  {
    mood: 'dusk', bill: 'noSay', cafe: 'auto', lamp: 'on', trees: 'summer', farLights: true,
    windows: (r) => pick(r, 0.86, 'screen', 'dark'),
    people: [
      ...[3, 4, 5].map((k, i) => ({ x: 0, y: 0, stoop: k, coat: [COAT.grey, COAT.plum, COAT.sky][i], dir: -1 as const, s: 0.9, phone: true, lit: true, skin: i, hair: i + 1 })),
      // on the bench outside the café
      ...[676, 750, 824].map((x, i) => ({ x, y: 916, pose: 'sit' as const, coat: [COAT.green, COAT.grey, COAT.pink][i], dir: 1 as const, s: 0.84, phone: true, lit: true, skin: 3 - i, hair: i })),
    ],
    ground: (pl) => {
      pl.fill({ r: 0.55, y: 0.45, b: 0.55 }, quad(still, 640, 910, 230, 10, 0.5));
      for (const x of [652, 852]) pl.stroke(DARK, line([x, 918, x, 948]), 5);
    },
    front: (pl) => {
      bot(pl, 660, 1124, 1.75, 1, true);
      bot(pl, 960, 948, 0.95, -1);
      bot(pl, -150, 948, 0.95, 1, true);
      rover(pl, 420, 948, 0.9);
      drone(pl, 300, 300, 1, true);
      drone(pl, 520, 222, 0.8, true);
    },
  },
  // Concentration of power: one emblem on every window, banner and chest;
  // ranks in step, searchlights, and a camera on the one who is not marching
  {
    mood: 'gloom', bill: 'eye', cafe: 'dark', lamp: 'on', trees: 'summer',
    windows: (r, k) => (k === 'tower' ? 'logo' : pick(r, 0.25, 'logo', 'dark')),
    people: [
      ...[[60, 942, 1], [170, 942, 1], [280, 942, 1], [560, 1010, 1.14], [650, 1050, 1.24], [740, 1090, 1.33]]
        .map(([x, y, s]) => ({ x, y, s, coat: COAT.blue, legs: { b: 0.95, r: 0.5 }, dir: 1 as const, uniform: true })),
      { x: 474, y: 944, coat: COAT.red, pose: 'stand', dir: -1, slump: true, skin: 2, hair: 1 },
    ],
    behind: (pl) => {
      // searchlights sweeping over the roofs
      pl.glow(() => {
        for (const [x0, x1] of [[60, -240], [300, 470]]) pl.fill({ y: 0.12, b: 0.34, r: 0.1 }, poly([x0 - 4, 900, x0 + 4, 900, x1 + 60, 0, x1 - 60, 0]));
      });
    },
    ground: (pl) => {
      // a drone's spotlight on the one who is not marching
      pl.glow(() => pl.fill({ y: 0.42 }, poly([462, 352, 478, 352, 530, 952, 414, 952])));
      // and the cameras' gaze
      watch(pl, [490, 656], [462, 950], 40);
      watch(pl, [572, 252], [490, 950], 34);
    },
    facade: (pl) => {
      for (const h of street!.houses.slice(3)) {
        const x = (h.x0 + h.x1) / 2, t = h.top + 18;
        pl.fill({ b: 0.95, r: 0.12 }, poly([x - 24, t, x + 24, t, x + 24, t + 230, x, t + 212, x - 24, t + 230]));
        emblem(pl, x, t + 40, 38, { b: 0.95 }, { y: 0.06 });
      }
    },
    front: (pl) => {
      camera(pl, 520, 640, -1);
      camera(pl, 602, 236, -1);
      drone(pl, 470, 346, 1.1);
      drone(pl, 150, 250, 0.8);
    },
  },
  // Cyber attacks: the power is out, every signal at once, cars meet in the
  // dark crossing, a fire in the city; people get about by torchlight
  {
    mood: 'night', bill: 'breach', cafe: 'dark', lamp: 'spark', trees: 'summer',
    windows: (r, k) => (k === 'house' ? pick(r, 0.14, 'candle', 'dark') : pick(r, 0.14, 'glitch', 'dark')),
    people: [
      { x: 430, y: 942, coat: COAT.yellow, dir: -1, torch: true, skin: 1 },
      { x: 930, y: 1110, coat: COAT.red, dir: -1, s: 1.3, torch: true, hair: 2 },
    ],
    behind: (pl, r) => {
      // a fire beyond the roofs: its light, its smoke, its flames
      // the smoke, dark against the sky, lit from below near the flames
      for (let k = 11; k >= 0; k--) {
        const t = k / 11;
        const puff = blob(r, 84 - t * 130 - t * t * 40, 350 - t * 250, 36 + t * 56, 30 + t * 34, 10, 0.16);
        if (t < 0.3) pl.glow(() => pl.fill({ r: 0.5, b: 0.42, y: 0.5 }, puff));
        else pl.fill({ r: 0.55, b: 0.6, y: 0.22 }, puff);
      }
      pl.glow(() => {
        pl.over({ r: { x: 90, y: 420, r: 280, from: 0.7, to: 0 }, y: { x: 90, y: 420, r: 280, from: 0.95, to: 0 } }, circle(90, 420, 280));
        for (const [x, h, w] of [[30, 90, 30], [70, 130, 36], [112, 100, 30], [150, 70, 24]]) {
          pl.fill({ r: 0.75, y: 0.95 }, poly([x - w, 410, x - w * 0.3, 410 - h * 0.55, x, 410 - h, x + w * 0.4, 410 - h * 0.5, x + w, 410]));
          pl.fill({ y: 0.95, r: 0.2 }, poly([x - w * 0.5, 410, x, 410 - h * 0.55, x + w * 0.5, 410]));
        }
      });
    },
    front: (pl) => {
      // two cars meet in the crossing, where the signals went wrong
      car(pl, 300, 1134, 1, COAT.orange, 0, true);
      car(pl, 770, 1128, -1, COAT.sky, 0.16, true);
      pl.glow(() => {
        const [x, y] = [548, 1062];
        const star: number[] = [];
        for (let k = 0; k < 16; k++) {
          const a = (k / 16) * Math.PI * 2, rad = k % 2 ? 22 : 50;
          star.push(x + Math.cos(a) * rad, y + Math.sin(a) * rad * 0.8);
        }
        pl.fill({ y: 0.95, r: 0.5 }, poly(star));
        pl.fill({ y: 0.9 }, circle(x, y, 14));
        // smoke from the bonnets
        for (const [sx, sy, rad] of [[540, 1000, 26], [556, 962, 34], [536, 918, 40]]) pl.fill({ r: 0.32, b: 0.45, y: 0.12 }, blob(still, sx, sy, rad, rad * 0.8, 9, 0));
      });
      // the signal on the lamp, every light on at once
      pl.stroke(DARK, line([520, 690, 538, 690]), 5);
      pl.fill(DARK, round(534, 650, 30, 82, 6));
      pl.glow(() => {
        for (const [k, c] of [[0, { r: 0.95, y: 0.3 }], [1, { y: 0.95, r: 0.4 }], [2, { b: 0.6, y: 0.95 }]] as const) {
          pl.over({ y: { x: 549, y: 666 + k * 25, r: 30, from: 0.5, to: 0 } }, circle(549, 666 + k * 25, 30));
          pl.fill(c, circle(549, 666 + k * 25, 9));
        }
      });
    },
  },
  // Biological risk: a sickly sky, the crossing barred, an ambulance, boarded
  // windows, and the only people out are in protective suits
  {
    mood: 'sick', bill: 'biohazard', cafe: 'closed', lamp: 'off', trees: 'bare',
    windows: (r, k) => (k === 'house' ? pick(r, 0.25, 'warm', 'dark') : pick(r, 0.6, 'dark', 'day')),
    people: [
      { x: 330, y: 944, coat: { y: 0.95 }, dir: -1, hazmat: true, bag: true, pose: 'stand' },
      { x: 600, y: 1112, coat: { y: 0.95 }, dir: 1, s: 1.3, hazmat: true },
      { x: 150, y: 942, coat: COAT.sky, dir: -1, mask: true, bag: true, skin: 2, s: 0.94 },
    ],
    facade: (pl, r) => {
      const WOOD: Spec = { y: 0.5, r: 0.2, b: 0.04 };
      const planks = (x: number, y: number, w: number, h: number) => {
        for (const p of [line([x - 4, y + 8, x + w + 4, y + h - 8]), line([x - 4, y + h - 8, x + w + 4, y + 8])]) {
          pl.stroke(DARK, p, 13);
          pl.stroke(WOOD, p, 8);
        }
      };
      for (const h of street!.houses) for (const w of h.wins) if (r() < 0.22) planks(w.x, w.y, w.w, w.h);
      planks(620, 806, 236, 90);
      // a warning on the doors
      for (const h of street!.houses.slice(3)) {
        const x = h.x0 + (h.x1 - h.x0) * 0.6 + 19;
        pl.fill({ y: 0.95 }, quad(still, x - 14, 788, 28, 28, 0));
        biohazard(pl, x, 802, 11, DARK, { y: 0.95 });
      }
    },
    ground: (pl) => {
      // tape along the sidewalk, then barriers across the road
      const tape: P[] = [[-460, 884], [-200, 896], [96, 880], [418, 892], [520, 880], [1170, 888], [1460, 880]];
      const tp = line(tape.flat());
      pl.stroke({ y: 0.95 }, tp, 9);
      for (let k = 0; k < tape.length - 1; k++) {
        const [x0, y0] = tape[k], [x1, y1] = tape[k + 1];
        for (let t = 0; t < 1; t += 26 / Math.hypot(x1 - x0, y1 - y0)) {
          const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
          pl.fill(DARK, poly([x, y - 4.5, x + 9, y - 4.5, x + 4, y + 4.5, x - 5, y + 4.5]));
        }
      }
      barrier(pl, 90, 1150, 190);
      barrier(pl, 330, 1150, 190);
    },
    front: (pl) => ambulance(pl, 700, 1086, true),
  },
];

const SKY: Record<Mood, Spec> = {
  day: { b: lin(0.44, 0.1) },
  dusk: { b: lin(0.6, 0.06), r: lin(0.16, 0.5), y: lin(0, 0.7) },
  night: { b: lin(0.58, 0.32), r: lin(0.22, 0.14) },
  gloom: { b: lin(0.66, 0.4), r: lin(0.5, 0.26), y: 0.08 },
  sick: { y: lin(0.62, 0.3), b: lin(0.3, 0.12), r: 0.08 },
};
// the light of each plate, added to everything that does not give off its own
const WASH: Record<Mood, Partial<Record<Ink, number>>> = {
  day: {},
  dusk: { r: 0.18, b: 0.26, y: 0.06 },
  night: { b: 0.64, r: 0.32 },
  gloom: { b: 0.3, r: 0.2 },
  sick: { y: 0.14, b: 0.06 },
};

export const PLATE_COUNT = SCENES.length;

export function drawPlate(i: number, pw: number, ph: number): Plate {
  const S = (street ??= buildStreet());
  const sc = SCENES[i];
  // each plate a little out of register, as real prints are
  const reg = (k: number): [number, number] => {
    const r = seeded(500 + i * 7 + k);
    return [jit(r, 2), jit(r, 2)];
  };
  const pl = new Plate(pw, ph, { r: reg(1), b: reg(2) });
  const r = seeded(100 + i * 31);
  pl.wash = WASH[sc.mood];

  // sky, and what is in it
  pl.fill(SKY[sc.mood], S.sky);
  if (sc.mood === 'day') pl.glow(() => pl.fill({ y: 0.95, r: 0.12 }, circle(250, 292, 50)));
  if (sc.mood === 'dusk') pl.glow(() => pl.fill({ y: 0.95, r: 0.58 }, circle(290, 350, 62)));
  if (sc.mood === 'night') {
    pl.glow(() => {
      for (let k = 0; k < 44; k++) {
        const x = r() * 1000, y = 190 + r() * 230;
        if (x > 590 && y > 100) continue;
        pl.fill({ y: 0.9 }, circle(x, y, 1.5 + r() * 2.5));
      }
      pl.fill({ y: 0.92 }, circle(250, 270, 38));
    });
    pl.fill(SKY.night, circle(265, 262, 34)); // the shadow that makes it a crescent
  }
  if (sc.clouds) {
    for (const [x, y, w] of [[-280, 220, 130], [110, 236, 120], [440, 206, 96], [1230, 200, 120]]) {
      for (let k = 0; k < 4; k++) pl.fill({ b: 0.04 }, blob(r, x + (k - 1.5) * w * 0.35, y + Math.abs(k - 1.5) * 8, w * 0.32, w * 0.2, 10, 0.12));
    }
  }
  // far city
  for (const f of S.far) {
    pl.fill({ b: 0.36, r: 0.12, y: 0.06 }, f.body);
    if (sc.farLights) pl.glow(() => pl.fill({ y: 0.85, r: 0.12 }, f.dots));
    else pl.over({ b: 0.18 }, f.dots);
  }
  pl.fill({ b: 0.36, r: 0.06 }, S.hancock);
  pl.stroke({ b: 0.2 }, S.hancockLines, 1.5, true);
  pl.fill({ b: 0.3, r: 0.2, y: 0.18 }, S.pru);
  pl.fill({ b: 0.3, r: 0.2, y: 0.18 }, S.pruCrown);
  pl.over({ b: 0.2, r: 0.1 }, S.pruBands);
  pl.stroke({ b: 0.5, r: 0.4 }, S.pruMast, 3);
  sc.behind?.(pl, r);

  // the tower, its windows and its screen
  pl.fill(GLASS, S.tower);
  const towerStates = S.cells.map(() => sc.windows(r, 'tower'));
  S.cells.forEach((c, k) => pl.fill(towerStates[k] === 'day' ? { b: 0.66, r: 0.1 } : GLASS_DARK, c.path));
  pl.clip(S.tower, () => {
    for (let x = 760; x < 1300; x += 170) pl.fill({ b: 0.3 }, poly([x, 112, x + 46, 112, x - 230, GROUND, x - 276, GROUND]));
  });
  pl.glow(() => S.cells.forEach((c, k) => glowWindow(pl, r, c, towerStates[k], false)));
  pl.fill(DARK, S.towerCap);
  pl.fill(DARK, S.billFrame);
  for (const bx of [BILL.x + 30, BILL.x + BILL.w - 30]) pl.stroke(DARK, line([bx, BILL.y + BILL.h + 12, bx, BILL.y + BILL.h + 32]), 6);
  pl.glow(() => BILLS[sc.bill](pl, r));

  // the church
  const C = S.church;
  const granite: Spec = { r: 0.42, y: 0.5, b: 0.14 };
  const roof: Spec = { r: 0.7, b: 0.62, y: 0.32 };
  pl.fill(roof, C.gable);
  pl.fill(granite, C.nave);
  pl.fill({ r: 0.7, y: 0.6, b: 0.3 }, C.band);
  pl.fill(roof, C.roof);
  for (const t of C.turrets) pl.fill(roof, t);
  pl.fill(granite, C.tower);
  pl.over({ b: 0.16 }, quad(still, 1180, 404, 40, 250, 0));
  pl.fill(GLASS_DARK, C.arches);
  pl.fill(GLASS_DARK, C.rose);
  pl.stroke({ r: 0.7, y: 0.6, b: 0.3 }, C.rose, 4);
  pl.fill({ r: 0.75, b: 0.7, y: 0.3 }, C.doors);

  // the café
  pl.fill(DARK, S.cafeSign);
  S.awning.forEach((a, k) => pl.fill(k % 2 ? WHITE : { r: 0.95 }, a));
  const lit = sc.cafe === 'open' || sc.cafe === 'auto';
  const inside: Spec = lit ? { y: 0.42, r: 0.12 } : { b: 0.72, r: 0.38 };
  pl.glow(() => {
    pl.fill(inside, S.cafeGlass);
    pl.fill(inside, S.cafeDoor);
  });
  if (sc.cafe === 'open') person(pl, { x: 720, y: 878, s: 0.62, coat: { r: 0.95 }, pose: 'stand', dir: 1, skin: 1 });
  if (lit) pl.fill(STONE, S.counter);
  if (sc.cafe === 'auto') {
    pl.stroke({ b: 0.55, r: 0.3 }, line([700, 862, 712, 818, 760, 812, 772, 836]), 9);
    pl.fill(DARK, circle(712, 818, 7));
    pl.fill(DARK, circle(760, 812, 7));
    pl.fill(WHITE, round(764, 838, 18, 22, 3));
  }
  if (sc.cafe === 'closed') {
    // a no-entry sign on the door
    pl.fill({ r: 0.95 }, circle(907, 838, 15));
    pl.fill(WHITE, round(897, 835, 20, 6, 2));
  }
  pl.stroke(DARK, S.cafeGlass, 5);
  pl.stroke(DARK, S.cafeDoor, 5);

  // the brownstones
  for (const h of S.houses) {
    pl.fill(BRICK, h.facade);
    pl.fill({ r: 0.66, y: 0.56, b: 0.12 }, h.bay);
    pl.over({ b: 0.22 }, h.bayShade);
    pl.fill(CORNICE, h.cornice);
    pl.fill(STONE, h.lintels);
    const states = h.wins.map(() => sc.windows(r, 'house'));
    h.wins.forEach((w, k) => {
      pl.fill(states[k] === 'day' ? GLASS : GLASS_DARK, w.path);
      if (states[k] === 'day') pl.fill({ b: 0.16 }, poly([w.x + 4, w.y + w.h - 10, w.x + w.w * 0.55, w.y + 4, w.x + w.w * 0.8, w.y + 4, w.x + 14, w.y + w.h - 4]));
      else pl.glow(() => glowWindow(pl, r, w, states[k], true));
      pl.stroke(WHITE, w.frame, 3.5);
    });
    pl.fill(STONE, h.doorArch);
    pl.fill(h.paint, h.door);
    pl.fill(STONE, h.stoop);
    pl.stroke(DARK, h.rail, 3);
    pl.fill(GLASS_DARK, h.garden);
  }
  sc.facade?.(pl, r);

  // the street
  pl.fill(SIDEWALK, S.sidewalk);
  pl.fill({ r: 0.2, y: 0.25, b: 0.3 }, S.curb);
  pl.fill(ROAD, S.road);
  pl.fill({ b: 0.06 }, S.zebra);
  pl.fill({ y: 0.9 }, S.laneMarks);
  if (lit && sc.mood !== 'day') pl.glow(() => pl.over({ y: { x: 740, y: 900, r: 220, from: 0.3, to: 0 } }, circle(740, 900, 220)));

  // trees and the lamp
  for (const t of S.trees) {
    pl.fill(BARK, t.trunk);
    if (sc.trees === 'bare') {
      pl.stroke(BARK, t.branches, 4);
      continue;
    }
    for (const l of t.leaves) pl.fill(LEAF, l);
    for (const l of t.light) pl.fill(LEAF_LIGHT, l);
    for (const l of t.dark) pl.fill(LEAF_DARK, l);
  }
  for (const L of S.lamps) {
    pl.stroke(DARK, L.pole, 9);
    pl.stroke(DARK, L.arm, 5);
    pl.fill(DARK, L.cap);
    if (sc.lamp === 'on') {
      pl.glow(() => {
        pl.over({ y: { x: L.x, y: 580, r: 200, from: 0.5, to: 0 } }, circle(L.x, 580, 200));
        pl.fill({ y: 0.9 }, L.lantern);
      });
    } else pl.fill({ b: 0.32, r: 0.2 }, L.lantern);
    pl.stroke(DARK, L.lantern, 4);
    if (L.x === 520 && sc.lamp === 'spark') {
      pl.glow(() => {
        for (const [dx, dy, a] of [[-30, -10, 0.4], [26, -18, -0.3], [8, 30, 1.2], [-20, 26, 2.2]]) {
          const x = L.x + dx, y = 578 + dy;
          pl.stroke({ y: 0.95 }, line([x, y, x + Math.cos(a) * 14 + 4, y + Math.sin(a) * 14 - 6, x + Math.cos(a) * 26, y + Math.sin(a) * 26]), 3);
        }
        pl.fill({ y: 0.95, r: 0.3 }, circle(L.x, 578, 7));
      });
    }
  }

  // people, each with whatever light they carry, then whatever else is in front
  sc.ground?.(pl, r);
  const drawn = sc.people.map((w) => {
    const seat = w.stoop === undefined ? null : S.houses[w.stoop].seat;
    const d = person(pl, seat ? { ...w, pose: 'sit', x: seat[0], y: seat[1] } : w);
    pl.glow(() => personGlow(pl, d));
    return d;
  });
  sc.front?.(pl, r, drawn);
  return pl;
}

function glowWindow(pl: Plate, r: R, w: Win, s: WinState, house: boolean) {
  const at = w.inner;
  if (s === 'warm') {
    pl.fill({ y: 0.8, r: 0.16 }, at);
    if (house && r() < 0.5) silhouette(pl, w);
  }
  if (s === 'screen') {
    pl.fill({ b: 0.42, y: 0.06 }, at);
    const sw = w.w * 0.5, sh = w.h * 0.36;
    pl.fill({ b: 0.06 }, quad(r, w.x + (w.w - sw) / 2, w.y + w.h * 0.22, sw, sh, 0.4));
    if (house) silhouette(pl, w);
  }
  if (s === 'logo') {
    pl.fill({ y: 0.06 }, at);
    emblem(pl, w.x + w.w / 2, w.y + w.h / 2, w.w * 0.8, { b: 0.95 }, { y: 0.06 });
  }
  if (s === 'robot') {
    // a robot at the desk: a square head, an antenna, two lit eyes
    pl.fill({ y: 0.55, r: 0.1 }, at);
    const x = w.x + w.w / 2, y = w.y + w.h, hw = w.w * 0.42;
    pl.fill(DARK, round(x - w.w * 0.3, y - 8, w.w * 0.6, 8, 2));
    pl.fill(DARK, round(x - hw / 2, y - 30, hw, 20, 4));
    pl.stroke(DARK, line([x, y - 30, x, y - 36]), 2);
    for (const o of [-0.22, 0.22]) pl.fill({ y: 0.95 }, circle(x + o * hw, y - 21, 2.6));
  }
  if (s === 'glitch') {
    pl.fill({ b: 0.8, r: 0.5 }, at);
    const tones: Spec[] = [{ r: 0.9 }, { b: 0.6 }, WHITE, { y: 0.9 }];
    pl.clip(at, () => {
      for (let k = 0; k < 4; k++) pl.fill(tones[(r() * 4) | 0], quad(r, w.x + r() * w.w * 0.5, w.y + 3 + r() * (w.h - 10), 8 + r() * w.w * 0.6, 2 + r() * 5, 0.3));
    });
  }
  if (s === 'candle') {
    const x = w.x + w.w / 2, y = w.y + w.h - 14;
    pl.fill({ y: { x, y, r: 34, from: 0.85, to: 0.05 }, r: { x, y, r: 34, from: 0.2, to: 0 }, b: { x, y, r: 34, from: 0, to: 0.8 } }, at);
    pl.fill({ y: 0.95, r: 0.3 }, ellipse(x, y - 6, 3, 7));
  }
}

/** Someone at home, seen from the street: head and shoulders against the light. */
function silhouette(pl: Plate, w: Win) {
  const x = w.x + w.w * 0.5, y = w.y + w.h;
  const p = new Path2D();
  p.moveTo(x - w.w * 0.36, y);
  p.quadraticCurveTo(x - w.w * 0.32, y - 18, x, y - 18);
  p.quadraticCurveTo(x + w.w * 0.32, y - 18, x + w.w * 0.36, y);
  p.closePath();
  p.addPath(circle(x, y - 26, 9));
  pl.fill({ b: 0.88, r: 0.5 }, p);
}
