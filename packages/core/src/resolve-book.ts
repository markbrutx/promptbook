import { interpolate } from "./interpolate.js";
import type {
  AddTrace,
  Composition,
  Context,
  ContextValue,
  ForbidTrace,
  PromptBook,
  ReplaceTrace,
  ResolveResult,
  RuleTrace,
  Trace,
  UnmatchedAxis,
  When,
} from "./types.js";

/**
 * Pure resolver over an already-loaded {@link PromptBook}. No filesystem, no
 * YAML, no Node builtins — the entire dependency footprint is {@link interpolate}
 * and type-only imports. This is the determinism boundary: given the same book
 * and context, the returned `text` is byte-for-byte stable, and the module
 * bundles to a self-contained artifact for edge runtimes (see `edge.ts`).
 *
 * Conflict strategy: rules apply in declaration order, later wins (cascade).
 * `forbid` is the one exception — it is applied as a final filter and always
 * wins, so a forbidden id never reaches the output even if added earlier.
 */
export function resolveBook(book: PromptBook, prompt: string, context: Context): ResolveResult {
  const composition = book.compositions.get(prompt);
  if (!composition) {
    const available = [...book.compositions.keys()].sort().join(", ") || "(none)";
    throw new Error(`Unknown prompt "${prompt}". Available compositions: ${available}.`);
  }

  const warnings: string[] = [...book.warnings];
  const ruleTraces: RuleTrace[] = [];
  const replaced: ReplaceTrace[] = [];
  const added: AddTrace[] = [];
  const forbidden: ForbidTrace[] = [];
  const forbiddenIds = new Set<string>();

  const working: string[] = [...composition.base];
  let orderOverride: string[] | undefined = composition.order ? [...composition.order] : undefined;

  for (const rule of composition.rules) {
    const match = matchWhen(rule.when, context);
    const trace: RuleTrace = {
      index: rule.index,
      action: rule.action,
      when: rule.when,
      fired: match.fired,
    };
    if (!match.fired) {
      trace.reason = match.reason;
      ruleTraces.push(trace);
      continue;
    }

    switch (rule.action) {
      case "replace": {
        const effects: string[] = [];
        for (const [from, to] of Object.entries(rule.replace ?? {})) {
          const at = working.indexOf(from);
          if (at === -1) {
            warnings.push(`Rule #${rule.index} cannot replace "${from}": it is not present in "${prompt}".`);
            continue;
          }
          working[at] = to;
          replaced.push({ from, to, ruleIndex: rule.index });
          effects.push(`${from} -> ${to}`);
        }
        trace.effect = `replace ${effects.join(", ")}`;
        break;
      }
      case "add": {
        const ids = rule.add ?? [];
        const after = rule.after;
        const at = insertionPoint(working, after, rule.index, prompt, warnings);
        working.splice(at, 0, ...ids);
        for (const id of ids) {
          added.push(
            after !== undefined ? { id, after, ruleIndex: rule.index } : { id, ruleIndex: rule.index },
          );
        }
        trace.effect = `add ${ids.join(", ")}${after !== undefined ? ` after ${after}` : ""}`;
        break;
      }
      case "forbid": {
        const ids = rule.forbid ?? [];
        for (const id of ids) {
          forbiddenIds.add(id);
          forbidden.push({ id, ruleIndex: rule.index });
        }
        trace.effect = `forbid ${ids.join(", ")}`;
        break;
      }
      case "order": {
        orderOverride = [...(rule.order ?? [])];
        trace.effect = `order ${orderOverride.join(", ")}`;
        break;
      }
    }
    ruleTraces.push(trace);
  }

  const ordered = applyOrder(working, orderOverride);
  const selected = ordered.filter((id) => !forbiddenIds.has(id));

  const parts: string[] = [];
  const finalOrder: string[] = [];
  for (const id of selected) {
    const fragment = book.fragments.get(id);
    if (!fragment) {
      warnings.push(`Fragment "${id}" referenced by "${prompt}" was not found.`);
      continue;
    }
    parts.push(
      interpolate(fragment.body, context, (key) => {
        warnings.push(`Missing variable "${key}" while rendering fragment "${id}".`);
      }),
    );
    finalOrder.push(id);
  }

  const trace: Trace = {
    prompt,
    context,
    rules: ruleTraces,
    finalOrder,
    replaced,
    added,
    forbidden,
    unmatchedAxes: computeUnmatchedAxes(composition, context),
    warnings,
  };

  return { text: parts.join("\n\n"), trace };
}

interface WhenMatch {
  fired: boolean;
  reason?: string;
}

function matchWhen(when: When, context: Context): WhenMatch {
  for (const [key, expected] of Object.entries(when)) {
    const actual = context[key];
    if (actual === undefined) {
      return { fired: false, reason: `context.${key} is unset, rule expects "${expected}"` };
    }
    if (!valuesEqual(expected, actual)) {
      return { fired: false, reason: `context.${key}="${actual}" does not equal expected "${expected}"` };
    }
  }
  return { fired: true };
}

function valuesEqual(a: ContextValue, b: ContextValue): boolean {
  return String(a) === String(b);
}

/**
 * Decide where an `add` inserts. With `after`, just past that id; without it,
 * before the last fragment (so trailing format/footer fragments stay last).
 */
function insertionPoint(
  working: string[],
  after: string | undefined,
  ruleIndex: number,
  prompt: string,
  warnings: string[],
): number {
  if (after === undefined) {
    return Math.max(working.length - 1, 0);
  }
  const at = working.indexOf(after);
  if (at === -1) {
    warnings.push(`Rule #${ruleIndex} add anchor "${after}" not found in "${prompt}"; appending at end.`);
    return working.length;
  }
  return at + 1;
}

/**
 * Produce the final id sequence. With an `order` override, listed ids come
 * first (those that are present), then any remaining working ids in their
 * existing order. Without an override, the working order is used as-is.
 * Duplicates are collapsed to their first occurrence.
 */
function applyOrder(working: string[], orderOverride: string[] | undefined): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  const push = (id: string) => {
    if (!seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  };
  if (orderOverride) {
    const present = new Set(working);
    for (const id of orderOverride) {
      if (present.has(id)) {
        push(id);
      }
    }
  }
  for (const id of working) {
    push(id);
  }
  return result;
}

/**
 * Find context axes that some rule referenced but matched none. This surfaces
 * holes like `industry=zoo` where industry rules exist but none cover "zoo".
 */
function computeUnmatchedAxes(composition: Composition, context: Context): UnmatchedAxis[] {
  const result: UnmatchedAxis[] = [];
  for (const key of Object.keys(context)) {
    let referenced = false;
    let matched = false;
    for (const rule of composition.rules) {
      if (Object.hasOwn(rule.when, key)) {
        referenced = true;
        const expected = rule.when[key];
        if (expected !== undefined && valuesEqual(expected, context[key] as ContextValue)) {
          matched = true;
          break;
        }
      }
    }
    if (referenced && !matched) {
      result.push({ key, value: context[key] as ContextValue });
    }
  }
  return result;
}
