import { cp, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ParsedArgs } from "../src/args.js";
import { cmdWatch } from "../src/commands/watch.js";
import { capture, fixtureDir } from "./helpers.js";

/** Wrap `capture()` so writeFile actually hits the disk — chokidar watches real files. */
function diskCapture() {
  const cap = capture();
  cap.io.writeFile = async (path, contents) => {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, contents);
  };
  return cap;
}

function watchArgs(overrides: Partial<ParsedArgs> = {}): ParsedArgs {
  return {
    command: "watch",
    operands: [],
    help: false,
    version: false,
    json: false,
    explain: false,
    plain: false,
    ctx: [],
    fragments: false,
    compositions: false,
    all: false,
    check: false,
    excludeCodePrompts: false,
    strict: false,
    lint: false,
    noOpen: false,
    ...overrides,
  };
}

/** Poll until `check` returns truthy or `timeoutMs` elapses. */
async function waitFor<T>(check: () => Promise<T | undefined>, timeoutMs = 4000): Promise<T> {
  const start = Date.now();
  for (;;) {
    const value = await check();
    if (value !== undefined && value !== null && value !== (false as unknown as T)) {
      return value;
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error(`waitFor timed out after ${timeoutMs}ms`);
    }
    await new Promise((r) => setTimeout(r, 50));
  }
}

describe("watch command", () => {
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = await mkdtemp(join(tmpdir(), "pb-watch-"));
    await cp(fixtureDir("workspace"), tmpRoot, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpRoot, { recursive: true, force: true });
  });

  it("does an initial bundle for every book then rebuilds on a fragment edit", async () => {
    const cap = diskCapture();
    const watchPromise = cmdWatch(watchArgs({ dir: tmpRoot }), cap.io);

    // Initial pass: both greeter/book.generated.ts and summarizer/book.generated.ts appear.
    await waitFor(async () => {
      try {
        await stat(join(tmpRoot, "greeter", "book.generated.ts"));
        await stat(join(tmpRoot, "summarizer", "book.generated.ts"));
        return true;
      } catch {
        return false;
      }
    });
    expect(cap.err()).toContain("watching 2 book(s)");
    expect(cap.err()).toContain("greeter bundled");
    expect(cap.err()).toContain("summarizer bundled");

    const initialErr = cap.err();
    const greeterBefore = await readFile(join(tmpRoot, "greeter", "book.generated.ts"), "utf8");

    // Touch a fragment in greeter: the file should be rebundled and stderr should report it again.
    const fragmentPath = join(tmpRoot, "greeter", "fragments");
    const entries = await readdir(fragmentPath);
    const firstFragment = entries[0] as string;
    const fragmentFile = join(fragmentPath, firstFragment);
    const original = await readFile(fragmentFile, "utf8");
    await writeFile(fragmentFile, `${original}\nappended line for watch test\n`);

    await waitFor(async () => {
      const next = cap.err().slice(initialErr.length);
      return next.includes("greeter bundled");
    });

    const greeterAfter = await readFile(join(tmpRoot, "greeter", "book.generated.ts"), "utf8");
    expect(greeterAfter).not.toBe(greeterBefore);
    expect(greeterAfter).toContain("appended line for watch test");

    process.emit("SIGINT");
    const exit = await watchPromise;
    expect(exit).toBe(0);
    expect(cap.err()).toContain("stopped");
  }, 15000);

  it("rejects --out when more than one book is in the workspace", async () => {
    const cap = capture();
    const code = await cmdWatch(watchArgs({ dir: tmpRoot, out: "/tmp/x.ts" }), cap.io);
    expect(code).toBe(1);
    expect(cap.err()).toContain("--out requires a single book");
  });

  it("rejects --check", async () => {
    const cap = capture();
    const code = await cmdWatch(watchArgs({ dir: tmpRoot, check: true }), cap.io);
    expect(code).toBe(1);
    expect(cap.err()).toContain("--check is not supported by watch");
  });
});
