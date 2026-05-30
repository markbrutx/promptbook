import type { AssertionResult, EvalReport, FixtureResult } from "@promptbook/core";
import { makeStyle, plural, type Style } from "./style.js";

function rate(value: number): string {
  return value.toFixed(2);
}

/** One line per fixture plus indented failure details for the failed ones. */
function renderFixture(s: Style, fixture: FixtureResult, threshold: number): string[] {
  const ok = fixture.passRate >= threshold;
  const mark = ok ? s.green("✓") : s.red("✗");
  const head = `  ${mark} ${fixture.name}  passRate ${rate(fixture.passRate)} (${fixture.passes}/${fixture.samples})`;
  const lines = [head];
  if (!ok) {
    for (const failure of dedupeFailures(fixture.failures)) {
      lines.push(`      ${s.red(failure.type)}: ${failure.message}`);
      if (failure.excerpt !== undefined && failure.excerpt !== "") {
        lines.push(`        ${s.dim(`output: ${failure.excerpt}`)}`);
      }
    }
  }
  return lines;
}

/** Collapse identical failures (same type + message) repeated across samples. */
function dedupeFailures(failures: AssertionResult[]): AssertionResult[] {
  const seen = new Set<string>();
  const unique: AssertionResult[] = [];
  for (const failure of failures) {
    const key = `${failure.type}\u0000${failure.message}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(failure);
    }
  }
  return unique;
}

/**
 * Render an {@link EvalReport} as a human-readable block: a per-fixture line
 * (pass/fail mark, passRate, samples) with indented failing assertions and
 * output excerpts, then a summary line gated by `threshold`.
 */
export function renderEvalReport(report: EvalReport, threshold: number, color: boolean): string {
  const s = makeStyle(color);
  const lines: string[] = [s.bold("eval")];
  for (const fixture of report.results) {
    lines.push(...renderFixture(s, fixture, threshold));
  }
  const total = report.results.length;
  const summary = `${report.passed}/${total} fixtures passed (threshold ${rate(threshold)})`;
  const colored = report.failed > 0 ? s.red(summary) : s.green(summary);
  lines.push(`summary: ${colored}, ${plural(report.failed, "failure")}`);
  return `${lines.join("\n")}\n`;
}
