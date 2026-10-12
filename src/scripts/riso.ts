/**
 * A tiny risograph press, for the home page print (scripts/street.ts).
 *
 * A riso print is made with one drum per ink, each ink laid down as grainy
 * halftone dots, one over the other. This does the same thing on canvases:
 *
 *   1. A Plate is three greyscale canvases, one per ink (yellow, red, blue).
 *      Drawing on a plate means saying how much of each ink a shape gets,
 *      0 to 1. By default a shape knocks out the inks it does not name, as a
 *      real print would; `over` prints on top of what is there instead.
 *   2. print() turns each greyscale canvas into ink coverage, through a
 *      halftone screen at its own angle plus grain and a little uneven ink,
 *      and multiplies the three inks over paper, in one pass, into the
 *      finished picture. Each ink is drawn slightly out of register.
 *
 * None of this touches the page, so it runs in a worker (street.worker.ts)
 * on OffscreenCanvas, off the main thread.
 *
 * Overprinting is where the colour comes from: red and yellow make orange,
 * blue and yellow make green, red and blue make the near-black used for
 * lines. Everything is drawn in one fixed space, WORLD: 1900 × 1200, x from
 * -450 to 1450. The column on the page shows the middle, x 0 to 1000; the
 * full-screen opening shows as much of the width as the screen allows.
 */
export type Ink = 'y' | 'r' | 'b';
export const INKS: Ink[] = ['y', 'r', 'b'];
export const INK_RGB: Record<Ink, [number, number, number]> = {
  y: [255, 200, 38],
  r: [210, 30, 52],
  b: [0, 112, 186],
};
export const PAPER = '#f5efe3';
export const WORLD = { x0: -450, w: 1900, h: 1200 };

/** How much ink: a flat amount, a vertical gradient, or a radial glow. */
export type Tone =
  | number
  | { y0: number; y1: number; from: number; to: number }
  | { x: number; y: number; r: number; from: number; to: number };
export type Spec = Partial<Record<Ink, Tone>>;

export class Plate {
  readonly c = {} as Record<Ink, CanvasRenderingContext2D>;
  /**
   * The light of the plate (dusk, night): ink added to everything drawn,
   * except what is drawn inside glow(), which gives off its own light.
   */
  wash: Partial<Record<Ink, number>> = {};
  private lit = false;

  /** reg: how far each ink is out of register, in world units */
  constructor(readonly pw: number, readonly ph: number, reg: Partial<Record<Ink, [number, number]>> = {}) {
    // the canvas is the whole world, so this is only a scale and a shift
    const s = pw / WORLD.w;
    for (const k of INKS) {
      const [dx, dy] = reg[k] ?? [0, 0];
      const g = canvas2d(pw, ph);
      g.fillStyle = '#fff';
      g.fillRect(0, 0, pw, ph);
      g.setTransform(s, 0, 0, s, (dx - WORLD.x0) * s, dy * s);
      g.lineCap = 'round';
      g.lineJoin = 'round';
      this.c[k] = g;
    }
  }

  private tone(g: CanvasRenderingContext2D, t: Tone): string | CanvasGradient {
    const grey = (d: number) => {
      const n = Math.round(255 * (1 - Math.min(1, Math.max(0, d))));
      return `rgb(${n},${n},${n})`;
    };
    if (typeof t === 'number') return grey(t);
    const gr = 'r' in t ? g.createRadialGradient(t.x, t.y, 0, t.x, t.y, t.r) : g.createLinearGradient(0, t.y0, 0, t.y1);
    gr.addColorStop(0, grey(t.from));
    gr.addColorStop(1, grey(t.to));
    return gr;
  }

  /** Draw things that give off light: the plate's wash does not reach them. */
  glow(draw: () => void) {
    this.lit = true;
    draw();
    this.lit = false;
  }

  private each(spec: Spec, over: boolean, draw: (g: CanvasRenderingContext2D, style: string | CanvasGradient) => void) {
    for (const k of INKS) {
      let t = spec[k];
      if (t === undefined) {
        if (over) continue;
        t = 0;
      }
      const w = this.lit || over ? 0 : this.wash[k] ?? 0;
      if (w) {
        const add = (d: number) => 1 - (1 - d) * (1 - w);
        t = typeof t === 'number' ? add(t) : { ...t, from: add(t.from), to: add(t.to) };
      }
      const g = this.c[k];
      g.globalCompositeOperation = over ? 'multiply' : 'source-over';
      draw(g, this.tone(g, t));
    }
  }

  fill(spec: Spec, path: Path2D) {
    this.each(spec, false, (g, s) => { g.fillStyle = s; g.fill(path); });
  }

