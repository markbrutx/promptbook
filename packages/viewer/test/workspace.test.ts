import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startViewer, type Viewer } from "../src/index.js";
import type { Annotation, BookResponse, BooksResponse, ResolveResponse } from "../src/shared/types.js";

const workspaceDir = fileURLToPath(new URL("./fixtures/workspace", import.meta.url));

describe("viewer over a multi-book workspace", () => {
  let viewer: Viewer;
  const url = (path: string) => `${viewer.url}${path}`;

  beforeAll(async () => {
    viewer = await startViewer({ promptsDir: workspaceDir, open: false });
  });
  afterAll(async () => {
    await viewer.close();
  });

  it("lists the discovered books for the switcher", async () => {
    const { books } = (await (await fetch(url("/api/books"))).json()) as BooksResponse;
    expect(books.map((b) => b.name)).toEqual(["alpha", "beta"]);
  });

  it("defaults /api/book to the first book and routes ?book= to a chosen one", async () => {
    const first = (await (await fetch(url("/api/book"))).json()) as BookResponse;
    expect(first.compositions.map((c) => c.name)).toEqual(["one"]);

    const beta = (await (await fetch(url("/api/book?book=beta"))).json()) as BookResponse;
    expect(beta.compositions.map((c) => c.name)).toEqual(["two"]);
  });

  it("resolves a composition scoped to ?book=", async () => {
    const res = await fetch(url("/api/resolve?book=beta"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "two", context: { topic: "ramp" } }),
    });
    const resolved = (await res.json()) as ResolveResponse;
    expect(resolved.text).toContain("Beta summarizes ramp.");
  });

  it("keeps annotation queues separate per book", async () => {
    const created = await fetch(url("/api/annotate?book=alpha"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fragmentId: "a", anchorText: "Alpha", comment: "tone" }),
    });
    const annotation = (await created.json()) as Annotation;
    expect(annotation.id).toBeTruthy();

    const alphaList = (await (await fetch(url("/api/annotations?book=alpha"))).json()) as {
      annotations: Annotation[];
    };
    expect(alphaList.annotations.map((a) => a.id)).toEqual([annotation.id]);

    const betaList = (await (await fetch(url("/api/annotations?book=beta"))).json()) as {
      annotations: Annotation[];
    };
    expect(betaList.annotations).toEqual([]);

    // Clean up so re-runs against the on-disk fixture stay deterministic.
    await fetch(url(`/api/annotations/${annotation.id}?book=alpha`), { method: "DELETE" });
  });
});
