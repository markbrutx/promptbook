import { basename, isAbsolute, join, relative, resolve as resolvePath, sep } from "node:path";
import type { PromptBook } from "@markbrutx/promptbook-core";
import { loadPrompts, serializeBook, serializeBookJson } from "@markbrutx/promptbook-core";
import type { ParsedArgs } from "../args.js";
import { requirePromptsDir } from "../config.js";
import { emitWarnings, type IO } from "../io.js";
import { loadWorkspace } from "../workspace.js";

/** Default name of the artifact file each book emits alongside its sources. */
const BUNDLE_FILE = "book.generated.ts";

/** Rewrite an absolute source path to a portable, forward-slash path relative to `dir`. */
function relativizeSource(sourceFile: string, dir: string): string {
  if (!isAbsolute(sourceFile)) {
    return sourceFile;
  }
  return relative(dir, sourceFile).split(sep).join("/");
}

/** Copy a keyed map, relativizing each value's `sourceFile`. */
function relativizeMap<T extends { sourceFile: string }>(map: Map<string, T>, dir: string): Map<string, T> {
  return new Map(
    [...map].map(([key, value]) => [key, { ...value, sourceFile: relativizeSource(value.sourceFile, dir) }]),
  );
}

/**
 * Copy the book with every `sourceFile` made relative to the prompts folder, so
 * the generated module carries portable paths instead of one machine's absolute
 * layout. Resolution and lint ignore `sourceFile`, so this never affects output.
 */
function portableBook(book: PromptBook, dir: string): PromptBook {
  return {
    fragments: relativizeMap(book.fragments, dir),
    compositions: relativizeMap(book.compositions, dir),
    codePrompts: relativizeMap(book.codePrompts, dir),
    warnings: book.warnings,
  };
}

/** Return the book with `codePrompts` cleared — used by `--exclude-code-prompts`. */
function withoutCodePrompts(book: PromptBook): PromptBook {
  return { ...book, codePrompts: new Map() };
}

/** Normalize EOL so a CRLF-checked-in artifact does not falsely look stale on an LF rebuild. */
function normalizeEol(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

/** First 1-based line index where two strings differ; null when equal. */
function firstDiffLine(actual: string, expected: string): number | null {
  if (actual === expected) {
    return null;
  }
  const a = actual.split("\n");
  const b = expected.split("\n");
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i += 1) {
    if (a[i] !== b[i]) {
      return i + 1;
    }
  }
  // Unreachable: if the strings differ, at least one index in [0, max) must too.
  throw new Error("firstDiffLine: strings differ but no line diff found");
}

/** Build the output text for one book (TypeScript module or JSON). */
function renderOutput(book: PromptBook, args: ParsedArgs): string {
  return args.json
    ? serializeBookJson(book)
    : serializeBook(book, { typed: !args.plain, importSpecifier: args.importSpecifier });
}

/** Pick the artifact path: explicit `--out`, else `book.generated.ts` next to the prompts folder. */
function targetPath(io: IO, args: ParsedArgs, promptsDir: string): string {
  if (args.out !== undefined) {
    return resolvePath(io.cwd(), args.out);
  }
  return join(promptsDir, BUNDLE_FILE);
}

/** One book's `--check` outcome: file present and matching, drifted, or missing. */
type CheckOutcome =
  | { status: "up-to-date"; path: string }
  | { status: "stale"; reason: "missing"; path: string }
  | { status: "stale"; reason: "diff"; firstDiffLine: number; path: string };

async function checkOne(io: IO, output: string, path: string): Promise<CheckOutcome> {
  let existing: string;
  try {
    existing = await io.fs.readFile(path);
  } catch {
    return { status: "stale", reason: "missing", path };
  }
  const line = firstDiffLine(normalizeEol(output), normalizeEol(existing));
  if (line === null) {
    return { status: "up-to-date", path };
  }
  return { status: "stale", reason: "diff", firstDiffLine: line, path };
}

function emitCheckResult(io: IO, args: ParsedArgs, bookName: string, outcome: CheckOutcome): void {
  if (args.json) {
    const diff =
      outcome.status === "stale"
        ? outcome.reason === "missing"
          ? { reason: "missing", path: outcome.path }
          : { reason: "diff", firstDiffLine: outcome.firstDiffLine }
        : null;
    io.stderr(`${JSON.stringify({ book: bookName, status: outcome.status, diff })}\n`);
    return;
  }
  if (outcome.status === "up-to-date") {
    io.stderr(`${bookName} up to date\n`);
    return;
  }
  if (outcome.reason === "missing") {
    io.stderr(`${bookName} stale (missing ${outcome.path})\n`);
    return;
  }
  io.stderr(`${bookName} stale (first diff at line ${outcome.firstDiffLine})\n`);
}

