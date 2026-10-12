/**
 * Prints the street plates off the main thread, so drawing them never
 * stutters a scroll or an animation. The page (street-view.ts) says what size
 * to print at, then asks for plates in the order it wants them; each one comes
 * back as a finished picture.
 */
import { screens, print, type Screens } from './riso';
import { drawPlate } from './street';

type Message =
  | { type: 'size'; gen: number; pw: number; ph: number; dot: number }
  | { type: 'plate'; gen: number; i: number };

let sc: Screens | null = null;
let size = { gen: -1, pw: 0, ph: 0 };

self.onmessage = async (e: MessageEvent<Message>) => {
  const m = e.data;
  if (m.type === 'size') {
    size = { gen: m.gen, pw: m.pw, ph: m.ph };
    sc = screens(m.pw, m.ph, m.dot);
    return;
  }
  // a request from before a resize is no longer wanted
  if (m.gen !== size.gen || !sc) return;
  const bitmap = await createImageBitmap(print(drawPlate(m.i, size.pw, size.ph), sc));
  (self as unknown as Worker).postMessage({ gen: m.gen, i: m.i, bitmap }, [bitmap]);
};
