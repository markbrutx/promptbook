import { basename, join, relative } from "node:path";
import type { PromptBook } from "@markbrutx/promptbook-core";
import { loadPrompts } from "@markbrutx/promptbook-core";
import type { IO } from "./io.js";

/** A discovered prompts book: its folder name and absolute directory. */
export interface Book {
  name: string;
  dir: string;
}

/** A workspace root and the books found directly under it (sorted by name). */
export interface Workspace {
  root: string;
  books: Book[];
}

/** A `<book>/<comp>` operand split into its parts (`book` absent for bare names). */
export interface Address {
  book?: string;
  comp: string;
}

/** A bare/qualified operand resolved to a concrete book + composition name. */
export interface ResolvedAddress {
  book: Book;
  comp: string;
  /** The matched book, already loaded during bare-name resolution (reuse to skip a reload). */
  loaded?: PromptBook;
}

/** Folder names that are book internals or noise, never workspace sub-books. */
const NON_BOOK_DIRS = new Set(["node_modules", "fragments", "rules", "code-prompts"]);

/** Markers that make a folder a loadable book (a config or a loadable form). */
const BOOK_MARKERS = ["promptbook.json", "rules", "code-prompts"];

/** True when `dir` looks like a prompts book (has a config or a loadable form). */
export async function isBook(io: IO, dir: string): Promise<boolean> {
  let entries: string[];
  try {
    entries = await io.fs.readDir(dir);
  } catch {
    return false;
  }
  return BOOK_MARKERS.some((marker) => entries.includes(marker));
}

/**
 * Find the books directly under `rootDir`: each non-internal subfolder that is
 * itself a book. One level deep, not recursive; sorted by name for a stable
 * menu. Dot/underscore folders and book internals are skipped.
 */
export async function discoverBooks(io: IO, rootDir: string): Promise<Book[]> {
  let entries: string[];
  try {
    entries = await io.fs.readDir(rootDir);
  } catch {
    return [];
  }
  const books: Book[] = [];
  for (const name of [...entries].sort()) {
    if (name.startsWith(".") || name.startsWith("_") || NON_BOOK_DIRS.has(name)) {
      continue;
    }
    const dir = join(rootDir, name);
    if (await isBook(io, dir)) {
      books.push({ name, dir });
    }
  }
  return books;
}

/**
 * Read a workspace from `rootDir`. When the root is itself a book it is the only
 * book (back-compat single-book path, named after the folder); otherwise the
 * root is a workspace of its sub-books.
 */
export async function loadWorkspace(io: IO, rootDir: string): Promise<Workspace> {
  if (await isBook(io, rootDir)) {
    return { root: rootDir, books: [{ name: basename(rootDir), dir: rootDir }] };
  }
  return { root: rootDir, books: await discoverBooks(io, rootDir) };
}

/** Split an operand on the first `/`: `book/comp` (comp may itself contain `/`). */
export function parseAddress(operand: string): Address {
  const slash = operand.indexOf("/");
  if (slash === -1) {
    return { comp: operand };
  }
  return { book: operand.slice(0, slash), comp: operand.slice(slash + 1) };
}

/** A book's directory relative to the workspace root (`.` when it is the root). */
export function bookDir(workspace: Workspace, book: Book): string {
  return relative(workspace.root, book.dir) || ".";
}

/**
 * Resolve an operand to a concrete book + composition. A `<book>/<comp>` prefix
 * that names a known book addresses it directly; otherwise the whole operand is
 * a bare composition name, resolved by uniqueness across the workspace's books
 * (a single-book workspace always uses its one book). Throws a clear error when
 * a bare name is missing or ambiguous.
 */
export async function resolveAddress(
  io: IO,
  workspace: Workspace,
  operand: string,
): Promise<ResolvedAddress> {
  const address = parseAddress(operand);
  if (address.book !== undefined) {
    const book = workspace.books.find((b) => b.name === address.book);
    if (book !== undefined) {
      return { book, comp: address.comp };
    }
    // Prefix names no book: fall through and treat the whole operand as a
    // (possibly path-like) bare composition name.
  }

  if (workspace.books.length === 1) {
    return { book: workspace.books[0] as Book, comp: operand };
  }

  const matches: { book: Book; loaded: PromptBook }[] = [];
  for (const book of workspace.books) {
    const loaded = await loadPrompts(book.dir, io.fs);
    if (loaded.compositions.has(operand)) {
      matches.push({ book, loaded });
    }
  }
  const [first] = matches;
  if (matches.length === 1 && first !== undefined) {
    return { book: first.book, comp: operand, loaded: first.loaded };
  }
  if (matches.length === 0) {
    throw new Error(`Unknown prompt "${operand}" in any book. Qualify it as <book>/<comp>.`);
  }
  const names = matches.map((m) => m.book.name).join(", ");
  throw new Error(
    `Ambiguous prompt "${operand}"; found in ${matches.length} books (${names}). Qualify it as <book>/<comp>.`,
  );
}
