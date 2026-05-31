import { describe, expect, it } from "vitest";
import type { Annotation } from "../src/index.js";
import { parseInbox, serializeAnnotationLine, serializeInbox } from "../src/index.js";

function annotation(id: string, overrides: Partial<Annotation> = {}): Annotation {
  return {
    id,
    createdAt: "2026-05-31T00:00:00.000Z",
    target: { prompt: "assistant", context: { mode: "terse" } },
    anchor: { fragmentId: "voice", anchorText: "be concise" },
    comment: "tone is off here",
    status: "open",
    ...overrides,
  };
}

describe("parseInbox", () => {
  it("parses one annotation per non-empty line", () => {
    const text = `${serializeAnnotationLine(annotation("a"))}${serializeAnnotationLine(annotation("b"))}`;
    const parsed = parseInbox(text);
    expect(parsed.map((a) => a.id)).toEqual(["a", "b"]);
  });

  it("skips blank and malformed lines without throwing", () => {
    const text = ["", "not json", "{}", '{"id":"x"}', serializeAnnotationLine(annotation("ok")).trim()].join(
      "\n",
    );
    const parsed = parseInbox(text);
    // `{}` and `{"id":"x"}` lack the required anchor/comment shape and are dropped.
    expect(parsed.map((a) => a.id)).toEqual(["ok"]);
  });

  it("returns an empty list for empty input", () => {
    expect(parseInbox("")).toEqual([]);
    expect(parseInbox("\n  \n")).toEqual([]);
  });
});

describe("serializeInbox", () => {
  it("round-trips through parseInbox", () => {
    const items = [annotation("a"), annotation("b", { status: "resolved" })];
    expect(parseInbox(serializeInbox(items))).toEqual(items);
  });

  it("emits one newline-terminated line per annotation", () => {
    const text = serializeInbox([annotation("a"), annotation("b")]);
    expect(text.endsWith("\n")).toBe(true);
    expect(text.trim().split("\n")).toHaveLength(2);
  });

  it("is empty for an empty queue", () => {
    expect(serializeInbox([])).toBe("");
  });
});
