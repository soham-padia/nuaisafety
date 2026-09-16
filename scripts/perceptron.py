#!/usr/bin/env python3
"""
Generates src/components/Perceptron.astro: an inline SVG after Figure 2 of
Rosenblatt (1958), "Organization of a perceptron".

    python3 scripts/perceptron.py

The diagram cycles through three inputs. Each one lights a different pattern in
the sensory mosaic and the projection area, fires a different scatter of
association units, and drives a different response unit. One fact becomes a
mechanism: the same wiring, three inputs, three answers.

Hundreds of hand-placed cells are not something to hand-edit, so the geometry is
generated here with a fixed seed. Run it, commit the output, and never touch the
coordinates by hand.

Size matters, since this ships inline in the home page HTML. Two tricks keep it
small. Every cell is one zero-length subpath with a round linecap, so it costs a
move rather than a whole <circle> element. And after the first, every move is
relative to the last, so a neighbouring cell costs "m12 0h0" rather than a pair
of four-digit absolutes. The grey mosaic is the full lattice and is shared by all
three inputs, so only the red layers multiply.

Colours are only ever the six site custom properties. Nothing here is hardcoded.
"""

import math
import random

SEED = 20250916

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

# Each input: a name, the response unit it drives, and the half width of its
# stroke in user units. The widths are not equal: an O lays down far more ink
# than a T at the same weight, so they are corrected by eye the way a type
# designer would, to make the three letters read as one family.
INPUTS = [
    ("x", 0, 17.0),
    ("o", 1, 16.2),
    ("t", 2, 18.0),
]


def n(v):
    """Compact number: integers lose their .0, everything else keeps one place."""
    r = round(v, 1)
    return str(int(r)) if r == int(r) else str(r)


def dots(points):
    """
    Zero-length subpaths. With a round linecap each one paints as a disc.
    The first is absolute, the rest are relative hops off their neighbour,
    which is where most of the byte saving comes from.
    """
    out = []
    px = py = None
    for x, y in points:
        X, Y = round(x), round(y)
        if px is None:
            out.append("M%d %dh0" % (X, Y))
        else:
            dx, dy = X - px, Y - py
            if dx == 0 and dy == 0:
                continue
            # A minus sign is its own separator, so only a positive y needs a space.
            out.append("m%d%sh0" % (dx, str(dy) if dy < 0 else " %d" % dy))
        px, py = X, Y
    return "".join(out)


# --- the input patterns -----------------------------------------------------

def seg_dist(px, py, ax, ay, bx, by):
    vx, vy = bx - ax, by - ay
    t = ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)
    t = max(0.0, min(1.0, t))
    return math.hypot(px - (ax + t * vx), py - (ay + t * vy))


def strokes(o, kind):
    """
    A pattern is a list of segments in real coordinates. Measuring the distance
    to segments rather than working in normalized ellipse space is what keeps
    the stroke an even thickness in a mosaic that is much taller than it is wide.
    """
    cx, cy, rx, ry = o["cx"], o["cy"], o["rx"], o["ry"]
    if kind == "x":
        ax, bx = cx - 0.76 * rx, cx + 0.76 * rx
        ay, by = cy - 0.67 * ry, cy + 0.67 * ry
        return [(ax, ay, bx, by), (bx, ay, ax, by)]
    if kind == "o":
        a, b = 0.60 * rx, 0.64 * ry
        pts = [(cx + a * math.cos(i / 48 * 2 * math.pi),
                cy + b * math.sin(i / 48 * 2 * math.pi)) for i in range(49)]
        return [(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]) for i in range(48)]
    if kind == "t":
        top = cy - 0.50 * ry
        return [(cx - 0.62 * rx, top, cx + 0.62 * rx, top),
                (cx, top, cx, cy + 0.62 * ry)]
    raise ValueError(kind)


def band(o, kind, x, y, warp=0.0):
    """Distance from a cell to the nearest stroke of the pattern."""
    if warp:
        x = x + warp * math.sin((y - o["cy"]) / 37.0)
    return min(seg_dist(x, y, *s) for s in strokes(o, kind))


# --- lattices ---------------------------------------------------------------

def lattice(o, rng):
    """Jittered hex lattice clipped to the ellipse, in row order."""
    cells = []
    row_h = CELL_PITCH * math.sqrt(3) / 2
    rows = int((2 * o["ry"]) / row_h)
    for i in range(rows + 1):
        y0 = o["cy"] - o["ry"] + i * row_h + row_h / 2
        offset = (i % 2) * CELL_PITCH / 2
        cols = int((2 * o["rx"]) / CELL_PITCH) + 2
        for j in range(cols + 1):
            x0 = o["cx"] - o["rx"] + offset + j * CELL_PITCH
            x = x0 + rng.uniform(-CELL_JITTER, CELL_JITTER)
            y = y0 + rng.uniform(-CELL_JITTER, CELL_JITTER)
            # Inset so no cell straddles the outline.
            if ((x - o["cx"]) / (o["rx"] - 6.5)) ** 2 + ((y - o["cy"]) / (o["ry"] - 6.5)) ** 2 > 1:
                continue
            cells.append((x, y))
    return cells


