import type { Context, ResolveResult } from "@markbrutx/promptbook-core";
import { loadPrompts, resolve, resolveBook } from "@markbrutx/promptbook-core";
import type { ParsedArgs } from "../args.js";
import { buildContext, requirePromptsDir } from "../config.js";
import { colorEnabled, emitWarnings, type IO } from "../io.js";
import { renderExplain } from "../render-explain.js";
import { loadWorkspace, resolveAddress } from "../workspace.js";

/** One node of a book's menu in deterministic (name) order, typed by kind. */
interface BookNode {
  name: string;
  kind: "composition" | "code-prompt";
}

/**
 * `resolve --all`: assemble every composition of every book in the workspace.
 * Missing variables become stderr warnings, never throws, so the run always
 * completes. `--json` emits a `{ "book/comp": value }` map (compositions carry
 * `text`+`trace`; code-prompts ride along as inventory `{kind, samples}` so
 * builders are not silently dropped); plain prints each composition under a
 * `=== book/comp ===` header and notes the skipped code-prompts. Order is by
 * book then by node name.
 */
async function cmdResolveAll(io: IO, root: string, context: Context, json: boolean): Promise<number> {
  const workspace = await loadWorkspace(io, root);
  const blocks: string[] = [];
  const skipped: string[] = [];
  const map: Record<string, unknown> = {};

  // Load every book up front (concurrently); iterate the sorted result for
  // deterministic output, matching `ls --all`.
  const loadedBooks = await Promise.all(
    workspace.books.map(async (book) => ({ book, loaded: await loadPrompts(book.dir, io.fs) })),
  );

  for (const { book, loaded } of loadedBooks) {
    emitWarnings(
      io,
      loaded.warnings.map((w) => `${book.name}: ${w}`),
    );
    const nodes: BookNode[] = [
      ...[...loaded.compositions.keys()].map((name): BookNode => ({ name, kind: "composition" })),
      ...[...loaded.codePrompts.keys()].map((name): BookNode => ({ name, kind: "code-prompt" })),
    ].sort((a, b) => a.name.localeCompare(b.name));

    for (const node of nodes) {
      const key = `${book.name}/${node.name}`;
      if (node.kind === "code-prompt") {
        const codePrompt = loaded.codePrompts.get(node.name);
        skipped.push(key);
        if (json) {
          map[key] = { kind: "code-prompt", samples: codePrompt?.samples ?? [] };
        }
        continue;
      }
      const { text, trace } = resolveBook(loaded, node.name, context);
      emitWarnings(
        io,
        trace.warnings.map((w) => `${key}: ${w}`),
      );
      if (json) {
        map[key] = { kind: "composition", text, trace };
      } else {
        blocks.push(`=== ${key} ===\n${text}`);
      }
    }
  }

  if (json) {
    io.stdout(`${JSON.stringify(map, null, 2)}\n`);
    return 0;
  }
  io.stdout(`${blocks.join("\n\n")}\n`);
  if (skipped.length > 0) {
    io.stderr(`note: skipped ${skipped.length} code-prompt(s) (not resolvable): ${skipped.join(", ")}\n`);
  }
  return 0;
}

/**
 * `resolve [<book>/]<prompt>`: assemble the prompt and print its text to stdout.
 * A `<book>/` prefix addresses a specific book; a bare name resolves by
 * uniqueness across the workspace (and works as before in a single-book root).
 * `--json` prints `{ text, trace }`; `--explain` adds the trace to stderr;
 * `--all` assembles every composition of every book. Warnings always go to
 * stderr so nothing is lost.
 */
export async function cmdResolve(args: ParsedArgs, io: IO): Promise<number> {
  const promptsDir = await requirePromptsDir(io, args.dir);
  if (promptsDir === null) {
    return 1;
  }

  let context: Context;
  try {
    context = await buildContext(io, args.ctx, args.contextFile);
  } catch (error) {
    io.stderr(`error: ${(error as Error).message}\n`);
    return 1;
  }

  if (args.all) {
    return cmdResolveAll(io, promptsDir, context, args.json);
  }

  const operand = args.operands[0];
  if (operand === undefined) {
    io.stderr('error: resolve requires a <prompt> name (or --all). Run "promptbook --help".\n');
    return 1;
  }

  let result: ResolveResult;
  try {
    const workspace = await loadWorkspace(io, promptsDir);
    const { book, comp, loaded } = await resolveAddress(io, workspace, operand);
    // Bare-name resolution already loaded the matched book — reuse it; otherwise load now.
    result =
      loaded !== undefined
        ? resolveBook(loaded, comp, context)
        : await resolve({ promptsDir: book.dir, prompt: comp, context, fs: io.fs });
  } catch (error) {
    io.stderr(`error: ${(error as Error).message}\n`);
    return 1;
  }

  const { text, trace } = result;
  emitWarnings(io, trace.warnings);

  if (args.json) {
    io.stdout(`${JSON.stringify({ text, trace }, null, 2)}\n`);
    return 0;
  }

  if (args.explain) {
    io.stderr(renderExplain(trace, colorEnabled(io)));
  }
  io.stdout(`${text}\n`);
  return 0;
}
