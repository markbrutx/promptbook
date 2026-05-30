import { describe, expect, it } from "vitest";
import { type Rule, resolveBook } from "../src/index.js";
import { book, composition, fragment } from "./helpers.js";

const frags = [
  fragment("a", "AAA"),
  fragment("b", "BBB"),
  fragment("c", "CCC"),
  fragment("a2", "A2"),
  fragment("x", "XXX"),
];

function rule(partial: Omit<Rule, "index">, index: number): Rule {
  return { index, ...partial };
}

describe("resolveBook actions", () => {
  it("uses base order when no rules fire", () => {
    const b = book(frags, [composition("p", ["a", "b", "c"])]);
    const { text, trace } = resolveBook(b, "p", {});
    expect(trace.finalOrder).toEqual(["a", "b", "c"]);
    expect(text).toBe("AAA\n\nBBB\n\nCCC");
  });

  it("replace swaps an id in place, keeping position", () => {
    const rules = [rule({ when: {}, action: "replace", replace: { a: "a2" } }, 0)];
    const b = book(frags, [composition("p", ["a", "b", "c"], rules)]);
    const { trace } = resolveBook(b, "p", {});
    expect(trace.finalOrder).toEqual(["a2", "b", "c"]);
    expect(trace.replaced).toEqual([{ from: "a", to: "a2", ruleIndex: 0 }]);
  });

  it("add without an anchor inserts before the last fragment", () => {
    const rules = [rule({ when: {}, action: "add", add: ["x"] }, 0)];
    const b = book(frags, [composition("p", ["a", "b", "c"], rules)]);
    const { trace } = resolveBook(b, "p", {});
    expect(trace.finalOrder).toEqual(["a", "b", "x", "c"]);
    expect(trace.added).toEqual([{ id: "x", ruleIndex: 0 }]);
  });

  it("add with an anchor inserts right after it", () => {
    const rules = [rule({ when: {}, action: "add", add: ["x"], after: "a" }, 0)];
    const b = book(frags, [composition("p", ["a", "b", "c"], rules)]);
    const { trace } = resolveBook(b, "p", {});
    expect(trace.finalOrder).toEqual(["a", "x", "b", "c"]);
    expect(trace.added).toEqual([{ id: "x", after: "a", ruleIndex: 0 }]);
  });

  it("forbid wins even when the id was added by an earlier rule", () => {
    const rules = [
      rule({ when: {}, action: "add", add: ["x"], after: "a" }, 0),
      rule({ when: {}, action: "forbid", forbid: ["x"] }, 1),
    ];
    const b = book(frags, [composition("p", ["a", "b", "c"], rules)]);
    const { trace } = resolveBook(b, "p", {});
    expect(trace.finalOrder).toEqual(["a", "b", "c"]);
    expect(trace.forbidden).toEqual([{ id: "x", ruleIndex: 1 }]);
  });

  it("forbid also removes a base fragment", () => {
    const rules = [rule({ when: {}, action: "forbid", forbid: ["b"] }, 0)];
    const b = book(frags, [composition("p", ["a", "b", "c"], rules)]);
    const { trace } = resolveBook(b, "p", {});
    expect(trace.finalOrder).toEqual(["a", "c"]);
  });

  it("order override reorders present fragments", () => {
    const b = book(frags, [composition("p", ["a", "b", "c"], [], ["c", "a", "b"])]);
    const { trace } = resolveBook(b, "p", {});
    expect(trace.finalOrder).toEqual(["c", "a", "b"]);
  });

  it("cascade: later replace wins", () => {
    const rules = [
      rule({ when: {}, action: "replace", replace: { a: "a2" } }, 0),
      rule({ when: {}, action: "replace", replace: { a2: "x" } }, 1),
    ];
    const b = book(frags, [composition("p", ["a", "b"], rules)]);
    const { trace } = resolveBook(b, "p", {});
    expect(trace.finalOrder).toEqual(["x", "b"]);
  });

  it("matches when by equality and treats absent when keys as wildcards", () => {
    const rules = [rule({ when: { mode: "terse" }, action: "add", add: ["x"], after: "a" }, 0)];
    const b = book(frags, [composition("p", ["a", "b"], rules)]);
    expect(resolveBook(b, "p", { mode: "terse", locale: "ru" }).trace.finalOrder).toEqual(["a", "x", "b"]);
    expect(resolveBook(b, "p", { mode: "plain" }).trace.finalOrder).toEqual(["a", "b"]);
  });

  it("does not throw on a missing variable and records a warning", () => {
    const b = book([fragment("a", "Hi ${name}")], [composition("p", ["a"])]);
    const { text, trace } = resolveBook(b, "p", {});
    expect(text).toBe("Hi ");
    expect(trace.warnings.some((w) => w.includes("Missing variable") && w.includes("name"))).toBe(true);
  });

  it("warns about references to unknown fragments instead of throwing", () => {
    const b = book([fragment("a", "AAA")], [composition("p", ["a", "ghost"])]);
    const { text, trace } = resolveBook(b, "p", {});
    expect(text).toBe("AAA");
    expect(trace.warnings.some((w) => w.includes("ghost") && w.includes("was not found"))).toBe(true);
  });

  it("is deterministic: same input yields byte-identical text", () => {
    const rules = [
      rule({ when: { mode: "terse" }, action: "replace", replace: { a: "a2" } }, 0),
      rule({ when: { mode: "terse" }, action: "add", add: ["x"], after: "b" }, 1),
    ];
    const b = book(frags, [composition("p", ["a", "b", "c"], rules)]);
    const first = resolveBook(b, "p", { mode: "terse" });
    const second = resolveBook(b, "p", { mode: "terse" });
    expect(first.text).toBe(second.text);
    expect(JSON.stringify(first.trace)).toBe(JSON.stringify(second.trace));
  });

  it("throws on an unknown prompt name", () => {
    const b = book(frags, [composition("p", ["a"])]);
    expect(() => resolveBook(b, "nope", {})).toThrow(/Unknown prompt "nope"/);
  });
});
