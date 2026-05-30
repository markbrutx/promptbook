import type { Context, PromptBook } from "@promptbook/core";
import { resolve, resolveBook } from "@promptbook/core";
import { describe, expect, it } from "vitest";
import { run } from "../src/run.js";
import { capture, promptsDir } from "./helpers.js";

interface BundleJson {
  fragments: { id: string }[];
  compositions: { name: string }[];
  warnings: string[];
}

/** Pull the `book` value expression out of the generated module and evaluate it. */
function restoreFromModule(module: string): PromptBook {
  const marker = "export const book: PromptBook = ";
  const start = module.indexOf(marker);
  const end = module.indexOf(";\n\nexport default book;");
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  const expression = module.slice(start + marker.length, end);
  return (new Function(`return (${expression});`) as () => PromptBook)();
}

const contexts: Context[] = [{ locale: "ru" }, { mode: "terse", subjectName: "Ada", notesDigest: "thin" }];

describe("bundle command", () => {
  it("emits an importable module to stdout", async () => {
    const cap = capture();
    const code = await run(["bundle", "--dir", promptsDir], cap.io);
    expect(code).toBe(0);
    const out = cap.out();
    expect(out).toContain('import type { PromptBook } from "@promptbook/core";');
    expect(out).toContain("export const book: PromptBook = {");
    expect(out).toContain("export default book;");
    expect(out).toContain("new Map([");
    expect(cap.err()).toBe("");
  });

  it("accepts the folder as a positional argument", async () => {
    const cap = capture();
    const code = await run(["bundle", promptsDir], cap.io);
    expect(code).toBe(0);
    expect(cap.out()).toContain("export const book: PromptBook");
  });

  it("relativizes source paths (portable, forward-slash)", async () => {
    const cap = capture();
    await run(["bundle", "--dir", promptsDir], cap.io);
    const out = cap.out();
    expect(out).toContain('"sourceFile":"fragments/voice.md"');
    expect(out).toContain('"sourceFile":"rules/assistant.yaml"');
    expect(out).not.toContain(promptsDir);
  });

  it("round-trips: the bundled book resolves identically to the folder", async () => {
    const cap = capture();
    await run(["bundle", "--dir", promptsDir], cap.io);
    const restored = restoreFromModule(cap.out());
    for (const context of contexts) {
      const fromFolder = await resolve({ promptsDir, prompt: "assistant", context });
      const fromBundle = resolveBook(restored, "assistant", context);
      expect(fromBundle.text).toBe(fromFolder.text);
    }
  });

  it("writes to a file with -o and reports the path on stderr", async () => {
    const cap = capture();
    const code = await run(["bundle", "--dir", promptsDir, "-o", "out/book.generated.ts"], cap.io);
    expect(code).toBe(0);
    expect(cap.out()).toBe("");
    expect(cap.err()).toContain("wrote");
    const files = cap.files();
    const paths = Object.keys(files);
    expect(paths.length).toBe(1);
    const path = paths[0] ?? "";
    expect(path.endsWith("out/book.generated.ts")).toBe(true);
    expect(files[path]).toContain("export const book: PromptBook");
  });

  it("emits a parseable JSON dump with --json", async () => {
    const cap = capture();
    const code = await run(["bundle", "--dir", promptsDir, "--json"], cap.io);
    expect(code).toBe(0);
    const parsed = JSON.parse(cap.out()) as BundleJson;
    expect(parsed.compositions.map((c) => c.name)).toContain("assistant");
    expect(parsed.fragments.map((f) => f.id)).toContain("voice");
    expect(Array.isArray(parsed.warnings)).toBe(true);
  });

  it("emits a plain module with --plain (no type-only import)", async () => {
    const cap = capture();
    const code = await run(["bundle", "--dir", promptsDir, "--plain"], cap.io);
    expect(code).toBe(0);
    const out = cap.out();
    expect(out).not.toContain("import type");
    expect(out).toContain("export const book = {");
    expect(out).toContain("new Map([");
  });

  it("is deterministic across runs", async () => {
    const a = capture();
    const b = capture();
    await run(["bundle", "--dir", promptsDir], a.io);
    await run(["bundle", "--dir", promptsDir], b.io);
    expect(a.out()).toBe(b.out());
  });

  it("fails with a clear message for a missing prompts folder", async () => {
    const cap = capture();
    const code = await run(["bundle", "--dir", "/no/such/place"], cap.io);
    expect(code).toBe(1);
    expect(cap.err()).toContain("prompts folder not found");
  });
});
