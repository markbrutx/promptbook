/** Matches `${path}` placeholders, capturing an optional leading `\` escape. */
export const VAR_RE = /(\\?)\$\{([^}]+)\}/g;

/**
 * Extract the variable keys referenced by `${path}` placeholders in `body`.
 *
 * Shares its syntax with {@link interpolate} (both read {@link VAR_RE}), so the
 * keys reported here are exactly the ones interpolation substitutes. Escaped
 * `\${path}` placeholders are ignored (they render literally); keys are trimmed,
 * sorted and de-duplicated.
 */
export function extractVariables(body: string): string[] {
  const keys = new Set<string>();
  for (const match of body.matchAll(VAR_RE)) {
    const [, backslash, expr] = match;
    if (backslash || expr === undefined) {
      continue;
    }
    keys.add(expr.trim());
  }
  return [...keys].sort();
}
