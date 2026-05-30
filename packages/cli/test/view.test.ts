import { describe, expect, it } from "vitest";
import type { ParsedArgs } from "../src/args.js";
import { cmdView, type ViewDeps, type ViewerHandle, type ViewerStartOptions } from "../src/commands/view.js";
import { capture, fixtureDir } from "./helpers.js";

function viewArgs(overrides: Partial<ParsedArgs> = {}): ParsedArgs {
  return {
    command: "view",
    operands: [],
    help: false,
    version: false,
    json: false,
    explain: false,
    plain: false,
    ctx: [],
    fragments: false,
    compositions: false,
    strict: false,
    lint: false,
    noOpen: false,
    dir: fixtureDir("prompts"),
    ...overrides,
  };
}

/** A fake viewer + deps that records how `view` drove it. */
function fakeDeps(handle?: Partial<ViewerHandle>) {
  const calls: { start?: ViewerStartOptions; closed: boolean } = { closed: false };
  const viewer: ViewerHandle = {
    url: handle?.url ?? "http://localhost:4321",
    close: async () => {
      calls.closed = true;
    },
  };
  const deps: ViewDeps = {
    async start(options) {
      calls.start = options;
      return viewer;
    },
    // Resolve immediately instead of blocking on a signal.
    hold: async (h) => {
      await h.close();
      return 0;
    },
  };
  return { deps, calls };
}

describe("view command", () => {
  it("starts the viewer, prints the URL, and honors --no-open", async () => {
    const cap = capture();
    const { deps, calls } = fakeDeps();
    const code = await cmdView(viewArgs({ noOpen: true, port: 4321 }), cap.io, deps);

    expect(code).toBe(0);
    expect(calls.start?.open).toBe(false);
    expect(calls.start?.port).toBe(4321);
    expect(calls.start?.promptsDir).toBe(fixtureDir("prompts"));
    expect(cap.out()).toContain("http://localhost:4321");
    expect(calls.closed).toBe(true);
  });

  it("opens the browser by default (open=true)", async () => {
    const cap = capture();
    const { deps, calls } = fakeDeps();
    await cmdView(viewArgs(), cap.io, deps);
    expect(calls.start?.open).toBe(true);
  });

  it("exits non-zero with a clear error when the prompts folder is missing", async () => {
    const cap = capture();
    const { deps } = fakeDeps();
    const code = await cmdView(viewArgs({ dir: fixtureDir("does-not-exist") }), cap.io, deps);
    expect(code).toBe(1);
    expect(cap.err()).toContain("prompts folder not found");
  });

  it("surfaces a start failure as a non-zero exit", async () => {
    const cap = capture();
    const deps: ViewDeps = {
      start() {
        return Promise.reject(new Error("listen EADDRINUSE"));
      },
      hold: async () => 0,
    };
    const code = await cmdView(viewArgs(), cap.io, deps);
    expect(code).toBe(1);
    expect(cap.err()).toContain("error:");
  });
});
