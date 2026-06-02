// Single import surface for the web app: core scalar/trace types plus the
// wire DTOs. Everything here is type-only and erased from the bundle.
export type { Context, ContextValue, RuleTrace, Trace, When } from "@markbrutx/promptbook-core";
export type {
  AnnotateRequest,
  Annotation,
  AnnotationsResponse,
  BookResponse,
  BooksResponse,
  CodePromptSummary,
  CompositionSummary,
  FragmentSummary,
  LintResponse,
  ResolveResponse,
  Segment,
  UsedInResponse,
  VariantSummary,
  WorkspaceBook,
} from "../shared/types.js";
