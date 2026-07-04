import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Context, PromptBook } from "@markbrutx/promptbook-core";
import { resolve, resolveBook } from "@markbrutx/promptbook-core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { run } from "../src/run.js";
import { capture, fixtureDir, promptsDir } from "./helpers.js";

interface BundleJson {
  fragments: { id: string }[];
  compositions: { name: string }[];
  warnings: string[];
}

/** Pull the `book` value expression out of the generated module and evaluate it. */
function restoreFromModule(module: string): PromptBook {
  const marker = "export const book: PromptBook = ";
  const start = module.indexOf(marker);
  const end = module.indexOf(";\n\nexport default book;");
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  // Typed mode emits `new Map<string, T>(...)`; strip the TS generic args so the
  // expression is valid JavaScript for `new Function`.
  const expression = module.slice(start + marker.length, end).replace(/new Map<[^>]*>\(/g, "new Map(");
  return (new Function(`return (${expression});`) as () => PromptBook)();
}

const contexts: Context[] = [{ locale: "ru" }, { mode: "terse", subjectName: "Ada", notesDigest: "thin" }];

describe("bundle command", () => {
  it("emits an importable module to stdout", async () => {
    const cap = capture();
    const code = await run(["bundle", "--dir", promptsDir], cap.io);
    expect(code).toBe(0);
    const out = cap.out();
    expect(out).toContain(
      'import type { PromptBook, Fragment, Composition, CodePrompt } from "@markbrutx/promptbook-core";',
    );
    expect(out).toContain("export const book: PromptBook = {");
    expect(out).toContain("export default book;");
    expect(out).toContain("new Map<string, Fragment>([");
    expect(cap.err()).toBe("");
  });

  it("accepts the folder as a positional argument", async () => {
    const cap = capture();
    const code = await run(["bundle", promptsDir], cap.io);
    expect(code).toBe(0);
    expect(cap.out()).toContain("export const book: PromptBook");
  });

  it("relativizes source paths (portable, forward-slash)", async () => {
    const cap = capture();
    await run(["bundle", "--dir", promptsDir], cap.io);
    const out = cap.out();
    expect(out).toContain('"sourceFile":"fragments/voice.md"');
    expect(out).toContain('"sourceFile":"rules/assistant.yaml"');
    expect(out).not.toContain(promptsDir);
  });

  it("round-trips: the bundled book resolves identically to the folder", async () => {
    const cap = capture();
    await run(["bundle", "--dir", promptsDir], cap.io);
    const restored = restoreFromModule(cap.out());
    for (const context of contexts) {
      const fromFolder = await resolve({ promptsDir, prompt: "assistant", context });
      const fromBundle = resolveBook(restored, "assistant", context);
      expect(fromBundle.text).toBe(fromFolder.text);
    }
  });

  it("writes to a file with -o and reports the path on stderr", async () => {
    const cap = capture();
    const code = await run(["bundle", "--dir", promptsDir, "-o", "out/book.generated.ts"], cap.io);
    expect(code).toBe(0);
    expect(cap.out()).toBe("");
    expect(cap.err()).toContain("wrote");
    const files = cap.files();
    const paths = Object.keys(files);
    expect(paths.length).toBe(1);
    const path = paths[0] ?? "";
    expect(path.endsWith("out/book.generated.ts")).toBe(true);
    expect(files[path]).toContain("export const book: PromptBook");
  });

  it("emits a parseable JSON dump with --json", async () => {
    const cap = capture();
    const code = await run(["bundle", "--dir", promptsDir, "--json"], cap.io);
    expect(code).toBe(0);
    const parsed = JSON.parse(cap.out()) as BundleJson;
    expect(parsed.compositions.map((c) => c.name)).toContain("assistant");
    expect(parsed.fragments.map((f) => f.id)).toContain("voice");
    expect(Array.isArray(parsed.warnings)).toBe(true);
  });

  it("emits a plain module with --plain (no type-only import)", async () => {
    const cap = capture();
    const code = await run(["bundle", "--dir", promptsDir, "--plain"], cap.io);
    expect(code).toBe(0);
    const out = cap.out();
    expect(out).not.toContain("import type");
    expect(out).toContain("export const book = {");
    expect(out).toContain("new Map([");
  });

  it("points the typed import at --import-specifier", async () => {
    const cap = capture();
    const code = await run(
      ["bundle", "--dir", promptsDir, "--import-specifier", "npm:@markbrutx/promptbook-core@1.2.3"],
      cap.io,
    );
    expect(code).toBe(0);
    const out = cap.out();
    expect(out).toContain(
      'import type { PromptBook, Fragment, Composition, CodePrompt } from "npm:@markbrutx/promptbook-core@1.2.3";',
    );
    expect(out).toContain("export const book: PromptBook = {");
  });

  it("is deterministic across runs", async () => {
    const a = capture();
    const b = capture();
    await run(["bundle", "--dir", promptsDir], a.io);
    await run(["bundle", "--dir", promptsDir], b.io);
    expect(a.out()).toBe(b.out());
  });

  it("fails with a clear message for a missing prompts folder", async () => {
    const cap = capture();
    const code = await run(["bundle", "--dir", "/no/such/place"], cap.io);
    expect(code).toBe(1);
    expect(cap.err()).toContain("prompts folder not found");
  });
});

describe("bundle -o resolution", () => {
  it("resolves a relative -o against the book folder, not cwd", async () => {
    const cap = capture({ cwd: () => join(tmpdir(), "unrelated-cwd") });
    const code = await run(["bundle", "--dir", promptsDir, "-o", "book.generated.ts"], cap.io);
    expect(code).toBe(0);
    expect(Object.keys(cap.files())).toEqual([join(promptsDir, "book.generated.ts")]);
  });

  it("leaves an absolute -o untouched", async () => {
    const abs = join(tmpdir(), "pb-abs-out.generated.ts");
    const cap = capture({ cwd: () => join(tmpdir(), "unrelated-cwd") });
    const code = await run(["bundle", "--dir", promptsDir, "-o", abs], cap.io);
    expect(code).toBe(0);
    expect(Object.keys(cap.files())).toEqual([abs]);
  });
});

describe("bundle empty-book guard", () => {
  let emptyDir: string;

  beforeEach(async () => {
    emptyDir = await mkdtemp(join(tmpdir(), "pb-bundle-empty-"));
  });

  afterEach(async () => {
    await rm(emptyDir, { recursive: true, force: true });
  });

  it("exits 1 with the resolved path instead of writing a hollow artifact", async () => {
    const cap = capture();
    const code = await run(["bundle", "--dir", emptyDir], cap.io);
    expect(code).toBe(1);
    expect(cap.err()).toContain("no prompts in");
    expect(cap.err()).toContain(emptyDir);
    expect(cap.out()).toBe("");
    expect(Object.keys(cap.files())).toEqual([]);
  });

  it("hints at INIT_CWD when pnpm exec snapped cwd to an empty package root", async () => {
    const cap = capture({ cwd: () => emptyDir, env: { INIT_CWD: promptsDir } });
    const code = await run(["bundle", "--dir", "."], cap.io);
    expect(code).toBe(1);
    expect(cap.err()).toContain("no prompts in");
    expect(cap.err()).toContain("pnpm exec snaps cwd");
    expect(cap.err()).toContain(promptsDir);
  });
});

describe("bundle --exclude-code-prompts", () => {
  it("keeps code-prompts by default", async () => {
    const cap = capture();
    await run(["bundle", "--dir", promptsDir, "--json"], cap.io);
    const parsed = JSON.parse(cap.out()) as { codePrompts: { name: string }[] };
    expect(parsed.codePrompts.map((c) => c.name)).toContain("digest-table");
  });

  it("strips code-prompts from the serialized output", async () => {
    const cap = capture();
    const code = await run(["bundle", "--dir", promptsDir, "--exclude-code-prompts", "--json"], cap.io);
    expect(code).toBe(0);
    const parsed = JSON.parse(cap.out()) as { codePrompts: unknown[] };
    expect(parsed.codePrompts).toEqual([]);
  });

  it("emits an empty Map() in the TypeScript module", async () => {
    const cap = capture();
    const code = await run(["bundle", "--dir", promptsDir, "--exclude-code-prompts"], cap.io);
    expect(code).toBe(0);
    const out = cap.out();
    expect(out).toContain("codePrompts: new Map<string, CodePrompt>()");
    expect(out).not.toContain("digest-table");
  });
});

describe("bundle --check", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), "pb-bundle-check-"));
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  async function freshBundleAt(path: string): Promise<void> {
    const cap = capture();
    const code = await run(["bundle", "--dir", promptsDir, "-o", path], cap.io);
    expect(code).toBe(0);
    const files = cap.files();
    await writeFile(path, files[Object.keys(files)[0] as string] as string);
  }

  it("exits 0 when the existing artifact matches the freshly bundled output", async () => {
    const outPath = join(tmp, "book.generated.ts");
    await freshBundleAt(outPath);
    const cap = capture();
    const code = await run(["bundle", "--dir", promptsDir, "--check", "-o", outPath], cap.io);
    expect(code).toBe(0);
    expect(cap.err()).toContain("up to date");
    expect(cap.out()).toBe("");
  });

  it("exits 1 with a stale hint when the artifact drifted", async () => {
    const outPath = join(tmp, "book.generated.ts");
    await freshBundleAt(outPath);
    const original = await readFile(outPath, "utf8");
    await writeFile(outPath, original.replace("export default book;", "export default book; // drifted"));
    const cap = capture();
    const code = await run(["bundle", "--dir", promptsDir, "--check", "-o", outPath], cap.io);
    expect(code).toBe(1);
    expect(cap.err()).toMatch(/stale.*first diff at line/);
  });

  it("exits 1 with `missing` when the artifact is absent", async () => {
    const outPath = join(tmp, "book.generated.ts");
    const cap = capture();
    const code = await run(["bundle", "--dir", promptsDir, "--check", "-o", outPath], cap.io);
    expect(code).toBe(1);
    expect(cap.err()).toContain("missing");
  });

  it("ignores CRLF differences when comparing", async () => {
    const outPath = join(tmp, "book.generated.ts");
    await freshBundleAt(outPath);
    const original = await readFile(outPath, "utf8");
    await writeFile(outPath, original.replace(/\n/g, "\r\n"));
    const cap = capture();
    const code = await run(["bundle", "--dir", promptsDir, "--check", "-o", outPath], cap.io);
    expect(code).toBe(0);
    expect(cap.err()).toContain("up to date");
  });

  it("hints at --exclude-code-prompts when the diff is only code-prompt samples", async () => {
    const outPath = join(tmp, "book.generated.ts");
    const lean = capture();
    const leanCode = await run(
      ["bundle", "--dir", promptsDir, "--exclude-code-prompts", "-o", outPath],
      lean.io,
    );
    expect(leanCode).toBe(0);
    const files = lean.files();
    await writeFile(outPath, files[Object.keys(files)[0] as string] as string);

    const cap = capture();
    const code = await run(["bundle", "--dir", promptsDir, "--check", "-o", outPath], cap.io);
    expect(code).toBe(1);
    expect(cap.err()).toMatch(/stale.*first diff at line/);
    expect(cap.err()).toContain("hint:");
    expect(cap.err()).toContain("--exclude-code-prompts");
  });

  it("hints in the reverse direction when checking with --exclude-code-prompts", async () => {
    const outPath = join(tmp, "book.generated.ts");
    await freshBundleAt(outPath);
    const cap = capture();
    const code = await run(
      ["bundle", "--dir", promptsDir, "--check", "--exclude-code-prompts", "-o", outPath],
      cap.io,
    );
    expect(code).toBe(1);
    expect(cap.err()).toContain("re-run without --exclude-code-prompts");
  });

  it("includes the hint in the --json --check object", async () => {
    // `--json` also selects the JSON payload serializer, so the artifact under
    // check must itself be a JSON dump for the comparison to be meaningful.
    const outPath = join(tmp, "book.generated.json");
    const lean = capture();
    await run(["bundle", "--dir", promptsDir, "--exclude-code-prompts", "--json", "-o", outPath], lean.io);
    const files = lean.files();
    await writeFile(outPath, files[Object.keys(files)[0] as string] as string);

    const cap = capture();
    const code = await run(["bundle", "--dir", promptsDir, "--check", "--json", "-o", outPath], cap.io);
    expect(code).toBe(1);
    const parsed = JSON.parse(cap.err().trim()) as { status: string; hint?: string };
    expect(parsed.status).toBe("stale");
    expect(parsed.hint).toContain("--exclude-code-prompts");
  });

  it("emits a JSON object on stderr with --json --check", async () => {
    const outPath = join(tmp, "book.generated.ts");
    const cap = capture();
    const code = await run(["bundle", "--dir", promptsDir, "--check", "--json", "-o", outPath], cap.io);
    expect(code).toBe(1);
    const parsed = JSON.parse(cap.err().trim()) as { status: string; diff: { reason: string } };
    expect(parsed.status).toBe("stale");
    expect(parsed.diff.reason).toBe("missing");
  });
});

