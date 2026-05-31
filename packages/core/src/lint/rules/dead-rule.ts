import { valuesEqual } from "../../resolve-book.js";
import type { Composition, When } from "../../types.js";
import type { LintFinding, LintRule, Severity } from "../types.js";

export interface DeadRuleOptions {
  severity?: Severity;
}

/**
 * `dead-rule` (book): catch rules that statically cannot do what they say.
 * For each rule it flags a `replace` whose source is never present, an `add` of
 * an already-present id, and an `order` naming an id that can never appear.
 *
 * `when` is taken into account: a prior rule only shapes the present-set a later
 * rule sees if it is *guaranteed to co-fire* — i.e. its `when` is implied by the
 * later rule's `when`. This keeps mutually-exclusive single-axis swaps (e.g.
 * `tone=a|b|c` each replacing the same base fragment) from reading as dead,
 * while still catching a replace whose source was unconditionally consumed by an
 * earlier rule.
 *
 * v0 limitation: still a static check. "A rule that never fires under any
 * context" (which requires enumerating contexts) remains out of scope.
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
        const everPresent = everPresentSet(composition);
        composition.rules.forEach((rule, position) => {
          const present = presentSetFor(composition.base, composition.rules, position, rule.when);
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
              }
              break;
            case "replace":
              for (const from of Object.keys(rule.replace ?? {})) {
                if (!present.has(from)) {
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
                if (!everPresent.has(id)) {
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
        });
      }
      return findings;
    },
  };
}

/**
 * The present-set a rule sees: `base` mutated by every earlier rule that is
 * guaranteed to co-fire (its `when` is implied by this rule's `when`).
 */
function presentSetFor(
  base: readonly string[],
  rules: Composition["rules"],
  position: number,
  currentWhen: When,
): Set<string> {
  const present = new Set<string>(base);
  for (let i = 0; i < position; i++) {
    const prior = rules[i];
    if (!prior || !firesWhenever(prior.when, currentWhen)) {
      continue;
    }
    if (prior.action === "add") {
      for (const id of prior.add ?? []) {
        present.add(id);
      }
    } else if (prior.action === "replace") {
      for (const [from, to] of Object.entries(prior.replace ?? {})) {
        if (present.has(from)) {
          present.delete(from);
          present.add(to);
        }
      }
    }
  }
  return present;
}

/** Every id that can ever appear: base plus all add ids and all replace targets. */
function everPresentSet(composition: Composition): Set<string> {
  const present = new Set<string>(composition.base);
  for (const rule of composition.rules) {
    if (rule.action === "add") {
      for (const id of rule.add ?? []) {
        present.add(id);
      }
    } else if (rule.action === "replace") {
      for (const to of Object.values(rule.replace ?? {})) {
        present.add(to);
      }
    }
  }
  return present;
}

/** True if `prior` fires in every context where `current` fires — i.e. every
 * constraint in `prior` is also required (same value) by `current`. An empty
 * `prior` (unconditional) always co-fires. */
function firesWhenever(prior: When, current: When): boolean {
  for (const [key, value] of Object.entries(prior)) {
    const actual = current[key];
    if (actual === undefined || !valuesEqual(actual, value)) {
      return false;
    }
  }
  return true;
}
