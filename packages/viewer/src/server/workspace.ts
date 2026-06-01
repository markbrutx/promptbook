import { basename, join } from "node:path";
import type { FsAdapter } from "@markbrutx/promptbook-core";
import { nodeFs } from "@markbrutx/promptbook-core";

/** A discovered prompts book: its folder name and absolute directory. */
export interface Book {
  name: string;
  dir: string;
}

/** Folder names that are book internals or noise, never workspace sub-books. */
const NON_BOOK_DIRS = new Set(["node_modules", "fragments", "rules", "code-prompts"]);

/** Markers that make a folder a loadable book (a config or a loadable form). */
const BOOK_MARKERS = ["promptbook.json", "rules", "code-prompts"];

/** True when `dir` looks like a prompts book (has a config or a loadable form). */
async function isBook(fs: FsAdapter, dir: string): Promise<boolean> {
  let entries: string[];
  try {
    entries = await fs.readDir(dir);
  } catch {
    return false;
  }
  return BOOK_MARKERS.some((marker) => entries.includes(marker));
}

/**
 * Find the books directly under `rootDir`: each non-internal subfolder that is
 * itself a book. One level deep, sorted by name. This mirrors the CLI's
 * discovery (kept as a server-local copy so the viewer never depends on the
 * CLI), so `view` and `ls --all` see the same workspace.
 */
async function discoverBooks(rootDir: string, fs: FsAdapter = nodeFs()): Promise<Book[]> {
  let entries: string[];
  try {
    entries = await fs.readDir(rootDir);
  } catch {
    return [];
  }
  const books: Book[] = [];
  for (const name of [...entries].sort()) {
    if (name.startsWith(".") || name.startsWith("_") || NON_BOOK_DIRS.has(name)) {
      continue;
    }
    const dir = join(rootDir, name);
    if (await isBook(fs, dir)) {
      books.push({ name, dir });
    }
  }
  return books;
}

/**
 * Read a workspace from `rootDir`. When the root is itself a book it is the only
 * book (back-compat single-book view, named after the folder); otherwise the
 * root is a workspace of its sub-books.
 */
export async function loadWorkspaceBooks(rootDir: string, fs: FsAdapter = nodeFs()): Promise<Book[]> {
  if (await isBook(fs, rootDir)) {
    return [{ name: basename(rootDir), dir: rootDir }];
  }
  return discoverBooks(rootDir, fs);
}
