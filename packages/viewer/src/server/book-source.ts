import type { Fixture, FsAdapter, PromptBook } from "@markbrutx/promptbook-core";
import { loadFixtures, loadPrompts } from "@markbrutx/promptbook-core";
import { type Book, loadWorkspaceBooks } from "./workspace.js";

/** A loaded prompts folder plus the fixtures that supply named variants. */
export interface LoadedFolder {
  book: PromptBook;
  fixtures: Fixture[];
}

/**
 * Caches the loaded folder and reloads lazily after {@link invalidate}. The
 * server wires a folder watcher to `invalidate` for hot-reload; tests can call
 * it directly. Reads are serialized so a burst of requests during a reload
 * shares one load.
 */
export interface BookSource {
  /** Current folder contents, reloading first if it was invalidated. */
  get(): Promise<LoadedFolder>;
  /** Mark the cache stale; the next {@link get} reloads from disk. */
  invalidate(): void;
}

/** Fixtures are optional: a folder without a `fixtures/` dir simply has none. */
async function safeLoadFixtures(promptsDir: string, fs?: FsAdapter): Promise<Fixture[]> {
  try {
    return await loadFixtures(promptsDir, fs);
  } catch {
    return [];
  }
}

export function createBookSource(promptsDir: string, fs?: FsAdapter): BookSource {
  let cached: Promise<LoadedFolder> | undefined;

  const load = async (): Promise<LoadedFolder> => {
    const [book, fixtures] = await Promise.all([
      loadPrompts(promptsDir, fs),
      safeLoadFixtures(promptsDir, fs),
    ]);
    return { book, fixtures };
  };

  return {
    get() {
      if (cached === undefined) {
        cached = load();
      }
      return cached;
    },
    invalidate() {
      cached = undefined;
    },
  };
}

/** A book resolved for a request: its identity plus its loaded folder. */
export interface ResolvedBook {
  book: Book;
  folder: LoadedFolder;
}

/**
 * Caches a {@link BookSource} per book across a whole workspace, discovering the
 * books under the root lazily. One viewer serves every book through a single
 * switcher: `books()` lists them, `resolve(name)` loads one (defaulting to the
 * first), and `invalidate(name)` drops one book's cache while always re-scanning
 * the book set (so a new folder appears without a restart).
 */
export interface WorkspaceSource {
  /** Root the workspace was discovered from (annotation fallback when bookless). */
  root: string;
  /** Discovered books (name + dir), re-scanned after {@link invalidate}. */
  books(): Promise<Book[]>;
  /** Load a book by name, or the first book when the name is missing/unknown. */
  resolve(name?: string): Promise<ResolvedBook | undefined>;
  /** Drop one book's cache (or none) and re-scan the book set. */
  invalidate(name?: string): void;
}

export function createWorkspaceSource(root: string, fs?: FsAdapter): WorkspaceSource {
  let bookList: Promise<Book[]> | undefined;
  const sources = new Map<string, BookSource>();

  const discover = (): Promise<Book[]> => {
    if (bookList === undefined) {
      bookList = loadWorkspaceBooks(root, fs);
    }
    return bookList;
  };

  const sourceFor = (book: Book): BookSource => {
    let source = sources.get(book.name);
    if (source === undefined) {
      source = createBookSource(book.dir, fs);
      sources.set(book.name, source);
    }
    return source;
  };

  return {
    root,
    books() {
      return discover();
    },
    async resolve(name) {
      const books = await discover();
      if (books.length === 0) {
        return undefined;
      }
      const book = books.find((b) => b.name === name) ?? (books[0] as Book);
      return { book, folder: await sourceFor(book).get() };
    },
    invalidate(name) {
      bookList = undefined;
      if (name !== undefined) {
        sources.get(name)?.invalidate();
      }
    },
  };
}
