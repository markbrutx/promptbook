import { relative, sep } from "node:path";
import type { CodePrompt, Composition, Context, Rule } from "@markbrutx/promptbook-core";
import { estimateTokensByChars, lint, resolveBook } from "@markbrutx/promptbook-core";
import type {
  BookResponse,
  CodePromptSummary,
  CompositionSummary,
  LintResponse,
  ResolveResponse,
  RuleSummary,
  UsedInResponse,
  VariantSummary,
} from "../shared/types.js";
import type { LoadedFolder } from "./book-source.js";
import { deriveSegments } from "./segments.js";
import { usedIn } from "./used-in.js";

/** Path relative to the prompts folder, normalized to forward slashes. */
function relativeSource(promptsDir: string, sourceFile: string): string {
  const rel = relative(promptsDir, sourceFile);
  return (rel === "" ? sourceFile : rel).split(sep).join("/");
}

/** Drop undefined action fields so the wire shape stays minimal. */
function summarizeRule(rule: Rule): RuleSummary {
  const summary: RuleSummary = { index: rule.index, when: rule.when, action: rule.action };
  if (rule.add !== undefined) summary.add = rule.add;
  if (rule.after !== undefined) summary.after = rule.after;
  if (rule.replace !== undefined) summary.replace = rule.replace;
  if (rule.forbid !== undefined) summary.forbid = rule.forbid;
  if (rule.order !== undefined) summary.order = rule.order;
  return summary;
}

/** Group fixtures by the composition they target, for variant lookup. */
function variantsByPrompt(folder: LoadedFolder): Map<string, VariantSummary[]> {
  const byPrompt = new Map<string, VariantSummary[]>();
  for (const fixture of folder.fixtures) {
    const list = byPrompt.get(fixture.prompt) ?? [];
    list.push({ name: fixture.name, context: fixture.context ?? {} });
    byPrompt.set(fixture.prompt, list);
  }
  for (const list of byPrompt.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }
  return byPrompt;
}

/** Project a code-prompt to the wire shape, relativizing its manifest path. */
function summarizeCodePrompt(promptsDir: string, codePrompt: CodePrompt): CodePromptSummary {
  const summary: CodePromptSummary = {
    name: codePrompt.name,
    samples: codePrompt.samples.map((s) => ({
      label: s.label,
      ...(s.context !== undefined ? { context: s.context } : {}),
      output: s.output,
    })),
    sourceFile: relativeSource(promptsDir, codePrompt.sourceFile),
  };
  if (codePrompt.description !== undefined) summary.description = codePrompt.description;
  return summary;
}

function summarizeComposition(
  variants: VariantSummary[],
  promptsDir: string,
  c: Composition,
): CompositionSummary {
  const summary: CompositionSummary = {
    name: c.name,
    base: c.base,
    rules: c.rules.map(summarizeRule),
    sourceFile: relativeSource(promptsDir, c.sourceFile),
    variants,
  };
  if (c.order !== undefined) summary.order = c.order;
  return summary;
}

/** Build the `GET /api/book` payload: compositions + fragments + warnings. */
export function buildBookResponse(folder: LoadedFolder, promptsDir: string): BookResponse {
  const { book } = folder;
  const variants = variantsByPrompt(folder);
  const compositions = [...book.compositions.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => summarizeComposition(variants.get(c.name) ?? [], promptsDir, c));
  const codePrompts = [...book.codePrompts.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => summarizeCodePrompt(promptsDir, c));
  const fragments = [...book.fragments.values()]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((f) => ({
      id: f.id,
      ...(f.kind !== undefined ? { kind: f.kind } : {}),
      tags: f.tags ?? [],
      body: f.body,
      sourceFile: relativeSource(promptsDir, f.sourceFile),
    }));
  return { compositions, codePrompts, fragments, warnings: book.warnings };
}

/** Resolve a variant and attach the colored segments. Throws on unknown prompt. */
export function buildResolveResponse(
  folder: LoadedFolder,
  prompt: string,
  context: Context,
): ResolveResponse {
  const { text, trace } = resolveBook(folder.book, prompt, context);
  return { text, trace, segments: deriveSegments(folder.book, trace.finalOrder, context) };
}

/** Lint a resolved variant and estimate its token count. Throws on unknown prompt. */
export function buildLintResponse(folder: LoadedFolder, prompt: string, context: Context): LintResponse {
  const result = resolveBook(folder.book, prompt, context);
  const report = lint({ book: folder.book, result });
  return {
    findings: report.findings,
    errorCount: report.errorCount,
    warningCount: report.warningCount,
    tokens: estimateTokensByChars(result.text),
  };
}

/** List the compositions/rules that reference a fragment id. */
export function buildUsedInResponse(folder: LoadedFolder, fragmentId: string): UsedInResponse {
  return { fragmentId, references: usedIn(folder.book, fragmentId) };
}
