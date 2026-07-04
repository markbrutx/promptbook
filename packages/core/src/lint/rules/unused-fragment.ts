import { extractVariables } from "../../vars.js";
import { iterateReferences } from "../references.js";
import type { LintFinding, LintRule, Severity } from "../types.js";

export interface UnusedFragmentOptions {
  severity?: Severity;
}

/**
 * `unused-fragment` (book): a fragment nothing can reach is dead weight and is
 * flagged. Reachable means: mentioned by a composition (base, order, or any
 * rule's add/after/replace/forbid/order), or referenced via a `${...}` ref
 * from an already-reachable fragment's body — transitively, so a chain of
 * fragments that only reference each other is flagged whole. A `${...}` key
 * counts only when it names an existing fragment id; context variables anchor
 * nothing. Code-prompts never reference fragments (their builders live in
 * code), so they anchor nothing either. Findings are sorted by id for
 * deterministic output.
 */
export function unusedFragment(options: UnusedFragmentOptions = {}): LintRule {
  const severity = options.severity ?? "warning";
  return {
    id: "unused-fragment",
    description: "Every fragment should be reachable from at least one composition or rule.",
    scope: "book",
    check(input) {
      const { fragments } = input.book;
      const reachable = new Set<string>();
      const queue: string[] = [];
      const mark = (id: string) => {
        if (!reachable.has(id)) {
          reachable.add(id);
          queue.push(id);
        }
      };
      for (const reference of iterateReferences(input.book)) {
        mark(reference.id);
      }
      while (queue.length > 0) {
        const fragment = fragments.get(queue.pop() as string);
        if (!fragment) {
          continue;
        }
        for (const key of extractVariables(fragment.body)) {
          if (fragments.has(key)) {
            mark(key);
          }
        }
      }
      const findings: LintFinding[] = [];
      for (const id of [...fragments.keys()].sort()) {
        if (!reachable.has(id)) {
          const sourceFile = fragments.get(id)?.sourceFile ?? "";
          findings.push({
            ruleId: "unused-fragment",
            severity,
            message: `fragment "${id}" (${sourceFile}) is not referenced by any composition, rule, or reachable fragment`,
            fragmentId: id,
          });
        }
      }
      return findings;
    },
  };
}