def plane_point(s, t):
    x = PL_X0 + s * (PL_X1 - PL_X0)
    y = PL_TOP_L + s * (PL_TOP_R - PL_TOP_L) + t * PL_H
    return x, y


def plane_lattice(rng):
    cells = []
    cols = int((PL_X1 - PL_X0) / PLANE_PITCH)
    rows = int(PL_H / PLANE_PITCH)
    for i in range(rows):
        for j in range(cols):
            s = 0.055 + 0.89 * (j + 0.5 + (i % 2) * 0.5) / cols
            t = 0.035 + 0.93 * (i + 0.5) / rows
            x, y = plane_point(s, t)
            cells.append((x + rng.uniform(-PLANE_JITTER, PLANE_JITTER),
                          y + rng.uniform(-PLANE_JITTER, PLANE_JITTER)))
    return cells


def fired(o, cells, kind, half, warp, keep, stray, rng):
    """Cells of the lattice this input excites, with a little noise at the edge."""
    hot = []
    for (x, y) in cells:
        d = band(o, kind, x, y, warp)
        if d <= half:
            if rng.random() < keep:
                hot.append((x, y))
        elif d <= half * 2.1 and rng.random() < stray:
            hot.append((x, y))
    return hot


def a_units(cells, rng, count=8, apart=46):
    """
    A-units respond to features, not to position, so the active ones are
    scattered rather than patterned. Spread them so no two land on top of
    each other, then order them top to bottom for the fan.
    """
    picks = []
    for _ in range(4000):
        if len(picks) == count:
            break
        c = rng.choice(cells)
        if all(math.hypot(c[0] - p[0], c[1] - p[1]) > apart for p in picks):
            picks.append(c)
    picks.sort(key=lambda p: p[1])
    return picks


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


def random_connections(rng):
    """Crossed and shuffled, stage two to the association plane."""
    b = OVALS[1]
    starts = [b["cy"] + (i - 4) / 4.0 * 0.84 * b["ry"] for i in range(9)]
    ends = [PL_TOP_L + (i + 0.5) / 9.0 * PL_H for i in range(9)]
    order = list(range(9))
    rng.shuffle(order)
    paths, heads = [], []
    for i, k in enumerate(order):
        sy = starts[i]
        sx = ellipse_x(b, sy, +1)
        ey = ends[k]
        c1 = sx + (PL_X0 - sx) * rng.uniform(0.22, 0.62)
        c2 = PL_X0 - rng.uniform(28, 96)
        paths.append("M%s %sC%s %s %s %s %s %s"
                     % (n(sx), n(sy), n(c1), n(sy + rng.uniform(-9, 9)),
                        n(c2), n(ey), n(PL_X0), n(ey)))
        heads.append("M%s %sl-9 -5.5M%s %sl-9 5.5" % (n(PL_X0), n(ey), n(PL_X0), n(ey)))
    return paths, heads


def fan(hot, unit):
    """
    The active A-units into the response unit this input drives. These are the
    lines the original draws in red.
    """
    out = []
    top, bot = RBOX_CY[unit] - 23, RBOX_CY[unit] + 23
    for i, (x, y) in enumerate(hot):
        ty = top + (bot - top) * (i / max(len(hot) - 1, 1))
        c1 = x + (RBOX_X - x) * 0.46
        out.append("M%s %sC%s %s %s %s %s %s"
                   % (n(x), n(y), n(c1), n(y), n(RBOX_X - 28), n(ty), n(RBOX_X), n(ty)))
    return out


def to_all_units(rng):
    """
    The plainer traffic. Every response unit is wired to the plane whether or
    not it is the one firing, which is the whole point of having three.
    """
    out = []
    spec = [(0.14, 0, -15), (0.52, 0, 13),
            (0.30, 1, -16), (0.72, 1, 14),
            (0.44, 2, -15), (0.90, 2, 15)]
    for t, unit, off in spec:
        x, y = plane_point(1.0, t)
        ty = RBOX_CY[unit] + off
        c1 = x + (RBOX_X - x) * rng.uniform(0.34, 0.5)
        out.append("M%s %sC%s %s %s %s %s %s"
                   % (n(x), n(y), n(c1), n(y), n(RBOX_X - 70), n(ty), n(RBOX_X), n(ty)))
    return out


# --- assembly ---------------------------------------------------------------

rng = random.Random(SEED)
lat = [lattice(OVALS[0], rng), lattice(OVALS[1], rng)]
latp = plane_lattice(rng)

topo_p, topo_h = topographic()
rand_p, rand_h = random_connections(rng)
other_p = to_all_units(rng)

