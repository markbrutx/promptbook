/**
 * Self-contained entrypoint for edge / Deno / browser runtimes that only need
 * to resolve and lint an already-bundled book at request time (no folder
 * loading). Its module graph touches no filesystem, YAML, or Node builtins, so
 * `scripts/build-edge.mjs` bundles it to one portable ESM file with no
 * external imports. Consumers (e.g. a Supabase edge function or a static
 * Next.js demo) vendor that file and pair it with a `promptbook bundle` book.
 */
export { interpolate } from "./interpolate.js";
export { lint } from "./lint/lint.js";
export type { FragmentReference } from "./lint/references.js";
export { iterateReferences } from "./lint/references.js";
export { estimateTokensByChars } from "./lint/rules/token-budget.js";
export type { LintFinding, LintInput, LintReport, LintRule, LintScope, Severity } from "./lint/types.js";
export { resolveBook } from "./resolve-book.js";
export type {
  Composition,
  Context,
  ContextValue,
  Fragment,
  PromptBook,
  ResolveResult,
  Rule,
  RuleAction,
  Trace,
  When,
} from "./types.js";
