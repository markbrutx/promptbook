import type { ModelAdapter } from "@promptbook/core";
import { afterEach, describe, expect, it } from "vitest";
import type { IO } from "../src/io.js";
import { run } from "../src/run.js";
import { capture, fixtureDir, promptsDir } from "./helpers.js";

/** A fake adapter that echoes the user input back as the model output. */
const echo: NonNullable<IO["makeAdapter"]> = () => ({
  complete: async (req) => ({ text: req.input }),
});

/** Adapter that fails the test if the model is ever called. */
const neverCall: NonNullable<IO["makeAdapter"]> = () => ({
  complete: async () => {
    throw new Error("adapter should not be called");
  },
});

/** A fake adapter that returns `good` for the first N calls, then `bad`. */
function flakyMake(good: string, bad: string, goodCount: number): NonNullable<IO["makeAdapter"]> {
  return () => {
    let calls = 0;
    const adapter: ModelAdapter = {
      complete: async () => {
        calls += 1;
        return { text: calls <= goodCount ? good : bad };
      },
    };
    return adapter;
  };
}

interface EvalJson {
  results: { name: string; samples: number; passes: number; passRate: number }[];
  passRate: number;
  passed: number;
  failed: number;
}

const SAVED_KEY = process.env.OPENROUTER_API_KEY;
afterEach(() => {
  if (SAVED_KEY === undefined) {
    delete process.env.OPENROUTER_API_KEY;
  } else {
    process.env.OPENROUTER_API_KEY = SAVED_KEY;
  }
});

