import { fileURLToPath } from "node:url";
import type { FsAdapter } from "@markbrutx/promptbook-core";
import { nodeFs } from "@markbrutx/promptbook-core";
import type { IO } from "../src/io.js";

/** Absolute path to a folder under `test/fixtures`. */
export function fixtureDir(name: string): string {
  return fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
}

/** Path to the sample prompts folder. */
export const promptsDir = fixtureDir("prompts");

export interface Capture {
  io: IO;
  /** Everything written to stdout, concatenated. */
  out(): string;
  /** Everything written to stderr, concatenated. */
  err(): string;
  /** Contents written via `io.writeFile`, keyed by absolute path. */
  files(): Record<string, string>;
}

/**
 * Build an IO that captures stream writes for assertions. By default it uses
 * the real Node fs (so commands run against on-disk fixtures) with color off.
 */
export function capture(overrides: Partial<IO> = {}): Capture {
  const outChunks: string[] = [];
  const errChunks: string[] = [];
  const written: Record<string, string> = {};
  const io: IO = {
    stdout(text) {
      outChunks.push(text);
    },
    stderr(text) {
      errChunks.push(text);
    },
    async writeFile(path, contents) {
      written[path] = contents;
    },
    cwd: () => process.cwd(),
    env: {},
    fs: nodeFs(),
    colorDefault: false,
    ...overrides,
  };
  return {
    io,
    out: () => outChunks.join(""),
    err: () => errChunks.join(""),
    files: () => written,
  };
}

/**
 * A filesystem adapter backed by an in-memory `absolutePath -> contents` map.
 *
 * Intentionally self-contained (no cross-package test deps): this mirrors
 * core's test helper but its `readDir` walks one path segment so nested
 * `fragments/`/`rules/` dirs resolve, which the CLI fixtures need.
 */
export function memoryFs(files: Record<string, string>): FsAdapter {
  return {
    async readFile(path: string): Promise<string> {
      const contents = files[path];
      if (contents === undefined) {
        throw new Error(`memoryFs: no such file "${path}"`);
      }
      return contents;
    },
    async readDir(path: string): Promise<string[]> {
      const prefix = path.endsWith("/") ? path : `${path}/`;
      const names = new Set<string>();
      for (const full of Object.keys(files)) {
        if (full.startsWith(prefix)) {
          const rest = full.slice(prefix.length);
          const head = rest.split("/")[0];
          if (head) {
            names.add(head);
          }
        }
      }
      if (names.size === 0) {
        throw new Error(`memoryFs: no such dir "${path}"`);
      }
      return [...names];
    },
  };
}
