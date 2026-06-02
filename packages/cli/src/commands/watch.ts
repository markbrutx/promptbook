import { relative, sep } from "node:path";
import { watch as chokidarWatch } from "chokidar";
import type { ParsedArgs } from "../args.js";
import { requirePromptsDir } from "../config.js";
import { colorEnabled, type IO } from "../io.js";
import { makeStyle, type Style } from "../style.js";
import { type Book, loadWorkspace } from "../workspace.js";
import { bundleOne } from "./bundle.js";

/** Folders inside a book whose edits warrant a rebuild (mirrors core's loader layout). */
const BOOK_DIRS = ["fragments", "rules", "code-prompts"];

/** Single-book root files we re-bundle on touch (config edits change the assembly). */
const BOOK_FILES = ["promptbook.json"];

/** Debounce window per book: a burst of edits collapses into one rebuild. */
const DEBOUNCE_MS = 250;

interface RebuildStats {
  bytes: number;
  ms: number;
}

/** Local-time clock prefix (`hours:minutes:seconds`); slices off Date#toTimeString's TZ tail. */
function clock(): string {
  return new Date().toTimeString().slice(0, 8);
}

/** True when `event` happened inside one of the book's watched folders (or is a root file). */
function eventInBook(book: Book, eventPath: string): boolean {
  const rel = relative(book.dir, eventPath);
  if (rel === "" || rel.startsWith("..")) {
    return false;
  }
  const parts = rel.split(sep);
  if (parts.length === 1) {
    return BOOK_FILES.includes(parts[0] as string);
  }
  return BOOK_DIRS.includes(parts[0] as string);
}

/** Ignore artifacts, tests, fixtures, and everything VCS / dep manager touches. */
function shouldIgnore(eventPath: string): boolean {
  const lower = eventPath.toLowerCase();
  if (lower.endsWith("book.generated.ts")) {
    return true;
  }
  if (lower.endsWith(".test.ts") || lower.endsWith(".test.js")) {
    return true;
  }
  const segments = eventPath.split(sep);
  for (const segment of segments) {
    if (segment === "node_modules" || segment === ".git" || segment === "fixtures") {
      return true;
    }
  }
  return false;
}

/** Wrap `io` so `bundleOne`'s `wrote <path>` chatter is dropped and the artifact size is captured. */
function captureBytes(io: IO): { sink: IO; bytes: () => number } {
  let bytes = 0;
  const sink: IO = {
    ...io,
    stderr(text) {
      if (text.startsWith("wrote ")) {
        return;
      }
      io.stderr(text);
    },
    async writeFile(path, contents) {
      bytes = contents.length;
      await io.writeFile(path, contents);
    },
  };
  return { sink, bytes: () => bytes };
}

function emitEvent(
  io: IO,
  args: ParsedArgs,
  style: Style,
  event: "started" | "bundled" | "error" | "stopped",
  payload: Record<string, unknown> = {},
): void {
  if (args.json) {
    io.stderr(`${JSON.stringify({ event, ts: clock(), ...payload })}\n`);
    return;
  }
  const ts = style.dim(`[${clock()}]`);
  if (event === "started") {
    const books = payload.books as string[];
    io.stderr(`${ts} watching ${books.length} book(s): ${books.join(", ")}\n`);
    return;
  }
  if (event === "bundled") {
    io.stderr(`${ts} ${payload.book} bundled (${payload.bytes} B, ${payload.ms}ms)\n`);
    return;
  }
  if (event === "stopped") {
    io.stderr("stopped\n");
    return;
  }
  io.stderr(`${ts} ${payload.book} ${style.red("ERROR")}: ${payload.message}\n`);
}

async function rebuild(io: IO, args: ParsedArgs, book: Book): Promise<RebuildStats | Error> {
  const start = Date.now();
  const capture = captureBytes(io);
  try {
    const code = await bundleOne(capture.sink, args, book.dir, book.name, true);
    if (code !== 0) {
      return new Error(`bundle exited with code ${code}`);
    }
    return { bytes: capture.bytes(), ms: Date.now() - start };
  } catch (error) {
    return error as Error;
  }
}

/** Run one rebuild and emit its bundled/error event. */
async function rebuildAndReport(io: IO, args: ParsedArgs, style: Style, book: Book): Promise<void> {
  const result = await rebuild(io, args, book);
  if (result instanceof Error) {
    emitEvent(io, args, style, "error", { book: book.name, message: result.message });
  } else {
    emitEvent(io, args, style, "bundled", { book: book.name, bytes: result.bytes, ms: result.ms });
  }
}

/**
 * `watch [<dir>]`: rebuild `book.generated.ts` whenever fragments, rules,
 * compositions, code-prompts or `promptbook.json` change. Streams one short
 * line per rebuild to stderr (`[clock] <book> bundled (<bytes> B, <ms>ms)`);
 * stdout stays empty (the contract: stdout = payload, watch has no payload).
 *
 * Discovers every book under the prompts folder and rebuilds each once on
 * startup, then debounces per-book events with a 250 ms window so a burst of
 * edits collapses into one rebuild. SIGINT / SIGTERM closes the watcher and
 * exits 0. Honors `--plain`, `--exclude-code-prompts`, `--json`, and the
 * config / `--dir` resolution chain.
 *
 * `--out <file>` only works in a single-book workspace; the multi-book mode
 * always writes each book's artifact next to its sources.
 */
export async function cmdWatch(args: ParsedArgs, io: IO): Promise<number> {
  if (args.check) {
    io.stderr("error: --check is not supported by watch (run `bundle --check --all` from CI)\n");
    return 1;
  }

  const promptsDir = await requirePromptsDir(io, args.operands[0] ?? args.dir);
  if (promptsDir === null) {
    return 1;
  }

  const workspace = await loadWorkspace(io, promptsDir);
  if (workspace.books.length === 0) {
    io.stderr(`error: no books found under ${promptsDir}\n`);
    return 1;
  }
  if (args.out !== undefined && workspace.books.length > 1) {
    io.stderr("error: --out requires a single book; drop --out to write each book's book.generated.ts\n");
    return 1;
  }

  const style = makeStyle(colorEnabled(io));
  emitEvent(io, args, style, "started", { books: workspace.books.map((b) => b.name) });

  // Initial pass runs in parallel: each book writes its own artifact, no contention.
  await Promise.all(workspace.books.map((book) => rebuildAndReport(io, args, style, book)));

  const watcher = chokidarWatch(promptsDir, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 25 },
    ignored: (eventPath) => shouldIgnore(eventPath),
  });

  const timers = new Map<string, NodeJS.Timeout>();
  const scheduleRebuild = (book: Book): void => {
    const existing = timers.get(book.name);
    if (existing !== undefined) {
      clearTimeout(existing);
    }
    const timer = setTimeout(() => {
      timers.delete(book.name);
      void rebuildAndReport(io, args, style, book);
    }, DEBOUNCE_MS);
    timers.set(book.name, timer);
  };

  watcher.on("all", (_event, eventPath) => {
    const book = workspace.books.find((b) => eventInBook(b, eventPath));
    if (book === undefined) {
      return;
    }
    scheduleRebuild(book);
  });

  // Hold the promise open until SIGINT / SIGTERM closes the watcher.
  return new Promise<number>((resolveDone) => {
    let stopped = false;
    const stop = async (): Promise<void> => {
      if (stopped) {
        return;
      }
      stopped = true;
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
      await watcher.close();
      emitEvent(io, args, style, "stopped");
      process.off("SIGINT", stop);
      process.off("SIGTERM", stop);
      resolveDone(0);
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });
}
