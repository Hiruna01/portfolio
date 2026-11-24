"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { playSwitch } from "@/lib/switch-sound";
import { isDarkTheme, subscribeTheme, switchTheme } from "@/lib/theme";

/*
 * The theme switch: a small pendant lamp hanging from the top of the window, with a pull cord.
 *
 * - Light theme: the lamp is on (dark shade, warm bulb, a soft glow). Dark theme: it is off (white shade).
 * - Click the shade, or tap the cord: the cord is yanked down and springs back, the lamp switches at once
 *   and the page follows with the circular reveal, spreading out from the bulb.
 * - Drag the cord: it goes taut and gives a little, with growing resistance, like a real pull cord, and
 *   the lamp leans slightly after it. Pulled down far enough it clicks and switches (once per pull).
 *   Keep pulling well past that and the cord snaps: the lamp swings and flickers, the loose end falls
 *   away, a small note says so, and the cord grows back after a few seconds.
 * - Each switch plays a short click, and letting go of the cord a softer one (lib/switch-sound.ts).
 *
 * The cord is a short rope (Verlet integration with distance constraints) and the lamp a damped
 * pendulum. The loop only runs while something moves, and writes straight to the SVG, not through React.
 * Keyboard users get the same switch through the button over the shade.
 */

// Geometry in px, in the lamp's own frame: the pivot (top of the window) is the origin, y points down.
const BULB_Y = 31; // where the pull cord is tied, under the bulb
const SEGMENTS = 9;
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
  const lampRef = useRef<SVGGElement>(null);
  const glowRef = useRef<SVGCircleElement>(null);
  const cordRef = useRef<SVGPathElement>(null);
  const cordHitRef = useRef<SVGPathElement>(null);
  const beadRef = useRef<SVGCircleElement>(null);
  const beadHitRef = useRef<SVGCircleElement>(null);
  const looseRef = useRef<SVGPathElement>(null);
  const looseBeadRef = useRef<SVGCircleElement>(null);

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

  // The loop reads the lamp's state from the ref, so it never waits for a render.
  useEffect(() => {
    sim.current.lit = lit;
    const glow = glowRef.current;
    if (glow && performance.now() - sim.current.flickerStart > 700) glow.style.opacity = lit ? "1" : "0";
  }, [lit]);

  useEffect(() => {
    const scheduled = timers.current;
    return () => {
      cancelAnimationFrame(frame.current);
      scheduled.forEach(clearTimeout);
    };
  }, []);

  function draw() {
    const s = sim.current;
    lampRef.current?.setAttribute("transform", `rotate(${((s.theta * 180) / Math.PI).toFixed(3)})`);
    const d = cordPath(s.pts);
    cordRef.current?.setAttribute("d", d);
    cordHitRef.current?.setAttribute("d", d);
    const bead = s.pts[s.pts.length - 1];
    const showBead = !s.snapped || s.regrowStart > 0;
    for (const el of [beadRef.current, beadHitRef.current]) {
      if (!el) continue;
      el.setAttribute("cx", bead.x.toFixed(2));
      el.setAttribute("cy", bead.y.toFixed(2));
      el.style.display = showBead ? "" : "none";
    }
    const loose = s.falling;
    if (looseRef.current && looseBeadRef.current) {
      looseRef.current.style.display = loose ? "" : "none";
      looseBeadRef.current.style.display = loose ? "" : "none";
      if (loose) {
        looseRef.current.setAttribute("d", cordPath(loose));
        const end = loose[loose.length - 1];
        looseBeadRef.current.setAttribute("cx", end.x.toFixed(2));
        looseBeadRef.current.setAttribute("cy", end.y.toFixed(2));
        const fade = String(Math.max(0, 1 - (performance.now() - s.fallingSince) / 900));
        looseRef.current.style.opacity = fade;
        looseBeadRef.current.style.opacity = fade;
      }
    }
    const glow = glowRef.current;
    const flicker = flickerLevel(performance.now() - s.flickerStart);
    if (glow && flicker >= 0) glow.style.opacity = String(flicker);
    else if (glow && performance.now() - s.flickerStart < 800) glow.style.opacity = s.lit ? "1" : "0";
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
      <svg
        ref={svgRef}
        width="1"
        height="1"
        overflow="visible"
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0"
      >
        <defs>
          <radialGradient id="lamp-glow">
            <stop offset="0" stopColor="#ffc56b" stopOpacity="0.55" />
            <stop offset="0.45" stopColor="#ffb44d" stopOpacity="0.18" />
            <stop offset="1" stopColor="#ffb44d" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="lamp-shade-on" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#1b1c1f" />
            <stop offset="0.38" stopColor="#4a4d53" />
            <stop offset="0.62" stopColor="#2c2e32" />
            <stop offset="1" stopColor="#141517" />
          </linearGradient>
          <linearGradient id="lamp-shade-off" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#b9bdc4" />
            <stop offset="0.38" stopColor="#ffffff" />
            <stop offset="0.66" stopColor="#e6e8eb" />
            <stop offset="1" stopColor="#a9adb4" />
          </linearGradient>
          <radialGradient id="lamp-bulb-on" cx="0.5" cy="0.2" r="0.8">
            <stop offset="0" stopColor="#fffaf0" />
            <stop offset="0.5" stopColor="#ffd98f" />
            <stop offset="1" stopColor="#f2a33a" />
          </radialGradient>
          <radialGradient id="lamp-bulb-off" cx="0.4" cy="0.3" r="0.8">
            <stop offset="0" stopColor="#9a9ea6" />
            <stop offset="1" stopColor="#4b4e54" />
          </radialGradient>
          <radialGradient id="lamp-bead" cx="0.35" cy="0.3" r="0.75">
            <stop offset="0" stopColor="#ffd796" />
            <stop offset="0.55" stopColor="#d9953f" />
            <stop offset="1" stopColor="#9c5f1c" />
          </radialGradient>
        </defs>

        <g ref={lampRef}>
          <circle ref={glowRef} cx="0" cy="26" r="40" fill="url(#lamp-glow)" style={{ opacity: lit ? 1 : 0, transition: "opacity 0.15s" }} />
          {/* Hanging cord and the cap the shade hangs from. */}
          <line x1="0" y1="-2" x2="0" y2="12" stroke={lit ? "#4a4d53" : "#9a9ea6"} strokeWidth="1.3" />
          <rect x="-2.6" y="10.5" width="5.2" height="4.5" rx="1" fill={lit ? "#2a2c30" : "#d4d7dc"} />
          {/* The bulb, peeking out under the shade. */}
          <circle cx="0" cy="26.6" r="4.4" fill={lit ? "url(#lamp-bulb-on)" : "url(#lamp-bulb-off)"} />
          {/* The dome shade, its rim and a highlight. */}
          <path d="M-12.5 26.5C-12.5 19.2-7.6 14.2 0 14.2S12.5 19.2 12.5 26.5Z" fill={lit ? "url(#lamp-shade-on)" : "url(#lamp-shade-off)"} />
          <path d="M-12.9 26.4H12.9" stroke={lit ? "#ffcf80" : "#8d9198"} strokeOpacity={lit ? 0.9 : 0.7} strokeWidth="1.1" strokeLinecap="round" />
          <path d="M-7.6 22.4C-7.2 19.4-5.2 17.1-2.4 16.2" fill="none" stroke="#fff" strokeOpacity={lit ? 0.22 : 0.85} strokeWidth="1.1" strokeLinecap="round" />
        </g>

        {/* The loose end of a snapped cord, falling away. */}
        <path ref={looseRef} fill="none" stroke="#c88836" strokeWidth="1.3" strokeLinecap="round" style={{ display: "none" }} />
        <circle ref={looseBeadRef} r="3.3" fill="url(#lamp-bead)" style={{ display: "none" }} />

        {/* The pull cord and its bead, with wider invisible copies to make them easy to grab. */}
        <path ref={cordRef} d={RESTING_PATH} fill="none" stroke="#c88836" strokeWidth="1.3" strokeLinecap="round" />
        <circle ref={beadRef} cx="0" cy={BULB_Y + CORD} r="3.3" fill="url(#lamp-bead)" />
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
        className="absolute left-1/2 top-[8px] h-[24px] w-[30px] -translate-x-1/2 cursor-pointer rounded-full"
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
