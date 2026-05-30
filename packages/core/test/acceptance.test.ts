import { describe, expect, it } from "vitest";
import { resolve } from "../src/index.js";
import { fixtureDir } from "./helpers.js";

const dir = fixtureDir("sample");
const subject = { subjectName: "Ada Lovelace", notesDigest: "thin metrics; vague scope" };

describe("acceptance: assistant / terse variant", () => {
  it("assembles the base order for locale=ru", async () => {
    const { trace } = await resolve({ promptsDir: dir, prompt: "assistant", context: { locale: "ru" } });
    expect(trace.finalOrder).toEqual([
      "voice",
      "task-framing",
      "locale",
      "native-language",
      "bans",
      "input-context",
      "json-return",
    ]);
  });

  it("assembles the terse variant: 3 replaces + 1 add relative to base", async () => {
    const { trace } = await resolve({
      promptsDir: dir,
      prompt: "assistant",
      context: { mode: "terse", locale: "ru" },
    });
    expect(trace.finalOrder).toEqual([
      "terse-voice",
      "terse-task-framing",
      "locale",
      "native-language",
      "bans",
      "line-by-content",
      "terse-input-context",
      "json-return",
    ]);
    expect(trace.replaced).toEqual([
      { from: "voice", to: "terse-voice", ruleIndex: 0 },
      { from: "task-framing", to: "terse-task-framing", ruleIndex: 0 },
      { from: "input-context", to: "terse-input-context", ruleIndex: 0 },
    ]);
    expect(trace.added).toEqual([{ id: "line-by-content", after: "bans", ruleIndex: 1 }]);
  });

  it("reuses shared fragments verbatim across base and terse", async () => {
    const base = await resolve({ promptsDir: dir, prompt: "assistant", context: { ...subject } });
    const terse = await resolve({
      promptsDir: dir,
      prompt: "assistant",
      context: { mode: "terse", ...subject },
    });
    for (const shared of [
      "Write the final output in the requested locale.",
      "Match the user's native-language register and idioms.",
      "Never use em-dashes, hype words, or numeric scores in the output.",
      'Return a single JSON object with a "text" field holding the rewritten draft.',
    ]) {
      expect(base.text).toContain(shared);
      expect(terse.text).toContain(shared);
    }
  });

  it("interpolates caller-provided context into the input fragment", async () => {
    const { text, trace } = await resolve({
      promptsDir: dir,
      prompt: "assistant",
      context: { ...subject },
    });
    expect(text).toContain("Subject: Ada Lovelace");
    expect(text).toContain("Points to address: thin metrics; vague scope");
    expect(trace.warnings).toEqual([]);
  });

  it("reports the missing-rule hole when an unknown mode is requested", async () => {
    const { trace } = await resolve({
      promptsDir: dir,
      prompt: "assistant",
      context: { mode: "unknown-mode" },
    });
    // Both terse rules reference `mode`, none match "unknown-mode" -> flagged axis.
    expect(trace.unmatchedAxes).toEqual([{ key: "mode", value: "unknown-mode" }]);
    expect(trace.finalOrder).toEqual([
      "voice",
      "task-framing",
      "locale",
      "native-language",
      "bans",
      "input-context",
      "json-return",
    ]);
  });

  it("is deterministic across repeated resolves", async () => {
    const first = await resolve({
      promptsDir: dir,
      prompt: "assistant",
      context: { mode: "terse", ...subject },
    });
    const second = await resolve({
      promptsDir: dir,
      prompt: "assistant",
      context: { mode: "terse", ...subject },
    });
    expect(first.text).toBe(second.text);
  });
});
