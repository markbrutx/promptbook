import type { FragmentReference } from "./lint/references.js";
import { iterateReferences } from "./lint/references.js";
import type { ContextValue, PromptBook } from "./types.js";
import { extractVariables } from "./vars.js";

/**
 * The context a composition declares it needs, derived statically (no cascade
 * run). Lets a consumer see the keys to supply instead of discovering holes one
 * `Missing variable` at a time.
 */
export interface RequiredContext {
  /** `${var}` keys across the composition's reachable fragments; sorted, unique. */
  vars: string[];
  /** `when`-axis key → sorted unique option values seen across its rules. */
  axes: Record<string, ContextValue[]>;
  /** Provenance: each var → the fragment ids that introduce it; sorted, unique. */
  sources: Record<string, string[]>;
}

/** Roles that can put a fragment into the assembled output (so its vars matter). */
const REACHABLE_ROLES = new Set<FragmentReference["role"]>(["base", "add", "replace-to"]);

/**
 * Statically report the context a composition needs: the `${var}` keys across
 * every fragment it can reach (`base ∪ add-ids ∪ replace-targets`) and the
 * `when`-axes its rules branch on.
 *
 * Directed over-approximation: it unions vars across *all* rules without running
 * the cascade, so supplying every reported key never leaves a hole in any
 * context (a never-firing `add` may over-report, never under-report). `forbid`
 * and `order` introduce no new fragments, so they contribute no vars. Throws on
 * an unknown composition, matching `resolveBook`.
 */
export function requiredContext(book: PromptBook, compName: string): RequiredContext {
  const composition = book.compositions.get(compName);
  if (!composition) {
    const available = [...book.compositions.keys()].sort().join(", ") || "(none)";
    throw new Error(`Unknown prompt "${compName}". Available compositions: ${available}.`);
  }

  const reachable = new Set<string>();
  for (const ref of iterateReferences(book)) {
    if (ref.composition === compName && REACHABLE_ROLES.has(ref.role)) {
      reachable.add(ref.id);
    }
  }

  const sourceSets = new Map<string, Set<string>>();
  for (const id of reachable) {
    const fragment = book.fragments.get(id);
    if (!fragment) {
      continue;
    }
    for (const key of extractVariables(fragment.body)) {
      addTo(sourceSets, key, id);
    }
  }

  const axisSets = new Map<string, Set<ContextValue>>();
  for (const rule of composition.rules) {
    for (const [key, value] of Object.entries(rule.when)) {
      addTo(axisSets, key, value);
    }
  }

  const vars = [...sourceSets.keys()].sort();
  const sources: Record<string, string[]> = {};
  for (const key of vars) {
    sources[key] = [...(sourceSets.get(key) ?? [])].sort();
  }
  const axes: Record<string, ContextValue[]> = {};
  for (const key of [...axisSets.keys()].sort()) {
    axes[key] = [...(axisSets.get(key) ?? [])].sort(compareContextValues);
  }

  return { vars, axes, sources };
}

/** Append `value` to the set under `key`, creating the set on first use. */
function addTo<V>(map: Map<string, Set<V>>, key: string, value: V): void {
  let set = map.get(key);
  if (set === undefined) {
    set = new Set();
    map.set(key, set);
  }
  set.add(value);
}

/** Stable order for axis options: numeric when both numbers, else by string. */
function compareContextValues(a: ContextValue, b: ContextValue): number {
  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }
  return String(a).localeCompare(String(b));
}
