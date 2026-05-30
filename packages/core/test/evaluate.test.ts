import { describe, expect, it } from "vitest";
import type { AssertionRegistry, Fixture, ModelAdapter, ModelResponse } from "../src/index.js";
import { evaluate } from "../src/index.js";
import { book, composition, fragment } from "./helpers.js";

/** A book with one composition "greet" that interpolates a name. */
const greetBook = book([fragment("intro", "You greet ${who} warmly.")], [composition("greet", ["intro"])]);

/** An adapter that always returns the same text. */
function fixedAdapter(text: string): ModelAdapter {
  return { complete: async () => ({ text }) };
}

/** An adapter that returns `good` for the first `goodCount` calls, then `bad`. */
function flakyAdapter(good: string, bad: string, goodCount: number): ModelAdapter {
  let calls = 0;
  return {
    complete: async (): Promise<ModelResponse> => {
      calls += 1;
      return { text: calls <= goodCount ? good : bad };
    },
  };
}

const containsFixture = (name: string, value: string, samples?: number): Fixture => ({
  name,
  prompt: "greet",
  context: { who: "Ada" },
  input: "say hi",
  assert: [{ type: "contains", value }],
  ...(samples !== undefined ? { samples } : {}),
});

describe("evaluate", () => {
  it("passes a fixture whose assertion holds on the output", async () => {
    const report = await evaluate({
      book: greetBook,
      fixtures: [containsFixture("hit", "hello")],
      adapter: fixedAdapter("hello there"),
    });
    expect(report.passed).toBe(1);
    expect(report.failed).toBe(0);
    expect(report.passRate).toBe(1);
    expect(report.results[0]?.passRate).toBe(1);
    expect(report.results[0]?.failures).toEqual([]);
  });

  it("fails a fixture with a failing assertion and records the excerpt", async () => {
    const report = await evaluate({
      book: greetBook,
      fixtures: [containsFixture("miss", "absent")],
      adapter: fixedAdapter("hello there"),
    });
    expect(report.passed).toBe(0);
    expect(report.failed).toBe(1);
    expect(report.passRate).toBe(0);
    const failure = report.results[0]?.failures[0];
    expect(failure?.type).toBe("contains");
    expect(failure?.excerpt).toContain("hello there");
  });

  it("produces a fractional pass-rate with a flaky adapter", async () => {
    const report = await evaluate({
      book: greetBook,
      fixtures: [containsFixture("flaky", "hello", 4)],
      adapter: flakyAdapter("hello", "nope", 3),
    });
    const fixture = report.results[0];
    expect(fixture?.samples).toBe(4);
    expect(fixture?.passes).toBe(3);
    expect(fixture?.passRate).toBe(0.75);
  });

  it("gates on passThreshold: 0.75 passes at 0.7, fails at 0.8", async () => {
    const args = {
      book: greetBook,
      fixtures: [containsFixture("flaky", "hello", 4)],
    };
    const lenient = await evaluate({
      ...args,
      adapter: flakyAdapter("hello", "nope", 3),
      passThreshold: 0.7,
    });
    expect(lenient.passed).toBe(1);
    const strict = await evaluate({ ...args, adapter: flakyAdapter("hello", "nope", 3), passThreshold: 0.8 });
    expect(strict.failed).toBe(1);
  });

  it("uses the same system prompt across all samples (resolve is deterministic)", async () => {
    const seen: string[] = [];
    const adapter: ModelAdapter = {
      complete: async (req) => {
        seen.push(req.system);
        return { text: "hello" };
      },
    };
    await evaluate({
      book: greetBook,
      fixtures: [containsFixture("repeat", "hello", 3)],
      adapter,
    });
    expect(seen).toHaveLength(3);
    expect(new Set(seen).size).toBe(1);
    expect(seen[0]).toBe("You greet Ada warmly.");
  });

  it("accepts a custom assertion registry", async () => {
    const registry: AssertionRegistry = {
      "starts-with": (output, a) => ({
        type: "starts-with",
        pass: output.startsWith(a.value ?? ""),
        message: "prefix check",
      }),
    };
    const fixture: Fixture = {
      name: "custom",
      prompt: "greet",
      context: { who: "Ada" },
      input: "hi",
      assert: [{ type: "starts-with", value: "hello" }],
    };
    const report = await evaluate({
      book: greetBook,
      fixtures: [fixture],
      adapter: fixedAdapter("hello world"),
      assertions: registry,
    });
    expect(report.passed).toBe(1);
  });

  it("marks an unknown assertion type as a failure rather than throwing", async () => {
    const fixture: Fixture = {
      name: "weird",
      prompt: "greet",
      context: { who: "Ada" },
      input: "hi",
      assert: [{ type: "nonexistent" }],
    };
    const report = await evaluate({
      book: greetBook,
      fixtures: [fixture],
      adapter: fixedAdapter("hello"),
    });
    expect(report.failed).toBe(1);
    expect(report.results[0]?.failures[0]?.message).toContain("unknown assertion type");
  });

  it("propagates an unknown-prompt error from resolveBook", async () => {
    const fixture: Fixture = { name: "x", prompt: "missing", input: "hi", assert: [{ type: "json-valid" }] };
    await expect(
      evaluate({ book: greetBook, fixtures: [fixture], adapter: fixedAdapter("{}") }),
    ).rejects.toThrow(/Unknown prompt "missing"/);
  });

  it("returns an empty, passing report for no fixtures", async () => {
    const report = await evaluate({ book: greetBook, fixtures: [], adapter: fixedAdapter("") });
    expect(report).toEqual({ results: [], passed: 0, failed: 0, passRate: 1 });
  });
});
