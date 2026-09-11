# Web craft

What was actually used to build this site, why, and the specific things that
cost time. `DESIGN.md` records what was decided for *this* site. This file is the
transferable part: the method, the techniques, and the traps.

Everything here was measured on this project. Numbers are real.

---

## Method

### Research the register before writing any CSS

Pull four sites in the same category and extract what they *agree* on. Unanimity
across independent teams is a strong signal; one site doing something is taste.

For this project all four peer sites used a sans for body text, a neutral base
with exactly one accent, abstract vector art or no imagery at all, and a mailing
list as the primary call to action. That converged set became the brief.

**The more valuable output is the patterns you cannot copy.** One reference used
a partner logo grid, another used member counts. Both were ruled out by this
project's constraints. Knowing that early prevented building something that had
to be torn out.

### Verify, do not assume

Contrast was computed, not eyeballed. The accent `#c8102e` on white is **5.88:1**,
which passes AA for normal text and not only for large. That single number decided
whether the accent could be used on body-size links. Muted `#5b6169` on white is
6.25:1, and 5.76:1 on the `#f6f7f8` wash.

Compute relative luminance properly rather than trusting a swatch:

```
c_lin = c/255 <= 0.03928 ? (c/255)/12.92 : (((c/255)+0.055)/1.055)^2.4
L     = 0.2126*R_lin + 0.7152*G_lin + 0.0722*B_lin
ratio = (L_light + 0.05) / (L_dark + 0.05)
```

### Iterate by screenshot, not by imagination

Render, look at it, judge it, fix it. This caught things that reasoning did not:

- A generated hero illustration that read as a **line chart** rather than a network,
  because evenly spaced columns plus one zigzag polyline is the visual grammar of
  a time series
- A second attempt that read as a generic blob and never resolved into the shape
  it was supposed to be
- A square logo with the text off-centre and half the canvas empty

None of those were visible in the markup. All were obvious in one look.

---

## Type

One family, system stack, no webfont request:

```css
--sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto,
        "Helvetica Neue", Arial, sans-serif;
```

Fluid scale with `clamp()` so nothing needs breakpoints:

```css
--step-0: 1.0625rem;
--step-3: clamp(1.75rem, 1.4rem + 1.6vw, 2.25rem);
--step-4: clamp(2.25rem, 1.6rem + 3.1vw, 3.5rem);
```

Details that do most of the work:

- Negative tracking on large text only. `-0.03em` on the h1, `-0.021em` on
  headings, none on body. Large type looks loose at default tracking; body text
  becomes unreadable if you tighten it.
- `text-wrap: balance` on headings, `text-wrap: pretty` on body. One line of CSS
  each, and it removes orphans and ragged headline breaks.
- Constrain the measure, not the container: `p { max-width: 34rem }`. Line length
  is a typographic property, not a layout one.
- `font-synthesis-weight: none` so a missing weight fails visibly instead of
  being faked badly.

---

## Color

Six custom properties, one accent, no gradients:

```css
--ink: #14161a;  --muted: #5b6169;  --accent: #c8102e;
--paper: #ffffff; --wash: #f6f7f8;  --rule: #e3e6e9;
```

Body text is never pure black. `#14161a` reads as black and is softer at length.

The accent appears on links, the primary button and one focal element. That is
the whole budget. The discipline is what makes it read as an accent rather than
as a theme.

Keep a pre-darkened accent for hover rather than computing one, so the hover
state is a deliberate value: `--accent-deep: #a30d26`.

---

## Layout

Grid for page structure, flex for component internals. Two container widths:
`--page: 64rem` for the outer wrap, `--measure: 34rem` for prose.

**Order the DOM for the smallest screen, then reorder with grid.** The hero puts
text before artwork in the markup so the call to action sits above the image on a
phone, and the grid swaps them at `56rem`. No duplicate markup, no `order` hacks
on the critical path.

```css
.hero__grid { display: grid; gap: 2.75rem; align-items: center; }
@media (min-width: 56rem) {
  .hero__grid { grid-template-columns: 1fr 0.8fr; gap: 4rem; }
}
```

Use `:is()` in selectors so a component survives swapping its contents:

```css
.hero__art :is(img, svg) { /* works whether the art is raster or vector */ }
```

---

## Motion

### Free things first

Three effects cost nothing and should be exhausted before any library:

**Cross-document view transitions.** Page navigation cross-fades with zero
JavaScript. Unsupported browsers simply navigate.

```css
@media (prefers-reduced-motion: no-preference) {
  @view-transition { navigation: auto; }
}
::view-transition-old(root), ::view-transition-new(root) { animation-duration: 240ms; }
```

**Scroll-driven animation** via `animation-timeline: view()`, behind `@supports`
so unsupported browsers get static content rather than invisible content.

**State transitions** on links and buttons. A 160ms ease on colour, border and
transform is the difference between a page that feels built and one that snaps.

### When a library is worth it

