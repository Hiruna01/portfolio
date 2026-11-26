"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { bayer8, dotSize, hexToRgb } from "@/lib/dither";
import { playSwitch } from "@/lib/switch-sound";
import { isDarkTheme, subscribeTheme, switchTheme } from "@/lib/theme";

/*
 * The theme switch: a small pendant lamp hanging from the top of the window, with a pull cord.
 *
 * - It is drawn like the koi pond behind the site: ordered-dithered 2px dots on the pond's own grid
 *   (lib/dither.ts), in the pond's blue ink, with amber dots for the bulb and its glow.
 * - Light theme: the lamp is on (dense, shaded shade, a bright bulb and a halo of amber dots).
 *   Dark theme: it is off (a light shade with a dotted outline, no glow).
 * - Click the shade, or tap the cord: the cord is yanked down and springs back, the lamp switches at once
 *   and the page follows with the circular reveal, spreading out from the bulb.
 * - Drag the cord: it goes taut and gives a little, with growing resistance, like a real pull cord, and
 *   the lamp leans slightly after it. Pulled down far enough it clicks and switches (once per pull).
 *   Keep pulling well past that and the cord snaps: the lamp swings and flickers, the loose end falls
 *   away, a small note says so, and the cord grows back after a few seconds.
 * - Each switch plays a short click, and letting go of the cord a softer one (lib/switch-sound.ts).
 *
 * The cord is a short rope (Verlet integration with distance constraints) and the lamp a damped
 * pendulum. The loop only runs while something moves. Each frame works out how much ink every dot cell
 * near the lamp gets and dithers it onto a small canvas (paintLamp), not through React. Invisible SVG
 * shapes over the cord and bead take the pointer; keyboard users get the switch through the button
 * over the shade.
 */

// Geometry in px, in the lamp's own frame: the pivot (top of the window) is the origin, y points down.
// The lamp is a little larger than a plain icon so it still reads at 2px dots.
const CAP_TOP = 12.5;
const CAP_BOTTOM = 18.5;
const CAP_HALF = 3.2;
const RIM_Y = 33; // the shade's open bottom edge
const SHADE_RX = 15.6;
const SHADE_RY = 14;
const BULB_CY = 33.2;
const BULB_R = 5.5;
const GLOW_R = 36;
const BEAD_R = 3.6;
const BULB_Y = 39; // where the pull cord is tied, under the bulb
const SEGMENTS = 8;
const SEG = 4; // rest length of one cord segment
const CORD = SEGMENTS * SEG;
const STUB = 3; // segments left hanging after a snap
const GIVE = 22; // the most a taut cord gives, however hard it is pulled
const SWITCH_AT = 9; // how far the cord must give to switch
const YANK = 14; // how far a click pulls the pointer past the cord, which gives about 10px
const RETRACT = 140; // ms for a released cord to ease back to its length
const SNAP_OVER = 110; // how far past the cord's length the pointer must go to snap it
const REGROW_AFTER = 6000;
const REGROW_FOR = 450;
const STEP = 1 / 60;
const GRAVITY = 1500;
const REACH = 120; // the canvas covers this far either side of the pivot
const DEPTH = 260; // and this far down
const AMBER: [number, number, number] = [242, 163, 58];

type Pt = { x: number; y: number; px: number; py: number };
const point = (x: number, y: number): Pt => ({ x, y, px: x, py: y });

function anchorAt(theta: number) {
  return { x: -BULB_Y * Math.sin(theta), y: BULB_Y * Math.cos(theta) };
}

function restingCord() {
  return Array.from({ length: SEGMENTS + 1 }, (_, i) => point(0, BULB_Y + i * SEG));
}

