/**
 * Shows the street print (scripts/street.ts) on the page.
 *
 * The plates are printed in a worker (street.worker.ts) and come back as
 * finished pictures, so the main thread only ever copies a picture onto a
 * canvas: once per plate change, a millisecond or two. Where the worker
 * cannot draw (a browser without OffscreenCanvas), the same code prints
 * here, one plate per idle moment.
 *
 * The canvas always holds the whole world. Where it sits is two things,
 * blended by the opening's progress (0 to 1):
 *
 *   full screen  the world covers the screen, under the header too
 *   column       the middle of the world (x 0 to 1000) covers the frame
 *
 * Moving between them only changes a CSS transform and a clip; the layout is
 * read once per opening, not once per frame.
 */
import { WORLD } from './riso';
import { STORY } from '../data/story';

export interface StreetView {
  /** Where the story is, 0 to the last plate; fractions are transitions. */
  show(pos: number): void;
  /** The opening: 0 full screen, 1 settled in its column. */
  open(q: number): void;
}

type Done = (gen: number, i: number, picture: CanvasImageSource) => void;
interface Printer {
  size(gen: number, pw: number, ph: number, dot: number): void;
  plate(gen: number, i: number): void;
}

/** Print in a worker where the browser can; otherwise here, when idle. */
function printer(done: Done): Printer {
  const canWorker = typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined';
  if (canWorker) {
    try {
      const w = new Worker(new URL('./street.worker.ts', import.meta.url), { type: 'module' });
      w.onmessage = (e) => done(e.data.gen, e.data.i, e.data.bitmap);
      return {
        size: (gen, pw, ph, dot) => w.postMessage({ type: 'size', gen, pw, ph, dot }),
        plate: (gen, i) => w.postMessage({ type: 'plate', gen, i }),
      };
    } catch { /* fall through */ }
  }
  const idle = (fn: () => void) =>
    'requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 1000 }) : setTimeout(fn, 60);
  const lib = Promise.all([import('./riso'), import('./street')]);
  let sz = { gen: -1, pw: 0, ph: 0, dot: 3 };
  let sc: import('./riso').Screens | null = null;
  return {
    size: (gen, pw, ph, dot) => { sz = { gen, pw, ph, dot }; sc = null; },
    plate: (gen, i) =>
      lib.then(([riso, street]) =>
        idle(() => {
          if (gen !== sz.gen) return;
          sc ??= riso.screens(sz.pw, sz.ph, sz.dot);
          const cv = document.createElement('canvas');
          cv.width = sz.pw;
          cv.height = sz.ph;
          cv.getContext('2d')!.putImageData(riso.print(street.drawPlate(i, sz.pw, sz.ph), sc), 0, 0);
          done(gen, i, cv);
        }),
      ),
  };
}

