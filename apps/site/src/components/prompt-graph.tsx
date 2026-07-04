"use client";

import { useEffect, useRef, useState } from "react";

interface GraphJson {
  nodes: { id: string; label: string; kind: "composition" | "fragment" }[];
  edges: { source: string; target: string }[];
}

interface SimNode {
  id: string;
  label: string;
  kind: "composition" | "fragment";
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Render position = sim position + ambient drift; edges/labels/glows all use this. */
  rx: number;
  ry: number;
  r: number;
  degree: number;
  phase: number;
  /** Entrance stagger offset in seconds. */
  birth: number;
  /** 0..1 entrance progress ("ignition"). */
  ignite: number;
  /** Eased 0..1 — this node is in the hovered neighborhood. */
  focusT: number;
  /** Hover spring value + velocity (slight overshoot when hovered). */
  hs: number;
  hsv: number;
  /** Preferred label side: 1 = below the node, -1 = above. Sticky across frames to avoid flapping. */
  side: 1 | -1;
}

interface SimEdge {
  a: number;
  b: number;
  /** Signed curvature factor — a whisper of arc so the web doesn't read as wireframe. */
  bend: number;
  /** Eased 0..1 — this edge is ignited by the hovered neighborhood. */
  lit: number;
}

interface Palette {
  accent: string;
  text: string;
  muted: string;
  subtle: string;
  mono: string;
}

const SETTLE_TICKS = 420;
const REPULSION = 4200;
const SPRING = 0.02;
const CENTER_PULL = 0.0021;
const DAMPING = 0.82;
const MAX_SPEED = 4.5;
const HIT_RADIUS = 26;
const SPRITE_SIZE = 256;
/** Halo radius as a multiple of core radius. */
const GLOW_COMP = 6.2;
const GLOW_FRAG = 3.8;

