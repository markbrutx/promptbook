import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createWorkspaceSource } from "../src/server/book-source.js";
import { sampleDir } from "./helpers.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "viewer-book-source-"));
  await cp(sampleDir, root, { recursive: true });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("createWorkspaceSource.invalidate", () => {
  it("drops every cached book on an unnamed invalidate (root-is-book edits)", async () => {
    const workspace = createWorkspaceSource(root);
    const before = await workspace.resolve();
    expect(before?.folder.book.fragments.has("extra")).toBe(false);

    await writeFile(join(root, "fragments", "extra.md"), "---\nid: extra\n---\nMore notes.\n");
    // Root-is-book watch events never carry a real book name.
    workspace.invalidate(undefined);

    const after = await workspace.resolve();
    expect(after?.folder.book.fragments.has("extra")).toBe(true);
  });

  it("still drops a single named book's cache", async () => {
    const workspace = createWorkspaceSource(root);
    const books = await workspace.books();
    const name = books[0]?.name;
    expect(name).toBeDefined();

    await workspace.resolve(name);
    await writeFile(join(root, "fragments", "later.md"), "---\nid: later\n---\nLater notes.\n");
    workspace.invalidate(name);

    const after = await workspace.resolve(name);
    expect(after?.folder.book.fragments.has("later")).toBe(true);
  });
});
