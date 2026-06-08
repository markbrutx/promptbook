import { describe, expect, it } from "vitest";
import type { Context, PromptBook } from "../src/index.js";
import {
  loadPrompts,
  resolveBook,
  serializeBook,
  serializeBookExpression,
  serializeBookJson,
} from "../src/index.js";
import { composition, fixtureDir, fragment, book as makeBook } from "./helpers.js";

const dir = fixtureDir("sample");
const multiDir = fixtureDir("multi");

/** Reconstruct a PromptBook from a serialized expression (pure JS, only `new Map`). */
function restore(expression: string): PromptBook {
  const factory = new Function(`return (${expression});`) as () => PromptBook;
  return factory();
}

const contexts: Context[] = [
  { locale: "ru" },
  { mode: "terse", locale: "ru" },
  { mode: "terse", subjectName: "Ada Lovelace", notesDigest: "thin metrics; vague scope" },
  { subjectName: "Grace Hopper", notesDigest: "no impact numbers" },
];

describe("serializeBook", () => {
  it("round-trips: resolveBook on the restored book matches the original", async () => {
    const original = await loadPrompts(dir);
    const restored = restore(serializeBookExpression(original));

    for (const context of contexts) {
      const a = resolveBook(original, "assistant", context);
      const b = resolveBook(restored, "assistant", context);
      expect(b.text).toBe(a.text);
      expect(b.trace.finalOrder).toEqual(a.trace.finalOrder);
    }
  });

  it("round-trips a multi-composition book: every composition resolves identically after a bundle", async () => {
    const original = await loadPrompts(multiDir);
    // Sanity: the folder really holds more than one composition over a shared pool.
    expect([...original.compositions.keys()].sort()).toEqual(["assistant", "summarizer"]);
    const restored = restore(serializeBookExpression(original));

    for (const name of original.compositions.keys()) {
      for (const context of contexts) {
        const a = resolveBook(original, name, context);
        const b = resolveBook(restored, name, context);
        expect(b.text).toBe(a.text);
        expect(b.trace.finalOrder).toEqual(a.trace.finalOrder);
      }
    }
  });

  it("re-bundling a multi-composition folder is byte-identical", async () => {
    const original = await loadPrompts(multiDir);
    expect(serializeBook(original)).toBe(serializeBook(original));
    // A reload of the same folder bundles to the same bytes (no Map-order drift
    // across the two compositions or their shared fragments).
    const reloaded = await loadPrompts(multiDir);
    expect(serializeBookJson(reloaded)).toBe(serializeBookJson(original));
  });

  it("round-trips code-prompts (snapshot output survives a bundle)", async () => {
    const original = await loadPrompts(dir);
    expect(original.codePrompts.has("digest-table")).toBe(true);
    const restored = restore(serializeBookExpression(original));

    const before = original.codePrompts.get("digest-table");
    const after = restored.codePrompts.get("digest-table");
    expect(after?.description).toBe(before?.description);
    expect(after?.samples).toEqual(before?.samples);
    expect(after?.sourceFile).toBe(before?.sourceFile);
  });

  it("preserves fragments, compositions, code-prompts and warnings exactly", async () => {
    const original = await loadPrompts(dir);
    const restored = restore(serializeBookExpression(original));

    expect([...restored.fragments.keys()].sort()).toEqual([...original.fragments.keys()].sort());
    expect([...restored.compositions.keys()].sort()).toEqual([...original.compositions.keys()].sort());
    expect([...restored.codePrompts.keys()].sort()).toEqual([...original.codePrompts.keys()].sort());
    expect(restored.warnings).toEqual(original.warnings);
    const voice = restored.fragments.get("voice");
    expect(voice?.body).toBe(original.fragments.get("voice")?.body);
    expect(voice?.kind).toBe(original.fragments.get("voice")?.kind);
    expect(voice?.tags).toEqual(original.fragments.get("voice")?.tags);
  });

  it("is deterministic: serializing the same book twice is byte-identical", async () => {
    const book = await loadPrompts(dir);
    expect(serializeBook(book)).toBe(serializeBook(book));
    expect(serializeBookExpression(book)).toBe(serializeBookExpression(book));
  });

  it("emits an importable module exporting book: PromptBook", async () => {
    const book = await loadPrompts(dir);
    const module = serializeBook(book);
    expect(module).toContain(
      'import type { PromptBook, Fragment, Composition, CodePrompt } from "@markbrutx/promptbook-core";',
    );
    expect(module).toContain("export const book: PromptBook = {");
    expect(module).toContain("export default book;");
    expect(module).toContain("new Map<string, Fragment>([");
    // The module body, with the boilerplate stripped, is the same value.
    expect(module).toContain(serializeBookExpression(book, { typed: true }));
  });

  it("honors a custom import specifier", async () => {
    const book = await loadPrompts(dir);
    const module = serializeBook(book, { importSpecifier: "../src/index.js" });
    expect(module).toContain(
      'import type { PromptBook, Fragment, Composition, CodePrompt } from "../src/index.js";',
    );
  });

  it("emits a plain module (no type import/annotation) with typed:false", async () => {
    const book = await loadPrompts(dir);
    const module = serializeBook(book, { typed: false });
    expect(module).not.toContain("import type");
    expect(module).toContain("export const book = {");
    expect(module).toContain("export default book;");
    // The value is identical to the typed variant's value.
    expect(module).toContain(serializeBookExpression(book));
  });

  it("preserves every field of a fully-populated book (all fragment optionals + rule actions)", () => {
    const fully = makeBook(
      [
        fragment("a", "alpha ${x}", { kind: "persona", tags: ["t1", "t2"] }),
        fragment("b", "beta"),
        fragment("c", "gamma"),
      ],
      [
        composition(
          "w",
          ["a", "b"],
          [
            { index: 0, when: { mode: "x" }, action: "add", add: ["c"], after: "a" },
            { index: 1, when: {}, action: "replace", replace: { b: "c" } },
            { index: 2, when: { drop: true }, action: "forbid", forbid: ["c"] },
            { index: 3, when: {}, action: "order", order: ["b", "a"] },
          ],
          ["a", "b"],
        ),
      ],
    );
    const restored = restore(serializeBookExpression(fully));
    expect(restored).toEqual(fully);
  });

  it("serializeBookJson shares the canonical shape and parses", async () => {
    const book = await loadPrompts(dir);
    const json = serializeBookJson(book);
    const parsed = JSON.parse(json) as {
      fragments: { id: string }[];
      compositions: { name: string }[];
      warnings: string[];
    };
    expect(parsed.fragments.map((f) => f.id)).toContain("voice");
    expect(parsed.compositions.map((c) => c.name)).toContain("assistant");
    const withCode = JSON.parse(json) as { codePrompts: { name: string }[] };
    expect(withCode.codePrompts.map((c) => c.name)).toContain("digest-table");
    // Key-sorted, locale-independent order.
    const ids = parsed.fragments.map((f) => f.id);
    expect(ids).toEqual([...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
  });

  it("serializes an empty book without dangling commas", () => {
    const empty: PromptBook = {
      fragments: new Map(),
      compositions: new Map(),
      codePrompts: new Map(),
      warnings: [],
    };
    const expression = serializeBookExpression(empty);
    expect(expression).toContain("new Map()");
    expect(expression).not.toContain("new Map([])");
    const restored = restore(expression);
    expect(restored.fragments.size).toBe(0);
    expect(restored.compositions.size).toBe(0);
  });
});
