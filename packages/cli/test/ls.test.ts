import { describe, expect, it } from "vitest";
import { run } from "../src/run.js";
import { capture, fixtureDir, memoryFs, promptsDir } from "./helpers.js";

interface RequiredContext {
  vars: string[];
  axes: Record<string, (string | number | boolean)[]>;
  sources: Record<string, string[]>;
}

interface LsJson {
  compositions?: { name: string; base: number; rules: number; requiredContext: RequiredContext }[];
  codePrompts?: { name: string; description: string | null; samples: number }[];
  fragments?: { id: string; kind: string | null; tags: string[]; sourceFile: string }[];
}

interface LsAllJson {
  workspace: string;
  books: {
    name: string;
    dir: string;
    compositions: { name: string; base: number; rules: number; requiredContext: RequiredContext }[];
    codePrompts: { name: string; description: string | null; samples: number }[];
    warnings: string[];
  }[];
}

describe("ls command", () => {
  it("lists compositions, code-prompts and fragments by default", async () => {
    const cap = capture();
    const code = await run(["ls", "--dir", promptsDir], cap.io);
    expect(code).toBe(0);
    const out = cap.out();
    expect(out).toContain("compositions:");
    expect(out).toContain("assistant  base=7  rules=3");
    expect(out).toContain("code-prompts:");
    expect(out).toContain("digest-table  kind=code  samples=2");
    expect(out).toContain("fragments:");
    expect(out).toContain("voice");
    expect(out).toContain("bans");
    expect(cap.err()).toBe("");
  });

  it("emits parseable JSON with both sections plus required context", async () => {
    const cap = capture();
    const code = await run(["ls", "--dir", promptsDir, "--json"], cap.io);
    expect(code).toBe(0);
    const parsed = JSON.parse(cap.out()) as LsJson;
    const assistant = (parsed.compositions ?? []).find((c) => c.name === "assistant");
    expect(assistant).toMatchObject({ name: "assistant", base: 7, rules: 3 });
    // The static required-context superset reports the input vars + the axes
    // its rules branch on (mode, industry), both from the sample book.
    expect(assistant?.requiredContext.vars).toEqual(["notesDigest", "subjectName"]);
    expect(assistant?.requiredContext.axes).toMatchObject({ mode: ["terse"], industry: ["tech"] });
    expect(parsed.codePrompts).toContainEqual({
      name: "digest-table",
      description: expect.stringContaining("variable-length table"),
      samples: 2,
    });
    const ids = (parsed.fragments ?? []).map((f) => f.id);
    expect(ids).toContain("voice");
    expect(ids).toContain("tech-note");
  });

  it("narrows to compositions (with code-prompts) only", async () => {
    const cap = capture();
    const code = await run(["ls", "--dir", promptsDir, "--compositions"], cap.io);
    expect(code).toBe(0);
    expect(cap.out()).toContain("compositions:");
    expect(cap.out()).toContain("code-prompts:");
    expect(cap.out()).not.toContain("fragments:");
  });

  it("narrows to fragments only (no code-prompts)", async () => {
    const cap = capture();
    const code = await run(["ls", "--dir", promptsDir, "--fragments"], cap.io);
    expect(code).toBe(0);
    expect(cap.out()).toContain("fragments:");
    expect(cap.out()).not.toContain("compositions:");
    expect(cap.out()).not.toContain("code-prompts:");
  });

  it("narrows JSON output to a single section", async () => {
    const cap = capture();
    await run(["ls", "--dir", promptsDir, "--fragments", "--json"], cap.io);
    const parsed = JSON.parse(cap.out()) as LsJson;
    expect(parsed.fragments).toBeDefined();
    expect(parsed.compositions).toBeUndefined();
  });

  it("fails with a clear message for a missing prompts folder", async () => {
    const cap = capture();
    const code = await run(["ls", "--dir", "/no/such/place"], cap.io);
    expect(code).toBe(1);
    expect(cap.err()).toContain("prompts folder not found");
  });
});

describe("ls --all (workspace)", () => {
  const workspaceDir = fixtureDir("workspace");

  it("emits a cross-book JSON inventory with required context, sorted", async () => {
    const cap = capture();
    const code = await run(["ls", "--all", "--json", "--dir", workspaceDir], cap.io);
    expect(code).toBe(0);
    const parsed = JSON.parse(cap.out()) as LsAllJson;
    expect(parsed.workspace).toBe("workspace");
    // The underscore-prefixed folder is ignored; books sort by name.
    expect(parsed.books.map((b) => b.name)).toEqual(["greeter", "summarizer"]);

    const greeter = parsed.books.find((b) => b.name === "greeter");
    expect(greeter?.dir).toBe("greeter");
    const greeting = greeter?.compositions.find((c) => c.name === "greeting");
    expect(greeting).toMatchObject({ name: "greeting", base: 1, rules: 1 });
    expect(greeting?.requiredContext.vars).toEqual(["name"]);
    expect(greeting?.requiredContext.axes).toEqual({ tone: ["formal"] });
    // `name` is reachable via both the base `hello` and the replace target `formal`.
    expect(greeting?.requiredContext.sources.name).toEqual(["formal", "hello"]);

    const summarizer = parsed.books.find((b) => b.name === "summarizer");
    expect(summarizer?.compositions.find((c) => c.name === "digest")?.requiredContext.vars).toEqual([
      "topic",
    ]);
    expect(summarizer?.codePrompts).toContainEqual({
      name: "table",
      description: "Builder-rendered digest table.",
      samples: 1,
    });
  });

  it("prints an indented book tree with a compact ctx summary", async () => {
    const cap = capture();
    const code = await run(["ls", "--all", "--dir", workspaceDir], cap.io);
    expect(code).toBe(0);
    const out = cap.out();
    expect(out).toContain("workspace: workspace");
    expect(out).toContain("greeter  (greeter)");
    expect(out).toContain("greeting  base=1 rules=1  ctx: vars=name axes=tone=formal");
    expect(out).toContain("summarizer  (summarizer)");
    expect(out).toContain("table  kind=code samples=1");
  });

  it("is silent (empty books) for a root with no books", async () => {
    const cap = capture({ fs: memoryFs({ "/empty/readme.md": "hi" }) });
    const code = await run(["ls", "--all", "--json", "--dir", "/empty"], cap.io);
    expect(code).toBe(0);
    const parsed = JSON.parse(cap.out()) as LsAllJson;
    expect(parsed.books).toEqual([]);
  });
});
