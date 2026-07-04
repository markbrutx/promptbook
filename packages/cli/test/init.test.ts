import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { IO } from "../src/io.js";
import { run } from "../src/run.js";
import { type Capture, capture } from "./helpers.js";

describe("init command", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), "pb-init-"));
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  /** A capture whose writeFile hits the real disk, so init → ls round-trips. */
  function diskCapture(): Capture {
    const overrides: Partial<IO> = {
      cwd: () => tmp,
      async writeFile(path, contents) {
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, contents);
      },
    };
    return capture(overrides);
  }

  it("scaffolds config, fragments, and a rule; stdout stays empty", async () => {
    const cap = diskCapture();
    const code = await run(["init"], cap.io);
    expect(code).toBe(0);
    expect(cap.out()).toBe("");
    expect(cap.err()).toContain(`create ${join(tmp, "promptbook.json")}`);
    expect(cap.err()).toContain(join(tmp, "prompts", "rules", "reply.yaml"));
    expect(cap.err()).toContain("book ready");
    const config = JSON.parse(await readFile(join(tmp, "promptbook.json"), "utf8")) as {
      promptsDir: string;
    };
    expect(config.promptsDir).toBe("./prompts");
  });

  it("the scaffolded book lists and resolves with the tone swap", async () => {
    await run(["init"], diskCapture().io);

    const ls = diskCapture();
    expect(await run(["ls"], ls.io)).toBe(0);
    expect(ls.out()).toContain("reply");
    expect(ls.out()).toContain("persona");

    const warm = diskCapture();
    expect(await run(["resolve", "reply", "--ctx", "message=Where is my order?"], warm.io)).toBe(0);
    expect(warm.out()).toContain("empathetic");
    expect(warm.out()).toContain("Where is my order?");

    const terse = diskCapture();
    expect(
      await run(["resolve", "reply", "--ctx", "tone=terse", "--ctx", "message=Where is my order?"], terse.io),
    ).toBe(0);
    expect(terse.out()).toContain("at most three sentences");
    expect(terse.out()).not.toContain("empathetic");
  });

  it("is idempotent: a second run skips everything and changes nothing", async () => {
    await run(["init"], diskCapture().io);
    const before = await readFile(join(tmp, "prompts", "fragments", "persona.md"), "utf8");

    const again = diskCapture();
    const code = await run(["init"], again.io);
    expect(code).toBe(0);
    expect(again.err()).toContain("skip");
    expect(again.err()).not.toContain("create ");
    expect(await readFile(join(tmp, "prompts", "fragments", "persona.md"), "utf8")).toBe(before);
  });

  it("honors a custom target dir operand", async () => {
    const cap = diskCapture();
    const code = await run(["init", "./my-book"], cap.io);
    expect(code).toBe(0);
    const config = JSON.parse(await readFile(join(tmp, "promptbook.json"), "utf8")) as {
      promptsDir: string;
    };
    expect(config.promptsDir).toBe("./my-book");
    expect(cap.err()).toContain(join(tmp, "my-book", "fragments", "persona.md"));
  });
});
