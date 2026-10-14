/**
 * A row of cards that moves sideways as you scroll down, on a phone.
 *
 * The row's wrapper is pinned in view while the page scroll is turned into a
 * sideways move of the row, until its last card is in view; then the page
 * carries on. Used by the Get involved cards and the two fellowship tracks.
 *
 * Without this (no JavaScript, reduced motion, a wider screen) the row is
 * whatever the CSS makes it: on a phone, a row you swipe yourself.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export interface Sideways {
  /** Scroll the page to a point along the row, 0 to 1. False if not pinned. */
  go(progress: number): boolean;
}

export function sideways(row: HTMLElement, media: string, onProgress?: (p: number) => void): Sideways {
  const wrap = row.parentElement!;
  let trigger: ScrollTrigger | null = null;

  gsap.matchMedia().add(`${media} and (prefers-reduced-motion: no-preference)`, () => {
    wrap.classList.add('is-sideways');
    const distance = () => Math.max(0, row.scrollWidth - row.clientWidth);
    const tween = gsap.to(row, {
      x: () => -distance(),
      ease: 'none',
      scrollTrigger: {
        trigger: wrap,
        start: 'center 55%',
        end: () => `+=${distance()}`,
        pin: true,
        scrub: true, // the smooth scroll already eases it
        invalidateOnRefresh: true,
        onUpdate: (self) => onProgress?.(self.progress),
      },
    });
    trigger = tween.scrollTrigger ?? null;
    return () => {
      wrap.classList.remove('is-sideways');
      trigger = null;
    };
  });

  return {
    go(p) {
      if (!trigger) return false;
      const y = trigger.start + (trigger.end - trigger.start) * p;
      const lenis = (window as unknown as { lenis?: { scrollTo(y: number): void } }).lenis;
      if (lenis) lenis.scrollTo(y);
      else window.scrollTo({ top: y, behavior: 'smooth' });
      return true;
    },
  };
}
