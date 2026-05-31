import { resolve } from "@markbrutx/promptbook-core";
import { describe, expect, it } from "vitest";
import { renderExplain } from "../src/render-explain.js";
import { promptsDir } from "./helpers.js";

describe("renderExplain", () => {
  it("renders fired/skipped rules, final order and effects without color", async () => {
    const { trace } = await resolve({
      promptsDir,
      prompt: "assistant",
      context: { mode: "terse", subjectName: "Ada", notesDigest: "x" },
    });
    const text = renderExplain(trace, false);
    expect(text).toContain('resolve "assistant"');
    expect(text).toContain("✓ #0 replace");
    expect(text).toContain("voice → terse-voice");
    expect(text).toContain("line-by-content after bans");
    expect(text).toContain("final order:");
    // The industry rule did not fire under mode=terse.
    expect(text).toContain("✗ #2 add");
    // biome-ignore lint/suspicious/noControlCharactersInRegex: asserting no ANSI escapes.
    expect(text).not.toMatch(/\x1b\[/);
  });

  it("highlights unmatched axes for an unknown industry", async () => {
    const { trace } = await resolve({
      promptsDir,
      prompt: "assistant",
      context: { industry: "zoo", subjectName: "Ada", notesDigest: "x" },
    });
    const text = renderExplain(trace, false);
    expect(text).toContain("unmatched axes:");
    expect(text).toContain("⚠ no rules matched for industry=zoo");
  });

  it("includes ANSI escapes when color is enabled", async () => {
    const { trace } = await resolve({
      promptsDir,
      prompt: "assistant",
      context: { mode: "terse", subjectName: "Ada", notesDigest: "x" },
    });
    const text = renderExplain(trace, true);
    // biome-ignore lint/suspicious/noControlCharactersInRegex: asserting ANSI escapes.
    expect(text).toMatch(/\x1b\[/);
  });
});