describe("bundle unchanged skip", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), "pb-bundle-skip-"));
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it("skips rewriting a byte-identical artifact", async () => {
    const outPath = join(tmp, "book.generated.ts");
    const first = capture();
    const firstCode = await run(["bundle", "--dir", promptsDir, "-o", outPath], first.io);
    expect(firstCode).toBe(0);
    const files = first.files();
    await writeFile(outPath, files[Object.keys(files)[0] as string] as string);

    const cap = capture();
    const code = await run(["bundle", "--dir", promptsDir, "-o", outPath], cap.io);
    expect(code).toBe(0);
    expect(cap.err()).toContain(`unchanged ${outPath}`);
    expect(Object.keys(cap.files())).toEqual([]);
  });

  it("still rewrites when the artifact drifted", async () => {
    const outPath = join(tmp, "book.generated.ts");
    await writeFile(outPath, "// drifted artifact\n");
    const cap = capture();
    const code = await run(["bundle", "--dir", promptsDir, "-o", outPath], cap.io);
    expect(code).toBe(0);
    expect(cap.err()).toContain(`wrote ${outPath}`);
    expect(Object.keys(cap.files())).toEqual([outPath]);
  });
});

describe("bundle --all", () => {
  const workspaceDir = fixtureDir("workspace");
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = await mkdtemp(join(tmpdir(), "pb-bundle-all-"));
    await cp(workspaceDir, tmpRoot, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpRoot, { recursive: true, force: true });
  });

  it("rebundles every book in the workspace, writing each to its own book.generated.ts", async () => {
    const cap = capture();
    const code = await run(["bundle", "--dir", tmpRoot, "--all"], cap.io);
    expect(code).toBe(0);
    const paths = Object.keys(cap.files()).sort();
    expect(paths.some((p) => p.endsWith("greeter/book.generated.ts"))).toBe(true);
    expect(paths.some((p) => p.endsWith("summarizer/book.generated.ts"))).toBe(true);
  });

  it("refuses to combine --all with -o", async () => {
    const cap = capture();
    const code = await run(["bundle", "--dir", tmpRoot, "--all", "-o", "/tmp/x.ts"], cap.io);
    expect(code).toBe(1);
    expect(cap.err()).toContain("--all is not compatible with -o");
  });

  it("exits 1 when any book is stale under --all --check", async () => {
    // First bundle each book onto disk so --check has something to compare to.
    for (const name of ["greeter", "summarizer"]) {
      const cap = capture();
      const code = await run(
        ["bundle", "--dir", join(tmpRoot, name), "-o", join(tmpRoot, name, "book.generated.ts")],
        cap.io,
      );
      expect(code).toBe(0);
      const written = Object.entries(cap.files())[0];
      expect(written).toBeDefined();
      const [path, contents] = written as [string, string];
      await writeFile(path, contents);
    }
    // Drift the greeter artifact.
    const greeter = join(tmpRoot, "greeter", "book.generated.ts");
    const original = await readFile(greeter, "utf8");
    await writeFile(greeter, `${original}\n// drift\n`);

    const cap = capture();
    const code = await run(["bundle", "--dir", tmpRoot, "--all", "--check"], cap.io);
    expect(code).toBe(1);
    expect(cap.err()).toMatch(/greeter stale/);
    expect(cap.err()).toMatch(/summarizer up to date/);
  });
});
