#!/usr/bin/env python3
"""
Generates src/components/Perceptron.astro: an inline SVG after Figure 2 of
Rosenblatt (1958), "Organization of a perceptron".

Hundreds of hand-placed cells are not something to hand-edit, so the geometry is
generated here with a fixed seed. Run it, commit the output, and never touch the
coordinates by hand.

    python3 scripts/perceptron.py

Size matters, since this ships inline in the home page HTML. Every cell in the
mosaic is one zero-length subpath with a round linecap, so a dot costs about
eleven bytes instead of the forty a <circle> element costs. About 850 cells come
in around 10 KB.

Colours are only ever the six site custom properties. Nothing here is hardcoded.
"""

import math
import random

SEED = 20250916
random.seed(SEED)

W, H = 1000, 562

# --- stage geometry ---------------------------------------------------------

OVALS = [
    dict(cx=100, cy=280, rx=86, ry=150),   # mosaic of sensory points
    dict(cx=372, cy=280, rx=86, ry=150),   # projection area
]

# The association plane is a parallelogram with vertical edges, the right one
# lifted, which is how the original draws a plane seen at an angle.
PL_X0, PL_X1 = 596, 756
PL_TOP_L, PL_TOP_R = 160, 105
PL_H = 300

RBOX_X, RBOX_W, RBOX_H = 880, 64, 64
RBOX_CY = [170, 280, 390]

CELL_PITCH = 11.6      # hex spacing of the mosaic
CELL_JITTER = 1.7
PLANE_PITCH = 16.0
PLANE_JITTER = 4.2


def n(v):
    """Compact number: integers lose their .0, everything else keeps one place."""
    r = round(v, 1)
    return str(int(r)) if r == int(r) else str(r)


def dots(points):
    """Zero-length subpaths. With a round linecap each one paints as a disc."""
    return "".join("M%d %dh0" % (round(x), round(y)) for x, y in points)


# --- the letter X -----------------------------------------------------------

def seg_dist(px, py, ax, ay, bx, by):
    vx, vy = bx - ax, by - ay
    t = ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)
    t = max(0.0, min(1.0, t))
    return math.hypot(px - (ax + t * vx), py - (ay + t * vy))


def x_strokes(o, span_x=0.76, span_y=0.67):
    ax, bx = o["cx"] - span_x * o["rx"], o["cx"] + span_x * o["rx"]
    ay, by = o["cy"] - span_y * o["ry"], o["cy"] + span_y * o["ry"]
    return [(ax, ay, bx, by), (bx, ay, ax, by)]


def on_x(o, x, y, half, warp=0.0):
    if warp:
        x = x + warp * math.sin((y - o["cy"]) / 37.0)
    return min(seg_dist(x, y, *s) for s in x_strokes(o))<= half


# --- mosaics ----------------------------------------------------------------

def mosaic(o, half, warp, keep, stray):
    """Jittered hex lattice clipped to the ellipse, split into dim and active."""
    dim, hot = [], []
    row_h = CELL_PITCH * math.sqrt(3) / 2
    rows = int((2 * o["ry"]) / row_h)
    for i in range(rows + 1):
        y0 = o["cy"] - o["ry"] + i * row_h + row_h / 2
        offset = (i % 2) * CELL_PITCH / 2
        cols = int((2 * o["rx"]) / CELL_PITCH) + 2
        for j in range(cols + 1):
            x0 = o["cx"] - o["rx"] + offset + j * CELL_PITCH
            x = x0 + random.uniform(-CELL_JITTER, CELL_JITTER)
            y = y0 + random.uniform(-CELL_JITTER, CELL_JITTER)
            # Inset so no cell straddles the outline.
            if ((x - o["cx"]) / (o["rx"] - 6.5)) ** 2 + ((y - o["cy"]) / (o["ry"] - 6.5)) ** 2 > 1:
                continue
            d = min(seg_dist(x + warp * math.sin((y - o["cy"]) / 37.0), y, *s)
                    for s in x_strokes(o))
            if d <= half:
                (hot if random.random() < keep else dim).append((x, y))
            elif d <= half * 2.1 and random.random() < stray:
                hot.append((x, y))
            else:
                dim.append((x, y))
    return dim, hot


def plane_point(s, t):
    x = PL_X0 + s * (PL_X1 - PL_X0)
    y = PL_TOP_L + s * (PL_TOP_R - PL_TOP_L) + t * PL_H
    return x, y