patterns = []
for k, (kind, unit, half) in enumerate(INPUTS):
    r = random.Random(SEED + 101 * (k + 1))
    patterns.append(dict(
        kind=kind,
        unit=unit,
        hot1=fired(OVALS[0], lat[0], kind, half, 0.0, 0.99, 0.015, r),
        hot2=fired(OVALS[1], lat[1], kind, half - 0.5, 5.0, 0.95, 0.035, r),
        hotp=a_units(latp, r),
    ))
for p in patterns:
    p["fan"] = fan(p["hotp"], p["unit"])

plane_path = "M%s %sL%s %sL%s %sL%s %sZ" % (
    n(PL_X0), n(PL_TOP_L), n(PL_X1), n(PL_TOP_R),
    n(PL_X1), n(PL_TOP_R + PL_H), n(PL_X0), n(PL_TOP_L + PL_H))

L = []
A = L.append
A('<svg class="art perceptron" viewBox="0 0 %d %d" role="img" aria-labelledby="pt-t pt-d" xmlns="http://www.w3.org/2000/svg">' % (W, H))
A('  <title id="pt-t">Organization of a perceptron</title>')
A('  <desc id="pt-d">After Rosenblatt, 1958. A mosaic of sensory points feeds a '
  'projection area through topographic connections, then an association system '
  'through random connections, then three response units. The diagram cycles '
  'through three inputs, the letters X, O and T. For each one the cells active '
  'in the mosaic and in the projection area are marked in red, a different '
  'scatter of association units fires, and a different response unit produces '
  'the output impulse.</desc>')

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
for cy in RBOX_CY:
    A('    <rect x="%d" y="%d" width="%d" height="%d"/>' % (RBOX_X, cy - RBOX_H // 2, RBOX_W, RBOX_H))
A('  </g>')

# Every cell of every lattice is painted grey, active ones included, so that as
# one input clears and the next arrives the mosaic stays whole instead of
# showing a pattern-shaped hole.
A('  <path class="pt-cell" d="%s"/>' % dots(lat[0] + lat[1] + latp))

A('  <g class="pt-unit">')
for cy, lab in zip(RBOX_CY, ["1", "2", "n"]):
    A('    <text x="%d" y="%d">R<tspan class="pt-sub" dy="5">%s</tspan></text>'
      % (RBOX_X + RBOX_W // 2 - 4, cy + 7, lab))
A('  </g>')

for p in patterns:
    A('  <g class="pat pat--%s">' % p["kind"])
    A('    <path class="pt-hot fire st1" d="%s"/>' % dots(p["hot1"]))
    A('    <path class="pt-hot fire st2" d="%s"/>' % dots(p["hot2"]))
    A('    <path class="pt-hot pt-hot--a fire st3" d="%s"/>' % dots(p["hotp"]))
    A('    <g class="fan"><path d="%s"/></g>' % "".join(p["fan"]))
    cy = RBOX_CY[p["unit"]]
    A('    <g class="fire st4">')
    A('      <rect class="pt-lit" x="%d" y="%d" width="%d" height="%d"/>'
      % (RBOX_X, cy - RBOX_H // 2, RBOX_W, RBOX_H))
    A('      <path class="pt-out" d="M%d %dH992M980 %dl12 7l-12 7"/>'
      % (RBOX_X + RBOX_W, cy, cy - 7))
    A('    </g>')
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
 * system, then three response units. The diagram cycles through three inputs,
 * the letters X, O and T. Each one lights its own pattern in the two mosaics,
 * fires its own scatter of association units, and drives its own response unit.
 * Red for the active cells is the original figure's own convention and also the
 * whole idea of interpretability: seeing which units fire for a given concept,
 * and that different concepts fire different units.
 *
 * Generated by scripts/perceptron.py with a fixed seed. Do not hand-edit the
 * coordinates, change the generator and run it again. The grey mosaic is the
 * full lattice of %d cells and is shared by all three inputs; only the %d red
 * cells multiply.
 *
 * Presentation lives in global.css under "perceptron", including the cycle,
 * which is behind prefers-reduced-motion. Without motion it settles on one
 * complete input, the letter X firing R1, which is also the frame the Open
 * Graph card is rendered from.
 */
---
%s
'''

hotn = sum(len(p["hot1"]) + len(p["hot2"]) + len(p["hotp"]) for p in patterns)
out = DOC % (len(lat[0]) + len(lat[1]) + len(latp), hotn, svg)
with open("src/components/Perceptron.astro", "w") as f:
    f.write(out)

print("grey lattice: %d + %d ovals, %d plane" % (len(lat[0]), len(lat[1]), len(latp)))
for p in patterns:
    print("  %s -> R%s: %d sensory, %d projection, %d a-units"
          % (p["kind"].upper(), ["1", "2", "n"][p["unit"]],
             len(p["hot1"]), len(p["hot2"]), len(p["hotp"])))
print("red cells total: %d" % hotn)
print("component bytes: %d" % len(out))
