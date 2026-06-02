import {
  estimateTokensByChars,
  iterateReferences,
  lint,
  type PromptBook,
  type Rule,
  resolveBook,
} from "@markbrutx/promptbook-core/edge";
import type {
  AnnotationsResponse,
  BookResponse,
  BooksResponse,
  CompositionSummary,
  LintResponse,
  ResolveResponse,
  RuleSummary,
  UsedInResponse,
  WorkspaceBook,
} from "@markbrutx/promptbook-viewer";
import type { Api } from "@markbrutx/promptbook-viewer/web";
import { deriveSegments } from "./segments";
import type { DemoBookEntry } from "./types";

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

function summarizeBook(book: PromptBook, entry: DemoBookEntry): BookResponse {
  const compositions: CompositionSummary[] = [...book.compositions.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => ({
      name: c.name,
      base: c.base,
      rules: c.rules.map(summarizeRule),
      sourceFile: c.sourceFile,
      variants: [],
      ...(c.order !== undefined ? { order: c.order } : {}),
    }));
  const codePrompts = [...book.codePrompts.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => ({
      name: c.name,
      samples: c.samples.map((s) => ({
        label: s.label,
        ...(s.context !== undefined ? { context: s.context } : {}),
        output: s.output,
      })),
      sourceFile: c.sourceFile,
      ...(c.description !== undefined ? { description: c.description } : {}),
    }));
  const fragments = [...book.fragments.values()]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((f) => ({
      id: f.id,
      ...(f.kind !== undefined ? { kind: f.kind } : {}),
      tags: f.tags ?? [],
      body: f.body,
      sourceFile: f.sourceFile,
    }));
  void entry;
  return { compositions, codePrompts, fragments, warnings: book.warnings };
}

/**
 * Build an `Api` implementation that resolves everything in-browser against a
 * pre-bundled book. Annotations are read-only on the static site: writes throw
 * with a clear error and reads return an empty list.
 */
export function createClientApi(book: PromptBook, entry: DemoBookEntry): Api {
  const workspaceBook: WorkspaceBook = { name: entry.slug, dir: entry.slug };
  const bookResponse = summarizeBook(book, entry);
  const booksResponse: BooksResponse = { books: [workspaceBook] };

  return {
    books: async () => booksResponse,
    book: async () => bookResponse,
    resolve: async (
      _book: string | null,
      prompt: string,
      context: Record<string, string | number | boolean>,
    ) => {
      const { text, trace } = resolveBook(book, prompt, context);
      const segments = deriveSegments(book, trace.finalOrder, context);
      const response: ResolveResponse = { text, trace, segments };
      return response;
    },
    lint: async (
      _book: string | null,
      prompt: string,
      context: Record<string, string | number | boolean>,
    ) => {
      const result = resolveBook(book, prompt, context);
      const report = lint({ book, result });
      const response: LintResponse = {
        findings: report.findings,
        errorCount: report.errorCount,
        warningCount: report.warningCount,
        tokens: estimateTokensByChars(result.text),
      };
      return response;
    },
    usedIn: async (_book: string | null, fragmentId: string) => {
      const references: UsedInResponse["references"] = [];
      for (const ref of iterateReferences(book)) {
        if (ref.id !== fragmentId) continue;
        references.push(
          ref.ruleIndex === undefined
            ? { composition: ref.composition, role: ref.role }
            : { composition: ref.composition, role: ref.role, ruleIndex: ref.ruleIndex },
        );
      }
      return { fragmentId, references };
    },
    annotations: async () => {
      const response: AnnotationsResponse = { annotations: [] };
      return response;
    },
    annotate: async () => {
      throw new Error("Annotations are not available on the static demo.");
    },
    resolveAnnotation: async () => {
      throw new Error("Annotations are not available on the static demo.");
    },
  };
}
