import { loadPrompts } from "./load.js";
import { resolveBook } from "./resolve-book.js";
import type { ResolveInput, ResolveResult } from "./types.js";

/**
 * Assemble a prompt for a context and return the text plus an explain trace.
 *
 * Loads the prompts folder (the one IO step), then delegates to the pure
 * {@link resolveBook}. Given the same folder contents and input, the returned
 * `text` is byte-for-byte stable.
 *
 * Each call re-reads the folder. For many resolves against the same folder,
 * call {@link loadPrompts} once and reuse {@link resolveBook}.
 */
export async function resolve(input: ResolveInput): Promise<ResolveResult> {
  const book = await loadPrompts(input.promptsDir, input.fs);
  return resolveBook(book, input.prompt, input.context ?? {});
}
