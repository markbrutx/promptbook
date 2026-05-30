import { describe, expect, it } from "vitest";
import type { PromptBook, ResolveResult } from "../src/index.js";
import {
  bannedTokens,
  danglingReference,
  deadRule,
  defaultRules,
  estimateTokensByChars,
  exampleBalance,
  type LintInput,
  type LintRule,
  languageDirectivePosition,
  lint,
  resolveBook,
  tokenBudget,
  unusedFragment,
} from "../src/index.js";
import { book, composition, fragment } from "./helpers.js";

/** Resolve a composition in a book and return `{ book, result }` for lint. */
function resolved(b: PromptBook, prompt: string, context = {}): LintInput {
  return { book: b, result: resolveBook(b, prompt, context) };
}

describe("lint engine dispatch", () => {
  const b = book([fragment("a", "hello"), fragment("orphan", "unused")], [composition("c", ["a"])]);

  it("runs book rules but skips resolved rules without a result", () => {
    const calls: string[] = [];
    const bookRule: LintRule = {
      id: "book-probe",
      description: "",
      scope: "book",
      check() {
        calls.push("book");
        return [];
      },
    };
    const resolvedRule: LintRule = {
      id: "resolved-probe",
      description: "",
      scope: "resolved",
      check() {
        calls.push("resolved");
        return [];
      },
    };
    lint({ book: b }, [bookRule, resolvedRule]);
    expect(calls).toEqual(["book"]);
  });

  it("runs resolved rules when a result is present", () => {
    const calls: string[] = [];
    const resolvedRule: LintRule = {
      id: "resolved-probe",
      description: "",
      scope: "resolved",
      check() {
        calls.push("resolved");
        return [];
      },
    };
    lint(resolved(b, "c"), [resolvedRule]);
    expect(calls).toEqual(["resolved"]);
  });

  it("aggregates error and warning counts", () => {
    const rule: LintRule = {
      id: "fixed",
      description: "",
      scope: "book",
      check() {
        return [
          { ruleId: "fixed", severity: "error", message: "e1" },
          { ruleId: "fixed", severity: "warning", message: "w1" },
          { ruleId: "fixed", severity: "info", message: "i1" },
        ];
      },
    };
    const report = lint({ book: b }, [rule]);
    expect(report.findings).toHaveLength(3);
    expect(report.errorCount).toBe(1);
    expect(report.warningCount).toBe(1);
  });

  it("executes a caller-supplied custom rule", () => {
    const custom: LintRule = {
      id: "no-empty",
      description: "fragment bodies must be non-empty",
      scope: "book",
      check(input) {
        const findings = [];
        for (const fragmentEntry of input.book.fragments.values()) {
          if (fragmentEntry.body.trim() === "") {
            findings.push({
              ruleId: "no-empty",
              severity: "error" as const,
              message: `empty ${fragmentEntry.id}`,
            });
          }
        }
        return findings;
      },
    };
    const withEmpty = book([fragment("a", "  ")], [composition("c", ["a"])]);
    const report = lint({ book: withEmpty }, [custom]);
    expect(report.errorCount).toBe(1);
    expect(report.findings[0]?.message).toBe("empty a");
  });
});

describe("token-budget", () => {
  const b = book([fragment("a", "x".repeat(400))], [composition("c", ["a"])]);

  it("estimates ~4 chars per token", () => {
    expect(estimateTokensByChars("")).toBe(0);
    expect(estimateTokensByChars("abcd")).toBe(1);
    expect(estimateTokensByChars("abcde")).toBe(2);
  });

  it("fires when the estimate exceeds the budget", () => {
    const report = lint(resolved(b, "c"), [tokenBudget({ maxTokens: 10 })]);
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0]?.ruleId).toBe("token-budget");
  });

  it("stays silent under the budget", () => {
    const report = lint(resolved(b, "c"), [tokenBudget({ maxTokens: 10000 })]);
    expect(report.findings).toHaveLength(0);
  });

  it("accepts an injected token counter", () => {
    const report = lint(resolved(b, "c"), [tokenBudget({ maxTokens: 5, estimateTokens: () => 6 })]);
    expect(report.findings).toHaveLength(1);
  });
});

describe("language-directive-position", () => {
  function makeBook(order: string[]): PromptBook {
    const frags = order.map((id) =>
      id === "lang" ? fragment("lang", "respond in lang", { kind: "language-directive" }) : fragment(id, id),
    );
    return book(frags, [composition("c", order)]);
  }

  it("flags a directive buried in the middle", () => {
    const report = lint(resolved(makeBook(["a", "b", "lang", "c", "d"]), "c"), [languageDirectivePosition()]);
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0]?.fragmentId).toBe("lang");
  });

  it("accepts a directive at the front edge", () => {
    const report = lint(resolved(makeBook(["lang", "a", "b", "c", "d"]), "c"), [languageDirectivePosition()]);
    expect(report.findings).toHaveLength(0);
  });

  it("accepts a directive at the back edge", () => {
    const report = lint(resolved(makeBook(["a", "b", "c", "d", "lang"]), "c"), [languageDirectivePosition()]);
    expect(report.findings).toHaveLength(0);
  });
});