/** A smooth path through the cord's points. */
function cordPath(pts: Pt[]) {
  if (pts.length < 2) return "";
  let d = `M${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    d += `Q${pts[i].x.toFixed(2)} ${pts[i].y.toFixed(2)} ${mx.toFixed(2)} ${my.toFixed(2)}`;
  }
  const last = pts[pts.length - 1];
  return `${d}L${last.x.toFixed(2)} ${last.y.toFixed(2)}`;
}

const RESTING_PATH = cordPath(restingCord());

type Sim = {
  theta: number;
  omega: number;
  pts: Pt[];
  dragging: boolean;
  pointer: { x: number; y: number };
  yankUntil: number;
  snapped: boolean;
  falling: Pt[] | null;
  fallingSince: number;
  regrowAt: number;
  regrowStart: number;
  flickerStart: number;
  lit: boolean;
  /** How far the held cord currently gives. */
  give: number;
  /** A released cord eases back from how far it gave, rather than flicking back. */
  releaseAt: number;
  releaseGive: number;
  releaseDir: { x: number; y: number };
  /** After a click, the cord gets a small sideways flick once it is back, for a little wiggle. */
  wiggle: boolean;
  /** Ready to switch on the next pull; set again once the cord has eased back. */
  armed: boolean;
  /** Whether this hold switched the lamp, so letting go plays the release click. */
  clicked: boolean;
};

// The flicker after a snap: glow levels over time (ms), then back to the lamp's real state.
const FLICKER = [
  [0, 0.9],
  [70, 0.1],
  [140, 1],
  [230, 0.2],
  [300, 0.8],
  [420, 0],
  [520, 0.6],
  [640, -1],
] as const;

function flickerLevel(elapsed: number) {
  let level = -1;
  for (const [at, value] of FLICKER) if (elapsed >= at) level = value;
  return level;
}

function inkColour(): [number, number, number] {
  return hexToRgb(getComputedStyle(document.documentElement).getPropertyValue("--koi"), [26, 66, 226]);
}

type Layout = {
  ctx: CanvasRenderingContext2D;
  image: ImageData;
  cols: number;
  rows: number;
  dot: number; // one dot in CSS px
  cellX: number; // the canvas's first column, counted in dots from the window's left edge
  originX: number; // the canvas's left edge, in CSS px from the pivot
  ink: [number, number, number];
};

/**
 * Size and place the canvas so its dots fall on the pond's grid: it starts on a whole dot from the
 * window's left edge, at the top of the window, one canvas pixel per dot, scaled up without smoothing.
 * It covers the lamp's reach around the pivot but never runs past the window's edges.
 */
function placeCanvas(canvas: HTMLCanvasElement | null, pivotEl: SVGSVGElement | null): Layout | null {
  const ctx = canvas?.getContext("2d");
  if (!canvas || !pivotEl || !ctx) return null;
  const { css: dot } = dotSize();
  const pivot = pivotEl.getBoundingClientRect();
  const slot = canvas.parentElement?.getBoundingClientRect();
  if (!slot) return null;
  const first = Math.max(0, Math.floor((pivot.left - REACH) / dot));
  const end = Math.min(Math.floor(document.documentElement.clientWidth / dot), Math.ceil((pivot.left + REACH) / dot));
  const cols = Math.max(1, end - first);
  const rows = Math.ceil(DEPTH / dot);
  canvas.width = cols;
  canvas.height = rows;
  canvas.style.width = `${cols * dot}px`;
  canvas.style.height = `${rows * dot}px`;
  canvas.style.left = `${first * dot - slot.left}px`;
  // The lamp hangs from the centre of a dot, so the cords are exactly one dot wide.
  const centre = (Math.floor(pivot.left / dot) + 0.5) * dot;
  return { ctx, image: ctx.createImageData(cols, rows), cols, rows, dot, cellX: first, originX: first * dot - centre, ink: inkColour() };
}

/** Distance from (x, y) to the segment a-b. */
function segmentDistance(x: number, y: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
}

function polylineDistance(x: number, y: number, pts: Pt[]) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) best = Math.min(best, segmentDistance(x, y, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y));
  return best;
}

/**
 * Ink (blue) and glow (amber) amounts, 0 to 1, at a point in the lamp's own frame. Lit, the shade is
 * dense with a lighter highlight band and the bulb is a bright gap; off, the shade is light with a
 * dark outline and the bulb a mid grey.
 */
function lampField(x: number, y: number, lit: boolean, glowing: boolean, line: number): [number, number] {
  let ink = 0;
  if (Math.abs(x) < line && y < CAP_TOP) ink = 1; // the hanging cord
  if (Math.abs(x) < CAP_HALF && y >= CAP_TOP && y < CAP_BOTTOM) ink = lit ? 0.95 : 0.75;
  // A superellipse rather than an ellipse, so the dome keeps round shoulders at this dot size.
  const e = Math.abs(x / SHADE_RX) ** 2.6 + Math.abs((y - RIM_Y) / SHADE_RY) ** 2.6;
  if (e <= 1 && y <= RIM_Y) {
    const edge = e > 0.72;
    const highlight = Math.exp(-(((x + SHADE_RX * 0.38) / (SHADE_RX * 0.22)) ** 2)) * (y < RIM_Y - 3 ? 1 : 0);
    ink = Math.max(
      ink,
      lit ? Math.min(1, 0.9 - highlight * 0.3 + (edge ? 0.1 : 0)) : edge ? 0.9 : 0.14 + (0.18 * Math.abs(x)) / SHADE_RX - highlight * 0.1,
    );
  }
  if (Math.abs(y - RIM_Y) < 1.1 && Math.abs(x) < SHADE_RX + 0.5) ink = 1; // the rim
  if (y > RIM_Y && Math.hypot(x, y - BULB_CY) < BULB_R) return glowing ? [0, 1] : [Math.max(ink, 0.55), 0];
  return [ink, 0];
}

/** Work out every dot's ink near the lamp, dither it, and put it on the canvas. */
function paintLamp(l: Layout, s: Sim, now: number) {
  const { cols, rows, dot, image } = l;
  const data = image.data;
  data.fill(0);

  const flicker = flickerLevel(now - s.flickerStart);
  const glow = flicker >= 0 ? flicker : s.lit ? 1 : 0;
  const cos = Math.cos(s.theta);
  const sin = Math.sin(s.theta);
  const bulb = { x: -BULB_CY * sin, y: BULB_CY * cos };
  const showBead = !s.snapped || s.regrowStart > 0;
  const bead = s.pts[s.pts.length - 1];
  const looseFade = s.falling ? Math.max(0, 1 - (now - s.fallingSince) / 900) : 0;
  const line = dot * 0.55; // how close a dot must be to a cord to be inked: one dot wide, without gaps

  for (let j = 0; j < rows; j++) {
    const y = (j + 0.5) * dot;
    for (let i = 0; i < cols; i++) {
      const x = l.originX + (i + 0.5) * dot;
      let ink = 0;
      let warm = 0;
      if (y < RIM_Y + BULB_R + 6 && Math.abs(x) < SHADE_RX + 14) {
        // Into the lamp's own frame, which swings about the pivot.
        [ink, warm] = lampField(x * cos + y * sin, -x * sin + y * cos, s.lit, glow > 0.5, line);
      }
      if (ink < 1 && polylineDistance(x, y, s.pts) < line) ink = 1;
      if (showBead && Math.hypot(x - bead.x, y - bead.y) < BEAD_R) ink = 1;
      if (s.falling && looseFade > 0) {
        const end = s.falling[s.falling.length - 1];
        if (polylineDistance(x, y, s.falling) < line || Math.hypot(x - end.x, y - end.y) < BEAD_R) ink = Math.max(ink, looseFade);
      }
      if (glow > 0 && ink < 0.05 && warm === 0) {
        const d = Math.hypot(x - bulb.x, y - bulb.y);
        if (d < GLOW_R) warm = glow * 0.36 * (1 - d / GLOW_R) ** 1.8;
      }
      const threshold = bayer8(l.cellX + i, j);
      const colour = ink > threshold ? l.ink : warm > threshold ? AMBER : null;
      if (!colour) continue;
      const k = (j * cols + i) * 4;
      data[k] = colour[0];
      data[k + 1] = colour[1];
      data[k + 2] = colour[2];
      data[k + 3] = 255;
    }
  }
  l.ctx.putImageData(image, 0, 0);
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function LampToggle() {
  const dark = useSyncExternalStore(subscribeTheme, isDarkTheme, () => false);
  // Set while the lamp has already switched but the page has not caught up yet.
  const [pending, setPending] = useState<boolean | null>(null);
  const lit = pending ?? !dark;
  const [note, setNote] = useState(0);

  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cordHitRef = useRef<SVGPathElement>(null);
  const beadHitRef = useRef<SVGCircleElement>(null);
  const layout = useRef<Layout | null>(null);

  const sim = useRef<Sim>({
    theta: 0,
    omega: 0,
    pts: restingCord(),
    dragging: false,
    pointer: { x: 0, y: 0 },
    yankUntil: 0,
    snapped: false,
    falling: null,
    fallingSince: 0,
    regrowAt: 0,
    regrowStart: 0,
    flickerStart: -Infinity,
    lit: true,
    give: 0,
    releaseAt: 0,
    releaseGive: 0,
    releaseDir: { x: 0, y: 1 },
    wiggle: false,
    armed: true,
    clicked: false,
  });
  const frame = useRef(0);
  const press = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const timers = useRef<number[]>([]);

  // The loop reads the lamp's state from the ref, so it never waits for a render. A theme change
  // repaints in the new ink.
  useEffect(() => {
    sim.current.lit = lit;
    if (layout.current) layout.current.ink = inkColour();
    repaint();
  }, [lit, dark]);

  // Line the canvas up with the pond's dot grid, now and whenever the window changes size.
  useEffect(() => {
    const place = () => {
      layout.current = placeCanvas(canvasRef.current, svgRef.current);
      repaint();
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, []);

  useEffect(() => {
    const scheduled = timers.current;
    return () => {
      cancelAnimationFrame(frame.current);
      scheduled.forEach(clearTimeout);
    };
  }, []);

  function repaint() {
    if (layout.current) paintLamp(layout.current, sim.current, performance.now());
  }

  function draw() {
    const s = sim.current;
    repaint();
    // Move the invisible grab targets with the cord.
    cordHitRef.current?.setAttribute("d", cordPath(s.pts));
    const bead = s.pts[s.pts.length - 1];
    const el = beadHitRef.current;
    if (el) {
      el.setAttribute("cx", bead.x.toFixed(2));
      el.setAttribute("cy", bead.y.toFixed(2));
      el.style.display = !s.snapped || s.regrowStart > 0 ? "" : "none";
    }
  }

  function snap() {
    const s = sim.current;
    s.snapped = true;
    s.dragging = false;
    s.armed = true;
    s.clicked = false;
    s.falling = s.pts.slice(STUB).map((p) => ({ ...p }));
    s.pts = s.pts.slice(0, STUB + 1);
    s.fallingSince = performance.now();
    s.flickerStart = performance.now();
    s.omega += -Math.sign(s.theta || 1) * 1.1;
    s.regrowAt = performance.now() + REGROW_AFTER;
    s.regrowStart = 0;
    setNote((n) => n + 1);
    timers.current.push(window.setTimeout(() => setNote(0), 4200));
  }

  function step(now: number) {
    const s = sim.current;

    // Regrow the cord after a snap: new segments start at the stub's end and lengthen.
    if (s.snapped && s.regrowStart === 0 && now >= s.regrowAt) {
      s.regrowStart = now;
      const end = s.pts[s.pts.length - 1];
      for (let i = s.pts.length; i <= SEGMENTS; i++) s.pts.push(point(end.x, end.y));
    }
    let grow = 1;
    if (s.snapped && s.regrowStart > 0) {
      grow = Math.min(1, (now - s.regrowStart) / REGROW_FOR);
      if (grow >= 1) {
        s.snapped = false;
        s.regrowStart = 0;
      }
    }
    const restOf = (i: number) => (s.snapped && i >= STUB ? SEG * grow : SEG);

    const yanking = now < s.yankUntil;
    if (s.yankUntil && !yanking) {
      s.yankUntil = 0;
      startRelease(now);
    }
    const releasing = s.releaseAt > 0 && now - s.releaseAt < RETRACT && !s.snapped && !s.dragging;
    const held = (s.dragging || yanking) && !s.snapped;

    // The lamp: a damped pendulum. While the cord is dragged sideways it leans a little after it.
    let alpha = -140 * Math.sin(s.theta) - 7 * s.omega;
    if (s.dragging && !s.snapped) {
      const lean = Math.max(-1, Math.min(1, (s.pointer.x - anchorAt(s.theta).x) / 120));
      alpha -= lean * 25;
    }
    s.omega += alpha * STEP;
    s.theta = Math.max(-0.6, Math.min(0.6, s.theta + s.omega * STEP));

    // The cord: Verlet integration, tied to the bulb, well damped so it settles without much wiggle.
    const tie = anchorAt(s.theta);
    const pts = s.pts;
    const last = pts.length - 1;
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      const vx = (p.x - p.px) * 0.93;
      const vy = (p.y - p.py) * 0.93;
      p.px = p.x;
      p.py = p.y;
      p.x += vx;
      p.y += vy + GRAVITY * STEP * STEP;
    }
    pts[0].x = tie.x;
    pts[0].y = tie.y;

    // Held past its length, the cord is a straight line that gives a little, with growing resistance.
    let taut = false;
    s.give = 0;
    if (held) {
      const target = s.dragging ? s.pointer : { x: tie.x, y: tie.y + CORD + YANK };
      const dx = target.x - tie.x;
      const dy = target.y - tie.y;
      const dist = Math.hypot(dx, dy) || 1;
      const over = dist - CORD;
      if (over > 0) {
        taut = true;
        s.give = GIVE * (1 - Math.exp(-over / GIVE));
        const length = CORD + s.give;
        for (let i = 1; i <= last; i++) {
          const f = (length * i) / last;
          pts[i].x += (tie.x + (dx / dist) * f - pts[i].x) * 0.6;
          pts[i].y += (tie.y + (dy / dist) * f - pts[i].y) * 0.6;
        }
        if (s.dragging && over > SNAP_OVER) snap();
      } else {
        // Slack: the bead simply follows the pointer.
        pts[last].x += (target.x - pts[last].x) * 0.5;
        pts[last].y += (target.y - pts[last].y) * 0.5;
      }
    }

    // Just let go: the cord eases back up along its line and swings down straight.
    if (releasing) {
      taut = true;
      const t = (now - s.releaseAt) / RETRACT;
      const ease = 1 - (1 - t) * (1 - t);
      const length = CORD + s.releaseGive * (1 - ease);
      const dx = s.releaseDir.x * (1 - ease);
      const dy = s.releaseDir.y * (1 - ease) + ease;
      const norm = Math.hypot(dx, dy) || 1;
      for (let i = 1; i <= last; i++) {
        const f = (length * i) / last;
        pts[i].x = tie.x + (dx / norm) * f;
        pts[i].y = tie.y + (dy / norm) * f;
        pts[i].px = pts[i].x;
        pts[i].py = pts[i].y;
      }
    } else if (s.releaseAt > 0) {
      s.releaseAt = 0;
      if (s.wiggle) {
        // A small flick, stronger toward the bead; the damping settles it in about half a second.
        s.wiggle = false;
        const side = Math.random() < 0.5 ? -1 : 1;
        for (let i = 1; i <= last; i++) pts[i].px = pts[i].x - side * 1.1 * (i / last);
        s.omega += side * 0.18;
      }
    }

    if (!taut) {
      for (let k = 0; k < 12; k++) {
        for (let i = 0; i < last; i++) {
          const a = pts[i];
          const b = pts[i + 1];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy) || 0.0001;
          const diff = (dist - restOf(i)) / dist;
          const wa = i === 0 ? 0 : 1;
          const wb = held && i + 1 === last ? 0 : i + 1 === last ? 0.45 : 1;
          const total = wa + wb;
          if (!total) continue;
          a.x += dx * diff * (wa / total);
          a.y += dy * diff * (wa / total);
          b.x -= dx * diff * (wb / total);
          b.y -= dy * diff * (wb / total);
        }
      }
    }

    // Like a real pull switch, it clicks while the cord is pulled, not when it is let go.
    if (s.dragging && !s.snapped) {
      if (s.armed && s.give >= SWITCH_AT) {
        s.armed = false;
        s.clicked = true;
        toggle();
      } else if (s.give < 3) {
        s.armed = true;
      }
    }

    // The loose end after a snap falls away.
    if (s.falling) {
      for (const p of s.falling) {
        const vx = (p.x - p.px) * 0.99;
        const vy = (p.y - p.py) * 0.99;
        p.px = p.x;
        p.py = p.y;
        p.x += vx;
        p.y += vy + GRAVITY * STEP * STEP;
      }
      for (let k = 0; k < 6; k++) {
        for (let i = 0; i < s.falling.length - 1; i++) {
          const a = s.falling[i];
          const b = s.falling[i + 1];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy) || 0.0001;
          const diff = ((dist - SEG) / dist) * 0.5;
          a.x += dx * diff;
          a.y += dy * diff;
          b.x -= dx * diff;
          b.y -= dy * diff;
        }
      }
      if (now - s.fallingSince > 900) s.falling = null;
    }
  }

  function startRelease(now: number) {
    const s = sim.current;
    const tie = anchorAt(s.theta);
    const bead = s.pts[s.pts.length - 1];
    const dx = bead.x - tie.x;
    const dy = bead.y - tie.y;
    const dist = Math.hypot(dx, dy) || 1;
    s.releaseAt = now;
    s.releaseGive = Math.max(0, dist - CORD);
    s.releaseDir = { x: dx / dist, y: dy / dist };
  }

  function settled(now: number) {
    const s = sim.current;
    if (s.releaseAt > 0) return false;
    if (s.dragging || s.falling || now < s.yankUntil || now - s.flickerStart < 700) return false;
    if (s.snapped && s.regrowStart === 0 && now < s.regrowAt) {
      // Waiting to regrow: rest until then if nothing moves.
      return Math.abs(s.omega) < 0.002 && Math.abs(s.theta) < 0.002 && s.pts.every((p) => Math.abs(p.x - p.px) + Math.abs(p.y - p.py) < 0.01);
    }
    if (s.snapped) return false;
    return Math.abs(s.omega) < 0.002 && Math.abs(s.theta) < 0.002 && s.pts.every((p) => Math.abs(p.x - p.px) + Math.abs(p.y - p.py) < 0.01);
  }

  function run() {
    if (frame.current) return;
    let last = performance.now();
    let carry = 0;
    const tick = (now: number) => {
      carry = Math.min(carry + (now - last) / 1000, 0.1);
      last = now;
      while (carry >= STEP) {
        step(now);
        carry -= STEP;
      }
      draw();
      if (settled(now)) {
        frame.current = 0;
        const s = sim.current;
        // Asleep while the stub waits: wake up in time to regrow it.
        if (s.snapped && s.regrowStart === 0) {
          timers.current.push(window.setTimeout(run, Math.max(0, s.regrowAt - performance.now()) + 20));
        }
        return;
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }

  /** Switch the lamp now and the page a moment later, from the bulb. */
  function toggle() {
    const next = !sim.current.lit;
    sim.current.lit = next;
    setPending(next);
    playSwitch("down");
    const box = svgRef.current?.getBoundingClientRect();
    const anchor = anchorAt(sim.current.theta);
    const origin = box ? { x: box.left + anchor.x, y: box.top + anchor.y - 4 } : { x: window.innerWidth, y: 0 };
    timers.current.push(
      window.setTimeout(() => switchTheme(origin, () => setPending(null)), prefersReducedMotion() ? 0 : 220),
    );
  }

  /** A click: yank the cord down, let it spring back, and switch. */
  function pull() {
    if (!prefersReducedMotion()) {
      const s = sim.current;
      if (!s.snapped) {
        s.yankUntil = performance.now() + 120;
        s.wiggle = true;
      }
      run();
    }
    toggle();
    timers.current.push(window.setTimeout(() => playSwitch("up"), 130));
  }

  function toLocal(event: ReactPointerEvent) {
    const box = svgRef.current?.getBoundingClientRect();
    return box ? { x: event.clientX - box.left, y: event.clientY - box.top } : { x: 0, y: 0 };
  }

  function onCordDown(event: ReactPointerEvent<SVGElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {}
    press.current = { x: event.clientX, y: event.clientY, moved: false };
  }

  function onCordMove(event: ReactPointerEvent<SVGElement>) {
    const p = press.current;
    if (!p || prefersReducedMotion()) return;
    const s = sim.current;
    if (!p.moved && Math.hypot(event.clientX - p.x, event.clientY - p.y) > 4 && !s.snapped) {
      p.moved = true;
      s.dragging = true;
    }
    if (s.dragging) {
      s.pointer = toLocal(event);
      run();
    }
  }

  function onCordUp() {
    const p = press.current;
    press.current = null;
    if (!p) return;
    const s = sim.current;
    if (!p.moved) {
      pull();
      return;
    }
    if (!s.dragging) return;
    s.dragging = false;
    s.armed = true;
    if (!s.snapped) startRelease(performance.now());
    if (s.clicked) playSwitch("up");
    s.clicked = false;
    run();
  }

  const label = lit ? "Switch to dark theme" : "Switch to light theme";

  return (
    <div className="relative w-8 shrink-0 self-stretch">
      {/* The lamp itself, dithered dots on a canvas lined up with the pond (paintLamp). */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute top-0"
        style={{ imageRendering: "pixelated", width: 0, height: 0 }}
      />
      <svg
        ref={svgRef}
        width="1"
        height="1"
        overflow="visible"
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0"
      >
        {/* Invisible grab targets over the cord and its bead, wider than they look. */}
        <path
          ref={cordHitRef}
          d={RESTING_PATH}
          fill="none"
          stroke="transparent"
          strokeWidth="12"
          style={{ pointerEvents: "stroke" }}
          className="cursor-grab touch-none active:cursor-grabbing"
          onPointerDown={onCordDown}
          onPointerMove={onCordMove}
          onPointerUp={onCordUp}
          onPointerCancel={onCordUp}
        />
        <circle
          ref={beadHitRef}
          cx="0"
          cy={BULB_Y + CORD}
          r="10"
          fill="transparent"
          className="pointer-events-auto cursor-grab touch-none active:cursor-grabbing"
          onPointerDown={onCordDown}
          onPointerMove={onCordMove}
          onPointerUp={onCordUp}
          onPointerCancel={onCordUp}
        />
      </svg>

      {/* The shade is the button, for clicks and for the keyboard. */}
      <button
        type="button"
        onClick={pull}
        aria-label={label}
        title={label}
        className="absolute left-1/2 top-[11px] h-[26px] w-[38px] -translate-x-1/2 cursor-pointer rounded-full"
      />

      {note > 0 &&
        createPortal(
          <div role="status" className="rise fixed bottom-6 right-6 z-50 flex max-w-[300px] overflow-hidden rounded-[12px] border border-line bg-raise shadow-[0_12px_32px_-18px_rgb(16_17_19/0.35)]">
            <span className="w-[3px] shrink-0 bg-accent" aria-hidden="true" />
            <span className="px-4 py-3">
              <span className="block text-[14px] font-medium text-strong">Easter egg found</span>
              <span className="block text-[13px] text-soft">You snapped the cord. It grows back in a moment.</span>
            </span>
          </div>,
          document.body,
        )}
    </div>
  );
}