/**
 * Bundle one book: load → relativize → optionally drop code-prompts → serialize.
 * Then either `--check` against the existing artifact, write to `--out`/the
 * default `book.generated.ts`, or print to stdout (single-book, no `--out`).
 *
 * Returns the exit code: 0 on success / up-to-date, 1 on drift / write failure.
 * `bookName` is used in `--check` output and warnings; when `inWorkspace` is
 * true the artifact is always written (not printed), matching `bundle --all`.
 */
export async function bundleOne(
  io: IO,
  args: ParsedArgs,
  promptsDir: string,
  bookName: string,
  inWorkspace: boolean,
): Promise<number> {
  const loaded = await loadPrompts(promptsDir, io.fs);
  // `--exclude-code-prompts` discards them outright; skipping the relativize pass is the whole point.
  const source = args.excludeCodePrompts ? withoutCodePrompts(loaded) : loaded;
  const book = portableBook(source, promptsDir);
  emitWarnings(io, book.warnings);

  const output = renderOutput(book, args);

  if (args.check) {
    const outcome = await checkOne(io, output, targetPath(io, args, promptsDir));
    emitCheckResult(io, args, bookName, outcome);
    return outcome.status === "up-to-date" ? 0 : 1;
  }

  if (args.out === undefined && !inWorkspace) {
    io.stdout(output);
    return 0;
  }

  const outPath = targetPath(io, args, promptsDir);
  try {
    await io.writeFile(outPath, output);
  } catch (error) {
    io.stderr(`error: cannot write "${outPath}": ${(error as Error).message}\n`);
    return 1;
  }
  io.stderr(`wrote ${outPath}\n`);
  return 0;
}

/** Run `bundleOne` over every book in the workspace in parallel; the worst exit code wins. */
async function bundleAll(io: IO, args: ParsedArgs, root: string): Promise<number> {
  const workspace = await loadWorkspace(io, root);
  if (workspace.books.length === 0) {
    io.stderr(`error: no books found under ${root}\n`);
    return 1;
  }
  const codes = await Promise.all(
    workspace.books.map((book) => bundleOne(io, args, book.dir, book.name, true)),
  );
  return Math.max(0, ...codes);
}

/**
 * `bundle [<dir>]`: load a prompts folder and emit it as an importable module
 * exporting `book: PromptBook`. Writes to stdout, or to a file with `-o`.
 *
 * Flags:
 * - `--json` emits the structured dump instead of the TypeScript module.
 * - `--plain` drops the type-only import (e.g. for Deno consumers).
 * - `--import-specifier <spec>` sets the module the typed `import type
 *   { PromptBook }` line points at (default `@markbrutx/promptbook-core`). Use a
 *   runtime-resolvable specifier such as `npm:@markbrutx/promptbook-core@1.2.3`
 *   to keep the typed annotation in a Deno consumer instead of `--plain`.
 * - `--exclude-code-prompts` serializes code-prompts as an empty map so the
 *   runtime bundle stays lean while `code-prompts/` keeps living on disk as
 *   metadata for `ls` / the viewer.
 * - `--check` compares the would-be output against the existing artifact
 *   (`book.generated.ts` next to the prompts folder, or `--out`); exits 1 on
 *   drift or a missing artifact and prints a short hint on stderr.
 * - `--all` walks every book in the workspace and writes each to its own
 *   `book.generated.ts`; incompatible with `-o`.
 *
 * The folder comes from the positional `<dir>`, else `--dir`, else config /
 * `./prompts`. `--all` does not accept a single-book `<dir>` operand differently.
 */
export async function cmdBundle(args: ParsedArgs, io: IO): Promise<number> {
  if (args.all && args.out !== undefined) {
    io.stderr("error: --all is not compatible with -o/--out\n");
    return 1;
  }

  const promptsDir = await requirePromptsDir(io, args.operands[0] ?? args.dir);
  if (promptsDir === null) {
    return 1;
  }

  if (args.all) {
    return bundleAll(io, args, promptsDir);
  }

  return bundleOne(io, args, promptsDir, basename(promptsDir), false);
}
