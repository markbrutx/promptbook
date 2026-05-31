import { resolveBook } from "@promptbook/core";
import { describe, expect, it } from "vitest";
import { createBookSource } from "../src/server/book-source.js";
import {
  buildBookResponse,
  buildLintResponse,
  buildResolveResponse,
  buildUsedInResponse,
} from "../src/server/responses.js";
import { sampleDir } from "./helpers.js";

async function folder() {
  return createBookSource(sampleDir).get();
}

describe("buildBookResponse", () => {
  it("lists compositions with variants from fixtures and fragments", async () => {
    const book = buildBookResponse(await folder(), sampleDir);

    const assistant = book.compositions.find((c) => c.name === "assistant");
    expect(assistant).toBeDefined();
    expect(assistant?.base).toContain("voice");
    // Variants come from fixtures whose `prompt` matches the composition.
    expect(assistant?.variants.map((v) => v.name).sort()).toEqual(["named", "terse"]);

    // sourceFile is relativized to the prompts folder (no absolute paths leak).
    expect(assistant?.sourceFile).toBe("rules/assistant.yaml");
    const voice = book.fragments.find((f) => f.id === "voice");
    expect(voice?.sourceFile).toBe("fragments/voice.md");
    expect(voice?.kind).toBe("persona");
  });

  it("lists code-prompts with samples and a relativized manifest path", async () => {
    const book = buildBookResponse(await folder(), sampleDir);

    const digest = book.codePrompts.find((c) => c.name === "digest-table");
    expect(digest).toBeDefined();
    expect(digest?.description).toContain("variable-length table");
    expect(digest?.sourceFile).toBe("code-prompts/digest-table.yaml");
    expect(digest?.samples.map((s) => s.label)).toEqual(["empty", "filled"]);
    // The captured output ships to the canvas verbatim.
    expect(digest?.samples[1]?.output).toContain("Summary table (3 rows):");
    expect(digest?.samples[0]?.context).toEqual({ rows: 0 });
  });
});

describe("buildResolveResponse", () => {
  it("matches resolveBook text and the segments concatenate back to it", async () => {
    const loaded = await folder();
    const context = { subjectName: "Ada", notesDigest: "thin metrics" };

    const response = buildResolveResponse(loaded, "assistant", context);
    const direct = resolveBook(loaded.book, "assistant", context);

    expect(response.text).toBe(direct.text);
    // The headline invariant: segments join (with blank lines) into the text.
    expect(response.segments.map((s) => s.text).join("\n\n")).toBe(response.text);
    expect(response.segments.map((s) => s.fragmentId)).toEqual(response.trace.finalOrder);
  });

  it("holds the segment invariant for the terse variant too", async () => {
    const loaded = await folder();
    const context = { mode: "terse", subjectName: "Ada", notesDigest: "thin metrics" };

    const response = buildResolveResponse(loaded, "assistant", context);
    expect(response.segments.map((s) => s.text).join("\n\n")).toBe(response.text);
    // The terse rule swaps voice and adds the line-by-content fragment.
    expect(response.trace.finalOrder).toContain("terse-voice");
    expect(response.trace.finalOrder).toContain("line-by-content");
  });

  it("throws on an unknown prompt", async () => {
    const loaded = await folder();
    expect(() => buildResolveResponse(loaded, "nope", {})).toThrow(/Unknown prompt/);
  });
});

describe("buildLintResponse", () => {
  it("returns findings counts and a token estimate", async () => {
    const loaded = await folder();
    const lint = buildLintResponse(loaded, "assistant", { subjectName: "Ada", notesDigest: "x" });
    expect(typeof lint.tokens).toBe("number");
    expect(lint.tokens).toBeGreaterThan(0);
    expect(lint.errorCount).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(lint.findings)).toBe(true);
  });
});

describe("buildUsedInResponse", () => {
  it("lists compositions that reference a shared fragment", async () => {
    const loaded = await folder();
    const used = buildUsedInResponse(loaded, "voice");
    expect(used.fragmentId).toBe("voice");
    expect(used.references.some((r) => r.composition === "assistant" && r.role === "base")).toBe(true);
  });

  it("reports a replace-from reference for the swapped fragment", async () => {
    const loaded = await folder();
    const used = buildUsedInResponse(loaded, "voice");
    expect(used.references.some((r) => r.role === "replace-from")).toBe(true);
  });

  it("returns an empty list for an unreferenced id", async () => {
    const loaded = await folder();
    expect(buildUsedInResponse(loaded, "does-not-exist").references).toEqual([]);
  });
});
