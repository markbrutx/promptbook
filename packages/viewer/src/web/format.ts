import type { Context, When } from "./types.js";

/** Render a context/when bag as `k=v, k=v` (empty bag → ""). */
export function kvLabel(bag: Context | When): string {
  return Object.entries(bag)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
}
