import { describe, expect, it } from "vitest";
import {
  bookDir,
  discoverBooks,
  isBook,
  loadWorkspace,
  parseAddress,
  resolveAddress,
} from "../src/workspace.js";
import { capture, memoryFs } from "./helpers.js";

/** A multi-book workspace under /ws: alpha+beta share a `shared` composition. */
const files: Record<string, string> = {
  // Ignored: underscore root, node_modules, a loose file.
  "/ws/_shared/rules/ignored.yaml": "name: ignored\nbase: [x]\n",
  "/ws/node_modules/pkg/rules/dep.yaml": "name: dep\nbase: [x]\n",
  "/ws/notes.md": "# loose file, not a book",
  // alpha: two compositions, one shared with beta.
  "/ws/alpha/fragments/x.md": "---\nid: x\n---\nAlpha body.",
  "/ws/alpha/rules/shared.yaml": "name: shared\nbase: [x]\n",
  "/ws/alpha/rules/only-alpha.yaml": "name: only-alpha\nbase: [x]\n",
  // beta: also exposes `shared` (makes the bare name ambiguous).
  "/ws/beta/fragments/y.md": "---\nid: y\n---\nBeta body.",
  "/ws/beta/rules/shared.yaml": "name: shared\nbase: [y]\n",
  // gamma: book by config marker only.
  "/ws/gamma/promptbook.json": "{}",
  "/ws/gamma/fragments/z.md": "---\nid: z\n---\nGamma body.",
  "/ws/gamma/rules/only-gamma.yaml": "name: only-gamma\nbase: [z]\n",
  // delta: book by code-prompts marker only (no rules/ dir).
  "/ws/delta/code-prompts/digest.yaml": "name: digest\nsamples:\n  - label: one\n    output: hi\n",
};

const io = capture({ fs: memoryFs(files) }).io;

describe("parseAddress", () => {
  it("splits on the first slash and keeps later slashes in comp", () => {
    expect(parseAddress("alpha/reply")).toEqual({ book: "alpha", comp: "reply" });
    expect(parseAddress("alpha/group/reply")).toEqual({ book: "alpha", comp: "group/reply" });
    expect(parseAddress("reply")).toEqual({ comp: "reply" });
  });
});

describe("discoverBooks", () => {
  it("finds sub-books, ignores underscore/node_modules/loose files, sorts by name", async () => {
    const books = await discoverBooks(io, "/ws");
    expect(books.map((b) => b.name)).toEqual(["alpha", "beta", "delta", "gamma"]);
  });

  it("treats a code-prompts-only folder as a book", async () => {
    expect(await isBook(io, "/ws/delta")).toBe(true);
  });

  it("returns no books for a missing root", async () => {
    expect(await discoverBooks(io, "/nope")).toEqual([]);
  });
});

describe("loadWorkspace", () => {
  it("expands a workspace root into its sub-books", async () => {
    const ws = await loadWorkspace(io, "/ws");
    expect(ws.books.map((b) => b.name)).toEqual(["alpha", "beta", "delta", "gamma"]);
    expect(ws.books.map((b) => bookDir(ws, b))[0]).toBe("alpha");
  });

  it("treats a root that is itself a book as a single-book workspace", async () => {
    const ws = await loadWorkspace(io, "/ws/alpha");
    expect(ws.books).toEqual([{ name: "alpha", dir: "/ws/alpha" }]);
    expect(ws.books.map((b) => bookDir(ws, b))).toEqual(["."]);
  });
});

describe("resolveAddress", () => {
  it("addresses a qualified <book>/<comp> directly", async () => {
    const ws = await loadWorkspace(io, "/ws");
    expect(await resolveAddress(io, ws, "alpha/shared")).toEqual({ book: ws.books[0], comp: "shared" });
  });

  it("resolves a unique bare name across books", async () => {
    const ws = await loadWorkspace(io, "/ws");
    const resolved = await resolveAddress(io, ws, "only-alpha");
    expect(resolved.book.name).toBe("alpha");
    expect(resolved.comp).toBe("only-alpha");
  });

  it("errors with the book list when a bare name is ambiguous", async () => {
    const ws = await loadWorkspace(io, "/ws");
    await expect(resolveAddress(io, ws, "shared")).rejects.toThrow(/Ambiguous prompt "shared".*alpha, beta/);
  });

  it("errors when a bare name is in no book", async () => {
    const ws = await loadWorkspace(io, "/ws");
    await expect(resolveAddress(io, ws, "ghost")).rejects.toThrow(/Unknown prompt "ghost" in any book/);
  });

  it("uses the one book for a bare name in a single-book workspace", async () => {
    const ws = await loadWorkspace(io, "/ws/alpha");
    expect(await resolveAddress(io, ws, "anything")).toEqual({ book: ws.books[0], comp: "anything" });
  });
});
