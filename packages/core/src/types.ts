/**
 * Public data model for the promptbook core.
 *
 * The core is domain-agnostic: it only selects, orders and interpolates
 * fragments. Any computed value (digests, scores, sorted lists) must be
 * supplied by the caller through {@link Context}.
 */

/** A scalar context value. The core never stores domain objects. */
export type ContextValue = string | number | boolean;

/** A flat bag of facts the caller knows at resolve time. */
export type Context = Record<string, ContextValue>;

/** A reusable micro-prompt (the WHAT). */
export interface Fragment {
  /** Unique id within a prompts folder. */
  id: string;
  /** Optional classification, e.g. "directive" or "format". */
  kind?: string;
  /** Optional free-form tags. */
  tags?: string[];
  /** Body text; may contain `${path}` placeholders. */
  body: string;
  /** Absolute/relative path the fragment was loaded from. */
  sourceFile: string;
}

/** Equality conditions on context. An empty object always matches. */
export type When = Record<string, ContextValue>;

/** The single action a rule performs. */
export type RuleAction = "add" | "replace" | "forbid" | "order";

/**
 * A declarative selection rule (the WHEN). Exactly one action field is set,
 * matching {@link RuleAction}.
 */
export interface Rule {
  /** Position in the composition's `rules` list; drives the cascade. */
  index: number;
  /** Match conditions. Empty = always fires. */
  when: When;
  /** Which action this rule performs. */
  action: RuleAction;
  /** ids to insert (action "add"). */
  add?: string[];
  /** Optional anchor: insert added ids after this id. */
  after?: string;
  /** Map of old id to new id (action "replace"). */
  replace?: Record<string, string>;
  /** ids to remove from the result (action "forbid"). */
  forbid?: string[];
  /** Explicit final order of ids (action "order"). */
  order?: string[];
}

/** A full system prompt assembled from fragments under one context. */
export interface Composition {
  /** Lookup name, e.g. "assistant". */
  name: string;
  /** Ordered base list of fragment ids. */
  base: string[];
  /** Optional explicit order override declared on the composition. */
  order?: string[];
  /** Ordered selection rules. */
  rules: Rule[];
  /** File the composition was loaded from. */
  sourceFile: string;
}

/**
 * A captured snapshot of a builder-backed prompt's output. The core never
 * runs the builder; it only stores the frozen text so the registry can show it.
 */
export interface CodePromptSample {
  /** Label identifying the sample, e.g. a scenario name. */
  label: string;
  /** Optional context the sample was captured under. */
  context?: Context;
  /** The captured builder output, stored verbatim. */
  output: string;
}

/**
 * A builder-backed prompt registered in the book (the HOW lives in code, not in
 * rules). The core holds metadata plus captured {@link CodePromptSample}s and
 * **never executes the builder** — it stays dumb and deterministic. This lets a
 * book index every prompt of a domain, computed ones included, as one menu.
 */
export interface CodePrompt {
  /** Lookup name, e.g. "quiz-pack". */
  name: string;
  /** Optional human description. */
  description?: string;
  /** Captured output samples (snapshots, not live executions). */
  samples: CodePromptSample[];
  /** Manifest file the code-prompt was loaded from. */
  sourceFile: string;
}

/** A loaded prompts folder: fragments + compositions + code-prompts + load-time warnings. */
export interface PromptBook {
  fragments: Map<string, Fragment>;
  compositions: Map<string, Composition>;
  /** Builder-backed prompts registered with snapshot output (never executed). */
  codePrompts: Map<string, CodePrompt>;
  warnings: string[];
}

/** Per-rule entry in the explain trace. */
export interface RuleTrace {
  index: number;
  action: RuleAction;
  when: When;
  /** Whether the rule's `when` matched the context. */
  fired: boolean;
  /** When `fired` is false, why (which key failed). */
  reason?: string;
  /** When `fired` is true, a human-readable summary of the effect. */
  effect?: string;
}

export interface ReplaceTrace {
  from: string;
  to: string;
  ruleIndex: number;
}

export interface AddTrace {
  id: string;
  after?: string;
  ruleIndex: number;
}

export interface ForbidTrace {
  id: string;
  ruleIndex: number;
}

/** A context axis that rules referenced but none matched its value. */
export interface UnmatchedAxis {
  key: string;
  value: ContextValue;
}

/** The explain trace: everything needed to see why the prompt looks as it does. */
export interface Trace {
  /** Composition name that was resolved. */
  prompt: string;
  /** Context the resolution ran against. */
  context: Context;
  /** Every rule, in declaration order, with fired/why. */
  rules: RuleTrace[];
  /** Final fragment ids in join order (only fragments that rendered). */
  finalOrder: string[];
  /** Replacements applied. */
  replaced: ReplaceTrace[];
  /** Additions applied. */
  added: AddTrace[];
  /** Forbids applied. */
  forbidden: ForbidTrace[];
  /** Axes present in context that no rule matched (e.g. unknown industry). */
  unmatchedAxes: UnmatchedAxis[];
  /** Missing variables, missing fragment refs, and other non-fatal issues. */
  warnings: string[];
}

/** The result of {@link resolve}. */
export interface ResolveResult {
  text: string;
  trace: Trace;
}

/** Injectable filesystem so the core stays runtime-agnostic (Node/Deno/Bun). */
export interface FsAdapter {
  readFile(path: string): Promise<string>;
  readDir(path: string): Promise<string[]>;
}

/** Input to {@link resolve}. */
export interface ResolveInput {
  /** Folder containing `fragments/` and `rules/`. */
  promptsDir: string;
  /** Composition name to assemble. */
  prompt: string;
  /** Facts to match rules against and interpolate into bodies. */
  context?: Context;
  /** Optional filesystem adapter; defaults to a lazy Node adapter. */
  fs?: FsAdapter;
}
