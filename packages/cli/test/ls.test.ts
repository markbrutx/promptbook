import { describe, expect, it } from "vitest";
import { run } from "../src/run.js";
import { capture, promptsDir } from "./helpers.js";

interface LsJson {
  compositions?: { name: string; base: number; rules: number }[];
  fragments?: { id: string; kind: string | null; tags: string[]; sourceFile: string }[];
}

describe("ls command", () => {
  it("lists compositions and fragments by default", async () => {
    const cap = capture();
    const code = await run(["ls", "--dir", promptsDir], cap.io);
    expect(code).toBe(0);
    const out = cap.out();
    expect(out).toContain("compositions:");
    expect(out).toContain("assistant  base=7  rules=3");
    expect(out).toContain("fragments:");
    expect(out).toContain("voice");
    expect(out).toContain("bans");
    expect(cap.err()).toBe("");
  });

  it("emits parseable JSON with both sections", async () => {
    const cap = capture();
    const code = await run(["ls", "--dir", promptsDir, "--json"], cap.io);
    expect(code).toBe(0);
    const parsed = JSON.parse(cap.out()) as LsJson;
    expect(parsed.compositions).toContainEqual({ name: "assistant", base: 7, rules: 3 });
    const ids = (parsed.fragments ?? []).map((f) => f.id);
    expect(ids).toContain("voice");
    expect(ids).toContain("tech-note");
  });

  it("narrows to compositions only", async () => {
    const cap = capture();
    const code = await run(["ls", "--dir", promptsDir, "--compositions"], cap.io);
    expect(code).toBe(0);
    expect(cap.out()).toContain("compositions:");
    expect(cap.out()).not.toContain("fragments:");
  });

  it("narrows to fragments only", async () => {
    const cap = capture();
    const code = await run(["ls", "--dir", promptsDir, "--fragments"], cap.io);
    expect(code).toBe(0);
    expect(cap.out()).toContain("fragments:");
    expect(cap.out()).not.toContain("compositions:");
  });

  it("narrows JSON output to a single section", async () => {
    const cap = capture();
    await run(["ls", "--dir", promptsDir, "--fragments", "--json"], cap.io);
    const parsed = JSON.parse(cap.out()) as LsJson;
    expect(parsed.fragments).toBeDefined();
    expect(parsed.compositions).toBeUndefined();
  });

  it("fails with a clear message for a missing prompts folder", async () => {
    const cap = capture();
    const code = await run(["ls", "--dir", "/no/such/place"], cap.io);
    expect(code).toBe(1);
    expect(cap.err()).toContain("prompts folder not found");
  });
});
