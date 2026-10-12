/**
 * The home page print: one corner of Boston's Back Bay, printed six times.
 * The same brownstones, office tower, café and crossing in every plate; what
 * changes is the light, the people, the windows and the screen on the tower.
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
const SEAT = 4; // the stoop someone sits on: the second house from the crossing
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
}
interface Drawn { who: Who; hand: P; head: P; H: number; d: number }

function person(pl: Plate, w: Who): Drawn {
  const H = 118 * (w.s ?? 1), d = w.dir ?? 1, x = w.x, pose = w.pose ?? 'walk';
  const legs = w.legs ?? DARK;
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
  const handB: P = pose === 'walk' ? [x - d * 0.15 * H, hipY + 0.01 * H] : [x - d * 0.12 * H, hipY + 0.04 * H];
  let hand: P = pose === 'walk' ? [x + d * 0.17 * H, hipY + 0.02 * H] : [x + d * 0.12 * H, hipY + 0.05 * H];
  if (sit) hand = [x + d * 0.2 * H, hipY - 0.07 * H];
  if (w.phone || w.book) hand = [x + d * 0.13 * H, top + 0.13 * H];
  if (w.torch) hand = [x + d * 0.27 * H, hipY - 0.07 * H];
  if (w.reach) hand = [x + d * 0.2 * H, top - 0.3 * H];
  const skin = SKIN[w.skin ?? 0];
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

  // head: the hair is a circle behind the face, set back
  const hx = x + d * 0.01 * H;
  const hy = top - 0.12 * H + (w.phone || w.book ? 0.02 * H : 0);
  pl.fill(HAIR[w.hair ?? 0], circle(hx - d * 0.016 * H, hy - 0.014 * H, 0.1 * H));
  pl.fill(skin, circle(hx + d * 0.014 * H, hy + 0.012 * H, 0.084 * H));
  if (w.mask) pl.fill({ b: 0.06 }, round(hx + d * 0.03 * H - 0.055 * H, hy + 0.02 * H, 0.11 * H, 0.06 * H, 0.02 * H));
  return { who: w, hand, head: [hx, hy], H, d };
}

/** The glow a person carries: a phone screen, a torch beam. */
function personGlow(pl: Plate, p: Drawn) {
  const [x, y] = p.hand, H = p.H, d = p.d;
  if (p.who.phone) {
    pl.fill({ b: 0.2 }, round(x - 0.018 * H, y - 0.062 * H, 0.036 * H, 0.06 * H, 0.006 * H));
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

function drone(pl: Plate, x: number, y: number, s = 1) {
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

function ambulance(pl: Plate, x: number, y: number) {
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
  // waiting, forever
  waiting: (pl) => {
    screen(pl, { b: 0.85, r: 0.2 });
    for (let k = 0; k < 12; k++) {
      const a = -Math.PI / 2 + (k / 12) * Math.PI * 2, f = k / 12;
      pl.fill({ b: 0.85 * f, r: 0.2 * f }, circle(cx + Math.cos(a) * 54, cy + Math.sin(a) * 54, 10));
    }
  },
  // one logo
  oneAnswer: (pl) => {
    screen(pl, { y: 0.06 });
    for (const [rad, w] of [[66, 16], [36, 14]] as const) pl.stroke({ b: 0.95 }, circle(cx, cy, rad), w);
    pl.fill({ b: 0.95 }, circle(cx, cy, 11));
  },
  // static
  noSignal: (pl, r) => {
    screen(pl, { b: 0.7, r: 0.6 });
    const tones: Spec[] = [{ b: 0.5 }, { r: 0.6 }, { y: 0.9 }, WHITE, { b: 0.95, r: 0.2 }];
    for (let i = 0; i < 60; i++) {
      const y = B.y + r() * B.h, h = 2 + r() * 9;
      pl.fill(tones[(r() * tones.length) | 0], quad(r, B.x + r() * B.w * 0.5, y, 30 + r() * B.w * 0.5, h, 0.5));
    }
  },
  // a medical cross and a house
  stayHome: (pl) => {
    screen(pl, { b: 0.04 });
    const x = B.x + 80, y = cy;
    pl.fill({ r: 0.95 }, poly([x - 14, y - 46, x + 14, y - 46, x + 14, y - 14, x + 46, y - 14, x + 46, y + 14, x + 14, y + 14, x + 14, y + 46, x - 14, y + 46, x - 14, y + 14, x - 46, y + 14, x - 46, y - 14, x - 14, y - 14]));
    const hx = B.x + 196;
    pl.stroke(DARK, poly([hx - 46, cy - 6, hx, cy - 50, hx + 46, cy - 6, hx + 34, cy - 6, hx + 34, cy + 46, hx - 34, cy + 46, hx - 34, cy - 6]), 10);
    pl.fill(DARK, round(hx - 10, cy + 14, 20, 32, 3));
  },
};

/* --- the plates -------------------------------------------------------------- */

type Mood = 'day' | 'dusk' | 'night' | 'grey';
type WinState = 'day' | 'dark' | 'warm' | 'screen' | 'logo' | 'candle';

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
  // Automation
  {
    mood: 'day', bill: 'robot', cafe: 'auto', lamp: 'off', trees: 'summer', clouds: true,
    windows: (r, k) => (k === 'tower' ? pick(r, 0.7, 'screen', 'day') : pick(r, 0.3, 'screen', 'day')),
    people: [
      { x: 150, y: 942, coat: COAT.sky, pose: 'stand', dir: 1, phone: true, skin: 1 },
      { x: 880, y: 948, coat: COAT.grey, dir: -1, s: 1.02, hair: 2 },
    ],
    front: (pl) => {
      rover(pl, 330, 946);
      rover(pl, 650, 1090, 1.3);
      drone(pl, 240, 312, 1.1);
      drone(pl, 560, 236, 0.9);
      drone(pl, 420, 372, 0.7);
    },
  },
  // Gradual disempowerment
  {
    mood: 'dusk', bill: 'waiting', cafe: 'auto', lamp: 'on', trees: 'summer', farLights: true,
    windows: (r) => pick(r, 0.82, 'screen', 'dark'),
    people: [
      { x: 0, y: 0, coat: COAT.plum, pose: 'sit', dir: -1, phone: true, skin: 2 },
      { x: 470, y: 944, coat: COAT.grey, pose: 'stand', dir: 1, phone: true, hair: 3 },
    ],
    front: (pl) => {
      rover(pl, 760, 946);
      rover(pl, 120, 948, 0.9);
      drone(pl, 300, 300, 1);
    },
  },
  // Concentration of power
  {
    mood: 'grey', bill: 'oneAnswer', cafe: 'open', lamp: 'off', trees: 'summer',
    windows: () => 'logo',
    // everyone dressed the same, walking the same way
    people: [[110, 942, 1], [250, 942, 1], [390, 942, 1], [560, 1010, 1.14], [650, 1050, 1.24], [740, 1090, 1.33]]
      .map(([x, y, s]) => ({ x, y, s, coat: COAT.blue, dir: 1 as const })),
    front: (pl) => {
      camera(pl, 520, 640, 1);
      camera(pl, 160, 470, -1);
      camera(pl, 470, 450, -1);
      camera(pl, 602, 236, -1);
    },
  },
  // Cyber attacks
  {
    mood: 'night', bill: 'noSignal', cafe: 'dark', lamp: 'spark', trees: 'summer',
    windows: (r, k) => (k === 'house' ? pick(r, 0.14, 'candle', 'dark') : 'dark'),
    people: [
      { x: 280, y: 942, coat: COAT.yellow, dir: 1, torch: true, skin: 1 },
      { x: 720, y: 1090, coat: COAT.red, dir: -1, s: 1.3, torch: true, hair: 2 },
    ],
  },
  // Biological risk
  {
    mood: 'grey', bill: 'stayHome', cafe: 'closed', lamp: 'off', trees: 'bare',
    windows: (r, k) => (k === 'house' ? pick(r, 0.3, 'warm', 'day') : pick(r, 0.6, 'dark', 'day')),
    people: [
      { x: 200, y: 942, coat: COAT.sky, dir: 1, mask: true, bag: true, skin: 2 },
      { x: 450, y: 938, coat: COAT.plum, dir: -1, mask: true, s: 0.96, hair: 1 },
    ],
    front: (pl) => ambulance(pl, 600, 1092),
  },
];

const SKY: Record<Mood, Spec> = {
  day: { b: lin(0.44, 0.1) },
  dusk: { b: lin(0.6, 0.06), r: lin(0.16, 0.5), y: lin(0, 0.7) },
  night: { b: lin(0.58, 0.32), r: lin(0.22, 0.14) },
  grey: { b: 0.17, r: 0.09, y: 0.05 },
};
// the light of each plate, added to everything that does not give off its own
const WASH: Record<Mood, Partial<Record<Ink, number>>> = {
  day: {},
  dusk: { r: 0.18, b: 0.26, y: 0.06 },
  night: { b: 0.64, r: 0.32 },
  grey: { b: 0.1, r: 0.06 },
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
  const drawn = sc.people.map((w) => {
    const d = person(pl, w.pose === 'sit' && w.x === 0 ? { ...w, x: S.houses[SEAT].seat[0], y: S.houses[SEAT].seat[1] } : w);
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
    pl.fill({ b: 0.1 }, at);
    const rad = Math.min(w.w, w.h) * 0.28;
    pl.stroke({ b: 0.95 }, circle(w.x + w.w / 2, w.y + w.h / 2, rad), Math.max(3, rad * 0.32));
    pl.fill({ b: 0.95 }, circle(w.x + w.w / 2, w.y + w.h / 2, rad * 0.28));
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
