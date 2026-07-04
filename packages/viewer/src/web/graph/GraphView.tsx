import { useEffect, useMemo, useRef, useState } from "react";
import type { BookResponse } from "../types.js";
import { buildGraph, type GraphNode } from "./model.js";
import {
  approach,
  clamp01,
  easeOutBack,
  easeOutCubic,
  makeCoreSprite,
  makeFogSprite,
  makeGlowSprite,
  mix,
  parseColor,
  phaseOf,
  type Rgb,
  rgba,
} from "./render.js";
import { createSimulation, type Simulation } from "./simulation.js";

interface GraphViewProps {
  book: BookResponse;
  onSelectComposition: (name: string) => void;
  onSelectCode: (name: string) => void;
  onSelectFragment: (id: string) => void;
}

/** Camera: world → screen is `s = w * k + t`. */
interface Transform {
  k: number;
  x: number;
  y: number;
}

/** Theme tokens read from the mounted container's CSS custom properties. */
interface Palette {
  accent: string;
  code: string;
  fragment: string;
  text: string;
  muted: string;
  bg: string;
}

function readPalette(element: Element): Palette {
  const style = getComputedStyle(element);
  const token = (name: string, fallback: string): string => style.getPropertyValue(name).trim() || fallback;
  return {
    accent: token("--accent", "#b8ff66"),
    code: token("--graph-code", "#7dc4ff"),
    fragment: token("--graph-fragment", "#666d7a"),
    text: token("--text", "#eceef1"),
    muted: token("--muted", "#8b919c"),
    bg: token("--bg", "#0a0b0e"),
  };
}

/** Per-node render recipe, precomputed once per graph: sprite, luminosity,
 * halo geometry. Brightness scales with degree so hubs read as the light
 * sources they are. Render-only — the simulation never sees these. */
interface NodeArt {
  color: Rgb;
  glow: HTMLCanvasElement;
  spec: HTMLCanvasElement;
  /** 0..1 luminous weight; feeds edge gradients so lines fade toward dim ends. */
  bright: number;
  haloR: number;
  haloAlpha: number;
  coreR: number;
  coreFill: string;
  /** White-hot pinpoint strength — the difference between a lamp and a bead. */
  specAlpha: number;
  phase: number;
}

/** Label priority: compositions, then code, then fragments. */
function kindRank(kind: GraphNode["kind"]): number {
  if (kind === "composition") {
    return 0;
  }
  if (kind === "code") {
    return 1;
  }
  return 2;
}

interface LabelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function intersects(a: LabelRect, b: LabelRect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

const FALLBACK_PALETTE: Palette = {
  accent: "#b8ff66",
  code: "#7dc4ff",
  fragment: "#666d7a",
  text: "#eceef1",
  muted: "#8b919c",
  bg: "#0a0b0e",
};

const clamp = (value: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, value));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Layout memory across tab switches and hot reloads: node key → last position.
 * Module-level so re-opening the graph restores the settled layout instead of
 * re-blooming. Bounded so long sessions across many books cannot grow it
 * without limit. */
const positionMemory = new Map<string, { x: number; y: number }>();
const POSITION_MEMORY_LIMIT = 4000;

function rememberPositions(keys: string[], positions: { x: number; y: number }[]): void {
  if (positionMemory.size + keys.length > POSITION_MEMORY_LIMIT) {
    positionMemory.clear();
  }
  keys.forEach((key, index) => {
    const position = positions[index];
    if (position !== undefined) {
      positionMemory.set(key, { x: position.x, y: position.y });
    }
  });
}

/**
 * Force-directed map of the loaded book (compositions ▸ fragments ▸ `${…}`
 * refs) on a single canvas. Hover highlights a node's neighborhood, drag
 * repositions, scroll zooms, background-drag pans, click opens the node in
 * the regular canvas view.
 *
 * Rendering treats nodes as light sources: pre-rendered radial sprites
 * composited with `lighter` (real additive bloom, no per-frame shadowBlur),
 * per-edge gradients fading toward the dimmer endpoint, a fog puddle behind
 * the cluster, staggered ignite-in on first open, and — once the physics
 * settle — micro ambient drift plus slow halo breathing (render-only sine
 * offsets; simulation state is never touched). All transitions are eased.
 * With `prefers-reduced-motion` the layout settles synchronously and the
 * scene is static but still glowing.
 */