export function mountStreet(fig: HTMLElement, reduce: boolean, count: number): StreetView {
  const frame = fig.querySelector<HTMLElement>('.riso__plate')!;
  const stage = fig.querySelector<HTMLElement>('.riso__stage')!;
  // two canvases: the plate you are on, and over it the next one, shown
  // through a grid of halftone dots that grow as you scroll
  const [canvas, upper] = [...stage.querySelectorAll('canvas')];
  const ctx = [canvas, upper].map((c) => c.getContext('2d', { alpha: false })!);
  const shown = [-1, -1]; // which plate each canvas holds
  const capTerm = fig.querySelector<HTMLElement>('[data-riso-term]');
  const capLine = fig.querySelector<HTMLElement>('[data-riso-line]');
  const N = count;

  let gen = 0, pw = 0, ph = 0;
  let pictures: (CanvasImageSource | undefined)[] = [];
  let pos = 0, q = reduce ? 1 : 0, caption = 0;

  const print = printer((g, i, picture) => {
    if (g !== gen) return;
    pictures[i] = picture;
    if (!fig.classList.contains('is-ready') && i === 0) fig.classList.add('is-ready');
    render(); // in case the plate on screen was waiting for this one
  });

  /** Where the screen and the frame are. Reads layout, so call it rarely. */
  function measure() {
    const SW = document.documentElement.clientWidth, SH = window.innerHeight;
    const f = frame.getBoundingClientRect();
    const uF = Math.max(SW / WORLD.w, SH / WORLD.h); // CSS px per world unit, full screen
    const uC = Math.max(f.width / 1000, f.height / WORLD.h); // and in the column
    const radius = parseFloat(getComputedStyle(frame).getPropertyValue('--radius')) || 0;
    return { SW, SH, fx: f.left, fy: f.top, fw: f.width, fh: f.height, uF, uC, radius };
  }
  let m = measure();

  /** Size the canvases: sharp enough in the column, and never too many pixels. */
  function setup() {
    const T = Math.min(window.devicePixelRatio || 1, 1.5);
    let D = T * Math.min(1, Math.max(m.uC / m.uF, 0.75)); // canvas px per CSS px, full screen
    const max = 1.5e6;
    const area = WORLD.w * WORLD.h * (m.uF * D) ** 2;
    if (area > max) D *= Math.sqrt(max / area);
    const w = Math.max(1, Math.round(WORLD.w * m.uF * D));
    // a small change in size (a phone's address bar) does not reprint the plates
    if (pw && Math.abs(w - pw) / pw < 0.15) return;
    pw = w;
    ph = Math.round((w * WORLD.h) / WORLD.w);
    for (const c of [canvas, upper]) {
      c.width = pw;
      c.height = ph;
    }
    for (const p of pictures) if (p instanceof ImageBitmap) p.close();
    pictures = [];
    shown[0] = shown[1] = -1;
    gen++;
    print.size(gen, pw, ph, Math.max(3, 3.2 * Math.min(1.5, pw / WORLD.w / m.uC)));
    // the plate in view first, then the one after it, then the rest
    const now = Math.min(Math.max(Math.round(pos), 0), N - 1);
    const order = [now, now + 1, ...Array.from({ length: N }, (_, k) => k)];
    for (const i of new Set(order.filter((k) => k < N))) print.plate(gen, i);
  }

  /** The canvases' CSS size: the whole world at full-screen scale. */
  function sizeCanvases() {
    for (const c of [canvas, upper]) {
      c.style.width = `${WORLD.w * m.uF}px`;
      c.style.height = `${WORLD.h * m.uF}px`;
    }
  }

  /** The stage's box: the whole screen during the opening, the frame after.
   *  Set only when it changes, since it moves layout. */
  let mode: 'screen' | 'frame' | '' = '';
  function frameStage(next: 'screen' | 'frame') {
    if (mode === next) return;
    mode = next;
    const full = next === 'screen';
    stage.style.left = full ? `${-m.fx}px` : '0px';
    stage.style.top = full ? `${-m.fy}px` : '0px';
    stage.style.width = `${full ? m.SW : m.fw}px`;
    stage.style.height = `${full ? m.SH : m.fh}px`;
  }

  /** Per frame of the opening: only a transform and a clip. */
  function place() {
    const e = q * q * (3 - 2 * q);
    if (e >= 1) {
      // settled: everything relative to the frame, so it stays right however
      // far the page has scrolled since the layout was read
      frameStage('frame');
      const t = `translate3d(${(m.fw - 1000 * m.uC) / 2 + WORLD.x0 * m.uC}px, ${(m.fh - WORLD.h * m.uC) * 0.6}px, 0) scale(${m.uC / m.uF})`;
      canvas.style.transform = upper.style.transform = t;
      stage.style.clipPath = `inset(0 round ${m.radius}px)`;
      return;
    }
    frameStage('screen');
    const mix = (a: number, b: number) => a + (b - a) * e;
    // full screen: the world centred across, a little more street than sky
    const fxF = (m.SW - WORLD.w * m.uF) / 2;
    const fyF = (m.SH - WORLD.h * m.uF) * 0.6;
    // column: world x 0 to 1000 across the frame
    const fxC = m.fx + (m.fw - 1000 * m.uC) / 2 + WORLD.x0 * m.uC;
    const fyC = m.fy + (m.fh - WORLD.h * m.uC) * 0.6;
    const t = `translate3d(${mix(fxF, fxC)}px, ${mix(fyF, fyC)}px, 0) scale(${mix(m.uF, m.uC) / m.uF})`;
    canvas.style.transform = upper.style.transform = t;
    const R = m.radius * e;
    stage.style.clipPath =
      `inset(${m.fy * e}px ${(m.SW - m.fx - m.fw) * e}px ${(m.SH - m.fy - m.fh) * e}px ${m.fx * e}px round ${R}px)`;
  }

  /** Copy a finished plate onto one of the canvases, if it is not there already. */
  function paint(which: 0 | 1, i: number) {
    if (shown[which] === i) return true;
    const picture = pictures[i];
    if (!picture) return false;
    ctx[which].drawImage(picture, 0, 0);
    shown[which] = i;
    return true;
  }

  /** Between plates, the next one comes through halftone dots that grow
   *  until they cover the last. Only the dot size changes as you scroll. */
  function render() {
    const p = Math.min(Math.max(pos, 0), N - 1);
    const i = Math.min(Math.floor(p), N - 2);
    let t = Math.min(1, Math.max(0, (p - i - 0.4) / 0.6));
    if (reduce) t = t < 0.5 ? 0 : 1;
    // once a change is done, the finished plate becomes the base
    paint(0, t >= 1 ? i + 1 : i);
    if (t > 0 && t < 1 && paint(1, i + 1)) {
      upper.style.setProperty('--dot', (t * t * (3 - 2 * t) * 0.75).toFixed(4));
      upper.style.visibility = 'visible';
    } else upper.style.visibility = 'hidden';

    const now = t < 0.5 ? i : i + 1;
    if (now !== caption) setCaption(now);
  }

  function setCaption(n: number) {
    caption = n;
    if (capTerm) capTerm.textContent = STORY[n].term;
    if (capLine) capLine.textContent = STORY[n].line;
    if (!reduce) {
      fig.querySelector('.riso__caption')?.animate(
        [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
        { duration: 420, easing: 'cubic-bezier(.2,.7,.2,1)' },
      );
    }
  }

  setup();
  sizeCanvases();
  place();

  let timer = 0;
  const resized = () => {
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      m = measure();
      setup();
      sizeCanvases();
      mode = '';
      place();
      render();
    }, 200);
  };
  new ResizeObserver(resized).observe(frame);
  window.addEventListener('resize', resized);

  let measured = q < 1; // the layout was read for this opening
  return {
    show(p: number) {
      pos = p;
      render();
    },
    open(v: number) {
      q = reduce ? 1 : Math.min(1, Math.max(0, v));
      // read the layout once as an opening starts (the frame does not move
      // while it runs), never per frame
      if (q < 1 && !measured) {
        m = measure();
        sizeCanvases();
        mode = '';
        measured = true;
      }
      if (q >= 1) measured = false;
      place();
    },
  };
}
