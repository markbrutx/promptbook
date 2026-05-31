import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startViewer, type Viewer } from "../src/index.js";
import { createAnnotationStore } from "../src/server/annotations.js";
import type { Annotation, AnnotationsResponse } from "../src/shared/types.js";
import { markAnchors } from "../src/web/annotations.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "pb-annot-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("createAnnotationStore", () => {
  it("appends, lists, and removes against the jsonl queue", async () => {
    const store = createAnnotationStore(dir);
    expect(await store.list()).toEqual([]);

    const a = await store.append({
      prompt: "assistant",
      context: { mode: "terse" },
      fragmentId: "voice",
      anchorText: "be concise",
      comment: "tone is off",
    });
    expect(a.status).toBe("open");
    expect(a.target).toEqual({ prompt: "assistant", context: { mode: "terse" } });
    expect(a.anchor).toEqual({ fragmentId: "voice", anchorText: "be concise" });

    const b = await store.append({ fragmentId: "bans", anchorText: "no em-dash", comment: "why?" });
    // A body without a prompt targets the fragment directly.
    expect(b.target).toEqual({ fragmentId: "bans" });

    const open = await store.list();
    expect(open.map((x) => x.id)).toEqual([a.id, b.id]);

    expect(await store.remove(a.id)).toBe(true);
    expect((await store.list()).map((x) => x.id)).toEqual([b.id]);
    expect(await store.remove("missing")).toBe(false);
  });

  it("writes the queue to <dir>/.annotations/inbox.jsonl", async () => {
    const store = createAnnotationStore(dir);
    await store.append({ fragmentId: "voice", anchorText: "x", comment: "c" });
    const raw = await readFile(join(dir, ".annotations", "inbox.jsonl"), "utf8");
    expect(raw.trim().split("\n")).toHaveLength(1);
    expect(JSON.parse(raw.trim()).comment).toBe("c");
  });
});

describe("annotation HTTP routes", () => {
  let viewer: Viewer;

  beforeEach(async () => {
    viewer = await startViewer({ promptsDir: dir, open: false });
  });

  afterEach(async () => {
    await viewer.close();
  });

  const post = (body: unknown) =>
    fetch(`${viewer.url}/api/annotate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  it("runs the annotate → list → resolve loop", async () => {
    const created = await post({
      prompt: "assistant",
      context: {},
      fragmentId: "voice",
      anchorText: "hello",
      comment: "fix this",
    });
    expect(created.status).toBe(200);
    const annotation = (await created.json()) as Annotation;
    expect(annotation.id).toBeTruthy();

    const listed = await fetch(`${viewer.url}/api/annotations`);
    const { annotations } = (await listed.json()) as AnnotationsResponse;
    expect(annotations.map((a) => a.id)).toEqual([annotation.id]);

    const removed = await fetch(`${viewer.url}/api/annotations/${annotation.id}`, { method: "DELETE" });
    expect(removed.status).toBe(200);
    expect((await removed.json()) as { removed: boolean }).toMatchObject({ removed: true });

    const after = await fetch(`${viewer.url}/api/annotations`);
    expect(((await after.json()) as AnnotationsResponse).annotations).toEqual([]);
  });

  it("rejects a body without a comment", async () => {
    const res = await post({ fragmentId: "voice", anchorText: "x" });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(/comment/);
  });

  it("404s when resolving an unknown id", async () => {
    const res = await fetch(`${viewer.url}/api/annotations/nope`, { method: "DELETE" });
    expect(res.status).toBe(404);
    expect(((await res.json()) as { removed: boolean }).removed).toBe(false);
  });
});

describe("markAnchors", () => {
  it("returns the whole text as one run when there are no anchors", () => {
    expect(markAnchors("hello world", [])).toEqual([{ text: "hello world" }]);
  });

  it("marks a matched span and leaves the surrounding text plain", () => {
    const runs = markAnchors("be concise and clear", [{ id: "a1", anchorText: "concise" }]);
    expect(runs).toEqual([{ text: "be " }, { text: "concise", annotationId: "a1" }, { text: " and clear" }]);
  });

  it("marks multiple non-overlapping anchors in order", () => {
    const runs = markAnchors("alpha beta gamma", [
      { id: "g", anchorText: "gamma" },
      { id: "a", anchorText: "alpha" },
    ]);
    expect(runs).toEqual([
      { text: "alpha", annotationId: "a" },
      { text: " beta " },
      { text: "gamma", annotationId: "g" },
    ]);
  });

  it("ignores an anchor whose text is not present", () => {
    expect(markAnchors("abc", [{ id: "x", anchorText: "zzz" }])).toEqual([{ text: "abc" }]);
  });
});
