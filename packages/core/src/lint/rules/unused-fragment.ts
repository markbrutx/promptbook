import { iterateReferences } from "../references.js";
import type { LintFinding, LintRule, Severity } from "../types.js";

export interface UnusedFragmentOptions {
  severity?: Severity;
}

/**
 * `unused-fragment` (book): a fragment that no composition mentions — not in a
 * base, order, or any rule (add/replace/forbid/order/after) — is dead weight
 * and is flagged. Findings are sorted by id for deterministic output.
 */
export function unusedFragment(options: UnusedFragmentOptions = {}): LintRule {
  const severity = options.severity ?? "warning";
  return {
    id: "unused-fragment",
    description: "Every fragment should be referenced by at least one composition or rule.",
    scope: "book",
    check(input) {
      const referenced = new Set<string>();
      for (const reference of iterateReferences(input.book)) {
        referenced.add(reference.id);
      }
      const findings: LintFinding[] = [];
      for (const id of [...input.book.fragments.keys()].sort()) {
        if (!referenced.has(id)) {
          findings.push({
            ruleId: "unused-fragment",
            severity,
            message: `fragment "${id}" is not referenced by any composition or rule`,
            fragmentId: id,
          });
        }
      }
      return findings;
    },
  };
}