  /** Print on top: inks add up instead of replacing what is underneath. */
  over(spec: Spec, path: Path2D) {
    this.each(spec, true, (g, s) => { g.fillStyle = s; g.fill(path); });
  }

  stroke(spec: Spec, path: Path2D, width: number, over = false) {
    this.each(spec, over, (g, s) => { g.strokeStyle = s; g.lineWidth = width; g.stroke(path); });
  }

  /** Draw only inside a shape. */
  clip(path: Path2D, draw: () => void) {
    for (const k of INKS) { this.c[k].save(); this.c[k].clip(path); }
    draw();
    for (const k of INKS) this.c[k].restore();
  }
}

/** The halftone screens for one canvas size, shared by every plate. */
export interface Screens {
  th: Record<Ink, Float32Array>;
  gain: Record<Ink, Float32Array>;
}

export function screens(pw: number, ph: number, dot: number): Screens {
  const n = pw * ph;
  const angle: Record<Ink, number> = { y: 0, r: (75 * Math.PI) / 180, b: (15 * Math.PI) / 180 };
  const th = {} as Record<Ink, Float32Array>;
  const gain = {} as Record<Ink, Float32Array>;
  const rnd = seeded(7);
  const f = (2 * Math.PI) / dot;
  for (const k of INKS) {
    const t = (th[k] = new Float32Array(n));
    const g = (gain[k] = new Float32Array(n));
    const c = Math.cos(angle[k]) * f;
    const s = Math.sin(angle[k]) * f;
    // uneven ink: a coarse grid of random values, smoothly interpolated
    const cell = 140;
    const gw = Math.ceil(pw / cell) + 2;
    const gh = Math.ceil(ph / cell) + 2;
    const grid = Float32Array.from({ length: gw * gh }, () => rnd());
    for (let y = 0; y < ph; y++) {
      const gy = y / cell, iy = gy | 0;
      let fy = gy - iy;
      fy = fy * fy * (3 - 2 * fy);
      for (let x = 0; x < pw; x++) {
        const i = y * pw + x;
        const spot = 0.5 + 0.25 * (Math.cos(x * c + y * s) + Math.cos(-x * s + y * c));
        t[i] = 0.05 + 0.84 * (0.72 * spot + 0.28 * rnd());
        const gx = x / cell, ix = gx | 0;
        let fx = gx - ix;
        fx = fx * fx * (3 - 2 * fx);
        const a = grid[iy * gw + ix], b = grid[iy * gw + ix + 1];
        const cc = grid[(iy + 1) * gw + ix], d = grid[(iy + 1) * gw + ix + 1];
        const v = a + (b - a) * fx + (cc - a) * fy + (a - b - cc + d) * fx * fy;
        g[i] = 0.93 + 0.11 * v;
      }
    }
  }
  return { th, gain };
}

/** Run a plate through the screens and onto paper: the finished picture. */
export function print(plate: Plate, sc: Screens): ImageData {
  const { pw, ph } = plate;
  const n = pw * ph;
  const out = new ImageData(pw, ph);
  const px = out.data;
  const src = INKS.map((k) => plate.c[k].getImageData(0, 0, pw, ph).data);
  const th = INKS.map((k) => sc.th[k]);
  const gain = INKS.map((k) => sc.gain[k]);
  // how much of each colour channel an ink takes away, at full coverage
  const take = INKS.map((k) => INK_RGB[k].map((c) => 1 - c / 255));
  const paper = [parseInt(PAPER.slice(1, 3), 16), parseInt(PAPER.slice(3, 5), 16), parseInt(PAPER.slice(5, 7), 16)];
  for (let i = 0; i < n; i++) {
    let r = paper[0], g = paper[1], b = paper[2];
    for (let k = 0; k < 3; k++) {
      const d = 1 - src[k][i * 4] / 255;
      if (d < 0.01) continue;
      let a = (d * gain[k][i] - th[k][i]) * 7 + 0.5;
      if (a <= 0) continue;
      if (a > 1) a = 1;
      const t = take[k];
      r *= 1 - a * t[0];
      g *= 1 - a * t[1];
      b *= 1 - a * t[2];
    }
    const j = i * 4;
    px[j] = r;
    px[j + 1] = g;
    px[j + 2] = b;
    px[j + 3] = 255;
  }
  return out;
}

/** A 2D canvas that works in a worker as well as on the page. */
function canvas2d(w: number, h: number): CanvasRenderingContext2D {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(w, h).getContext('2d', { willReadFrequently: true }) as unknown as CanvasRenderingContext2D;
  }
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  return cv.getContext('2d', { willReadFrequently: true })!;
}

export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
