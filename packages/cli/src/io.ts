import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { FsAdapter, ModelAdapter } from "@markbrutx/promptbook-core";
import { nodeFs } from "@markbrutx/promptbook-core";

/** Options the `eval` command needs to build a model adapter. */
export interface AdapterOptions {
  model?: string;
  apiKey?: string;
  baseUrl?: string;
}

/**
 * Injectable side-effect surface for the CLI.
 *
 * Keeping stdout/stderr/cwd/fs behind this interface lets {@link run} be driven
 * from tests without spawning a process. The stream contract is fixed:
 * **stdout = payload** (prompt text or JSON), **stderr = explanations/errors**.
 */
export interface IO {
  /** Write payload bytes verbatim (the command appends its own newlines). */
  stdout(text: string): void;
  /** Write explanations, warnings and errors verbatim. */
  stderr(text: string): void;
  /** Write a file to disk, creating parent directories as needed (e.g. `bundle -o`). */
  writeFile(path: string, contents: string): Promise<void>;
  /** Current working directory, used to resolve relative paths and config. */
  cwd(): string;
  /** Environment bag, consulted for `NO_COLOR`. */
  env: Record<string, string | undefined>;
  /** Filesystem adapter passed straight through to the core. */
  fs: FsAdapter;
  /** Whether color is allowed when `NO_COLOR` is unset (true on a TTY). */
  colorDefault: boolean;
  /**
   * Build the model adapter for `eval`. Tests inject a fake so no network or
   * key is needed; when unset, the command falls back to the OpenRouter
   * adapter built from flags/config/env.
   */
  makeAdapter?(options: AdapterOptions): ModelAdapter;
}

/** Real-process IO: stdout/stderr streams, Node fs, live env and cwd. */
export function defaultIO(): IO {
  return {
    stdout(text) {
      process.stdout.write(text);
    },
    stderr(text) {
      process.stderr.write(text);
    },
    async writeFile(path, contents) {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, contents);
    },
    cwd: () => process.cwd(),
    env: process.env,
    fs: nodeFs(),
    colorDefault: Boolean(process.stderr.isTTY),
  };
}

/** Emit each warning to stderr with the standard `warning:` prefix. */
export function emitWarnings(io: IO, warnings: string[]): void {
  for (const warning of warnings) {
    io.stderr(`warning: ${warning}\n`);
  }
}

/** Resolve whether colored output is allowed: off if `NO_COLOR` is set. */
export function colorEnabled(io: IO): boolean {
  const flag = io.env.NO_COLOR;
  if (flag !== undefined && flag !== "") {
    return false;
  }
  return io.colorDefault;
}
