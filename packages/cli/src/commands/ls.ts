import { basename, relative } from "node:path";
import type { PromptBook, RequiredContext } from "@markbrutx/promptbook-core";
import { loadPrompts, requiredContext } from "@markbrutx/promptbook-core";
import type { ParsedArgs } from "../args.js";
import { requirePromptsDir } from "../config.js";
import { emitWarnings, type IO } from "../io.js";
import { bookDir, loadWorkspace } from "../workspace.js";

interface CompositionEntry {
  name: string;
  base: number;
  rules: number;
  requiredContext: RequiredContext;
}

interface CodePromptEntry {
  name: string;
  description: string | null;
  samples: number;
}

/** Composition rows for the menu: counts plus the statically-declared context. */
function compositionEntries(book: PromptBook): CompositionEntry[] {
  return [...book.compositions.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => ({
      name: c.name,
      base: c.base.length,
      rules: c.rules.length,
      requiredContext: requiredContext(book, c.name),
    }));
}

/** Code-prompt rows: builder metadata only (opaque; no requiredContext). */
function codePromptEntries(book: PromptBook): CodePromptEntry[] {
  return [...book.codePrompts.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => ({ name: c.name, description: c.description ?? null, samples: c.samples.length }));
}

/** Compact one-line context summary for the plain `--all` tree. */
function ctxSummary(rc: RequiredContext): string {
  const vars = rc.vars.length > 0 ? rc.vars.join(",") : "-";
  const axes =
    Object.entries(rc.axes)
      .map(([key, values]) => `${key}=${values.join("|")}`)
      .join(" ") || "-";
  return `vars=${vars} axes=${axes}`;
}

/**
 * `ls --all`: a cross-book inventory of the whole workspace. Discovers every
 * book under the root, loads each, and emits the menu (compositions with their
 * required context + code-prompts) — `--json` as `{ workspace, books[] }`,
 * plain as an indented book→composition tree. Order is deterministic (books and
 * compositions sorted by name).
 */
async function cmdLsAll(io: IO, root: string, json: boolean): Promise<number> {
  const workspace = await loadWorkspace(io, root);
  const books = await Promise.all(
    workspace.books.map(async (b) => {
      const book = await loadPrompts(b.dir, io.fs);
      return {
        name: b.name,
        dir: bookDir(workspace, b),
        compositions: compositionEntries(book),
        codePrompts: codePromptEntries(book),
        warnings: book.warnings,
      };
    }),
  );

  if (json) {
    io.stdout(`${JSON.stringify({ workspace: basename(workspace.root), books }, null, 2)}\n`);
    return 0;
  }

  const lines: string[] = [`workspace: ${basename(workspace.root)}`];
  if (books.length === 0) {
    lines.push("  (no books found)");
  }
  for (const book of books) {
    lines.push("", `${book.name}  (${book.dir})`);
    lines.push("  compositions:");
    if (book.compositions.length === 0) {
      lines.push("    (none)");
    }
    for (const c of book.compositions) {
      lines.push(`    ${c.name}  base=${c.base} rules=${c.rules}  ctx: ${ctxSummary(c.requiredContext)}`);
    }
    if (book.codePrompts.length > 0) {
      lines.push("  code-prompts:");
      for (const c of book.codePrompts) {
        lines.push(`    ${c.name}  kind=code samples=${c.samples}`);
      }
    }
    emitWarnings(io, book.warnings);
  }
  io.stdout(`${lines.join("\n")}\n`);
  return 0;
}

/**
 * `ls`: list compositions (name, base length, rule count, required context),
 * code-prompts (name, description, sample count) and fragments (id, kind, tags,
 * source) — the unified menu of every prompt in the book. `--fragments`/
 * `--compositions` narrow the output (code-prompts ride with compositions, both
 * being prompts); `--json` emits a structured list; `--all` spans every book in
 * the workspace instead of one folder.
 */
export async function cmdLs(args: ParsedArgs, io: IO): Promise<number> {
  const promptsDir = await requirePromptsDir(io, args.dir);
  if (promptsDir === null) {
    return 1;
  }

  if (args.all) {
    return cmdLsAll(io, promptsDir, args.json);
  }

  const book = await loadPrompts(promptsDir, io.fs);
  emitWarnings(io, book.warnings);

  const onlyOneSection = args.fragments || args.compositions;
  const showCompositions = args.compositions || !onlyOneSection;
  const showFragments = args.fragments || !onlyOneSection;

  const compositions = compositionEntries(book);
  const codePrompts = codePromptEntries(book);
  const fragments = [...book.fragments.values()].sort((a, b) => a.id.localeCompare(b.id));

  if (args.json) {
    const out: Record<string, unknown> = {};
    if (showCompositions) {
      out.compositions = compositions;
      out.codePrompts = codePrompts;
    }
    if (showFragments) {
      out.fragments = fragments.map((f) => ({
        id: f.id,
        kind: f.kind ?? null,
        tags: f.tags ?? [],
        sourceFile: f.sourceFile,
      }));
    }
    io.stdout(`${JSON.stringify(out, null, 2)}\n`);
    return 0;
  }

  const lines: string[] = [];
  if (showCompositions) {
    lines.push("compositions:");
    if (compositions.length === 0) {
      lines.push("  (none)");
    }
    for (const c of compositions) {
      lines.push(`  ${c.name}  base=${c.base}  rules=${c.rules}`);
    }
    if (codePrompts.length > 0) {
      lines.push("");
      lines.push("code-prompts:");
      for (const c of codePrompts) {
        lines.push(`  ${c.name}  kind=code  samples=${c.samples}`);
      }
    }
  }
  if (showFragments) {
    if (lines.length > 0) {
      lines.push("");
    }
    lines.push("fragments:");
    if (fragments.length === 0) {
      lines.push("  (none)");
    }
    for (const f of fragments) {
      const tags = f.tags && f.tags.length > 0 ? f.tags.join(",") : "-";
      const source = relative(promptsDir, f.sourceFile) || f.sourceFile;
      lines.push(`  ${f.id}  kind=${f.kind ?? "-"}  tags=${tags}  ${source}`);
    }
  }
  io.stdout(`${lines.join("\n")}\n`);
  return 0;
}
