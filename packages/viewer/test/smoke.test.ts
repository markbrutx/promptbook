import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startViewer, type Viewer } from "../src/index.js";
import type { BookResponse, ResolveResponse, UsedInResponse } from "../src/shared/types.js";
import { sampleDir } from "./helpers.js";

describe("startViewer (headless smoke)", () => {
  let viewer: Viewer;

  beforeAll(async () => {
    viewer = await startViewer({ promptsDir: sampleDir, open: false });
  });

  afterAll(async () => {
    await viewer.close();
  });

  it("listens on a localhost URL", () => {
    expect(viewer.url).toMatch(/^http:\/\/localhost:\d+$/);
    expect(viewer.port).toBeGreaterThan(0);
  });

  it("serves GET /api/book", async () => {
    const res = await fetch(`${viewer.url}/api/book`);
    expect(res.status).toBe(200);
    const book = (await res.json()) as BookResponse;
    expect(book.compositions.some((c) => c.name === "assistant")).toBe(true);
    expect(book.fragments.some((f) => f.id === "voice")).toBe(true);
  });

  it("serves POST /api/resolve with concatenating segments", async () => {
    const res = await fetch(`${viewer.url}/api/resolve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "assistant", context: { subjectName: "Ada", notesDigest: "x" } }),
    });
    expect(res.status).toBe(200);
    const resolved = (await res.json()) as ResolveResponse;
    expect(resolved.text.length).toBeGreaterThan(0);
    expect(resolved.segments.map((s) => s.text).join("\n\n")).toBe(resolved.text);
  });

  it("serves GET /api/used-in/:id", async () => {
    const res = await fetch(`${viewer.url}/api/used-in/voice`);
    expect(res.status).toBe(200);
    const used = (await res.json()) as UsedInResponse;
    expect(used.references.some((r) => r.composition === "assistant")).toBe(true);
  });

  it("returns 400 on an unknown prompt", async () => {
    const res = await fetch(`${viewer.url}/api/resolve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "nope" }),
    });
    expect(res.status).toBe(400);
    const payload = (await res.json()) as { error: string };
    expect(payload.error).toMatch(/Unknown prompt/);
  });

  it("falls back to an HTML page for non-api routes", async () => {
    const res = await fetch(`${viewer.url}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
  });
});
