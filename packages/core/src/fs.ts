import type { FsAdapter } from "./types.js";

/**
 * Default filesystem adapter backed by `node:fs/promises`.
 *
 * The import is lazy so that simply importing the core does not pull in any
 * Node-only module: callers in Deno/Bun (or tests) can inject their own
 * {@link FsAdapter} and never touch this path. The module is resolved once
 * per adapter (when `nodeFs()` is called), not on every read.
 */
export function nodeFs(): FsAdapter {
  const fsModule = import("node:fs/promises");
  return {
    async readFile(path: string): Promise<string> {
      return (await fsModule).readFile(path, "utf8");
    },
    async readDir(path: string): Promise<string[]> {
      return (await fsModule).readdir(path);
    },
  };
}
