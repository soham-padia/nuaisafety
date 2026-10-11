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
 *   2. press() turns each greyscale canvas into ink coverage, through a
 *      halftone screen at its own angle plus grain and a little uneven ink.
 *   3. inkLayer() makes a coverage map into a canvas of that ink's colour,
 *      and the page multiplies the three over paper, slightly out of register.
 *
 * Overprinting is where the colour comes from: red and yellow make orange,
 * blue and yellow make green, red and blue make the near-black used for
 * lines. Everything is drawn in a fixed 1000 × 1200 space and cropped to fit.
 */
export type Ink = 'y' | 'r' | 'b';
export const INKS: Ink[] = ['y', 'r', 'b'];
export const INK_RGB: Record<Ink, [number, number, number]> = {
  y: [255, 200, 38],
  r: [210, 30, 52],
  b: [0, 112, 186],
};
export const PAPER = '#f5efe3';
export const VW = 1000;
export const VH = 1200;

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

  constructor(readonly pw: number, readonly ph: number) {
    // cover the frame; when cropping height, lose more sky than street
    const s = Math.max(pw / VW, ph / VH);
    const ox = (pw - VW * s) / 2;
    const oy = (ph - VH * s) * 0.6;
    for (const k of INKS) {
      const cv = document.createElement('canvas');
      cv.width = pw;
      cv.height = ph;
      const g = cv.getContext('2d', { willReadFrequently: true })!;
      g.fillStyle = '#fff';
      g.fillRect(0, 0, pw, ph);
      g.setTransform(s, 0, 0, s, ox, oy);
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

  text(spec: Spec, str: string, x: number, y: number, size: number, weight = 800) {
    this.each(spec, false, (g, s) => {
      g.fillStyle = s;
      g.font = `${weight} ${size}px "Bricolage Grotesque Variable", ui-sans-serif, system-ui, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(str, x, y);
    });
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

export type Coverage = Record<Ink, Uint8Array>;

/** Run a plate through the screens: greyscale in, ink coverage out. */
export function press(plate: Plate, sc: Screens): Coverage {
  const out = {} as Coverage;
  for (const k of INKS) {
    const src = plate.c[k].getImageData(0, 0, plate.pw, plate.ph).data;
    const n = plate.pw * plate.ph;
    const cov = (out[k] = new Uint8Array(n));
    const th = sc.th[k], gain = sc.gain[k];
    for (let i = 0; i < n; i++) {
      const d = 1 - src[i * 4] / 255;
      if (d < 0.01) continue;
      const v = (d * gain[i] - th[i]) * 7 + 0.5;
      cov[i] = v <= 0 ? 0 : v >= 1 ? 255 : (v * 255) | 0;
    }
  }
  return out;
}

/** One ink's coverage as a canvas of that ink, ready to multiply over paper. */
export function inkLayer(cov: Uint8Array, k: Ink, pw: number, ph: number): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = pw;
  cv.height = ph;
  const g = cv.getContext('2d')!;
  const img = g.createImageData(pw, ph);
  const px = new Uint32Array(img.data.buffer);
  const [r, gg, b] = INK_RGB[k];
  const rgb = (b << 16) | (gg << 8) | r; // little-endian RGBA
  for (let i = 0; i < cov.length; i++) px[i] = ((cov[i] << 24) | rgb) >>> 0;
  g.putImageData(img, 0, 0);
  return cv;
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
