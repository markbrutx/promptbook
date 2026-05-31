/**
 * Wire types shared by the server and the web app. These are the JSON shapes
 * the `/api/*` routes speak; importing them on both sides keeps the contract
 * in one place. Only type-only imports from `@promptbook/core` are used so the
 * file carries no runtime dependency.
 */
import type {
  Annotation,
  Context,
  FragmentReference,
  LintFinding,
  RuleAction,
  Trace,
  When,
} from "@promptbook/core";

export type { Annotation } from "@promptbook/core";

/** A rule reduced to what the viewer renders (no behavior, just the shape). */
export interface RuleSummary {
  index: number;
  when: When;
  action: RuleAction;
  add?: string[];
  after?: string;
  replace?: Record<string, string>;
  forbid?: string[];
  order?: string[];
}

/** A named context preset for a composition, sourced from `fixtures/`. */
export interface VariantSummary {
  name: string;
  context: Context;
}

/** A composition as the sidebar/canvas needs it. */
export interface CompositionSummary {
  name: string;
  base: string[];
  order?: string[];
  rules: RuleSummary[];
  sourceFile: string;
  variants: VariantSummary[];
}

/** A fragment as the inspector/used-in panels need it. */
export interface FragmentSummary {
  id: string;
  kind?: string;
  tags: string[];
  body: string;
  sourceFile: string;
}

/** Response of `GET /api/book`. */
export interface BookResponse {
  compositions: CompositionSummary[];
  fragments: FragmentSummary[];
  warnings: string[];
}

/** One colored slice of the assembled prompt, mapped to its source fragment. */
export interface Segment {
  fragmentId: string;
  text: string;
}

/** Request body for `POST /api/resolve` and `POST /api/lint`. */
export interface ResolveRequest {
  prompt: string;
  context?: Context;
}

/** Response of `POST /api/resolve`. */
export interface ResolveResponse {
  text: string;
  trace: Trace;
  segments: Segment[];
}

/** Response of `POST /api/lint`. */
export interface LintResponse {
  findings: LintFinding[];
  errorCount: number;
  warningCount: number;
  tokens: number;
}

/** Where a fragment id is referenced inside a composition (core's role union). */
type UsedInRole = FragmentReference["role"];

/** One reference to a fragment, as `GET /api/used-in/:id` reports it. */
export interface UsedInReference {
  composition: string;
  role: UsedInRole;
  ruleIndex?: number;
}

/** Response of `GET /api/used-in/:id`. */
export interface UsedInResponse {
  fragmentId: string;
  references: UsedInReference[];
}

/** Request body for `POST /api/annotate`. */
export interface AnnotateRequest {
  /** Composition of the annotated variant (omit when targeting a fragment). */
  prompt?: string;
  context?: Context;
  fragmentId: string;
  anchorText: string;
  comment: string;
  offset?: number;
  sourceFile?: string;
}

/** Response of `GET /api/annotations`. */
export interface AnnotationsResponse {
  annotations: Annotation[];
}
