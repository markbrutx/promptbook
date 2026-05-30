/**
 * Public types for the lint engine.
 *
 * Lint is static and deterministic: it runs pluggable rules over an assembled
 * `{ text, trace }` and/or the book structure. It never calls a model and adds
 * no runtime dependencies.
 */
import type { PromptBook, ResolveResult } from "../types.js";

/** How serious a finding is. `error` drives a non-zero CLI exit. */
export type Severity = "error" | "warning" | "info";

/** When a rule can run: over a resolved prompt, or over the book structure. */
export type LintScope = "resolved" | "book";

/** A single problem a rule reports. */
export interface LintFinding {
  /** Id of the rule that produced this finding. */
  ruleId: string;
  severity: Severity;
  /** Human-readable, domain-agnostic description. */
  message: string;
  /** Fragment the finding points at, when applicable. */
  fragmentId?: string;
  /** Composition rule index the finding points at, when applicable. */
  ruleIndex?: number;
}

/** What lint runs against. `result` is present only for resolved-scope rules. */
export interface LintInput {
  book: PromptBook;
  result?: ResolveResult;
}

/**
 * A pluggable rule. Created by a factory so thresholds are configurable, e.g.
 * `tokenBudget({ maxTokens })`. `check` is pure: same input, same findings.
 */
export interface LintRule {
  /** Stable id, e.g. "token-budget". */
  id: string;
  /** One-line explanation of what the rule enforces. */
  description: string;
  /** Scope decides whether the rule needs `input.result`. */
  scope: LintScope;
  /** Inspect the input and return zero or more findings. */
  check(input: LintInput): LintFinding[];
}

/** The aggregated outcome of a lint run. */
export interface LintReport {
  findings: LintFinding[];
  errorCount: number;
  warningCount: number;
}
