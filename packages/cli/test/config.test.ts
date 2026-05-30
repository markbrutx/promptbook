import { describe, expect, it } from "vitest";
import {
  buildContext,
  coerceScalar,
  loadLintConfig,
  parseCtxPairs,
  resolvePromptsDir,
} from "../src/config.js";
import type { IO } from "../src/io.js";
import { capture, memoryFs } from "./helpers.js";

function ioWith(files: Record<string, string>, cwd = "/work"): IO {
  return { ...capture({ cwd: () => cwd, fs: memoryFs(files) }).io };
}

describe("coerceScalar", () => {
  it("coerces booleans, numbers and strings", () => {
    expect(coerceScalar("true")).toBe(true);
    expect(coerceScalar("false")).toBe(false);
    expect(coerceScalar("3")).toBe(3);
    expect(coerceScalar("-2")).toBe(-2);
    expect(coerceScalar("3.14")).toBe(3.14);
    expect(coerceScalar("terse")).toBe("terse");
    expect(coerceScalar("3px")).toBe("3px");
    expect(coerceScalar("")).toBe("");
  });
});

describe("parseCtxPairs", () => {
  it("parses key=value pairs with coercion", () => {
    expect(parseCtxPairs(["n=3", "flag=true", "name=Ada"])).toEqual({
      n: 3,
      flag: true,
      name: "Ada",
    });
  });

  it("keeps a value that contains '=' intact after the first separator", () => {
    expect(parseCtxPairs(["expr=a=b"])).toEqual({ expr: "a=b" });
  });

  it("throws on a pair without '='", () => {
    expect(() => parseCtxPairs(["broken"])).toThrow(/expected key=value/);
  });

  it("throws on an empty key", () => {
    expect(() => parseCtxPairs(["=value"])).toThrow(/key is empty/);
  });
});

describe("buildContext", () => {
  it("layers --ctx over --context-file", async () => {
    const io = ioWith({ "/work/ctx.json": JSON.stringify({ a: 1, b: "fromFile", c: true }) });
    const context = await buildContext(io, ["b=fromFlag", "d=2"], "ctx.json");
    expect(context).toEqual({ a: 1, b: "fromFlag", c: true, d: 2 });
  });

  it("works with no context file", async () => {
    const io = ioWith({});
    expect(await buildContext(io, ["x=1"])).toEqual({ x: 1 });
  });

  it("throws when the context file is missing", async () => {
    const io = ioWith({});
    await expect(buildContext(io, [], "missing.json")).rejects.toThrow(/context file not found/);
  });
});

describe("resolvePromptsDir", () => {
  it("prefers --dir over config and default", async () => {
    const io = ioWith({ "/work/promptbook.json": JSON.stringify({ promptsDir: "./fromConfig" }) });
    expect(await resolvePromptsDir(io, "fromFlag")).toBe("/work/fromFlag");
  });

  it("uses promptbook.json promptsDir when no --dir", async () => {
    const io = ioWith({ "/work/promptbook.json": JSON.stringify({ promptsDir: "./fromConfig" }) });
    expect(await resolvePromptsDir(io)).toBe("/work/fromConfig");
  });

  it("falls back to ./prompts when neither is present", async () => {
    const io = ioWith({});
    expect(await resolvePromptsDir(io)).toBe("/work/prompts");
  });
});

describe("loadLintConfig", () => {
  it("reads maxTokens and bannedTokens from the lint section", async () => {
    const io = ioWith({
      "/work/promptbook.json": JSON.stringify({ lint: { maxTokens: 500, bannedTokens: ["foo", 7, "bar"] } }),
    });
    expect(await loadLintConfig(io)).toEqual({ maxTokens: 500, bannedTokens: ["foo", "bar"] });
  });

  it("returns an empty config when there is no lint section", async () => {
    const io = ioWith({ "/work/promptbook.json": JSON.stringify({ promptsDir: "./prompts" }) });
    expect(await loadLintConfig(io)).toEqual({});
  });

  it("returns an empty config when there is no config file", async () => {
    const io = ioWith({});
    expect(await loadLintConfig(io)).toEqual({});
  });
});
