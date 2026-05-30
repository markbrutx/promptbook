import { describe, expect, it } from "vitest";
import { run } from "../src/run.js";
import { capture } from "./helpers.js";

describe("run: top-level dispatch", () => {
  it("prints help and exits 0 for --help", async () => {
    const cap = capture();
    const code = await run(["--help"], cap.io);
    expect(code).toBe(0);
    expect(cap.out()).toContain("Usage:");
    expect(cap.out()).toContain("resolve <prompt>");
    expect(cap.out()).toContain("ls");
    expect(cap.err()).toBe("");
  });

  it("prints help and exits 0 when no command is given", async () => {
    const cap = capture();
    const code = await run([], cap.io);
    expect(code).toBe(0);
    expect(cap.out()).toContain("Usage:");
  });

  it("prints a semver-looking version for --version", async () => {
    const cap = capture();
    const code = await run(["--version"], cap.io);
    expect(code).toBe(0);
    expect(cap.out().trim()).toMatch(/^\d+\.\d+\.\d+/);
    expect(cap.err()).toBe("");
  });

  it("errors with non-zero exit for an unknown command", async () => {
    const cap = capture();
    const code = await run(["frobnicate"], cap.io);
    expect(code).toBe(1);
    expect(cap.err()).toContain('unknown command "frobnicate"');
    expect(cap.out()).toBe("");
  });

  it("errors with non-zero exit for an unknown flag", async () => {
    const cap = capture();
    const code = await run(["resolve", "assistant", "--nope"], cap.io);
    expect(code).toBe(1);
    expect(cap.err()).toContain("error:");
    expect(cap.out()).toBe("");
  });
});
