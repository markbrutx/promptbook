import type { LintFinding, LintRule, Severity } from "../types.js";

export interface BannedTokensOptions {
  /** Substrings or patterns that must not appear in the assembled text. */
  tokens?: (string | RegExp)[];
  severity?: Severity;
}

// Em-dash: a common stylistic ban, and deliberately generic (not domain-specific).
const EM_DASH = "\u2014";
const DEFAULT_BANNED: (string | RegExp)[] = [EM_DASH];

/**
 * `banned-tokens` (resolved): the assembled text must not contain any of the
 * configured substrings or patterns. The default bans the em-dash. Patterns
 * should not use the global flag, since each token is tested once.
 */
export function bannedTokens(options: BannedTokensOptions = {}): LintRule {
  const tokens = options.tokens ?? DEFAULT_BANNED;
  const severity = options.severity ?? "error";
  return {
    id: "banned-tokens",
    description: "Resolved prompt must not contain banned substrings or patterns.",
    scope: "resolved",
    check(input) {
      const result = input.result;
      if (result === undefined) {
        return [];
      }
      const text = result.text;
      const findings: LintFinding[] = [];
      for (const token of tokens) {
        const matched = typeof token === "string" ? text.includes(token) : token.test(text);
        if (matched) {
          const label = typeof token === "string" ? JSON.stringify(token) : String(token);
          findings.push({
            ruleId: "banned-tokens",
            severity,
            message: `text contains banned token ${label}`,
          });
        }
      }
      return findings;
    },
  };
}