def plane_cells():
    dim, hot = [], []
    cols = int((PL_X1 - PL_X0) / PLANE_PITCH)
    rows = int(PL_H / PLANE_PITCH)
    for i in range(rows):
        for j in range(cols):
            s = 0.055 + 0.89 * (j + 0.5 + (i % 2) * 0.5) / cols
            t = 0.035 + 0.93 * (i + 0.5) / rows
            x, y = plane_point(s, t)
            x += random.uniform(-PLANE_JITTER, PLANE_JITTER)
            y += random.uniform(-PLANE_JITTER, PLANE_JITTER)
            dim.append((x, y))
    # A-units respond to features, not to position, so the active ones are
    # scattered rather than patterned. Spread them so no two land on top of
    # each other.
    picks = []
    tries = 0
    while len(picks) < 8 and tries < 4000:
        tries += 1
        c = random.choice(dim)
        if all(math.hypot(c[0] - p[0], c[1] - p[1]) > 46 for p in picks):
            picks.append(c)
    for p in picks:
        dim.remove(p)
        hot.append(p)
    hot.sort(key=lambda p: p[1])
    return dim, hot


# --- connections ------------------------------------------------------------

def ellipse_x(o, y, side):
    k = 1 - ((y - o["cy"]) / o["ry"]) ** 2
    return o["cx"] + side * o["rx"] * math.sqrt(max(k, 0.0))


def topographic():
    """Straight, one to one, stage one to stage two."""
    a, b = OVALS
    paths, heads = [], []
    for i in range(9):
        y = a["cy"] + (i - 4) / 4.0 * 0.86 * a["ry"]
        x0 = ellipse_x(a, y, +1)
        x1 = ellipse_x(b, y, -1)
        paths.append("M%s %sH%s" % (n(x0), n(y), n(x1)))
        if i % 2 == 0:
            hx = x0 + (x1 - x0) * 0.62
            heads.append("M%s %sl-9 -5.5M%s %sl-9 5.5" % (n(hx), n(y), n(hx), n(y)))
    return paths, heads


def random_connections():
    """Crossed and shuffled, stage two to the association plane."""
    b = OVALS[1]
    starts = [b["cy"] + (i - 4) / 4.0 * 0.84 * b["ry"] for i in range(9)]
    ends = [PL_TOP_L + (i + 0.5) / 9.0 * PL_H for i in range(9)]
    order = list(range(9))
    random.shuffle(order)
    paths, heads = [], []
    for i, k in enumerate(order):
        sy = starts[i]
        sx = ellipse_x(b, sy, +1)
        ey = ends[k]
        c1 = sx + (PL_X0 - sx) * random.uniform(0.22, 0.62)
        c2 = PL_X0 - random.uniform(28, 96)
        paths.append("M%s %sC%s %s %s %s %s %s"
                     % (n(sx), n(sy), n(c1), n(sy + random.uniform(-9, 9)),
                        n(c2), n(ey), n(PL_X0), n(ey)))
        heads.append("M%s %sl-9 -5.5M%s %sl-9 5.5"
                     % (n(PL_X0), n(ey), n(PL_X0), n(ey)))
    return paths, heads


def fan(hot):
    """Active A-units into R1. These are the lines the original draws in red."""
    out = []
    top, bot = RBOX_CY[0] - 23, RBOX_CY[0] + 23
    for i, (x, y) in enumerate(hot):
        ty = top + (bot - top) * (i / max(len(hot) - 1, 1))
        c1 = x + (RBOX_X - x) * 0.46
        out.append("M%s %sC%s %s %s %s %s %s"
                   % (n(x), n(y), n(c1), n(y), n(RBOX_X - 28), n(ty), n(RBOX_X), n(ty)))
    return out


def to_other_units():
    """The plainer traffic: plane out to R2 and Rn."""
    out = []
    spec = [(0.30, 1, -15), (0.62, 1, 13), (0.44, 2, -17), (0.74, 2, 1), (0.92, 2, 17)]
    for t, unit, off in spec:
        x, y = plane_point(1.0, t)
        ty = RBOX_CY[unit] + off
        c1 = x + (RBOX_X - x) * random.uniform(0.34, 0.5)
        out.append("M%s %sC%s %s %s %s %s %s"
                   % (n(x), n(y), n(c1), n(y), n(RBOX_X - 70), n(ty), n(RBOX_X), n(ty)))
    return out


# --- assembly ---------------------------------------------------------------

dim1, hot1 = mosaic(OVALS[0], half=17.0, warp=0.0, keep=0.99, stray=0.015)
dim2, hot2 = mosaic(OVALS[1], half=16.5, warp=5.0, keep=0.95, stray=0.035)
pdim, phot = plane_cells()

topo_p, topo_h = topographic()
rand_p, rand_h = random_connections()
fan_p = fan(phot)
other_p = to_other_units()

plane_path = "M%s %sL%s %sL%s %sL%s %sZ" % (
    n(PL_X0), n(PL_TOP_L), n(PL_X1), n(PL_TOP_R),
    n(PL_X1), n(PL_TOP_R + PL_H), n(PL_X0), n(PL_TOP_L + PL_H))

L = []
A = L.append
A('<svg class="art perceptron" viewBox="0 0 %d %d" role="img" aria-labelledby="pt-t pt-d" xmlns="http://www.w3.org/2000/svg">' % (W, H))
A('  <title id="pt-t">Organization of a perceptron</title>')
A('  <desc id="pt-d">After Rosenblatt, 1958. A mosaic of sensory points feeds a projection area through topographic connections, then an association system through random connections, then response units. The cells active for the input pattern spell the letter X and are marked in red.</desc>')

