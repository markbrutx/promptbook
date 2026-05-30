import type { LintRule, Severity } from "../types.js";

export interface ExampleBalanceOptions {
  /** Fragment `kind` treated as an example. */
  kind?: string;
  /** Tag prefix that groups examples, e.g. "case:". */
  groupTagPrefix?: string;
  /** Maximum allowed difference between the largest and smallest group. */
  maxSkew?: number;
  severity?: Severity;
}

/**
 * `example-balance` (resolved): few-shot examples (fragments of the configured
 * kind) are grouped by their `groupTagPrefix` tag (e.g. `case:positive`). When
 * the largest group exceeds the smallest by more than `maxSkew`, attention is
 * skewed and a finding is raised. Examples without a group tag are ignored, so
 * the rule only compares groups that actually have examples.
 */
export function exampleBalance(options: ExampleBalanceOptions = {}): LintRule {
  const kind = options.kind ?? "example";
  const groupTagPrefix = options.groupTagPrefix ?? "case:";
  const maxSkew = options.maxSkew ?? 1;
  const severity = options.severity ?? "warning";
  return {
    id: "example-balance",
    description: `Example groups (kind "${kind}", tag "${groupTagPrefix}*") should differ by at most ${maxSkew}.`,
    scope: "resolved",
    check(input) {
      const result = input.result;
      if (result === undefined) {
        return [];
      }
      const counts = new Map<string, number>();
      for (const id of result.trace.finalOrder) {
        const fragment = input.book.fragments.get(id);
        if (fragment?.kind !== kind) {
          continue;
        }
        for (const tag of fragment.tags ?? []) {
          if (tag.startsWith(groupTagPrefix)) {
            counts.set(tag, (counts.get(tag) ?? 0) + 1);
          }
        }
      }
      if (counts.size < 2) {
        return [];
      }
      const values = [...counts.values()];
      const max = Math.max(...values);
      const min = Math.min(...values);
      if (max - min <= maxSkew) {
        return [];
      }
      const summary = [...counts.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([group, count]) => `${group}=${count}`)
        .join(", ");
      return [
        {
          ruleId: "example-balance",
          severity,
          message: `example groups are imbalanced (${summary}); skew ${max - min} exceeds ${maxSkew}`,
        },
      ];
    },
  };
}
