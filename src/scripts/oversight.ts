/**
 * One world, shared by every control on the site.
 *
 *   t  how much of its work we have stopped checking, 0 to 1. Written only by
 *      the hero slider.
 *   g  how many people have come to work on it, 0 to 1. Written only by the
 *      slider at the bottom of the home page.
 *
 * CSS reads both from the root and derives --tb, the damage actually done:
 * t scaled down by g. Moving any "hand it more" control clears g, so handing
 * the work away again undoes the help. Both persist for the session, so the
 * next page opens in the same world.
 */
const KEYS = { t: 'nuais-t', g: 'nuais-g' } as const;
type Key = keyof typeof KEYS;

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

function read(k: Key): number {
  try {
    const v = sessionStorage.getItem(KEYS[k]);
    return v === null ? 0 : clamp01(+v);
  } catch {
    return 0;
  }
}

function write(k: Key, v: number) {
  document.documentElement.style.setProperty(`--${k}`, String(v));
  try { sessionStorage.setItem(KEYS[k], String(v)); } catch { /* private mode */ }
  dispatchEvent(new CustomEvent(`nuais:${k}`, { detail: v }));
}

export const getT = () => read('t');
export const getG = () => read('g');
/** The damage actually visible: what was handed away, less what people fixed. */
export const getTb = () => read('t') * (1 - read('g'));

export function setT(t: number) {
  write('t', clamp01(t));
  if (read('g') > 0) write('g', 0);
}
export function setG(g: number) { write('g', clamp01(g)); }

export const onT = (fn: (t: number) => void) =>
  addEventListener('nuais:t', (e) => fn((e as CustomEvent<number>).detail));
export const onG = (fn: (g: number) => void) =>
  addEventListener('nuais:g', (e) => fn((e as CustomEvent<number>).detail));