Framer Motion is React-only. Using it on a static site means adding a framework
runtime, roughly 80 KB, for animation alone. The same team ships **`motion`**, a
vanilla build with the same spring physics and scroll API.

Measured here: **23 KB gzipped, 0 ms total blocking time, Lighthouse still 100
across all four categories.** On a small page a deferred module costs nothing
measurable. Measure before assuming it does.

### Three rules for reveal animations

These matter more than the animation does.

**1. Never strand content invisible.** Only hide elements that are below the fold
when the script runs. Anything already on screen is never touched, so a bug
cannot hide visible content. Add a timeout that un-hides whatever the observer
never reached.

```js
for (const el of reveals) {
  if (el.getBoundingClientRect().top > innerHeight * 0.9) {
    el.style.opacity = '0'; hidden.add(el);
  }
}
setTimeout(() => { hidden.forEach(clear); }, 4000);
```

**2. Animate position, not opacity, for anything above the fold.** A deferred
module runs after paint, so an opacity animation produces a visible-then-hidden
snap. Translation has no such flash.

**3. Never animate the LCP element.** Fading in the largest contentful paint
delays the measurement of the thing you are being scored on.

Guard everything twice: `prefers-reduced-motion: no-preference` for the effect,
and `@supports` for anything using a new timeline API. Remember that the reduce
branch also needs `scroll-behavior: auto`, which an `animation: none` reset does
not cover.

---

## Images

Let the framework do the work. In Astro:

```astro
<Image src={hero} alt="..." width={420} densities={[1, 2]}
       format="webp" quality={72} loading="eager" />
```

That produced **21 KB at 1x and 67 KB at 2x from a 2.1 MB PNG**, with `srcset`,
explicit `width`/`height`, and CLS of 0.

Explicit dimensions are the entire reason CLS stayed at zero. An image without
them reserves no space and shifts everything below it.

### Open Graph cards

Generate rather than hand-design, so the card regenerates when the brand changes.
Compose an SVG for the text, composite the artwork with `sharp`, output 1200x630.

Two things that silently fail:

- **`og:image` must be an absolute URL.** Scrapers ignore root-relative paths.
  Build it from the configured site origin.
- **`twitter:card` defaults to `summary`**, a small square. `summary_large_image`
  is what produces the full-width card.

Include `og:image:width`, `og:image:height` and `og:image:alt`.

---

## Accessibility

Treated as constraints during the build rather than an audit afterwards. Result
was 100 on every page, unchanged after adding motion and imagery.

- Real `<label>` on every input. Placeholder text is not a label.
- Never remove focus outlines. Style them: `outline: 2.5px solid var(--accent); outline-offset: 3px`.
- One `<h1>` per page, headings in document order, no level skipped.
- A skip link as the first focusable element.
- `aria-current="page"` on the active nav item, with a visual treatment that is
  not colour alone.
- Meaningful SVG gets `role="img"` with `<title>` and `<desc>`. Decorative SVG
  gets `aria-hidden="true"`.
- Every claim the design makes visually should survive CSS being disabled.

---

## Traps that cost real time

**Chrome's `--virtual-time-budget` does not advance rAF-driven animations.** A
screenshot taken with it shows spring-animated elements frozen at their start
keyframe, which looks exactly like a bug where content is stuck invisible. Verify
with a normal screenshot before concluding anything.

**Headless Chrome may not honour `--window-size` for mobile widths.** A "mobile"
screenshot rendered at roughly 500px and was cropped to 390, which looks exactly
like horizontal overflow. Use real device emulation, for instance Lighthouse's
`final-screenshot` audit, to check small screens.

**A multi-line string in an HTML attribute is a bug, not formatting.** Wrapping a
long `alt` across lines in source puts a newline and a run of spaces inside the
attribute value.

**With Actions-based deploys, a `CNAME` file in the build output does not set the
custom domain.** That is branch-build behaviour. Set the domain on the repository.
Verified here: the file was present and served correctly while the API still
reported `"cname": null`.

**Setting a custom domain before DNS resolves leaves certificate provisioning
stalled.** The first validation fails and is not automatically retried. Removing
and re-adding the domain fixed it in 30 seconds after 50 minutes of waiting.

**Extensionless URLs need directory output.** File output produces `/about.html`,
which relies on a host's `.html` fallback. Directory output produces
`/about/index.html`, which resolves anywhere.

**Root-absolute asset paths break under a path prefix.** A site configured for an
apex domain emits `/_astro/...`, which 404s when served from `user.github.io/repo/`.
There is no useful preview at that URL; verify locally instead.

---

## The loop

1. Decide the register from research, and list what the constraints forbid.
2. Build with constraints as constraints, not as a later audit.
3. Screenshot it and look at it.
4. Measure the thing you are claiming: contrast ratios, bundle size, Lighthouse.
5. Fix what the measurement says, not what you assumed.

Steps 3 and 4 are the ones people skip, and they are where every real problem on
this project was found.
