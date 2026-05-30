import type { LintRule } from "../types.js";
import { bannedTokens } from "./banned-tokens.js";
import { danglingReference } from "./dangling-reference.js";
import { deadRule } from "./dead-rule.js";
import { exampleBalance } from "./example-balance.js";
import { languageDirectivePosition } from "./language-directive-position.js";
import { tokenBudget } from "./token-budget.js";
import { unusedFragment } from "./unused-fragment.js";

/** Options surfaced through {@link defaultRules}; per-rule factories take more. */
export interface DefaultRulesOptions {
  /** Override the token-budget ceiling. */
  maxTokens?: number;
  /** Override the banned-tokens list. */
  bannedTokens?: (string | RegExp)[];
}

/**
 * The built-in rule set, instantiated with optional overrides. Callers can
 * also build their own array and pass it to `lint` to swap the set entirely.
 */
export function defaultRules(options: DefaultRulesOptions = {}): LintRule[] {
  return [
    tokenBudget(options.maxTokens !== undefined ? { maxTokens: options.maxTokens } : {}),
    languageDirectivePosition(),
    exampleBalance(),
    bannedTokens(options.bannedTokens !== undefined ? { tokens: options.bannedTokens } : {}),
    unusedFragment(),
    danglingReference(),
    deadRule(),
  ];
}

export type { BannedTokensOptions } from "./banned-tokens.js";
export { bannedTokens } from "./banned-tokens.js";
export type { DanglingReferenceOptions } from "./dangling-reference.js";
export { danglingReference } from "./dangling-reference.js";
export type { DeadRuleOptions } from "./dead-rule.js";
export { deadRule } from "./dead-rule.js";
export type { ExampleBalanceOptions } from "./example-balance.js";
export { exampleBalance } from "./example-balance.js";
export type { LanguageDirectivePositionOptions } from "./language-directive-position.js";
export { languageDirectivePosition } from "./language-directive-position.js";
export type { TokenBudgetOptions } from "./token-budget.js";
export { estimateTokensByChars, tokenBudget } from "./token-budget.js";
export type { UnusedFragmentOptions } from "./unused-fragment.js";
export { unusedFragment } from "./unused-fragment.js";
