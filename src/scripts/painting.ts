/**
 * The home page painting, with p5.js: a watercolour of Boston's Back Bay from
 * across the Charles, slowly repainted by a machine as you scroll.
 *
 * The watercolour
 *   Each wash is a polygon deformed many times over: every edge gets a new
 *   midpoint pushed off the line by a random amount, so the outline frays the
 *   way paint bleeds on wet paper. Each wash is laid down as dozens of nearly
 *   transparent layers, each deformed a little differently, which gives the
 *   soft, pooled look. Thin ink lines over the colour, like a sketchbook.
 *   It is painted once, offscreen, and kept.
 *
 * The machine
 *   As you scroll (p, 0 to 1, from GSAP's ScrollTrigger), hard-edged squares
 *   appear on a grid, each copying the colour of the painting beneath it:
 *     0.15  a few squares, scattered, here and there
 *     0.35  they spread out from a handful of points across the city
 *     0.55  their colours flatten toward a few reds
 *     0.80  they settle into one identical, optimised pattern
 *   The city is not destroyed; it is replaced by something tuned to a goal
 *   nobody meant to give it. One patch is never covered: the people on the
 *   river path, still painted by hand at the end.
 *
 * The painting only redraws when p changes or the frame is resized; p5's own
 * loop is off. With reduced motion the scroll still drives the story.
 */
import type p5 from 'p5';

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ramp = (p: number, a: number, b: number) => {
  const t = clamp((p - a) / (b - a));
  return t * t * (3 - 2 * t);
};