function readPalette(el: HTMLElement): Palette {
  const cs = getComputedStyle(el);
  const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
  return {
    accent: v("--accent", "#b8ff66"),
    text: v("--text", "#eceef1"),
    muted: v("--muted", "#8b919c"),
    subtle: v("--subtle", "#5a5f69"),
    mono: v("--font-mono", "ui-monospace, Menlo, monospace"),
  };
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (m?.[1] === undefined) return [184, 255, 102];
  const n = Number.parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Pre-rendered radial glow sprite. Blitting these with "lighter" is how the
 * bloom happens — per-frame shadowBlur is both slower and flatter.
 */
function makeSprite(stops: [number, string][]): HTMLCanvasElement | null {
  const c = document.createElement("canvas");
  c.width = SPRITE_SIZE;
  c.height = SPRITE_SIZE;
  const g = c.getContext("2d");
  if (g === null) return null;
  const half = SPRITE_SIZE / 2;
  const grad = g.createRadialGradient(half, half, 0, half, half, half);
  for (const [offset, color] of stops) grad.addColorStop(offset, color);
  g.fillStyle = grad;
  g.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  return c;
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function easeOutBack(x: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
}

/** Deterministic pseudo-random so the settled layout is stable across loads. */
function mulberry(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function PromptGraph({ src, ariaLabel }: { src: string; ariaLabel: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoverLabel, setHoverLabel] = useState<string | null>(null);
  const [counts, setCounts] = useState<{ nodes: number; edges: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    // Opaque context: the atmosphere layer covers the full pane every frame,
    // and an opaque canvas composites cheaper than a transparent one.
    const ctx = canvas.getContext("2d", { alpha: false });
    if (ctx === null) return;

    let disposed = false;
    let raf = 0;
    let nodes: SimNode[] = [];
    let edges: SimEdge[] = [];
    let neighbors: Set<number>[] = [];
    let width = 0;
    let height = 0;
    let hoverIndex = -1;
    let dragIndex = -1;
    let startNow = 0;
    let lastNow = 0;
    let focusAmt = 0;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const palette = readPalette(canvas);
    const [ar, ag, ab] = hexToRgb(palette.accent);

    const compGlow = makeSprite([
      [0, "rgba(236,255,210,0.9)"],
      [0.1, `rgba(${ar},${ag},${ab},0.55)`],
      [0.24, `rgba(${ar},${ag},${ab},0.2)`],
      [0.5, `rgba(${ar},${ag},${ab},0.07)`],
      [1, `rgba(${ar},${ag},${ab},0)`],
    ]);
    const fragGlow = makeSprite([
      [0, "rgba(208,222,246,0.7)"],
      [0.14, "rgba(142,164,206,0.32)"],
      [0.4, "rgba(120,142,186,0.1)"],
      [1, "rgba(104,124,164,0)"],
    ]);
    const hotGlow = makeSprite([
      [0, "rgba(246,255,228,0.95)"],
      [0.12, `rgba(${Math.min(ar + 30, 255)},255,${ab + 40},0.6)`],
      [0.34, `rgba(${ar},${ag},${ab},0.2)`],
      [1, `rgba(${ar},${ag},${ab},0)`],
    ]);

    let atmo: HTMLCanvasElement | null = null;
    let vignette: HTMLCanvasElement | null = null;

    function buildAtmosphere() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(Math.round(width * dpr), 1);
      const h = Math.max(Math.round(height * dpr), 1);

      atmo = document.createElement("canvas");
      atmo.width = w;
      atmo.height = h;
      const a = atmo.getContext("2d");
      if (a !== null) {
        a.setTransform(dpr, 0, 0, dpr, 0, 0);
        const base = a.createLinearGradient(0, 0, 0, height);
        base.addColorStop(0, "#0c0e13");
        base.addColorStop(1, "#08090d");
        a.fillStyle = base;
        a.fillRect(0, 0, width, height);

        const coolFog = a.createRadialGradient(
          width * 0.5,
          height * 0.46,
          0,
          width * 0.5,
          height * 0.46,
          Math.max(width, height) * 0.62,
        );
        coolFog.addColorStop(0, "rgba(96,118,160,0.11)");
        coolFog.addColorStop(0.55, "rgba(90,110,150,0.04)");
        coolFog.addColorStop(1, "rgba(90,110,150,0)");
        a.fillStyle = coolFog;
        a.fillRect(0, 0, width, height);

        const limeFog = a.createRadialGradient(
          width * 0.5,
          height * 0.52,
          0,
          width * 0.5,
          height * 0.52,
          Math.min(width, height) * 0.55,
        );
        limeFog.addColorStop(0, `rgba(${ar},${ag},${ab},0.05)`);
        limeFog.addColorStop(1, `rgba(${ar},${ag},${ab},0)`);
        a.fillStyle = limeFog;
        a.fillRect(0, 0, width, height);
      }

      vignette = document.createElement("canvas");
      vignette.width = w;
      vignette.height = h;
      const v = vignette.getContext("2d");
      if (v !== null) {
        v.setTransform(dpr, 0, 0, dpr, 0, 0);
        const grad = v.createRadialGradient(
          width * 0.5,
          height * 0.5,
          Math.min(width, height) * 0.38,
          width * 0.5,
          height * 0.5,
          Math.max(width, height) * 0.74,
        );
        grad.addColorStop(0, "rgba(4,5,8,0)");
        grad.addColorStop(1, "rgba(4,5,8,0.55)");
        v.fillStyle = grad;
        v.fillRect(0, 0, width, height);
      }
    }

    function measure() {
      const parent = canvas?.parentElement;
      if (canvas === null || parent === null || parent === undefined) return;
      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (ctx !== null) {
        ctx.fillStyle = "#0a0b0e";
        ctx.fillRect(0, 0, width, height);
      }
      buildAtmosphere();
    }

    function tick() {
      const cx = width / 2;
      const cy = height / 2;
      const n = nodes.length;
      const span = Math.min(width, height);
      const cutoff = span * span * 0.6;
      const restLength = span * 0.32;

      for (let i = 0; i < n; i++) {
        const a = nodes[i];
        if (a === undefined) continue;
        for (let j = i + 1; j < n; j++) {
          const b = nodes[j];
          if (b === undefined) continue;
          let dx = a.x - b.x;
          let dy = a.y - b.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 1) {
            dx = (i - j) * 0.11;
            dy = 0.13;
            d2 = dx * dx + dy * dy;
          }
          if (d2 > cutoff) continue;
          // Compositions repel each other harder so the hubs spread apart
          // instead of clumping around their shared fragments.
          const boost = a.kind === "composition" && b.kind === "composition" ? 5 : 1;
          const f = Math.min((REPULSION * boost) / d2, boost > 1 ? 3.4 : 2);
          const d = Math.sqrt(d2);
          const fx = (dx / d) * f;
          const fy = (dy / d) * f;
          a.vx += fx;
          a.vy += fy;
          b.vx -= fx;
          b.vy -= fy;
        }
      }

      for (const e of edges) {
        const a = nodes[e.a];
        const b = nodes[e.b];
        if (a === undefined || b === undefined) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const f = (d - restLength) * SPRING;
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }

      for (let i = 0; i < n; i++) {
        const p = nodes[i];
        if (p === undefined) continue;
        if (i === dragIndex) {
          p.vx = 0;
          p.vy = 0;
          continue;
        }
        const pull = p.kind === "composition" ? CENTER_PULL * 1.35 : CENTER_PULL;
        p.vx += (cx - p.x) * pull * 0.85;
        p.vy += (cy - p.y) * pull * 1.25;
        p.vx *= DAMPING;
        p.vy *= DAMPING;
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (speed > MAX_SPEED) {
          p.vx = (p.vx / speed) * MAX_SPEED;
          p.vy = (p.vy / speed) * MAX_SPEED;
        }
        p.x += p.vx;
        p.y += p.vy;
        const pad = 34;
        if (p.x < pad) p.x = pad;
        if (p.x > width - pad) p.x = width - pad;
        if (p.y < pad) p.y = pad;
        if (p.y > height - pad) p.y = height - pad;
      }
    }

    /** Snap every eased value to its target — used for reduced-motion static draws. */
    function snap() {
      focusAmt = hoverIndex >= 0 ? 1 : 0;
      const hood = hoverIndex >= 0 ? neighbors[hoverIndex] : undefined;
      for (let i = 0; i < nodes.length; i++) {
        const p = nodes[i];
        if (p === undefined) continue;
        p.ignite = 1;
        p.rx = p.x;
        p.ry = p.y;
        p.focusT = hoverIndex >= 0 && (i === hoverIndex || hood?.has(i) === true) ? 1 : 0;
        p.hs = i === hoverIndex ? 1 : 0;
        p.hsv = 0;
      }
      for (const e of edges) {
        e.lit = hoverIndex >= 0 && (e.a === hoverIndex || e.b === hoverIndex) ? 1 : 0;
      }
    }

    function draw(now: number) {
      if (ctx === null) return;
      if (startNow === 0) startNow = now;
      const dt = lastNow > 0 ? Math.min((now - lastNow) / 1000, 0.05) : 0.016;
      lastNow = now;
      const t = (now - startNow) / 1000;
      // ~200ms eased transitions for all hover state (alphas animate, never snap).
      const ease = reduceMotion ? 1 : 1 - Math.exp(-dt / 0.065);

      const focused = hoverIndex >= 0;
      const hood = focused ? neighbors[hoverIndex] : undefined;
      focusAmt += ((focused ? 1 : 0) - focusAmt) * ease;

      for (let i = 0; i < nodes.length; i++) {
        const p = nodes[i];
        if (p === undefined) continue;
        if (!reduceMotion) {
          p.ignite = Math.min(Math.max((t - p.birth) / 0.5, 0), 1);
          // Ambient drift: slow per-node sinusoids, ~1.5px — alive, never jiggly.
          p.rx = p.x + Math.sin(t * 0.42 + p.phase) * 1.5;
          p.ry = p.y + Math.cos(t * 0.36 + p.phase * 1.7) * 1.5;
        } else {
          p.ignite = 1;
          p.rx = p.x;
          p.ry = p.y;
        }
        const inHood = focused && (i === hoverIndex || hood?.has(i) === true);
        p.focusT += ((inHood ? 1 : 0) - p.focusT) * ease;
        // Underdamped spring so the hovered node pops slightly past its size.
        const target = i === hoverIndex ? 1 : 0;
        if (reduceMotion) {
          p.hs = target;
          p.hsv = 0;
        } else {
          p.hsv += ((target - p.hs) * 220 - p.hsv * 16) * dt;
          p.hs += p.hsv * dt;
        }
      }
      for (const e of edges) {
        const litTarget = focused && (e.a === hoverIndex || e.b === hoverIndex) ? 1 : 0;
        e.lit += (litTarget - e.lit) * ease;
      }

      ctx.fillStyle = "#0a0b0e";
      ctx.fillRect(0, 0, width, height);
      if (atmo !== null) {
        ctx.globalAlpha = reduceMotion ? 1 : Math.min(t / 0.4, 1);
        ctx.drawImage(atmo, 0, 0, width, height);
        ctx.globalAlpha = 1;
      }

      // Pass 1 — resting edges: per-edge gradient fading toward the dimmer
      // endpoint, whisper-quiet, slightly curved.
      for (const e of edges) {
        const a = nodes[e.a];
        const b = nodes[e.b];
        if (a === undefined || b === undefined) continue;
        const ig = Math.min(a.ignite, b.ignite);
        if (ig <= 0.02) continue;
        const dim = 1 - focusAmt * (1 - e.lit) * 0.88;
        const alphaFor = (p: SimNode) =>
          (p.kind === "composition" ? 0.19 : 0.055 + Math.min(p.degree, 12) * 0.006) * dim * ig;
        const colorFor = (p: SimNode, alpha: number) =>
          p.kind === "composition"
            ? `rgba(${ar},${ag},${ab},${alpha.toFixed(3)})`
            : `rgba(148,164,196,${alpha.toFixed(3)})`;
        const grad = ctx.createLinearGradient(a.rx, a.ry, b.rx, b.ry);
        grad.addColorStop(0, colorFor(a, alphaFor(a)));
        grad.addColorStop(1, colorFor(b, alphaFor(b)));
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1;
        const mx = (a.rx + b.rx) / 2;
        const my = (a.ry + b.ry) / 2;
        const dx = b.rx - a.rx;
        const dy = b.ry - a.ry;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = (-dy / d) * e.bend * d;
        const ny = (dx / d) * e.bend * d;
        ctx.beginPath();
        ctx.moveTo(a.rx, a.ry);
        ctx.quadraticCurveTo(mx + nx, my + ny, b.rx, b.ry);
        ctx.stroke();
      }

      // Pass 2 — ignited edges bloom additively over the base pass.
      ctx.globalCompositeOperation = "lighter";
      for (const e of edges) {
        if (e.lit <= 0.02) continue;
        const a = nodes[e.a];
        const b = nodes[e.b];
        if (a === undefined || b === undefined) continue;
        const hotFirst = e.a === hoverIndex || hoverIndex < 0;
        const grad = ctx.createLinearGradient(a.rx, a.ry, b.rx, b.ry);
        grad.addColorStop(0, `rgba(${ar},${ag},${ab},${(e.lit * (hotFirst ? 0.75 : 0.3)).toFixed(3)})`);
        grad.addColorStop(1, `rgba(${ar},${ag},${ab},${(e.lit * (hotFirst ? 0.3 : 0.75)).toFixed(3)})`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.4;
        const mx = (a.rx + b.rx) / 2;
        const my = (a.ry + b.ry) / 2;
        const dx = b.rx - a.rx;
        const dy = b.ry - a.ry;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = (-dy / d) * e.bend * d;
        const ny = (dx / d) * e.bend * d;
        ctx.beginPath();
        ctx.moveTo(a.rx, a.ry);
        ctx.quadraticCurveTo(mx + nx, my + ny, b.rx, b.ry);
        ctx.stroke();
      }

      // Pass 3 — glow halos: pre-rendered sprites, additive, breathing slowly.
      for (let i = 0; i < nodes.length; i++) {
        const p = nodes[i];
        if (p === undefined || p.ignite <= 0.01) continue;
        const isComp = p.kind === "composition";
        const breath = reduceMotion ? 0 : Math.sin(t * 0.9 + p.phase) * 0.06;
        const nodeAlpha = 1 - focusAmt * (1 - p.focusT) * 0.85;
        const scale = 0.35 + 0.65 * easeOutBack(p.ignite);
        const sizeBoost = 1 + 0.3 * p.hs;
        const sprite = isComp ? compGlow : fragGlow;
        if (sprite !== null) {
          const R = p.r * (isComp ? GLOW_COMP : GLOW_FRAG) * (1 + breath) * scale * sizeBoost;
          ctx.globalAlpha = (isComp ? 0.9 : 0.75) * nodeAlpha * p.ignite;
          ctx.drawImage(sprite, p.rx - R, p.ry - R, R * 2, R * 2);
        }
        // Hovered node and its lit fragments get an extra hot layer.
        const hot = Math.max(p.hs, p.focusT * 0.45);
        if (hot > 0.02 && hotGlow !== null) {
          const R = p.r * (isComp ? GLOW_COMP + 1.6 : GLOW_FRAG + 1.8) * scale;
          ctx.globalAlpha = hot * 0.85 * nodeAlpha;
          ctx.drawImage(hotGlow, p.rx - R, p.ry - R, R * 2, R * 2);
        }
      }
      ctx.globalCompositeOperation = "source-over";

      // Pass 4 — crisp cores over the halos.
      for (let i = 0; i < nodes.length; i++) {
        const p = nodes[i];
        if (p === undefined || p.ignite <= 0.01) continue;
        const isComp = p.kind === "composition";
        const nodeAlpha = 1 - focusAmt * (1 - p.focusT) * 0.85;
        const scale = 0.35 + 0.65 * easeOutBack(p.ignite);
        const rr = p.r * scale * (1 + 0.3 * p.hs);
        ctx.globalAlpha = nodeAlpha * p.ignite;
        if (isComp) {
          ctx.fillStyle = palette.accent;
          ctx.beginPath();
          ctx.arc(p.rx, p.ry, rr, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "rgba(244,255,226,0.75)";
          ctx.beginPath();
          ctx.arc(p.rx, p.ry, rr * 0.42, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const f = p.focusT;
          ctx.fillStyle = `rgb(${Math.round(mix(152, 226, f))},${Math.round(mix(168, 236, f))},${Math.round(mix(198, 250, f))})`;
          ctx.beginPath();
          ctx.arc(p.rx, p.ry, rr, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (vignette !== null) ctx.drawImage(vignette, 0, 0, width, height);

      // Labels, by priority (hovered → compositions → neighborhood fragments),
      // greedily skipping any label whose box would collide with one already
      // drawn — overlap in the dense core is worse than a missing label.
      const candidates: { i: number; priority: number }[] = [];
      for (let i = 0; i < nodes.length; i++) {
        const p = nodes[i];
        if (p === undefined || p.ignite < 0.7) continue;
        const isComp = p.kind === "composition";
        const inHood = focused && (i === hoverIndex || hood?.has(i) === true);
        if (!isComp && !inHood) continue;
        if (isComp && focused && !inHood) continue;
        candidates.push({ i, priority: i === hoverIndex ? 0 : isComp ? 1 : 2 });
      }
      candidates.sort((a, b) => a.priority - b.priority);

      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      const LABEL_H = 12;
      // The HTML footer strip (node counts / hover hint) overlays the bottom
      // of the pane — labels must never land under it, nor bleed off the edges.
      const SAFE_TOP = 6;
      const SAFE_BOTTOM = 32;
      const crossesEdge = (box: { y1: number; y2: number }) =>
        box.y1 < SAFE_TOP || box.y2 > height - SAFE_BOTTOM;
      const placed: { x1: number; y1: number; x2: number; y2: number }[] = [];
      const collides = (box: { x1: number; y1: number; x2: number; y2: number }) =>
        placed.some((b) => box.x1 < b.x2 && box.x2 > b.x1 && box.y1 < b.y2 && box.y2 > b.y1);
      // At rest a label must not sit on an unrelated node either; during hover
      // the dimmed nodes are barely visible, so only placed labels matter.
      const nodeCollides = (box: { x1: number; y1: number; x2: number; y2: number }, self: number) => {
        for (let k = 0; k < nodes.length; k++) {
          if (k === self) continue;
          const q = nodes[k];
          if (q === undefined) continue;
          if (q.rx > box.x1 - q.r && q.rx < box.x2 + q.r && q.ry > box.y1 - q.r && q.ry < box.y2 + q.r) {
            return true;
          }
        }
        return false;
      };

      for (const { i } of candidates) {
        const p = nodes[i];
        if (p === undefined) continue;
        const isComp = p.kind === "composition";
        const isHover = i === hoverIndex;
        ctx.font = `${isComp ? 10.5 : 9.5}px ${palette.mono}`;
        const w = ctx.measureText(p.label).width;
        const lx = Math.min(Math.max(p.rx, w / 2 + 6), width - w / 2 - 6);

        const boxFor = (side: 1 | -1) => {
          const y = side > 0 ? p.ry + p.r + 6 : p.ry - p.r - 6 - LABEL_H;
          return { y, x1: lx - w / 2 - 3, y1: y - 2, x2: lx + w / 2 + 3, y2: y + LABEL_H + 1 };
        };

        let box: ReturnType<typeof boxFor> | null = null;
        for (const side of [p.side, -p.side] as (1 | -1)[]) {
          const candidate = boxFor(side);
          if (crossesEdge(candidate)) continue;
          if (collides(candidate)) continue;
          if (!focused && nodeCollides(candidate, i)) continue;
          box = candidate;
          p.side = side;
          break;
        }
        if (box === null) {
          if (!isHover) continue;
          // Hovered label always shows: pick whichever side stays inside the
          // safe area, even if it overlaps another label.
          const preferred = boxFor(p.side);
          box = crossesEdge(preferred) ? boxFor(-p.side as 1 | -1) : preferred;
        }

        placed.push(box);
        ctx.globalAlpha = (isHover ? 1 : isComp ? 0.72 : 0.9) * p.ignite;
        // Ink halo keeps labels readable where they cross an edge.
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(8, 9, 12, 0.88)";
        ctx.strokeText(p.label, lx, box.y);
        if (isHover) {
          ctx.shadowColor = palette.accent;
          ctx.shadowBlur = 10;
        }
        ctx.fillStyle = isHover ? palette.accent : isComp ? palette.text : palette.muted;
        ctx.fillText(p.label, lx, box.y);
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = 1;
    }

    function loop(now: number) {
      if (disposed) return;
      tick();
      draw(now);
      raf = requestAnimationFrame(loop);
    }

    function staticDraw() {
      snap();
      draw(performance.now());
    }

    function nearest(x: number, y: number): number {
      let best = -1;
      let bestD = HIT_RADIUS * HIT_RADIUS;
      for (let i = 0; i < nodes.length; i++) {
        const p = nodes[i];
        if (p === undefined) continue;
        const dx = p.x - x;
        const dy = p.y - y;
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      return best;
    }

    function pointerPos(ev: PointerEvent) {
      const rect = canvas?.getBoundingClientRect();
      if (rect === undefined) return { x: 0, y: 0 };
      return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
    }

    function onPointerMove(ev: PointerEvent) {
      const { x, y } = pointerPos(ev);
      if (dragIndex >= 0) {
        const p = nodes[dragIndex];
        if (p !== undefined) {
          p.x = x;
          p.y = y;
        }
        if (reduceMotion) {
          for (let i = 0; i < 6; i++) tick();
          staticDraw();
        }
        return;
      }
      const hit = nearest(x, y);
      if (hit !== hoverIndex) {
        hoverIndex = hit;
        const node = hit >= 0 ? nodes[hit] : undefined;
        setHoverLabel(
          node !== undefined
            ? `${node.kind === "composition" ? "composition" : "fragment"} · ${node.label}`
            : null,
        );
        if (canvas !== null) canvas.style.cursor = hit >= 0 ? "grab" : "default";
        if (reduceMotion) staticDraw();
      }
    }

    function onPointerDown(ev: PointerEvent) {
      const { x, y } = pointerPos(ev);
      const hit = nearest(x, y);
      if (hit < 0) return;
      dragIndex = hit;
      hoverIndex = hit;
      canvas?.setPointerCapture(ev.pointerId);
      if (canvas !== null) canvas.style.cursor = "grabbing";
    }

    function onPointerUp(ev: PointerEvent) {
      if (dragIndex >= 0) canvas?.releasePointerCapture(ev.pointerId);
      dragIndex = -1;
      if (canvas !== null) canvas.style.cursor = hoverIndex >= 0 ? "grab" : "default";
    }

    function onPointerLeave() {
      if (dragIndex >= 0) return;
      hoverIndex = -1;
      setHoverLabel(null);
      if (reduceMotion) staticDraw();
    }

    async function boot() {
      const res = await fetch(src);
      if (!res.ok || disposed) return;
      const data = (await res.json()) as GraphJson;
      if (disposed) return;

      measure();

      const rand = mulberry(0x9e3779b9);
      const index = new Map<string, number>();
      const degree = new Map<string, number>();
      for (const e of data.edges) {
        degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
        degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
      }

      const cx = width / 2;
      const cy = height / 2;
      const ringX = width * 0.36;
      const ringY = height * 0.36;
      const ring = Math.min(width, height) * 0.37;
      let compIdx = 0;
      const compCount = data.nodes.filter((n) => n.kind === "composition").length || 1;

      nodes = data.nodes.map((n) => {
        const deg = degree.get(n.id) ?? 0;
        let x: number;
        let y: number;
        if (n.kind === "composition") {
          const angle = (compIdx / compCount) * Math.PI * 2 + 0.4;
          compIdx += 1;
          x = cx + Math.cos(angle) * ringX + (rand() - 0.5) * 30;
          y = cy + Math.sin(angle) * ringY + (rand() - 0.5) * 30;
        } else {
          x = cx + (rand() - 0.5) * ring * 1.6;
          y = cy + (rand() - 0.5) * ring * 1.6;
        }
        return {
          id: n.id,
          label: n.label,
          kind: n.kind,
          x,
          y,
          vx: 0,
          vy: 0,
          rx: x,
          ry: y,
          // Hubs must be visual gravity centers: ~3x leaf radius before the
          // halo multiplier widens the gap further.
          r:
            n.kind === "composition"
              ? 6 + Math.min(deg, 24) * 0.13
              : 2.1 + Math.sqrt(Math.min(deg, 16)) * 0.68,
          degree: deg,
          phase: rand() * Math.PI * 2,
          birth: rand() * 0.7,
          ignite: 0,
          focusT: 0,
          hs: 0,
          hsv: 0,
          side: 1 as const,
        };
      });
      for (let i = 0; i < nodes.length; i++) index.set(nodes[i]?.id ?? "", i);

      edges = [];
      neighbors = nodes.map(() => new Set<number>());
      for (const e of data.edges) {
        const a = index.get(e.source);
        const b = index.get(e.target);
        if (a === undefined || b === undefined) continue;
        edges.push({ a, b, bend: ((a * 31 + b * 17) % 2 === 0 ? 1 : -1) * 0.05, lit: 0 });
        neighbors[a]?.add(b);
        neighbors[b]?.add(a);
      }

      setCounts({ nodes: nodes.length, edges: edges.length });

      for (let i = 0; i < SETTLE_TICKS; i++) tick();

      canvas?.addEventListener("pointermove", onPointerMove);
      canvas?.addEventListener("pointerdown", onPointerDown);
      canvas?.addEventListener("pointerup", onPointerUp);
      canvas?.addEventListener("pointercancel", onPointerUp);
      canvas?.addEventListener("pointerleave", onPointerLeave);

      if (reduceMotion) {
        staticDraw();
      } else {
        raf = requestAnimationFrame(loop);
      }
    }

    const ro = new ResizeObserver(() => {
      if (nodes.length === 0) return;
      const oldW = width;
      const oldH = height;
      measure();
      if (oldW > 0 && oldH > 0) {
        for (const p of nodes) {
          p.x = (p.x / oldW) * width;
          p.y = (p.y / oldH) * height;
        }
      }
      if (reduceMotion) {
        for (let i = 0; i < 60; i++) tick();
        staticDraw();
      }
    });
    if (canvas.parentElement !== null) ro.observe(canvas.parentElement);

    void boot();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [src]);

  return (
    <div className="absolute inset-0">
      <canvas ref={canvasRef} className="absolute inset-0 touch-none" role="img" aria-label={ariaLabel} />
      <div className="pointer-events-none absolute bottom-3 left-4 font-mono text-[9.5px] uppercase tracking-[0.22em] text-[var(--subtle)]">
        {hoverLabel ??
          (counts !== null ? `${counts.nodes} nodes · ${counts.edges} references` : "loading graph…")}
      </div>
    </div>
  );
}
