import { defaultRules } from "./rules/index.js";
import type { LintFinding, LintInput, LintReport, LintRule } from "./types.js";

/**
 * Run lint rules over an input and aggregate the findings.
 *
 * Book-scope rules always run. Resolved-scope rules run only when
 * `input.result` is present, so calling `lint({ book })` lints structure only.
 * The engine has no intelligence of its own: it dispatches by scope and counts
 * severities. All judgement lives in the rules.
 */
export function lint(input: LintInput, rules: LintRule[] = defaultRules()): LintReport {
  const findings: LintFinding[] = [];
  for (const rule of rules) {
    if (rule.scope === "resolved" && input.result === undefined) {
      continue;
    }
    findings.push(...rule.check(input));
  }

  let errorCount = 0;
  let warningCount = 0;
  for (const finding of findings) {
    if (finding.severity === "error") {
      errorCount += 1;
    } else if (finding.severity === "warning") {
      warningCount += 1;
    }
  }

  return { findings, errorCount, warningCount };
}
