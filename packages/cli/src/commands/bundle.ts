import { isAbsolute, relative, resolve as resolvePath, sep } from "node:path";
import type { PromptBook } from "@promptbook/core";
import { loadPrompts, serializeBook, serializeBookJson } from "@promptbook/core";
import type { ParsedArgs } from "../args.js";
import { requirePromptsDir } from "../config.js";
import { emitWarnings, type IO } from "../io.js";

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

/**
 * `bundle [<dir>]`: load a prompts folder and emit it as a single importable
 * module exporting `book: PromptBook` (so a runtime can import the book instead
 * of reading the disk). Writes to stdout, or to a file with `-o`. `--json`
 * emits a structured dump instead of the TypeScript module.
 *
 * The folder comes from the positional `<dir>`, else `--dir`, else config /
 * `./prompts` (the standard resolution).
 */
export async function cmdBundle(args: ParsedArgs, io: IO): Promise<number> {
  const promptsDir = await requirePromptsDir(io, args.operands[0] ?? args.dir);
  if (promptsDir === null) {
    return 1;
  }

  const book = portableBook(await loadPrompts(promptsDir, io.fs), promptsDir);
  emitWarnings(io, book.warnings);

  const output = args.json ? serializeBookJson(book) : serializeBook(book, { typed: !args.plain });

  if (args.out === undefined) {
    io.stdout(output);
    return 0;
  }

  const outPath = resolvePath(io.cwd(), args.out);
  try {
    await io.writeFile(outPath, output);
  } catch (error) {
    io.stderr(`error: cannot write "${outPath}": ${(error as Error).message}\n`);
    return 1;
  }
  io.stderr(`wrote ${outPath}\n`);
  return 0;
}
