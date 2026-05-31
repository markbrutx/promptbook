// Single import surface for the web app: core scalar/trace types plus the
// wire DTOs. Everything here is type-only and erased from the bundle.
export type { Context, ContextValue, Trace, When } from "@markbrutx/promptbook-core";
export type {
  AnnotateRequest,
  Annotation,
  AnnotationsResponse,
  BookResponse,
  CodePromptSummary,
  CompositionSummary,
  FragmentSummary,
  LintResponse,
  ResolveResponse,
  Segment,
  UsedInResponse,
  VariantSummary,
} from "../shared/types.js";