type Pt = [number, number];
type RGB = [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/* The human patch: the people on the path, which the machine never reaches. */
const KEEP = { u: 0.34, v: 0.885, r: 0.13 };
/* Where the repainting starts. */
const SEEDS: Pt[] = [[0.56, 0.2], [0.31, 0.33], [0.8, 0.46], [0.13, 0.52], [0.66, 0.72]];
const MACHINE: RGB[] = ['#c8102e', '#9b0c24', '#e2475d', '#f1b6bf', '#1d1a1c'].map(hex);

export async function mountPainting(host: HTMLElement, getP: () => number) {
  const { default: P5 } = await import('p5');
  // p5's beginner-help checks run on every call and slow drawing down a lot
  (P5 as unknown as { disableFriendlyErrors: boolean }).disableFriendlyErrors = true;

  let redrawNow = () => {};

  new P5((s: p5) => {
    let W = 0, H = 0;
    let paint: p5.Graphics | null = null;
    let cells: { x: number; y: number; t: number; c: RGB; flat: RGB; tile: number }[] = [];
    let cell = 10;

    /* --- watercolour ---------------------------------------------------- */

    /** Push each edge's midpoint off the line, `times` times over. */
    function deform(pts: Pt[], times: number, amount: number): Pt[] {
      let out = pts;
      for (let k = 0; k < times; k++) {
        const next: Pt[] = [];
        for (let i = 0; i < out.length; i++) {
          const a = out[i], b = out[(i + 1) % out.length];
          const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
          const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
          const nx = -(b[1] - a[1]) / (len || 1), ny = (b[0] - a[0]) / (len || 1);
          const push = s.randomGaussian(0, len * amount);
          next.push(a, [mx + nx * push, my + ny * push]);
        }
        out = next;
      }
      return out;
    }

    function poly(g: p5.Graphics, pts: Pt[]) {
      g.beginShape();
      for (const [x, y] of pts) g.vertex(x, y);
      g.endShape(s.CLOSE);
    }

    /** A wash: many faint, differently frayed layers of one shape. */
    function wash(g: p5.Graphics, shape: Pt[], col: string, opts: { layers?: number; alpha?: number; spread?: number; base?: number } = {}) {
      const { layers = 28, alpha = 9, spread = 0.18, base = 2 } = opts;
      const root = deform(shape, base, spread * 0.6);
      const c = s.color(col);
      c.setAlpha(alpha);
      g.noStroke();
      g.fill(c);
      for (let i = 0; i < layers; i++) poly(g, deform(root, 3, spread));
    }

    const rect = (x: number, y: number, w: number, h: number): Pt[] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
    const blob = (cx: number, cy: number, rx: number, ry: number, n = 10): Pt[] =>
      Array.from({ length: n }, (_, i) => [cx + Math.cos((i / n) * Math.PI * 2) * rx, cy + Math.sin((i / n) * Math.PI * 2) * ry] as Pt);

    /** Ink: a slightly unsteady line, drawn twice faintly. */
    function ink(g: p5.Graphics, pts: Pt[], w = 1, close = false) {
      g.noFill();
      for (let pass = 0; pass < 2; pass++) {
        g.stroke(52, 40, 38, pass ? 70 : 140);
        g.strokeWeight(w * (pass ? 1.6 : 1));
        g.beginShape();
        for (const [x, y] of pts) g.vertex(x + s.random(-0.6, 0.6), y + s.random(-0.6, 0.6));
        g.endShape(close ? s.CLOSE : undefined);
      }
    }

    function makePainting() {
      s.randomSeed(11);
      s.noiseSeed(11);
      const g = s.createGraphics(W, H);
      g.pixelDensity(1);
      const X = (u: number) => u * W, Y = (v: number) => v * H;
      const HZ = 0.6; // the far waterline

      // paper
      g.background('#fbf8f2');

      // sky: a cool wash above, warm toward the horizon
      wash(g, rect(-0.1 * W, -0.1 * H, 1.2 * W, 0.45 * H), '#bcd3de', { layers: 30, alpha: 7, spread: 0.12 });
      wash(g, rect(-0.1 * W, Y(0.28), 1.2 * W, 0.36 * H), '#f4cfae', { layers: 30, alpha: 8, spread: 0.14 });
      for (const [u, v, w] of [[0.2, 0.12, 0.22], [0.62, 0.08, 0.18], [0.45, 0.24, 0.15]] as const) {
        wash(g, blob(X(u), Y(v), X(w), Y(0.022), 9), '#ffffff', { layers: 18, alpha: 14, spread: 0.2 });
      }
      // the sun
      wash(g, blob(X(0.76), Y(0.3), X(0.07), X(0.07), 12), '#f2a65a', { layers: 26, alpha: 10, spread: 0.08 });

      // the far city, pale and blue in the haze
      for (let u = -0.02; u < 1.02; ) {
        const w = s.random(0.03, 0.07), top = s.random(0.4, 0.5);
        wash(g, rect(X(u), Y(top), X(w), Y(HZ - top)), '#9fb2bf', { layers: 10, alpha: 9, spread: 0.05, base: 1 });
        u += w * s.random(0.7, 1);
      }

      // the skyline: landmarks first, then the rest
      type T = { u: number; w: number; top: number; col: string; kind?: string };
      const towers: T[] = [
        { u: 0.05, w: 0.06, top: 0.36, col: '#c9a98a' },
        { u: 0.12, w: 0.055, top: 0.31, col: '#d8c3a5' },
        { u: 0.185, w: 0.06, top: 0.39, col: '#b8b0a4' },
        { u: 0.265, w: 0.075, top: 0.17, col: '#c6b69c', kind: 'pru' },
        { u: 0.35, w: 0.05, top: 0.27, col: '#e0d0b5', kind: 'dome' },
        { u: 0.415, w: 0.045, top: 0.37, col: '#c99a7c' },
        { u: 0.47, w: 0.065, top: 0.14, col: '#86aec6', kind: 'glass' },
        { u: 0.55, w: 0.05, top: 0.33, col: '#d4bfa1' },
        { u: 0.61, w: 0.06, top: 0.26, col: '#b9a48c' },
        { u: 0.68, w: 0.05, top: 0.35, col: '#a7b8b4' },
        { u: 0.74, w: 0.07, top: 0.29, col: '#d8b391' },
        { u: 0.82, w: 0.055, top: 0.38, col: '#c4ab94' },
        { u: 0.885, w: 0.065, top: 0.33, col: '#b5aaa0' },
      ];
      for (const t of towers) {
        const x = X(t.u), w = X(t.w), y = Y(t.top), h = Y(HZ) - y;
        const shape: Pt[] = t.kind === 'glass'
          ? [[x, y + Y(0.02)], [x + w, y], [x + w, Y(HZ)], [x, Y(HZ)]]
          : rect(x, y, w, h);
        wash(g, shape, t.col, { layers: 22, alpha: 14, spread: 0.035, base: 1 });
        // shade on the side away from the sun
        wash(g, rect(x + w * 0.62, y + Y(0.01), w * 0.38, h), '#5a4a48', { layers: 8, alpha: 6, spread: 0.04, base: 1 });
        if (t.kind === 'pru') {
          wash(g, rect(x + w * 0.15, y - Y(0.022), w * 0.7, Y(0.024)), t.col, { layers: 14, alpha: 14, spread: 0.04, base: 1 });
          ink(g, [[x + w / 2, y - Y(0.022)], [x + w / 2, y - Y(0.09)]], 1.4);
        }
        if (t.kind === 'dome') {
          wash(g, blob(x + w / 2, y, w * 0.55, w * 0.45, 12), '#93b0ad', { layers: 14, alpha: 14, spread: 0.06 });
          ink(g, [[x + w / 2, y - w * 0.45], [x + w / 2, y - w * 1.1]], 1);
        }
        // ink: an outline, and a few window rows, not every window
        ink(g, t.kind === 'glass' ? [[x, Y(HZ)], [x, y + Y(0.02)], [x + w, y], [x + w, Y(HZ)]] : [[x, Y(HZ)], [x, y], [x + w, y], [x + w, Y(HZ)]], 0.9);
        for (let wy = y + Y(0.03); wy < Y(HZ) - Y(0.04); wy += Y(0.028)) {
          if (s.random() < 0.55) ink(g, [[x + w * 0.18, wy], [x + w * 0.82, wy]], 0.5);
        }
        if (t.kind === 'glass') ink(g, [[x + w * 0.5, Y(HZ)], [x + w * 0.5, y + Y(0.012)]], 0.6);
      }

      // Back Bay brownstones along the water
      for (let u = -0.01; u < 1.01; ) {
        const w = s.random(0.03, 0.045), top = s.random(0.525, 0.55);
        const col = ['#b5533c', '#a8432f', '#c26a4a', '#9a4632'][Math.floor(s.random(4))];
        wash(g, rect(X(u), Y(top), X(w), Y(HZ) - Y(top)), col, { layers: 12, alpha: 18, spread: 0.04, base: 1 });
        wash(g, rect(X(u) + 2, Y(top) - Y(0.01), X(w) - 4, Y(0.012)), '#4a4f5c', { layers: 6, alpha: 20, spread: 0.05, base: 1 });
        for (let wy = Y(top) + Y(0.012); wy < Y(HZ) - Y(0.012); wy += Y(0.014)) {
          ink(g, [[X(u) + X(w) * 0.25, wy], [X(u) + X(w) * 0.42, wy]], 0.7);
          ink(g, [[X(u) + X(w) * 0.58, wy], [X(u) + X(w) * 0.75, wy]], 0.7);
        }
        u += w;
      }

      // trees along the far bank
      for (let u = 0; u < 1; u += s.random(0.025, 0.05)) {
        const col = ['#6f9b58', '#86ad62', '#d98a2b', '#c8642e', '#5c8a52'][Math.floor(s.random(5))];
        wash(g, blob(X(u), Y(HZ - 0.006), X(0.022), Y(0.016)), col, { layers: 12, alpha: 16, spread: 0.12 });
      }

      // the river: layered teal, the city's reflection smeared down into it
      wash(g, rect(-0.1 * W, Y(HZ), 1.2 * W, Y(0.2)), '#4a8f98', { layers: 30, alpha: 10, spread: 0.06 });
      for (const t of towers) {
        const x = X(t.u), w = X(t.w);
        wash(g, rect(x + w * 0.1, Y(HZ) + 2, w * 0.8, (Y(HZ) - Y(t.top)) * 0.42), t.col, { layers: 10, alpha: 7, spread: 0.08, base: 1 });
      }
      g.stroke(255, 255, 255, 120);
      for (let i = 0; i < 40; i++) {
        const y = Y(s.random(HZ + 0.01, 0.79)), x = X(s.random(-0.05, 0.95));
        g.strokeWeight(s.random(0.8, 2));
        g.line(x, y, x + X(s.random(0.03, 0.12)), y);
      }

      // sailboats: white and one red, with ink
      for (const [u, v, sc, red] of [[0.22, 0.69, 1, false], [0.48, 0.74, 0.85, true], [0.78, 0.67, 0.75, false]] as const) {
        const x = X(u), y = Y(v), k = Y(0.075) * sc;
        const sail: Pt[] = [[x, y - k], [x, y], [x + k * 0.55, y]];
        wash(g, sail, red ? '#c8102e' : '#ffffff', { layers: 10, alpha: red ? 40 : 60, spread: 0.02, base: 1 });
        ink(g, sail, 0.8, true);
        wash(g, rect(x - k * 0.3, y + 1, k * 0.95, k * 0.12), '#3a3f4a', { layers: 6, alpha: 40, spread: 0.03, base: 1 });
      }

      // the near bank: grass, the path, big trees at the edges
      wash(g, rect(-0.1 * W, Y(0.79), 1.2 * W, Y(0.3)), '#8fb07a', { layers: 24, alpha: 12, spread: 0.08 });
      wash(g, rect(-0.1 * W, Y(0.86), 1.2 * W, Y(0.055)), '#f1e6d2', { layers: 16, alpha: 20, spread: 0.05 });
      for (const [u, v, r, col] of [[0.04, 0.72, 0.13, '#5c8a52'], [0.12, 0.66, 0.09, '#86ad62'], [0.96, 0.7, 0.12, '#d98a2b'], [0.88, 0.76, 0.08, '#c8642e']] as const) {
        ink(g, [[X(u), Y(1.02)], [X(u) + X(0.01), Y(v + 0.08)]], 2.4);
        wash(g, blob(X(u), Y(v), X(r), X(r) * 0.85, 11), col, { layers: 22, alpha: 14, spread: 0.16 });
      }
      // lamps along the path
      for (const u of [0.18, 0.5, 0.82]) {
        ink(g, [[X(u), Y(0.86)], [X(u), Y(0.8)]], 1.2);
        wash(g, blob(X(u), Y(0.797), X(0.008), X(0.008), 8), '#f2c46b', { layers: 6, alpha: 40, spread: 0.1 });
      }
      // people on the path, in bright coats
      const coats = ['#c8102e', '#1f6f78', '#e2b13c', '#2b2f3a', '#e9883a', '#6f9b58'];
      for (const [u, h, ci] of [[0.27, 0.05, 0], [0.295, 0.047, 1], [0.36, 0.05, 2], [0.4, 0.035, 4], [0.44, 0.048, 3], [0.62, 0.05, 5], [0.7, 0.046, 0]] as const) {
        const x = X(u), y = Y(0.9), hh = Y(h);
        wash(g, [[x - hh * 0.16, y - hh * 0.72], [x + hh * 0.16, y - hh * 0.72], [x + hh * 0.2, y - hh * 0.22], [x - hh * 0.2, y - hh * 0.22]], coats[ci], { layers: 6, alpha: 60, spread: 0.03, base: 1 });
        g.noStroke(); g.fill(60, 45, 40, 200); g.circle(x, y - hh * 0.84, hh * 0.24);
        ink(g, [[x - hh * 0.08, y - hh * 0.22], [x - hh * 0.12, y]], 1);
        ink(g, [[x + hh * 0.08, y - hh * 0.22], [x + hh * 0.12, y]], 1);
      }
      // a child's red balloon
      ink(g, [[X(0.405), Y(0.875)], [X(0.415), Y(0.8)]], 0.6);
      wash(g, blob(X(0.415), Y(0.79), X(0.011), X(0.013), 10), '#c8102e', { layers: 8, alpha: 50, spread: 0.06 });

      // paper grain over everything
      g.noStroke();
      for (let i = 0; i < (W * H) / 90; i++) {
        g.fill(90, 70, 60, s.random(4, 12));
        g.rect(s.random(W), s.random(H), 1, 1);
      }
      return g;
    }

    /* --- the machine's grid ------------------------------------------------ */

    function makeCells() {
      cells = [];
      if (!paint) return;
      cell = Math.max(6, Math.round(Math.min(W, H) / 48));
      paint.loadPixels();
      const d = paint.pixelDensity();
      for (let y = 0; y < H; y += cell) {
        for (let x = 0; x < W; x += cell) {
          const u = (x + cell / 2) / W, v = (y + cell / 2) / H;
          // nearest seed sets when this square turns, with noise in the edge
          let near = 9;
          for (const [su, sv] of SEEDS) near = Math.min(near, Math.hypot((u - su) * (W / H), v - sv));
          let t = 0.28 + near * 0.95 + (s.noise(u * 6, v * 6) - 0.5) * 0.22;
          if (s.random() < 0.05) t = s.random(0.12, 0.4); // the scattered first few
          // the people on the path are never reached
          const keep = Math.hypot((u - KEEP.u) * (W / H), v - KEEP.v);
          if (keep < KEEP.r) t = 9;
          else if (keep < KEEP.r * 1.6) t = Math.max(t, 0.9 + (KEEP.r * 1.6 - keep) * 2);
          // sample the painting at the square's centre, kept inside the edge
          const sx = Math.min(W - 1, Math.floor(x + cell / 2)), sy = Math.min(H - 1, Math.floor(y + cell / 2));
          const i = 4 * ((sy * d) * (paint.width * d) + sx * d);
          const c: RGB = [paint.pixels[i], paint.pixels[i + 1], paint.pixels[i + 2]];
          // the flattened colour: the nearest of the machine's few reds by lightness
          const light = (c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11) / 255;
          const flat = light > 0.8 ? MACHINE[3] : light > 0.62 ? MACHINE[2] : light > 0.42 ? MACHINE[0] : light > 0.25 ? MACHINE[1] : MACHINE[4];
          const tile = ((x / cell) + (y / cell)) % 2;
          cells.push({ x, y, t, c, flat, tile });
        }
      }
    }

    function render() {
      if (!paint) return;
      const p = getP();
      s.clear();
      s.image(paint, 0, 0, W, H);
      const flatten = ramp(p, 0.45, 0.75);
      // never quite uniform: a ghost of the skyline stays in the pattern
      const settle = ramp(p, 0.75, 0.96) * 0.82;
      const gap = Math.max(1, cell * 0.12);
      s.noStroke();
      for (const k of cells) {
        const on = clamp((p - k.t) * 9);
        if (on <= 0) continue;
        // the square grows in from its centre
        const size = (cell - gap) * on;
        const off = (cell - size) / 2;
        // its colour: copied, then flattened, then made uniform
        let r = k.c[0] + (k.flat[0] - k.c[0]) * flatten;
        let gg = k.c[1] + (k.flat[1] - k.c[1]) * flatten;
        let b = k.c[2] + (k.flat[2] - k.c[2]) * flatten;
        const u = k.tile ? MACHINE[0] : MACHINE[1];
        r += (u[0] - r) * settle; gg += (u[1] - gg) * settle; b += (u[2] - b) * settle;
        s.fill(r, gg, b);
        s.rect(k.x + off, k.y + off, size, size, cell * 0.12 * (1 - settle));
      }
    }

    function size() {
      const r = host.getBoundingClientRect();
      W = Math.max(1, Math.round(r.width));
      H = Math.max(1, Math.round(r.height));
    }

    s.setup = () => {
      size();
      s.createCanvas(W, H);
      s.pixelDensity(Math.min(2, window.devicePixelRatio || 1));
      s.noLoop();
      paint = makePainting();
      makeCells();
      render();
      host.classList.add('is-ready');
    };
    s.draw = () => render();

    let resizeTimer = 0;
    s.windowResized = () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        const ow = W, oh = H;
        size();
        if (W === ow && H === oh) return;
        s.resizeCanvas(W, H);
        paint?.remove();
        paint = makePainting();
        makeCells();
        render();
      }, 200);
    };

    redrawNow = () => s.redraw();
  }, host);

  return () => redrawNow();
}
