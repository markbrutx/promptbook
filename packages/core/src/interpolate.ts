import type { Context } from "./types.js";
import { VAR_RE } from "./vars.js";

/**
 * Substitute `${path}` placeholders in `body` using `context`.
 *
 * - A missing key resolves to an empty string and triggers `onMissing(key)`.
 *   Interpolation never throws.
 * - `\${path}` is an escape and renders the literal `${path}`.
 * - Lookup is by flat key, matching the flat {@link Context} shape.
 */
export function interpolate(body: string, context: Context, onMissing: (key: string) => void): string {
  return body.replace(VAR_RE, (_match, backslash: string, expr: string) => {
    if (backslash) {
      return `\${${expr}}`;
    }
    const key = expr.trim();
    const value = context[key];
    if (value === undefined) {
      onMissing(key);
      return "";
    }
    return String(value);
  });
}