A('  <g class="pt-wire">')
A('    <path d="%s"/>' % "".join(topo_p))
A('    <path d="%s"/>' % "".join(rand_p))
A('    <path d="%s"/>' % "".join(other_p))
A('  </g>')
A('  <g class="pt-head"><path d="%s"/></g>' % "".join(topo_h + rand_h))

A('  <g class="pt-body">')
for o in OVALS:
    A('    <ellipse cx="%d" cy="%d" rx="%d" ry="%d"/>' % (o["cx"], o["cy"], o["rx"], o["ry"]))
A('    <path d="%s"/>' % plane_path)
A('  </g>')

# Every cell is painted grey, active ones included, so that when the activation
# fades the mosaic stays whole instead of showing an X-shaped hole.
A('  <path class="pt-cell" d="%s"/>' % dots(dim1 + hot1 + dim2 + hot2 + pdim + phot))
A('  <path class="pt-hot fire st1" d="%s"/>' % dots(hot1))
A('  <path class="pt-hot fire st2" d="%s"/>' % dots(hot2))
A('  <path class="pt-hot pt-hot--a fire st3" d="%s"/>' % dots(phot))
A('  <g class="fan"><path d="%s"/></g>' % "".join(fan_p))

A('  <g class="pt-body">')
for cy in RBOX_CY:
    A('    <rect x="%d" y="%d" width="%d" height="%d"/>' % (RBOX_X, cy - RBOX_H // 2, RBOX_W, RBOX_H))
A('  </g>')
A('  <g class="pt-unit">')
for cy, lab in zip(RBOX_CY, ["1", "2", "n"]):
    A('    <text x="%d" y="%d">R<tspan class="pt-sub" dy="5">%s</tspan></text>'
      % (RBOX_X + RBOX_W // 2 - 4, cy + 7, lab))
A('  </g>')

A('  <g class="fire st4">')
A('    <rect class="pt-lit" x="%d" y="%d" width="%d" height="%d"/>'
  % (RBOX_X, RBOX_CY[0] - RBOX_H // 2, RBOX_W, RBOX_H))
A('    <path class="pt-out" d="M%d %dH992M980 %dl12 %dl-12 %d"/>'
  % (RBOX_X + RBOX_W, RBOX_CY[0], RBOX_CY[0] - 7, 7, 7))
A('  </g>')

A('  <g class="pt-label">')
for x, l1, l2 in [(OVALS[0]["cx"], "Mosaic of", "sensory points"),
                  (OVALS[1]["cx"], "Projection", "area"),
                  ((PL_X0 + PL_X1) // 2, "Association", "system"),
                  (RBOX_X + RBOX_W // 2, "Response", "units")]:
    A('    <text x="%d" y="34">%s<tspan x="%d" dy="27">%s</tspan></text>' % (x, l1, x, l2))
A('  </g>')

A('  <g class="pt-label pt-label--foot">')
for x, l1, l2 in [(236, "Topographic", "connections"),
                  (527, "Random", "connections")]:
    A('    <text x="%d" y="490">%s<tspan x="%d" dy="26">%s</tspan></text>' % (x, l1, x, l2))
A('  </g>')
A('  <g class="pt-head pt-head--foot"><path d="M%d 538H%dm-11 -5.5l11 5.5l-11 5.5M%d 538H%dm-11 -5.5l11 5.5l-11 5.5"/></g>'
  % (236 - 46, 236 + 46, 527 - 46, 527 + 46))
A('</svg>')

svg = "\n".join(L)

DOC = '''---
/**
 * Hero illustration: the organization of a perceptron, after Rosenblatt (1958),
 * Figure 2.
 *
 * A mosaic of sensory points feeds a projection area, then an association
 * system, then response units. The cells active for the input pattern are red
 * and they spell the letter X, which is the original figure's own convention
 * and also the whole idea of interpretability: seeing which units fire for a
 * given concept.
 *
 * Generated by scripts/perceptron.py with a fixed seed. Do not hand-edit the
 * coordinates, change the generator and run it again. Every cell in the mosaic
 * is a zero-length subpath with a round linecap, which is why about %d cells
 * cost so little.
 *
 * Presentation lives in global.css under "perceptron", including the activation
 * sweep, which is behind prefers-reduced-motion and renders as the static fired
 * state otherwise.
 */
---
%s
'''

out = DOC % (len(dim1) + len(hot1) + len(dim2) + len(hot2) + len(pdim) + len(phot), svg)
path = "src/components/Perceptron.astro"
with open(path, "w") as f:
    f.write(out)

print("cells: %d + %d ovals, %d plane" % (len(dim1) + len(hot1), len(dim2) + len(hot2), len(pdim) + len(phot)))
print("active: %d / %d / %d" % (len(hot1), len(hot2), len(phot)))
print("bytes: %d" % len(out))
