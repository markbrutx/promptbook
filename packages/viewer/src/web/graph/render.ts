/**
 * Render-only helpers for the graph canvas: color math, pre-rendered glow
 * sprites, and easing utilities. Nothing here reads or mutates simulation
 * state — GraphView composes these into the per-frame draw.
 */

export type Rgb = [number, number, number];

/** Resolve any CSS color (hex, rgb(), named, theme token value) to RGB by
 * rasterizing one pixel. Broken/empty tokens degrade to the fallback. */
export function parseColor(color: string, fallback: Rgb): Rgb {
  if (color === "") {
    return fallback;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d");
  if (ctx === null) {
    return fallback;
  }
  ctx.fillStyle = rgba(fallback, 1);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const data = ctx.getImageData(0, 0, 1, 1).data;
  return [data[0] ?? fallback[0], data[1] ?? fallback[1], data[2] ?? fallback[2]];
}

export function rgba(c: Rgb, alpha: number): string {
  return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
}

export function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

const SPRITE_SIZE = 128;

function radialSprite(stops: [number, string][]): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = SPRITE_SIZE;
  canvas.height = SPRITE_SIZE;
  const ctx = canvas.getContext("2d");
  if (ctx !== null) {
    const half = SPRITE_SIZE / 2;
    const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
    for (const [offset, color] of stops) {
      gradient.addColorStop(offset, color);
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  }
  return canvas;
}

/** Halo sprite: hot near-white center → colored falloff → transparent.
 * Drawn with `lighter` compositing so overlapping halos bloom additively —
 * this replaces per-frame shadowBlur, which is far too slow. */
export function makeGlowSprite(color: Rgb): HTMLCanvasElement {
  const hot = mix(color, [255, 255, 255], 0.55);
  return radialSprite([
    [0, rgba(hot, 0.9)],
    [0.1, rgba(color, 0.5)],
    [0.28, rgba(color, 0.16)],
    [0.6, rgba(color, 0.045)],
    [1, rgba(color, 0)],
  ]);
}

/** Small specular highlight layered over the crisp core disc. */
export function makeCoreSprite(color: Rgb): HTMLCanvasElement {
  const hot = mix(color, [255, 255, 255], 0.85);
  return radialSprite([
    [0, rgba(hot, 0.9)],
    [0.45, rgba(mix(color, [255, 255, 255], 0.4), 0.28)],
    [1, rgba(color, 0)],
  ]);
}

/** Wide, faint fog puddle drawn once behind the whole cluster. */
export function makeFogSprite(color: Rgb): HTMLCanvasElement {
  return radialSprite([
    [0, rgba(color, 0.16)],
    [0.5, rgba(color, 0.07)],
    [1, rgba(color, 0)],
  ]);
}

export const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));

export const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;

/** Slight overshoot for the entrance ignite. */
export function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

/** Frame-rate independent exponential approach toward a target.
 * `tau` is the time constant in ms (~63% of the gap closed per tau). */
export function approach(current: number, target: number, dtMs: number, tau: number): number {
  return current + (target - current) * (1 - Math.exp(-dtMs / tau));
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** Deterministic per-node phase so ambient drift never synchronizes. */
export const phaseOf = (index: number): number => index * GOLDEN_ANGLE * 7.13;
