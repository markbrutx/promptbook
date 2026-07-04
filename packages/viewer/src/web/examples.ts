import type { CompositionSummary, ContextValue } from "./types.js";

/**
 * Example values per context axis, harvested from the composition's own rules
 * (`when` values) and saved variants. Empty states teach with the book's own
 * vocabulary instead of hardcoded strings, so the viewer stays agnostic.
 */
export function axisExamples(composition: CompositionSummary | undefined): Record<string, ContextValue[]> {
  if (composition === undefined) {
    return {};
  }
  const byKey = new Map<string, ContextValue[]>();
  const add = (key: string, value: ContextValue): void => {
    const list = byKey.get(key) ?? [];
    if (!list.includes(value)) {
      list.push(value);
    }
    byKey.set(key, list);
  };
  for (const rule of composition.rules) {
    for (const [key, value] of Object.entries(rule.when)) {
      add(key, value);
    }
  }
  for (const variant of composition.variants) {
    for (const [key, value] of Object.entries(variant.context)) {
      add(key, value);
    }
  }
  return Object.fromEntries(byKey);
}

/** Up to `limit` starter `key=value` pairs (one per axis) for the try-it hint. */
export function starterPairs(
  examples: Record<string, ContextValue[]>,
  limit = 3,
): Array<{ key: string; value: ContextValue }> {
  return Object.entries(examples)
    .filter(([, values]) => values.length > 0)
    .slice(0, limit)
    .map(([key, values]) => ({ key, value: values[0] as ContextValue }));
}