describe("eval command", () => {
  it("passes a fixture whose assertion holds and exits 0", async () => {
    const cap = capture({ makeAdapter: echo });
    const code = await run(["eval", "greeting", "--dir", promptsDir], cap.io);
    expect(code).toBe(0);
    const out = cap.out();
    expect(out).toContain("greeting");
    expect(out).toContain("passRate 1.00");
    expect(out).toContain("1/1 fixtures passed");
  });

  it("fails a fixture with a failing assertion and shows the excerpt", async () => {
    const cap = capture({ makeAdapter: echo });
    const code = await run(["eval", "missing", "--dir", promptsDir], cap.io);
    expect(code).toBe(1);
    const out = cap.out();
    expect(out).toContain("missing");
    expect(out).toContain("contains");
    expect(out).toContain("absent-token");
    expect(out).toContain("plain text output");
  });

  it("treats a cyrillic output as language ru", async () => {
    const cap = capture({ makeAdapter: echo });
    const code = await run(["eval", "russian", "--dir", promptsDir], cap.io);
    expect(code).toBe(0);
    expect(cap.out()).toContain("russian");
  });

  it("emits a parseable EvalReport with --json", async () => {
    const cap = capture({ makeAdapter: echo });
    const code = await run(["eval", "greeting", "--dir", promptsDir, "--json"], cap.io);
    expect(code).toBe(0);
    const report = JSON.parse(cap.out()) as EvalJson;
    expect(report.passed).toBe(1);
    expect(report.failed).toBe(0);
    expect(report.results[0]?.name).toBe("greeting");
    expect(report.results[0]?.passRate).toBe(1);
  });

  it("produces a fractional passRate with a flaky adapter and gates on threshold", async () => {
    const adapter = flakyMake("ok", "no", 3);

    const strict = capture({ makeAdapter: adapter });
    const strictCode = await run(["eval", "flaky", "--dir", promptsDir, "--json"], strict.io);
    expect(strictCode).toBe(1); // 0.75 < default threshold 1
    const strictReport = JSON.parse(strict.out()) as EvalJson;
    expect(strictReport.results[0]?.passRate).toBe(0.75);
    expect(strictReport.results[0]?.passes).toBe(3);

    const lenient = capture({ makeAdapter: flakyMake("ok", "no", 3) });
    const lenientCode = await run(["eval", "flaky", "--dir", promptsDir, "--threshold", "0.7"], lenient.io);
    expect(lenientCode).toBe(0);
    expect(lenient.out()).toContain("passRate 0.75");
  });

  it("uses --samples as the default for fixtures that set none", async () => {
    const cap = capture({ makeAdapter: flakyMake("ok", "no", 1) });
    const code = await run(
      ["eval", "default-samples", "--dir", promptsDir, "--samples", "2", "--threshold", "0.5"],
      cap.io,
    );
    expect(code).toBe(0);
    expect(cap.out()).toContain("(1/2)");
  });

  it("lets a fixture's own samples win over --samples", async () => {
    const cap = capture({ makeAdapter: flakyMake("ok", "no", 3) });
    const code = await run(["eval", "flaky", "--dir", promptsDir, "--samples", "1", "--json"], cap.io);
    expect(code).toBe(1);
    const report = JSON.parse(cap.out()) as EvalJson;
    // The fixture declares samples: 4, so --samples 1 does not shrink it.
    expect(report.results[0]?.samples).toBe(4);
  });

  it("matches fixtures by glob", async () => {
    const cap = capture({ makeAdapter: echo });
    const code = await run(["eval", "rus*", "--dir", promptsDir, "--json"], cap.io);
    expect(code).toBe(0);
    const report = JSON.parse(cap.out()) as EvalJson;
    expect(report.results.map((r) => r.name)).toEqual(["russian"]);
  });

  it("errors for a filter that matches no fixtures", async () => {
    const cap = capture({ makeAdapter: echo });
    const code = await run(["eval", "nope", "--dir", promptsDir], cap.io);
    expect(code).toBe(1);
    expect(cap.err()).toContain('no fixtures match "nope"');
  });

  it("errors for a missing prompts folder", async () => {
    const cap = capture({ makeAdapter: echo });
    const code = await run(["eval", "--dir", "/no/such/place"], cap.io);
    expect(code).toBe(1);
    expect(cap.err()).toContain("prompts folder not found");
  });

  it("errors when no model is configured and no adapter is injected", async () => {
    delete process.env.OPENROUTER_API_KEY;
    const cap = capture(); // no makeAdapter -> real OpenRouter path
    const code = await run(["eval", "greeting", "--dir", promptsDir], cap.io);
    expect(code).toBe(1);
    expect(cap.err()).toContain("eval requires a model");
  });

  it("errors when a model is set but no API key is available", async () => {
    delete process.env.OPENROUTER_API_KEY;
    const cap = capture({ env: {} });
    const code = await run(["eval", "greeting", "--dir", promptsDir, "--model", "test/model"], cap.io);
    expect(code).toBe(1);
    expect(cap.err()).toContain("API key missing");
  });

  it("runs the lint gate before sampling and passes a clean book through", async () => {
    const cap = capture({ makeAdapter: echo });
    const code = await run(["eval", "greeting", "--dir", promptsDir, "--lint"], cap.io);
    expect(code).toBe(0);
    expect(cap.out()).toContain("1/1 fixtures passed");
  });

  it("aborts before sampling when --lint finds an error", async () => {
    const cap = capture({ makeAdapter: neverCall });
    const code = await run(["eval", "--dir", fixtureDir("lint-gate"), "--lint"], cap.io);
    expect(code).toBe(1);
    expect(cap.err()).toContain("lint gate failed");
    expect(cap.err()).toContain("dangling-reference");
    expect(cap.out()).toBe("");
  });

  it("rejects an invalid --threshold and --samples", async () => {
    const bad = capture({ makeAdapter: echo });
    expect(await run(["eval", "greeting", "--dir", promptsDir, "--threshold", "2"], bad.io)).toBe(1);
    expect(bad.err()).toContain("invalid --threshold");

    const bad2 = capture({ makeAdapter: echo });
    expect(await run(["eval", "greeting", "--dir", promptsDir, "--samples", "0"], bad2.io)).toBe(1);
    expect(bad2.err()).toContain("invalid --samples");
  });
});
