import { resolveBook } from "../resolve.js";
import { defaultAssertions } from "./assertions.js";
import type {
  Assertion,
  AssertionRegistry,
  AssertionResult,
  EvalInput,
  EvalReport,
  Fixture,
  FixtureResult,
} from "./types.js";

/** Run every assertion of a fixture against one model output. */
function runAssertions(output: string, asserts: Assertion[], registry: AssertionRegistry): AssertionResult[] {
  return asserts.map((assertion) => {
    const fn = registry[assertion.type];
    if (fn === undefined) {
      return { type: assertion.type, pass: false, message: `unknown assertion type "${assertion.type}"` };
    }
    return fn(output, assertion);
  });
}

/**
 * Run fixtures through a model adapter and report pass-rate.
 *
 * For each fixture: assemble the system prompt once via {@link resolveBook}
 * (deterministic — every sample of a fixture sees the same prompt), then take
 * N samples through `adapter.complete` and run the assertions on each. A sample
 * passes only when all its assertions pass; `passRate = passes / samples`. A
 * fixture meets the gate when `passRate >= passThreshold` (default 1).
 *
 * The engine is pure given the adapter: its control flow is deterministic and
 * the only stochasticity/IO is `adapter.complete`. It makes no network calls.
 */
export async function evaluate(input: EvalInput): Promise<EvalReport> {
  const registry = input.assertions ?? defaultAssertions();
  const defaultSamples = input.samples ?? 1;
  const threshold = input.passThreshold ?? 1;

  const results: FixtureResult[] = [];
  for (const fixture of input.fixtures) {
    results.push(await runFixture(fixture, input, registry, defaultSamples));
  }

  const passed = results.filter((r) => r.passRate >= threshold).length;
  return {
    results,
    passed,
    failed: results.length - passed,
    passRate: results.length === 0 ? 1 : passed / results.length,
  };
}

async function runFixture(
  fixture: Fixture,
  input: EvalInput,
  registry: AssertionRegistry,
  defaultSamples: number,
): Promise<FixtureResult> {
  const { text: system } = resolveBook(input.book, fixture.prompt, fixture.context ?? {});
  const samples = fixture.samples ?? defaultSamples;

  let passes = 0;
  const failures: AssertionResult[] = [];
  for (let i = 0; i < samples; i += 1) {
    const response = await input.adapter.complete({ system, input: fixture.input });
    const sampleResults = runAssertions(response.text, fixture.assert, registry);
    const failed = sampleResults.filter((r) => !r.pass);
    if (failed.length === 0) {
      passes += 1;
    } else {
      failures.push(...failed);
    }
  }

  return {
    name: fixture.name,
    samples,
    passes,
    passRate: samples === 0 ? 0 : passes / samples,
    failures,
  };
}
