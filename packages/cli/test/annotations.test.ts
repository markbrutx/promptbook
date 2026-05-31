import type { Annotation } from "@markbrutx/promptbook-core";
import { describe, expect, it } from "vitest";
import { run } from "../src/run.js";
import { capture, memoryFs } from "./helpers.js";

const DIR = "/prompts";
const QUEUE = `${DIR}/.annotations/inbox.jsonl`;

function annotation(id: string, overrides: Partial<Annotation> = {}): Annotation {
  return {
    id,
    createdAt: "2026-05-31T00:00:00.000Z",
    target: { prompt: "assistant", context: { mode: "terse" } },
    anchor: { fragmentId: "voice", anchorText: "be concise" },
    comment: `comment ${id}`,
    status: "open",
    ...overrides,
  };
}

/** A capture seeded with a queue file so `requirePromptsDir` + reads succeed. */
function seeded(annotations: Annotation[]) {
  const jsonl = annotations.map((a) => JSON.stringify(a)).join("\n");
  return capture({ fs: memoryFs({ [QUEUE]: jsonl }) });
}

describe("annotations command", () => {
  it("lists open annotations in human form", async () => {
    const cap = seeded([annotation("a1"), annotation("a2")]);
    const code = await run(["annotations", "list", "--dir", DIR], cap.io);
    expect(code).toBe(0);
    expect(cap.out()).toContain("a1");
    expect(cap.out()).toContain("assistant @ mode=terse");
    expect(cap.out()).toContain("be concise");
    expect(cap.err()).toBe("");
  });

  it("defaults to the list action", async () => {
    const cap = seeded([annotation("a1")]);
    const code = await run(["annotations", "--dir", DIR], cap.io);
    expect(code).toBe(0);
    expect(cap.out()).toContain("a1");
  });

  it("emits JSON of only open annotations", async () => {
    const cap = seeded([annotation("a1"), annotation("done", { status: "resolved" })]);
    const code = await run(["annotations", "list", "--json", "--dir", DIR], cap.io);
    expect(code).toBe(0);
    const parsed = JSON.parse(cap.out()) as Annotation[];
    expect(parsed.map((a) => a.id)).toEqual(["a1"]);
  });

  it("reports an empty queue", async () => {
    const cap = capture({ fs: memoryFs({ [QUEUE]: "" }) });
    const code = await run(["annotations", "list", "--dir", DIR], cap.io);
    expect(code).toBe(0);
    expect(cap.out()).toContain("No open annotations");
  });

  it("resolves one annotation by rewriting the queue", async () => {
    const cap = seeded([annotation("a1"), annotation("a2")]);
    const code = await run(["annotations", "resolve", "a1", "--dir", DIR], cap.io);
    expect(code).toBe(0);
    expect(cap.out()).toContain("Resolved a1");
    const written = cap.files()[QUEUE];
    expect(written).toBeDefined();
    const ids = (written ?? "")
      .trim()
      .split("\n")
      .map((line) => (JSON.parse(line) as Annotation).id);
    expect(ids).toEqual(["a2"]);
  });

  it("errors when resolving an unknown id", async () => {
    const cap = seeded([annotation("a1")]);
    const code = await run(["annotations", "resolve", "nope", "--dir", DIR], cap.io);
    expect(code).toBe(1);
    expect(cap.err()).toContain('no annotation with id "nope"');
  });

  it("errors when resolve is missing an id", async () => {
    const cap = seeded([annotation("a1")]);
    const code = await run(["annotations", "resolve", "--dir", DIR], cap.io);
    expect(code).toBe(1);
    expect(cap.err()).toContain("needs an <id>");
  });

  it("clears the whole queue", async () => {
    const cap = seeded([annotation("a1"), annotation("a2")]);
    const code = await run(["annotations", "clear", "--dir", DIR], cap.io);
    expect(code).toBe(0);
    expect(cap.out()).toContain("Cleared 2 annotations");
    expect(cap.files()[QUEUE]).toBe("");
  });

  it("rejects an unknown action", async () => {
    const cap = seeded([annotation("a1")]);
    const code = await run(["annotations", "frob", "--dir", DIR], cap.io);
    expect(code).toBe(1);
    expect(cap.err()).toContain('unknown annotations action "frob"');
  });
});
