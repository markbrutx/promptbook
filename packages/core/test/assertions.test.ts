import { describe, expect, it } from "vitest";
import type { Assertion } from "../src/index.js";
import { defaultAssertions } from "../src/index.js";

const registry = defaultAssertions();

function run(type: string, output: string, spec: Partial<Assertion> = {}) {
  const fn = registry[type];
  if (!fn) {
    throw new Error(`no assertion "${type}"`);
  }
  return fn(output, { type, ...spec });
}

describe("built-in assertions", () => {
  it("exposes the documented set", () => {
    expect(Object.keys(registry).sort()).toEqual([
      "contains",
      "equals",
      "json-valid",
      "language",
      "matches",
      "max-length",
      "not-contains",
      "not-matches",
    ]);
  });

  it("contains: pass and fail with an excerpt", () => {
    const ok = run("contains", "hello world", { value: "world" });
    expect(ok.pass).toBe(true);
    const bad = run("contains", "hello world", { value: "absent" });
    expect(bad.pass).toBe(false);
    expect(bad.excerpt).toContain("hello world");
  });

  it("not-contains: inverse of contains", () => {
    expect(run("not-contains", "abc", { value: "z" }).pass).toBe(true);
    expect(run("not-contains", "abc", { value: "b" }).pass).toBe(false);
  });

  it("matches / not-matches: regex with flags", () => {
    expect(run("matches", "Order 42", { pattern: "\\d+" }).pass).toBe(true);
    expect(run("matches", "no digits", { pattern: "\\d+" }).pass).toBe(false);
    expect(run("matches", "HELLO", { pattern: "hello", flags: "i" }).pass).toBe(true);
    expect(run("not-matches", "no digits", { pattern: "\\d+" }).pass).toBe(true);
    expect(run("not-matches", "Order 42", { pattern: "\\d+" }).pass).toBe(false);
  });

  it("equals: trims both sides", () => {
    expect(run("equals", "  yes\n", { value: "yes" }).pass).toBe(true);
    expect(run("equals", "yes", { value: "no" }).pass).toBe(false);
  });

  it("json-valid: parses or reports the error", () => {
    expect(run("json-valid", '{"a":1}').pass).toBe(true);
    const bad = run("json-valid", "{not json}");
    expect(bad.pass).toBe(false);
    expect(bad.message).toContain("not valid JSON");
  });

  it("max-length: counts characters", () => {
    expect(run("max-length", "1234", { max: 4 }).pass).toBe(true);
    expect(run("max-length", "12345", { max: 4 }).pass).toBe(false);
  });

  it("language: cyrillic passes for ru, latin fails", () => {
    expect(run("language", "Пиши ответ на русском языке", { lang: "ru" }).pass).toBe(true);
    const fail = run("language", "Write the answer in English", { lang: "ru" });
    expect(fail.pass).toBe(false);
    expect(fail.message).toContain("cyrillic");
  });

  it("language: latin passes for en, cyrillic fails", () => {
    expect(run("language", "Plain English sentence", { lang: "en" }).pass).toBe(true);
    expect(run("language", "Совсем по-русски", { lang: "en" }).pass).toBe(false);
  });

  it("language: accepts a script name directly and rejects unknown", () => {
    expect(run("language", "Привет", { lang: "cyrillic" }).pass).toBe(true);
    const unknown = run("language", "anything", { lang: "klingon" });
    expect(unknown.pass).toBe(false);
    expect(unknown.message).toContain("unsupported");
  });

  it("throws a clear error when a required field is missing", () => {
    expect(() => run("contains", "x")).toThrow(/requires a "value"/);
    expect(() => run("matches", "x")).toThrow(/requires a "pattern"/);
    expect(() => run("max-length", "x")).toThrow(/requires a "max"/);
  });
});
