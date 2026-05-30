import { describe, expect, it } from "vitest";
import { diffLines } from "../src/web/diff.js";

describe("diffLines", () => {
  it("marks shared lines equal and changed lines add/remove", () => {
    const rows = diffLines("a\nb\nc", "a\nx\nc");
    expect(rows).toEqual([
      { type: "equal", text: "a" },
      { type: "remove", text: "b" },
      { type: "add", text: "x" },
      { type: "equal", text: "c" },
    ]);
  });

  it("treats identical text as all equal", () => {
    const rows = diffLines("one\ntwo", "one\ntwo");
    expect(rows.every((r) => r.type === "equal")).toBe(true);
  });

  it("handles pure additions", () => {
    const rows = diffLines("", "new");
    expect(rows).toEqual([
      { type: "remove", text: "" },
      { type: "add", text: "new" },
    ]);
  });
});