describe("example-balance", () => {
  function exampleBook(groups: Record<string, number>): PromptBook {
    const frags = [];
    const ids: string[] = [];
    for (const [group, count] of Object.entries(groups)) {
      for (let i = 0; i < count; i += 1) {
        const id = `${group}-${i}`;
        ids.push(id);
        frags.push(fragment(id, id, { kind: "example", tags: [`case:${group}`] }));
      }
    }
    return book(frags, [composition("c", ids)]);
  }

  it("flags a skewed group distribution", () => {
    const report = lint(resolved(exampleBook({ positive: 3, negative: 1 }), "c"), [exampleBalance()]);
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0]?.ruleId).toBe("example-balance");
  });

  it("passes a balanced distribution", () => {
    const report = lint(resolved(exampleBook({ positive: 2, negative: 2 }), "c"), [exampleBalance()]);
    expect(report.findings).toHaveLength(0);
  });

  it("ignores a single group", () => {
    const report = lint(resolved(exampleBook({ positive: 5 }), "c"), [exampleBalance()]);
    expect(report.findings).toHaveLength(0);
  });
});

describe("banned-tokens", () => {
  it("flags the default em-dash", () => {
    const b = book([fragment("a", "one \u2014 two")], [composition("c", ["a"])]);
    const report = lint(resolved(b, "c"), [bannedTokens()]);
    expect(report.errorCount).toBe(1);
    expect(report.findings[0]?.ruleId).toBe("banned-tokens");
  });

  it("supports custom substrings and regex", () => {
    const b = book([fragment("a", "score: 9000")], [composition("c", ["a"])]);
    const report = lint(resolved(b, "c"), [bannedTokens({ tokens: ["score", /\d{4}/] })]);
    expect(report.findings).toHaveLength(2);
  });

  it("passes clean text", () => {
    const b = book([fragment("a", "all good here")], [composition("c", ["a"])]);
    const report = lint(resolved(b, "c"), [bannedTokens()]);
    expect(report.findings).toHaveLength(0);
  });
});

describe("unused-fragment", () => {
  it("flags a fragment no composition references", () => {
    const b = book([fragment("a", "a"), fragment("orphan", "o")], [composition("c", ["a"])]);
    const report = lint({ book: b }, [unusedFragment()]);
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0]?.fragmentId).toBe("orphan");
  });

  it("treats replace/add references as usage", () => {
    const b = book(
      [fragment("a", "a"), fragment("b", "b"), fragment("c", "c")],
      [
        composition(
          "comp",
          ["a"],
          [
            { index: 0, when: {}, action: "replace", replace: { a: "b" } },
            { index: 1, when: {}, action: "add", add: ["c"] },
          ],
        ),
      ],
    );
    const report = lint({ book: b }, [unusedFragment()]);
    expect(report.findings).toHaveLength(0);
  });
});

describe("dangling-reference", () => {
  it("flags a base reference to a missing fragment", () => {
    const b = book([fragment("a", "a")], [composition("c", ["a", "ghost"])]);
    const report = lint({ book: b }, [danglingReference()]);
    expect(report.errorCount).toBe(1);
    expect(report.findings[0]?.fragmentId).toBe("ghost");
  });

  it("flags a rule reference to a missing fragment with the rule index", () => {
    const b = book(
      [fragment("a", "a")],
      [composition("c", ["a"], [{ index: 2, when: {}, action: "add", add: ["ghost"] }])],
    );
    const report = lint({ book: b }, [danglingReference()]);
    expect(report.findings[0]?.ruleIndex).toBe(2);
  });
});

describe("dead-rule", () => {
  it("flags a replace whose source is never present", () => {
    const b = book(
      [fragment("a", "a"), fragment("b", "b")],
      [composition("c", ["a"], [{ index: 0, when: {}, action: "replace", replace: { missing: "b" } }])],
    );
    const report = lint({ book: b }, [deadRule()]);
    expect(report.warningCount).toBe(1);
    expect(report.findings[0]?.message).toContain("never present");
  });

  it("flags an add of an already-present id", () => {
    const b = book(
      [fragment("a", "a")],
      [composition("c", ["a"], [{ index: 0, when: {}, action: "add", add: ["a"] }])],
    );
    const report = lint({ book: b }, [deadRule()]);
    expect(report.findings[0]?.message).toContain("already present");
  });

  it("accepts a replace whose source was added by an earlier rule", () => {
    const b = book(
      [fragment("a", "a"), fragment("b", "b"), fragment("c", "c")],
      [
        composition(
          "comp",
          ["a"],
          [
            { index: 0, when: {}, action: "add", add: ["b"] },
            { index: 1, when: {}, action: "replace", replace: { b: "c" } },
          ],
        ),
      ],
    );
    const report = lint({ book: b }, [deadRule()]);
    expect(report.findings).toHaveLength(0);
  });
});

describe("defaultRules", () => {
  it("threads maxTokens through to token-budget", () => {
    const result: ResolveResult = {
      text: "x".repeat(400),
      trace: {
        prompt: "c",
        context: {},
        rules: [],
        finalOrder: ["a"],
        replaced: [],
        added: [],
        forbidden: [],
        unmatchedAxes: [],
        warnings: [],
      },
    };
    const b = book([fragment("a", "x".repeat(400))], [composition("c", ["a"])]);
    const tight = lint({ book: b, result }, defaultRules({ maxTokens: 10 }));
    expect(tight.findings.some((f) => f.ruleId === "token-budget")).toBe(true);
    const loose = lint({ book: b, result }, defaultRules({ maxTokens: 10000 }));
    expect(loose.findings.some((f) => f.ruleId === "token-budget")).toBe(false);
  });
});
