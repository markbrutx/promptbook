import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { loadPrompts, resolveBook } from "@markbrutx/promptbook-core";
import { describe, expect, it } from "vitest";

import { parseBookJson } from "../src/lib/demo/parse.js";
import type { BookJson } from "../src/lib/demo/types.js";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const examplesRoot = `${repoRoot}/examples`;
const publicRoot = fileURLToPath(new URL("../public/demo", import.meta.url));

const CASES = [
  {
    book: "sports-broadcast",
    prompt: "post-game-analysis",
    context: {
      sport: "football",
      locale: "English",
      tier: "premium",
      platform: "broadcast-tv",
      model: "claude",
      compliance: "standard",
    },
  },
  {
    book: "sports-broadcast",
    prompt: "social-post",
    context: {
      sport: "basketball",
      locale: "English",
      tier: "vip",
      platform: "social",
      model: "open-source",
      compliance: "kid-safe",
    },
  },
  {
    book: "support-assistant",
    prompt: "reply",
    context: { model: "gpt", tone: "warm", locale: "English" },
  },
] as const;

/**
 * The contract: shipping a book as JSON to the browser must produce the same
 * resolved text as loading it from disk and resolving it. If this test fails,
 * the fix is in serialize/parse — not in the site.
 */
describe("demo book JSON round-trip", () => {
  for (const tc of CASES) {
    it(`matches CLI resolve for ${tc.book}/${tc.prompt}`, async () => {
      const fromDisk = await loadPrompts(`${examplesRoot}/${tc.book}`);
      const fromDiskResult = resolveBook(fromDisk, tc.prompt, tc.context);

      const json = JSON.parse(await readFile(`${publicRoot}/${tc.book}/book.json`, "utf8")) as BookJson;
      const fromJson = parseBookJson(json);
      const fromJsonResult = resolveBook(fromJson, tc.prompt, tc.context);

      expect(fromJsonResult.text).toBe(fromDiskResult.text);
      expect(fromJsonResult.trace.finalOrder).toEqual(fromDiskResult.trace.finalOrder);
      expect(fromJsonResult.trace.replaced).toEqual(fromDiskResult.trace.replaced);
      expect(fromJsonResult.trace.added).toEqual(fromDiskResult.trace.added);
      expect(fromJsonResult.trace.forbidden).toEqual(fromDiskResult.trace.forbidden);
    });
  }
});
