import { iterateReferences } from "../references.js";
import type { LintFinding, LintRule, Severity } from "../types.js";

export interface DanglingReferenceOptions {
  severity?: Severity;
}

/**
 * `dangling-reference` (book): any reference (base, order, or a rule's
 * add/replace/forbid/order/after) that points at a fragment id which does not
 * exist is a hard error — the prompt cannot assemble as written.
 */
export function danglingReference(options: DanglingReferenceOptions = {}): LintRule {
  const severity = options.severity ?? "error";
  return {
    id: "dangling-reference",
    description: "Every referenced fragment id must exist.",
    scope: "book",
    check(input) {
      const findings: LintFinding[] = [];
      for (const reference of iterateReferences(input.book)) {
        if (input.book.fragments.has(reference.id)) {
          continue;
        }
        const where =
          reference.ruleIndex !== undefined
            ? `rule #${reference.ruleIndex} (${reference.role})`
            : reference.role;
        const finding: LintFinding = {
          ruleId: "dangling-reference",
          severity,
          message: `composition "${reference.composition}" references unknown fragment "${reference.id}" via ${where}`,
          fragmentId: reference.id,
        };
        if (reference.ruleIndex !== undefined) {
          finding.ruleIndex = reference.ruleIndex;
        }
        findings.push(finding);
      }
      return findings;
    },
  };
}
