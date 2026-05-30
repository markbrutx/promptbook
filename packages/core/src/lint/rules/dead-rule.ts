import type { LintFinding, LintRule, Severity } from "../types.js";

export interface DeadRuleOptions {
  severity?: Severity;
}

/**
 * `dead-rule` (book): catch rules that statically cannot do what they say.
 * Walking each composition's rules in order over a present-set seeded from
 * `base` (ignoring `when`), it flags: a `replace` whose source is never
 * present, an `add` of an already-present id, and an `order` naming an unknown
 * id.
 *
 * v0 limitation: this is a static check only. "A rule that never fires under
 * any context" (which requires enumerating contexts) is out of scope, and
 * because `when` is ignored, mutually-exclusive rules can read as redundant.
 */
export function deadRule(options: DeadRuleOptions = {}): LintRule {
  const severity = options.severity ?? "warning";
  return {
    id: "dead-rule",
    description: "Rules should affect fragments that can be present (static check).",
    scope: "book",
    check(input) {
      const findings: LintFinding[] = [];
      for (const composition of input.book.compositions.values()) {
        const present = new Set<string>(composition.base);
        for (const rule of composition.rules) {
          switch (rule.action) {
            case "add":
              for (const id of rule.add ?? []) {
                if (present.has(id)) {
                  findings.push({
                    ruleId: "dead-rule",
                    severity,
                    message: `rule #${rule.index} in "${composition.name}" adds "${id}", which is already present`,
                    fragmentId: id,
                    ruleIndex: rule.index,
                  });
                }
                present.add(id);
              }
              break;
            case "replace":
              for (const [from, to] of Object.entries(rule.replace ?? {})) {
                if (present.has(from)) {
                  present.delete(from);
                  present.add(to);
                } else {
                  findings.push({
                    ruleId: "dead-rule",
                    severity,
                    message: `rule #${rule.index} in "${composition.name}" replaces "${from}", which is never present`,
                    fragmentId: from,
                    ruleIndex: rule.index,
                  });
                }
              }
              break;
            case "order":
              for (const id of rule.order ?? []) {
                if (!present.has(id)) {
                  findings.push({
                    ruleId: "dead-rule",
                    severity,
                    message: `rule #${rule.index} in "${composition.name}" orders unknown id "${id}"`,
                    fragmentId: id,
                    ruleIndex: rule.index,
                  });
                }
              }
              break;
            case "forbid":
              // `forbid` does not feed the static present-set in v0.
              break;
          }
        }
      }
      return findings;
    },
  };
}
