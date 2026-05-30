import { describe, expect, it } from "vitest";
import { resolve, resolveBook } from "../src/index.js";
import { book, composition, fixtureDir, fragment } from "./helpers.js";

describe("explain trace", () => {
  it("records each rule with fired/why", () => {
    const b = book(
      [fragment("a", "A"), fragment("b", "B"), fragment("x", "X")],
      [
        composition(
          "p",
          ["a", "b"],
          [
            { index: 0, when: { mode: "terse" }, action: "add", add: ["x"], after: "a" },
            { index: 1, when: { locale: "ru" }, action: "add", add: ["x"], after: "b" },
          ],
        ),
      ],
    );
    const { trace } = resolveBook(b, "p", { mode: "terse" });
    const [r0, r1] = trace.rules;
    expect(r0?.fired).toBe(true);
    expect(r0?.effect).toContain("add x");
    expect(r1?.fired).toBe(false);
    expect(r1?.reason).toContain("locale");
  });

  it("explains why a rule did not fire because of a value mismatch", () => {
    const b = book(
      [fragment("a", "A")],
      [composition("p", ["a"], [{ index: 0, when: { mode: "terse" }, action: "forbid", forbid: ["a"] }])],
    );
    const { trace } = resolveBook(b, "p", { mode: "plain" });
    expect(trace.rules[0]?.fired).toBe(false);
    expect(trace.rules[0]?.reason).toContain('context.mode="plain"');
  });

  it("flags a context axis that no rule matched (zoo style hole)", async () => {
    const dir = fixtureDir("regions");
    const matched = await resolve({ promptsDir: dir, prompt: "profile", context: { industry: "tech" } });
    expect(matched.trace.unmatchedAxes).toEqual([]);
    expect(matched.trace.finalOrder).toEqual(["base-intro", "tech-note"]);

    const hole = await resolve({ promptsDir: dir, prompt: "profile", context: { industry: "zoo" } });
    expect(hole.trace.unmatchedAxes).toEqual([{ key: "industry", value: "zoo" }]);
    expect(hole.trace.finalOrder).toEqual(["base-intro"]);
  });

  it("does not flag a context key that no rule references", async () => {
    const dir = fixtureDir("regions");
    const result = await resolve({ promptsDir: dir, prompt: "profile", context: { locale: "ru" } });
    expect(result.trace.unmatchedAxes).toEqual([]);
  });

  it("collects warnings for missing variables and unknown fragment refs", () => {
    const b = book([fragment("a", "Hi ${name}")], [composition("p", ["a", "ghost"])]);
    const { trace } = resolveBook(b, "p", {});
    expect(trace.warnings).toHaveLength(2);
    expect(trace.warnings.some((w) => w.includes("Missing variable"))).toBe(true);
    expect(trace.warnings.some((w) => w.includes("ghost"))).toBe(true);
  });
});
