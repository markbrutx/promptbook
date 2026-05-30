import { describe, expect, it } from "vitest";
import { interpolate } from "../src/index.js";

function render(body: string, context: Record<string, string | number | boolean>) {
  const missing: string[] = [];
  const text = interpolate(body, context, (key) => missing.push(key));
  return { text, missing };
}

describe("interpolate", () => {
  it("substitutes a present variable", () => {
    const { text, missing } = render("Hi ${name}.", { name: "Ada" });
    expect(text).toBe("Hi Ada.");
    expect(missing).toEqual([]);
  });

  it("renders a missing variable as empty string and reports it", () => {
    const { text, missing } = render("Hi ${name}.", {});
    expect(text).toBe("Hi .");
    expect(missing).toEqual(["name"]);
  });

  it("never throws on a missing variable", () => {
    expect(() => render("${a} ${b} ${c}", { b: "x" })).not.toThrow();
  });

  it("coerces non-string scalars", () => {
    const { text } = render("n=${n} ok=${ok}", { n: 42, ok: true });
    expect(text).toBe("n=42 ok=true");
  });

  it("treats \\${ as an escape and renders it literally", () => {
    const { text, missing } = render("price is \\${amount}", { amount: 5 });
    expect(text).toBe("price is ${amount}");
    expect(missing).toEqual([]);
  });

  it("looks up flat keys verbatim, including dotted names", () => {
    const { text } = render("Hi ${user.name}.", { "user.name": "Bo" });
    expect(text).toBe("Hi Bo.");
  });

  it("is deterministic for repeated calls", () => {
    const a = render("${x}-${y}", { x: "1", y: "2" }).text;
    const b = render("${x}-${y}", { x: "1", y: "2" }).text;
    expect(a).toBe(b);
  });
});