export function GraphView({ book, onSelectComposition, onSelectCode, onSelectFragment }: GraphViewProps) {
  const containerRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const graph = useMemo(() => buildGraph(book), [book]);
  // The legend shares the canvas' resolved palette, so both stay correct even
  // when a host page redefines (or breaks) the CSS tokens.
  const [legendPalette, setLegendPalette] = useState<Palette>(FALLBACK_PALETTE);
  const handlersRef = useRef({ onSelectComposition, onSelectCode, onSelectFragment });
  handlersRef.current = { onSelectComposition, onSelectCode, onSelectFragment };

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (container === null || canvas === null || graph.nodes.length === 0) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (ctx === null) {
      return;
    }
    const palette = readPalette(container);
    setLegendPalette(palette);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let dpr = window.devicePixelRatio || 1;

    const accentRgb = parseColor(palette.accent, [184, 255, 102]);
    const codeRgb = parseColor(palette.code, [125, 196, 255]);
    // Fragments read cool blue-grey even when the token is a neutral grey.
    const fragmentRgb = mix(parseColor(palette.fragment, [102, 109, 122]), [116, 148, 210], 0.4);
    const textRgb = parseColor(palette.text, [236, 238, 241]);
    const bgRgb = parseColor(palette.bg, [10, 11, 14]);

    const glowSprites = {
      composition: makeGlowSprite(accentRgb),
      code: makeGlowSprite(codeRgb),
      fragment: makeGlowSprite(fragmentRgb),
    };
    const specSprites = {
      composition: makeCoreSprite(accentRgb),
      code: makeCoreSprite(codeRgb),
      fragment: makeCoreSprite(fragmentRgb),
    };
    const fogSprite = makeFogSprite(mix(codeRgb, bgRgb, 0.5));

    const maxDegree = graph.nodes.reduce((most, node) => Math.max(most, node.degree), 1);
    const art: NodeArt[] = graph.nodes.map((node, index) => {
      const dn = Math.sqrt(node.degree / maxDegree);
      const phase = phaseOf(index);
      if (node.kind === "composition") {
        return {
          color: accentRgb,
          glow: glowSprites.composition,
          spec: specSprites.composition,
          bright: 0.85 + 0.15 * dn,
          haloR: node.radius * (3.4 + 2.0 * dn),
          haloAlpha: 0.8 + 0.2 * dn,
          coreR: node.radius * (0.9 + 0.25 * dn),
          coreFill: rgba(mix(accentRgb, [255, 255, 255], 0.08), 1),
          specAlpha: 0.85,
          phase,
        };
      }
      if (node.kind === "code") {
        return {
          color: codeRgb,
          glow: glowSprites.code,
          spec: specSprites.code,
          bright: 0.7,
          haloR: node.radius * 3.0,
          haloAlpha: 0.55,
          coreR: node.radius,
          coreFill: rgba(mix(codeRgb, [255, 255, 255], 0.12), 1),
          specAlpha: 0.55,
          phase,
        };
      }
      const fragmentBase = mix(fragmentRgb, bgRgb, 0.2);
      return {
        color: fragmentRgb,
        glow: glowSprites.fragment,
        spec: specSprites.fragment,
        bright: 0.22 + 0.55 * dn,
        haloR: node.radius * (1.6 + 2.2 * dn),
        haloAlpha: 0.16 + 0.4 * dn,
        coreR: node.radius * (0.95 + 0.3 * dn),
        coreFill: rgba(mix(fragmentBase, [255, 255, 255], 0.3 * dn), 1),
        specAlpha: 0.1 + 0.35 * dn,
        phase,
      };
    });

    const sim: Simulation = createSimulation(
      graph.nodes.map((n) => n.radius),
      graph.edges,
    );
    let seeded = 0;
    graph.nodes.forEach((node, index) => {
      const memory = positionMemory.get(node.key);
      const particle = sim.nodes[index];
      if (memory !== undefined && particle !== undefined) {
        particle.x = memory.x;
        particle.y = memory.y;
        seeded += 1;
      }
    });
    if (seeded === graph.nodes.length) {
      // Every node kept its place (e.g. a hot-reload edit): relax gently.
      sim.reheat(0.12);
    }
    if (reducedMotion) {
      sim.settle();
    }

    const transform: Transform = { k: 1, x: 0, y: 0 };
    let width = 0;
    let height = 0;
    let sized = false;
    // The camera follows the blooming layout until the user takes over.
    let autoFit = seeded < graph.nodes.length / 2;
    let hover: number | null = null;
    let dirty = true;
    let raf: number | null = null;

    let panning: { sx: number; sy: number; tx: number; ty: number } | null = null;
    let dragging: { index: number; ox: number; oy: number; moved: boolean; sx: number; sy: number } | null =
      null;
    let pointer: { sx: number; sy: number } | null = null;

    // Eased render state: neighborhood focus, edge ignition, hover spring.
    // Targets flip instantly; the drawn values chase them (~200ms), so
    // nothing in the scene ever hard-cuts. Under reduced motion the values
    // jump straight to their targets.
    const litNode: number[] = graph.nodes.map(() => 0);
    const litEdge: number[] = graph.edges.map(() => 0);
    const hoverScale: number[] = graph.nodes.map(() => 1);
    const hoverVel: number[] = graph.nodes.map(() => 0);
    let hoverMix = 0;
    let driftMix = 0;
    let lastFrame = performance.now();

    // Staggered ignite-in on a fresh bloom only; returning to a remembered
    // layout (tab switch) skips it, and so does reduced motion.
    const entrance = !reducedMotion && seeded < graph.nodes.length;
    const mountAt = performance.now();
    const ENTRANCE_MS = 420;
    const entranceDelay: number[] = graph.nodes.map(() => 0);
    if (entrance) {
      const order = graph.nodes
        .map((_, i) => i)
        .sort((a, b) => {
          const nodeA = graph.nodes[a];
          const nodeB = graph.nodes[b];
          if (nodeA === undefined || nodeB === undefined) {
            return 0;
          }
          const rank = kindRank(nodeA.kind) - kindRank(nodeB.kind);
          return rank !== 0 ? rank : nodeB.degree - nodeA.degree;
        });
      const step = Math.min(40, 620 / Math.max(1, order.length));
      order.forEach((nodeIndex, position) => {
        entranceDelay[nodeIndex] = position * step;
      });
    }
    const entranceOf = (index: number, now: number): number => {
      if (!entrance) {
        return 1;
      }
      return clamp01((now - mountAt - (entranceDelay[index] ?? 0)) / ENTRANCE_MS);
    };

    const toWorld = (sx: number, sy: number): { x: number; y: number } => ({
      x: (sx - transform.x) / transform.k,
      y: (sy - transform.y) / transform.k,
    });

    const pick = (sx: number, sy: number): number | null => {
      const w = toWorld(sx, sy);
      // Array order is compositions → code → fragments; earlier = drawn on top.
      for (let i = 0; i < graph.nodes.length; i += 1) {
        const node = graph.nodes[i];
        const particle = sim.nodes[i];
        if (node === undefined || particle === undefined) {
          continue;
        }
        const hitRadius = Math.max(node.radius, 8 / transform.k) + 2 / transform.k;
        const dx = w.x - particle.x;
        const dy = w.y - particle.y;
        if (dx * dx + dy * dy <= hitRadius * hitRadius) {
          return i;
        }
      }
      return null;
    };

    const fitView = (lerpAmount: number): void => {
      if (!sized) {
        return;
      }
      let minX = Number.POSITIVE_INFINITY;
      let minY = Number.POSITIVE_INFINITY;
      let maxX = Number.NEGATIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;
      for (const particle of sim.nodes) {
        minX = Math.min(minX, particle.x);
        minY = Math.min(minY, particle.y);
        maxX = Math.max(maxX, particle.x);
        maxY = Math.max(maxY, particle.y);
      }
      const spanX = Math.max(maxX - minX, 60);
      const spanY = Math.max(maxY - minY, 60);
      const k = clamp(Math.min(width / (spanX + 160), height / (spanY + 160)), 0.2, 1.4);
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      transform.k += (k - transform.k) * lerpAmount;
      transform.x += (width / 2 - cx * transform.k - transform.x) * lerpAmount;
      transform.y += (height / 2 - cy * transform.k - transform.y) * lerpAmount;
    };

    /** Advance eased render state; returns the hover neighborhood (or null). */
    const updateMotion = (now: number): Set<number> | null => {
      const dt = Math.min(64, now - lastFrame);
      lastFrame = now;
      const focus = hover !== null ? new Set([hover, ...(graph.neighbors[hover] ?? [])]) : null;
      const hoverTarget = hover !== null ? 1 : 0;
      hoverMix = reducedMotion ? hoverTarget : approach(hoverMix, hoverTarget, dt, 80);
      const dtS = dt / 1000;
      for (let i = 0; i < graph.nodes.length; i += 1) {
        const litTarget = focus?.has(i) ? 1 : 0;
        litNode[i] = reducedMotion ? litTarget : approach(litNode[i] ?? 0, litTarget, dt, 60);
        const scaleTarget = hover === i ? 1.32 : 1;
        if (reducedMotion) {
          hoverScale[i] = scaleTarget;
        } else {
          // Underdamped spring: the hovered node pops with a slight overshoot.
          const x = hoverScale[i] ?? 1;
          let v = hoverVel[i] ?? 0;
          v += (scaleTarget - x) * 240 * dtS;
          v *= Math.exp(-18 * dtS);
          hoverScale[i] = x + v * dtS;
          hoverVel[i] = v;
        }
      }
      for (let j = 0; j < graph.edges.length; j += 1) {
        const edge = graph.edges[j];
        if (edge === undefined) {
          continue;
        }
        const litTarget = hover !== null && (edge.source === hover || edge.target === hover) ? 1 : 0;
        litEdge[j] = reducedMotion ? litTarget : approach(litEdge[j] ?? 0, litTarget, dt, 70);
      }
      const driftTarget = !reducedMotion && sim.settled() && dragging === null ? 1 : 0;
      driftMix = approach(driftMix, driftTarget, dt, 700);
      return focus;
    };

    const draw = (now: number): void => {
      const { k } = transform;
      const t = now / 1000;
      // Halos live in world space, so zooming in would flood the pane with
      // additive haze. Attenuate the atmospherics as k grows: close up you
      // get crisp discs and thin glow, zoomed out the constellation blooms.
      const zoomDamp = Math.min(1, 1.25 / Math.max(1, k)) ** 1.4;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * transform.x, dpr * transform.y);

      // Ambient drift: ~1.3 screen px, per-node phases, render-only.
      const amp = (1.3 * driftMix) / k;
      const driftX = (phase: number): number =>
        amp * (Math.sin(t * 0.5 + phase) + 0.6 * Math.sin(t * 0.27 + phase * 1.7));
      const driftY = (phase: number): number =>
        amp * (Math.cos(t * 0.43 + phase * 1.3) + 0.6 * Math.cos(t * 0.31 + phase * 2.1));

      // Fog puddle behind the cluster so the pane reads deep, not empty.
      {
        let minX = Number.POSITIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;
        for (const particle of sim.nodes) {
          minX = Math.min(minX, particle.x);
          minY = Math.min(minY, particle.y);
          maxX = Math.max(maxX, particle.x);
          maxY = Math.max(maxY, particle.y);
        }
        const radius = Math.max(maxX - minX, maxY - minY) * 0.75 + 240;
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        ctx.globalAlpha = 0.35 * zoomDamp;
        ctx.drawImage(fogSprite, cx - radius, cy - radius, radius * 2, radius * 2);
      }

      // Edges under nodes: per-edge gradients fading toward the dimmer
      // endpoint, low alpha at rest; `${…}` refs dashed. Hover ignites the
      // neighborhood toward accent (eased), the rest fall away (eased).
      for (let j = 0; j < graph.edges.length; j += 1) {
        const edge = graph.edges[j];
        if (edge === undefined) {
          continue;
        }
        const a = sim.nodes[edge.source];
        const b = sim.nodes[edge.target];
        const artA = art[edge.source];
        const artB = art[edge.target];
        if (a === undefined || b === undefined || artA === undefined || artB === undefined) {
          continue;
        }
        const enter = easeOutCubic(Math.min(entranceOf(edge.source, now), entranceOf(edge.target, now)));
        if (enter <= 0) {
          continue;
        }
        const lit = litEdge[j] ?? 0;
        const dim = 1 - hoverMix * (1 - lit) * 0.92;
        const ax = a.x + driftX(artA.phase);
        const ay = a.y + driftY(artA.phase);
        const bx = b.x + driftX(artB.phase);
        const by = b.y + driftY(artB.phase);
        const alphaA = lerp(0.07 + 0.28 * artA.bright, 0.9, lit);
        const alphaB = lerp(0.07 + 0.28 * artB.bright, 0.9, lit);
        const colorA = lit > 0.01 ? mix(artA.color, accentRgb, lit) : artA.color;
        const colorB = lit > 0.01 ? mix(artB.color, accentRgb, lit) : artB.color;
        const gradient = ctx.createLinearGradient(ax, ay, bx, by);
        gradient.addColorStop(0, rgba(colorA, alphaA));
        gradient.addColorStop(1, rgba(colorB, alphaB));
        ctx.globalAlpha = dim * enter;
        ctx.strokeStyle = gradient;
        ctx.lineWidth = (1 + lit) / k;
        ctx.setLineDash(edge.kind === "ref" ? [4 / k, 4 / k] : []);
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Ignited edges get a wide additive underglow.
      ctx.globalCompositeOperation = "lighter";
      for (let j = 0; j < graph.edges.length; j += 1) {
        const lit = litEdge[j] ?? 0;
        if (lit <= 0.02) {
          continue;
        }
        const edge = graph.edges[j];
        if (edge === undefined) {
          continue;
        }
        const a = sim.nodes[edge.source];
        const b = sim.nodes[edge.target];
        const artA = art[edge.source];
        const artB = art[edge.target];
        if (a === undefined || b === undefined || artA === undefined || artB === undefined) {
          continue;
        }
        ctx.globalAlpha = 0.28 * lit * hoverMix;
        ctx.strokeStyle = rgba(accentRgb, 1);
        ctx.lineWidth = 3.6 / k;
        ctx.setLineDash(edge.kind === "ref" ? [4 / k, 4 / k] : []);
        ctx.beginPath();
        ctx.moveTo(a.x + driftX(artA.phase), a.y + driftY(artA.phase));
        ctx.lineTo(b.x + driftX(artB.phase), b.y + driftY(artB.phase));
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Halos: additive sprites — overlapping neighborhoods genuinely bloom.
      // Slow breathing rides on driftMix so it only starts once settled.
      for (let i = 0; i < graph.nodes.length; i += 1) {
        const nodeArt = art[i];
        const particle = sim.nodes[i];
        if (nodeArt === undefined || particle === undefined) {
          continue;
        }
        const enter = entranceOf(i, now);
        if (enter <= 0) {
          continue;
        }
        const lit = litNode[i] ?? 0;
        // Dimmed halos must die almost completely or they read as moss.
        const focusAlpha = 1 - hoverMix * (1 - lit) * 0.97;
        const breathR = 1 + 0.05 * Math.sin(t * 0.55 + nodeArt.phase) * driftMix;
        const breathA = 1 + 0.12 * Math.sin(t * 0.55 + nodeArt.phase + 0.8) * driftMix;
        const scale = hoverScale[i] ?? 1;
        // Dimmed light also contracts — embers, not clouds.
        const contraction = 1 - hoverMix * (1 - lit) * 0.25;
        const radius = nodeArt.haloR * breathR * scale * contraction * (0.5 + 0.5 * easeOutCubic(enter));
        let alpha = nodeArt.haloAlpha * breathA * focusAlpha * enter * enter * zoomDamp;
        if (hover === i) {
          alpha = Math.min(1, alpha * 1.3);
        }
        ctx.globalAlpha = clamp01(alpha);
        const x = particle.x + driftX(nodeArt.phase);
        const y = particle.y + driftY(nodeArt.phase);
        ctx.drawImage(nodeArt.glow, x - radius, y - radius, radius * 2, radius * 2);
      }
      ctx.globalCompositeOperation = "source-over";

      // Crisp cores over the bloom, fragments first so compositions sit on
      // top. Vector shapes stay razor sharp at any zoom; code-prompts keep
      // their rounded-square silhouette.
      for (let i = graph.nodes.length - 1; i >= 0; i -= 1) {
        const node = graph.nodes[i];
        const nodeArt = art[i];
        const particle = sim.nodes[i];
        if (node === undefined || nodeArt === undefined || particle === undefined) {
          continue;
        }
        const enter = entranceOf(i, now);
        if (enter <= 0) {
          continue;
        }
        const lit = litNode[i] ?? 0;
        const radius = nodeArt.coreR * (hoverScale[i] ?? 1) * (entrance ? easeOutBack(enter) : 1);
        if (radius <= 0) {
          continue;
        }
        ctx.globalAlpha = (1 - hoverMix * (1 - lit) * 0.85) * Math.min(1, enter * 3);
        ctx.fillStyle = nodeArt.coreFill;
        ctx.beginPath();
        if (node.kind === "code") {
          const side = radius * 1.8;
          ctx.roundRect(
            particle.x + driftX(nodeArt.phase) - side / 2,
            particle.y + driftY(nodeArt.phase) - side / 2,
            side,
            side,
            radius * 0.5,
          );
        } else {
          ctx.arc(
            particle.x + driftX(nodeArt.phase),
            particle.y + driftY(nodeArt.phase),
            radius,
            0,
            Math.PI * 2,
          );
        }
        ctx.fill();
        if (hover === i) {
          ctx.strokeStyle = rgba(textRgb, 0.9);
          ctx.lineWidth = 1.4 / k;
          ctx.stroke();
        }
      }

      // Specular pinpoints: a white-hot center on every core.
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < graph.nodes.length; i += 1) {
        const nodeArt = art[i];
        const particle = sim.nodes[i];
        if (nodeArt === undefined || particle === undefined) {
          continue;
        }
        const enter = entranceOf(i, now);
        if (enter <= 0) {
          continue;
        }
        const lit = litNode[i] ?? 0;
        const radius = nodeArt.coreR * (hoverScale[i] ?? 1) * 0.85;
        ctx.globalAlpha =
          nodeArt.specAlpha * (0.25 + 0.75 * zoomDamp) * (1 - hoverMix * (1 - lit) * 0.95) * enter;
        const x = particle.x + driftX(nodeArt.phase);
        const y = particle.y + driftY(nodeArt.phase);
        ctx.drawImage(nodeArt.spec, x - radius, y - radius, radius * 2, radius * 2);
      }
      ctx.globalCompositeOperation = "source-over";

      // Labels: constant screen size, with greedy collision-skipping. Visible
      // labels are placed in priority order (hovered node, then compositions,
      // code, fragments by degree); any label whose rect would overlap an
      // already-placed one is skipped this frame. Rects live in world units,
      // so zooming in shrinks them and progressively reveals skipped labels.
      // While hovering, neighborhood labels ease in and the rest ease out.
      // A dark halo keeps text readable over crossing edges.
      ctx.font = `${11 / k}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.lineJoin = "round";
      ctx.strokeStyle = rgba(bgRgb, 1);
      ctx.lineWidth = 3.5 / k;
      const labelAlphaOf = (i: number): number => {
        const node = graph.nodes[i];
        if (node === undefined) {
          return 0;
        }
        const base = node.kind === "fragment" ? clamp((k - 1.05) * 2, 0, 1) : clamp((k - 0.55) * 2.2, 0, 1);
        const lit = Math.max(litNode[i] ?? 0, hover === i ? 1 : 0);
        return lerp(base, lit, hoverMix) * entranceOf(i, now);
      };
      const labelOrder = graph.nodes
        .map((_, i) => i)
        .filter((i) => labelAlphaOf(i) > 0.02)
        .sort((a, b) => {
          if (a === hover || b === hover) {
            return a === hover ? -1 : 1;
          }
          const nodeA = graph.nodes[a];
          const nodeB = graph.nodes[b];
          if (nodeA === undefined || nodeB === undefined) {
            return 0;
          }
          const rank = kindRank(nodeA.kind) - kindRank(nodeB.kind);
          return rank !== 0 ? rank : nodeB.degree - nodeA.degree;
        });
      const placed: LabelRect[] = [];
      const labelHeight = 13 / k;
      const labelPad = 2 / k;
      for (const i of labelOrder) {
        const node = graph.nodes[i];
        const nodeArt = art[i];
        const particle = sim.nodes[i];
        if (node === undefined || nodeArt === undefined || particle === undefined) {
          continue;
        }
        const textWidth = ctx.measureText(node.label).width;
        const labelX = particle.x + driftX(nodeArt.phase);
        const labelY = particle.y + driftY(nodeArt.phase) + node.radius + 5 / k;
        const rect: LabelRect = {
          x: labelX - textWidth / 2 - labelPad,
          y: labelY - labelPad,
          w: textWidth + labelPad * 2,
          h: labelHeight + labelPad * 2,
        };
        if (placed.some((other) => intersects(rect, other))) {
          continue;
        }
        placed.push(rect);
        ctx.globalAlpha = labelAlphaOf(i);
        ctx.fillStyle = hover === i || node.kind === "composition" ? palette.text : palette.muted;
        ctx.strokeText(node.label, labelX, labelY);
        ctx.fillText(node.label, labelX, labelY);
      }
      ctx.globalAlpha = 1;
    };

    const frame = (): void => {
      raf = null;
      const now = performance.now();
      const moved = reducedMotion ? false : sim.tick();
      if (moved && autoFit) {
        fitView(0.12);
      }
      updateMotion(now);
      if (!reducedMotion) {
        // Continuous loop: ambient drift and breathing keep the scene alive.
        // rAF pauses in background tabs; the component unmounts off-tab.
        draw(now);
        dirty = false;
        schedule();
        return;
      }
      if (moved || dirty) {
        draw(now);
        dirty = false;
      }
      if (moved) {
        schedule();
      }
    };
    const schedule = (): void => {
      if (raf === null) {
        raf = requestAnimationFrame(frame);
      }
    };
    const invalidate = (): void => {
      dirty = true;
      schedule();
    };

    const applySize = (): void => {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    };

    // Track devicePixelRatio changes (browser zoom, moving between monitors)
    // so the backing store stays razor sharp.
    let dprQuery: MediaQueryList | null = null;
    const onDprChange = (): void => {
      dpr = window.devicePixelRatio || 1;
      if (sized) {
        applySize();
      }
      invalidate();
      watchDpr();
    };
    const watchDpr = (): void => {
      dprQuery?.removeEventListener("change", onDprChange);
      dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      dprQuery.addEventListener("change", onDprChange);
    };
    watchDpr();

    const resizeObserver = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect === undefined || rect.width === 0 || rect.height === 0) {
        return;
      }
      const previousWidth = width;
      const previousHeight = height;
      width = rect.width;
      height = rect.height;
      dpr = window.devicePixelRatio || 1;
      applySize();
      if (!sized) {
        sized = true;
        transform.x = width / 2;
        transform.y = height / 2;
        fitView(1);
      } else if (autoFit) {
        // The host may grow after mount (e.g. an embedding page settling its
        // layout); as long as the user hasn't taken the camera, keep the
        // whole graph framed.
        fitView(1);
      } else {
        transform.x += (width - previousWidth) / 2;
        transform.y += (height - previousHeight) / 2;
      }
      invalidate();
    });
    resizeObserver.observe(container);

    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      autoFit = false;
      const rect = canvas.getBoundingClientRect();
      const sx = event.clientX - rect.left;
      const sy = event.clientY - rect.top;
      const next = clamp(transform.k * Math.exp(-event.deltaY * 0.0022), 0.15, 5);
      transform.x = sx - ((sx - transform.x) / transform.k) * next;
      transform.y = sy - ((sy - transform.y) / transform.k) * next;
      transform.k = next;
      invalidate();
    };

    const onPointerDown = (event: PointerEvent): void => {
      if (event.button !== 0) {
        return;
      }
      autoFit = false;
      canvas.setPointerCapture(event.pointerId);
      const rect = canvas.getBoundingClientRect();
      const sx = event.clientX - rect.left;
      const sy = event.clientY - rect.top;
      const index = pick(sx, sy);
      if (index !== null) {
        const particle = sim.nodes[index];
        if (particle === undefined) {
          return;
        }
        const w = toWorld(sx, sy);
        dragging = { index, ox: w.x - particle.x, oy: w.y - particle.y, moved: false, sx, sy };
        canvas.style.cursor = "grabbing";
      } else {
        panning = { sx, sy, tx: transform.x, ty: transform.y };
        canvas.style.cursor = "grabbing";
      }
    };

    const onPointerMove = (event: PointerEvent): void => {
      const rect = canvas.getBoundingClientRect();
      const sx = event.clientX - rect.left;
      const sy = event.clientY - rect.top;
      pointer = { sx, sy };
      if (dragging !== null) {
        const particle = sim.nodes[dragging.index];
        if (particle === undefined) {
          return;
        }
        if (Math.abs(sx - dragging.sx) + Math.abs(sy - dragging.sy) > 4) {
          dragging.moved = true;
        }
        const w = toWorld(sx, sy);
        particle.fx = w.x - dragging.ox;
        particle.fy = w.y - dragging.oy;
        if (!reducedMotion) {
          sim.reheat(0.35);
        }
        invalidate();
        return;
      }
      if (panning !== null) {
        transform.x = panning.tx + (sx - panning.sx);
        transform.y = panning.ty + (sy - panning.sy);
        invalidate();
        return;
      }
      const next = pick(sx, sy);
      if (next !== hover) {
        hover = next;
        canvas.style.cursor = next !== null ? "pointer" : "default";
        invalidate();
      }
    };

    const endDrag = (index: number): void => {
      const particle = sim.nodes[index];
      if (particle !== undefined) {
        particle.fx = null;
        particle.fy = null;
      }
      if (reducedMotion) {
        sim.reheat(0.15);
        sim.settle();
      }
    };

    const onPointerUp = (): void => {
      // The dragged node relaxes away from the cursor on release, so re-pick
      // instead of trusting the pre-drag hover.
      hover = pointer !== null ? pick(pointer.sx, pointer.sy) : null;
      canvas.style.cursor = hover !== null ? "pointer" : "default";
      if (dragging !== null) {
        const { index, moved } = dragging;
        dragging = null;
        endDrag(index);
        invalidate();
        if (!moved) {
          const node = graph.nodes[index];
          if (node !== undefined) {
            if (node.kind === "composition") {
              handlersRef.current.onSelectComposition(node.name);
            } else if (node.kind === "code") {
              handlersRef.current.onSelectCode(node.name);
            } else {
              handlersRef.current.onSelectFragment(node.name);
            }
          }
        }
        return;
      }
      panning = null;
    };

    const onPointerLeave = (): void => {
      pointer = null;
      if (hover !== null && dragging === null) {
        hover = null;
        canvas.style.cursor = "default";
        invalidate();
      }
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerLeave);
    schedule();

    return () => {
      resizeObserver.disconnect();
      dprQuery?.removeEventListener("change", onDprChange);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      if (raf !== null) {
        cancelAnimationFrame(raf);
      }
      rememberPositions(
        graph.nodes.map((node) => node.key),
        sim.nodes,
      );
    };
  }, [graph]);

  const hasCode = graph.nodes.some((node) => node.kind === "code");
  const hasRefs = graph.edges.some((edge) => edge.kind === "ref");

  return (
    <main className="graph-pane" aria-label="Book graph" ref={containerRef}>
      <canvas ref={canvasRef} className="graph-canvas" />
      {graph.nodes.length === 0 ? (
        <p className="graph-empty muted">Nothing to graph yet — add fragments and compositions.</p>
      ) : (
        <>
          <ul className="graph-legend">
            <li>
              <span
                className="graph-dot"
                style={{ background: legendPalette.accent, color: legendPalette.accent }}
              />
              compositions
            </li>
            {hasCode ? (
              <li>
                <span
                  className="graph-dot graph-dot-square"
                  style={{ background: legendPalette.code, color: legendPalette.code }}
                />
                code
              </li>
            ) : null}
            <li>
              <span
                className="graph-dot"
                style={{ background: legendPalette.fragment, color: legendPalette.fragment }}
              />
              fragments
            </li>
            {hasRefs ? <li className="graph-legend-ref">⌁ ${"{…}"} refs</li> : null}
          </ul>
          <p className="graph-hint">drag nodes · scroll to zoom · click to open</p>
        </>
      )}
    </main>
  );
}
