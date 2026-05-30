import { describe, expect, it } from "vitest";
import { run } from "../src/run.js";
import { capture, fixtureDir } from "./helpers.js";

const dirty = fixtureDir("dirty");
const clean = fixtureDir("clean");

interface LintJson {
  findings: { ruleId: string; severity: string; fragmentId?: string; ruleIndex?: number }[];
  errorCount: number;
  warningCount: number;
}

describe("lint command", () => {
  it("reports the planted problems on the dirty fixture and exits non-zero", async () => {
    const cap = capture();
    const code = await run(["lint", "dirty", "--dir", dirty], cap.io);
    expect(code).toBe(1);
    const out = cap.out();
    expect(out).toContain("2 errors");
    expect(out).toContain("3 warnings");
    expect(out).toContain("banned-tokens");
    expect(out).toContain("dangling-reference");
    expect(out).toContain("language-directive-position");
    expect(out).toContain("example-balance");
    expect(out).toContain("unused-fragment");
  });

  it("emits the expected severities and locations as JSON", async () => {
    const cap = capture();
    const code = await run(["lint", "dirty", "--dir", dirty, "--json"], cap.io);
    expect(code).toBe(1);
    const report = JSON.parse(cap.out()) as LintJson;
    expect(report.errorCount).toBe(2);
    expect(report.warningCount).toBe(3);
    const byRule = new Map(report.findings.map((f) => [f.ruleId, f.severity]));
    expect(byRule.get("banned-tokens")).toBe("error");
    expect(byRule.get("dangling-reference")).toBe("error");
    expect(byRule.get("language-directive-position")).toBe("warning");
    expect(byRule.get("example-balance")).toBe("warning");
    expect(byRule.get("unused-fragment")).toBe("warning");
  });

  it("runs only book rules and exits non-zero without a prompt", async () => {
    const cap = capture();
    const code = await run(["lint", "--dir", dirty], cap.io);
    expect(code).toBe(1);
    const out = cap.out();
    // Book-scope findings appear.
    expect(out).toContain("dangling-reference");
    expect(out).toContain("unused-fragment");
    // Resolved-scope findings do not (no prompt was resolved).
    expect(out).not.toContain("banned-tokens");
    expect(out).not.toContain("example-balance");
  });

  it("reports no findings and exits 0 on the clean fixture", async () => {
    const cap = capture();
    const code = await run(["lint", "clean", "--dir", clean], cap.io);
    expect(code).toBe(0);
    expect(cap.out()).toContain("no findings");
    expect(cap.err()).toBe("");
  });

  it("clean fixture is also clean as raw JSON", async () => {
    const cap = capture();
    const code = await run(["lint", "clean", "--dir", clean, "--json"], cap.io);
    expect(code).toBe(0);
    const report = JSON.parse(cap.out()) as LintJson;
    expect(report).toEqual({ findings: [], errorCount: 0, warningCount: 0 });
  });

  it("fires token-budget at a low --max-tokens", async () => {
    const cap = capture();
    const code = await run(["lint", "clean", "--dir", clean, "--max-tokens", "1"], cap.io);
    // A warning alone keeps exit 0.
    expect(code).toBe(0);
    expect(cap.out()).toContain("token-budget");
  });

  it("fails on warnings under --strict", async () => {
    const cap = capture();
    const code = await run(["lint", "clean", "--dir", clean, "--max-tokens", "1", "--strict"], cap.io);
    expect(code).toBe(1);
    expect(cap.out()).toContain("token-budget");
  });

  it("fails with a clear message for an unknown prompt", async () => {
    const cap = capture();
    const code = await run(["lint", "nonexistent", "--dir", clean], cap.io);
    expect(code).toBe(1);
    expect(cap.out()).toBe("");
    expect(cap.err()).toContain('Unknown prompt "nonexistent"');
  });

  it("fails with a clear message for a missing prompts folder", async () => {
    const cap = capture();
    const code = await run(["lint", "--dir", "/no/such/place"], cap.io);
    expect(code).toBe(1);
    expect(cap.err()).toContain("prompts folder not found");
  });

  it("rejects a non-numeric --max-tokens", async () => {
    const cap = capture();
    const code = await run(["lint", "clean", "--dir", clean, "--max-tokens", "abc"], cap.io);
    expect(code).toBe(1);
    expect(cap.err()).toContain("invalid --max-tokens");
  });
});
