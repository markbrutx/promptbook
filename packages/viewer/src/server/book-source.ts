import type { Fixture, FsAdapter, PromptBook } from "@promptbook/core";
import { loadFixtures, loadPrompts } from "@promptbook/core";

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
