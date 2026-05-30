import type { LintRule, Severity } from "../types.js";

/** Heuristic token estimate: ~4 characters per token. Not a real tokenizer. */
export function estimateTokensByChars(text: string): number {
  return Math.ceil(text.length / 4);
}

export interface TokenBudgetOptions {
  /** Maximum estimated tokens before a finding is raised. */
  maxTokens?: number;
  /** Inject a real token counter; defaults to the chars/4 heuristic. */
  estimateTokens?: (text: string) => number;
  severity?: Severity;
}

const DEFAULT_MAX_TOKENS = 8000;

/**
 * `token-budget` (resolved): estimate the assembled text's token count and
 * report when it exceeds `maxTokens`. The estimate is a deterministic
 * heuristic (chars/4) so the core stays dependency-free; callers can inject a
 * precise counter via `estimateTokens`.
 */
export function tokenBudget(options: TokenBudgetOptions = {}): LintRule {
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
  const estimate = options.estimateTokens ?? estimateTokensByChars;
  const severity = options.severity ?? "warning";
  return {
    id: "token-budget",
    description: `Resolved prompt should fit within ~${maxTokens} estimated tokens.`,
    scope: "resolved",
    check(input) {
      const result = input.result;
      if (result === undefined) {
        return [];
      }
      const tokens = estimate(result.text);
      if (tokens <= maxTokens) {
        return [];
      }
      return [
        {
          ruleId: "token-budget",
          severity,
          message: `estimated ${tokens} tokens exceeds budget of ${maxTokens}`,
        },
      ];
    },
  };
}
