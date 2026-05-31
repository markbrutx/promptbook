/**
 * Public types for the eval engine.
 *
 * Eval is the one place stochasticity enters the system, and it is locked
 * behind an injectable {@link ModelAdapter}. The engine's control flow is
 * deterministic: given the same adapter outputs it returns the same report.
 * The core ships no adapter and makes no network calls — a concrete adapter
 * (e.g. `@markbrutx/promptbook-openrouter`) lives in its own package.
 */
import type { Context, PromptBook } from "../types.js";

/** Token accounting, when an adapter reports it. Provider-agnostic shape. */
export interface ModelUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

/** One model call: the assembled system prompt plus the user input. */
export interface ModelRequest {
  /** The assembled system prompt from {@link resolveBook}. */
  system: string;
  /** The user input that accompanies the system prompt. */
  input: string;
  /** Optional per-request model override; adapters define the default. */
  model?: string;
}

/** A model's reply. `raw` carries the provider payload for debugging. */
export interface ModelResponse {
  text: string;
  usage?: ModelUsage;
  raw?: unknown;
}

/**
 * The seam stochasticity is locked behind. Implementations perform IO/network;
 * the eval engine only ever calls `complete`, so it stays pure given a fake.
 */
export interface ModelAdapter {
  complete(request: ModelRequest): Promise<ModelResponse>;
}

/**
 * A single assertion spec as authored in a fixture JSON. `type` selects the
 * checker from the assertion registry; the remaining fields are its params.
 */
export interface Assertion {
  /** Registry key, e.g. "contains" or "language". */
  type: string;
  /** Substring (contains/not-contains) or exact text (equals). */
  value?: string;
  /** Regex source for matches/not-matches. */
  pattern?: string;
  /** Regex flags for matches/not-matches. */
  flags?: string;
  /** Character ceiling for max-length. */
  max?: number;
  /** Expected language tag or script for `language` (e.g. "ru", "latin"). */
  lang?: string;
}

/** The outcome of running one assertion against one model output. */
export interface AssertionResult {
  /** The assertion `type` that produced this result. */
  type: string;
  pass: boolean;
  /** Human-readable, domain-agnostic explanation. */
  message: string;
  /** A short excerpt of the output relevant to the assertion. */
  excerpt?: string;
}

/** A checker for one assertion type. Pure: same output + spec, same result. */
export type AssertionFn = (output: string, assertion: Assertion) => AssertionResult;

/** Map of assertion `type` to its checker. Callers may supply their own. */
export type AssertionRegistry = Record<string, AssertionFn>;

/** A single eval test case loaded from a `fixtures/*.json` file. */
export interface Fixture {
  /** Lookup name; defaults to the file stem when omitted in JSON. */
  name: string;
  /** Composition name to assemble for this case. */
  prompt: string;
  /** Facts to resolve the composition under. */
  context?: Context;
  /** User input sent alongside the assembled system prompt. */
  input: string;
  /** Assertions every sample's output must satisfy. */
  assert: Assertion[];
  /** Per-fixture sample count; overrides the run-level default. */
  samples?: number;
  /** File the fixture was loaded from. */
  sourceFile?: string;
}

/** Per-fixture aggregate over its samples. */
export interface FixtureResult {
  name: string;
  /** Number of samples taken. */
  samples: number;
  /** Samples where every assertion passed. */
  passes: number;
  /** `passes / samples` (0 when `samples` is 0). */
  passRate: number;
  /** Every failing assertion across all samples, with messages/excerpts. */
  failures: AssertionResult[];
}

/** The aggregated outcome of an eval run. */
export interface EvalReport {
  results: FixtureResult[];
  /** Fraction of fixtures that met the threshold gate (`passed / total`). */
  passRate: number;
  /** Fixtures whose `passRate >= passThreshold`. */
  passed: number;
  /** Fixtures whose `passRate < passThreshold`. */
  failed: number;
}

/** Input to {@link evaluate}. */
export interface EvalInput {
  book: PromptBook;
  fixtures: Fixture[];
  /** The injected model seam; all stochasticity/IO lives here. */
  adapter: ModelAdapter;
  /** Assertion checkers; defaults to {@link defaultAssertions}. */
  assertions?: AssertionRegistry;
  /** Default sample count when a fixture sets none. Defaults to 1. */
  samples?: number;
  /** A fixture passes when `passRate >= passThreshold`. Defaults to 1. */
  passThreshold?: number;
}
