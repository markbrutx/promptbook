import type { LintFinding, LintRule, Severity } from "../types.js";

export interface LanguageDirectivePositionOptions {
  /** Fragment `kind` that must sit at an edge. */
  kind?: string;
  /** How many leading/trailing positions count as an edge. */
  edgeWindow?: number;
  severity?: Severity;
}

/**
 * `language-directive-position` (resolved): fragments of the configured kind
 * must appear within the first or last `edgeWindow` positions of the final
 * order. A language directive buried in the middle is easy for a model to
 * miss, so it is flagged.
 */
export function languageDirectivePosition(options: LanguageDirectivePositionOptions = {}): LintRule {
  const kind = options.kind ?? "language-directive";
  const edgeWindow = options.edgeWindow ?? 2;
  const severity = options.severity ?? "warning";
  return {
    id: "language-directive-position",
    description: `Fragments of kind "${kind}" should sit within the first/last ${edgeWindow} positions.`,
    scope: "resolved",
    check(input) {
      const result = input.result;
      if (result === undefined) {
        return [];
      }
      const order = result.trace.finalOrder;
      const total = order.length;
      const findings: LintFinding[] = [];
      order.forEach((id, position) => {
        if (input.book.fragments.get(id)?.kind !== kind) {
          return;
        }
        const atStart = position < edgeWindow;
        const atEnd = position >= total - edgeWindow;
        if (!atStart && !atEnd) {
          findings.push({
            ruleId: "language-directive-position",
            severity,
            message: `fragment "${id}" (kind "${kind}") is at position ${position + 1} of ${total}, not within the first/last ${edgeWindow}`,
            fragmentId: id,
          });
        }
      });
      return findings;
    },
  };
}
