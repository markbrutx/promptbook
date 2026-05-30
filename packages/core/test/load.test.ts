import { describe, expect, it } from "vitest";
import { loadPrompts } from "../src/index.js";
import { fixtureDir, memoryFs } from "./helpers.js";

describe("loadPrompts", () => {
  it("loads fragments and compositions from a folder", async () => {
    const dir = fixtureDir("sample");
    const loadedBook = await loadPrompts(dir);

    expect(loadedBook.fragments.size).toBe(11);
    const assistant = loadedBook.compositions.get("assistant");
    expect(assistant).toBeDefined();
    expect(assistant?.base).toEqual([
      "voice",
      "task-framing",
      "locale",
      "native-language",
      "bans",
      "input-context",
      "json-return",
    ]);
    expect(assistant?.rules).toHaveLength(2);
    expect(loadedBook.warnings).toEqual([]);
  });

  it("parses frontmatter fields and trims the body", async () => {
    const loadedBook = await loadPrompts(fixtureDir("sample"));
    const voice = loadedBook.fragments.get("voice");
    expect(voice?.kind).toBe("persona");
    expect(voice?.tags).toEqual(["core", "voice"]);
    expect(voice?.body.startsWith("You are a sharp")).toBe(true);
    expect(voice?.body.endsWith("\n")).toBe(false);
  });

  it("parses rule actions correctly", async () => {
    const loadedBook = await loadPrompts(fixtureDir("sample"));
    const assistant = loadedBook.compositions.get("assistant");
    const [replaceRule, addRule] = assistant?.rules ?? [];
    expect(replaceRule?.action).toBe("replace");
    expect(replaceRule?.when).toEqual({ mode: "terse" });
    expect(replaceRule?.replace).toEqual({
      voice: "terse-voice",
      "task-framing": "terse-task-framing",
      "input-context": "terse-input-context",
    });
    expect(addRule?.action).toBe("add");
    expect(addRule?.add).toEqual(["line-by-content"]);
    expect(addRule?.after).toBe("bans");
  });

  it("throws on duplicate fragment ids, naming both files", async () => {
    const fs = memoryFs({
      "/p/fragments/a.md": "---\nid: dup\n---\nA",
      "/p/fragments/b.md": "---\nid: dup\n---\nB",
    });
    await expect(loadPrompts("/p", fs)).rejects.toThrow(/Duplicate fragment id "dup".*a\.md.*b\.md/s);
  });

  it("throws when a fragment is missing an id", async () => {
    const fs = memoryFs({ "/p/fragments/a.md": "---\nkind: x\n---\nbody" });
    await expect(loadPrompts("/p", fs)).rejects.toThrow(/missing a string "id"/);
  });

  it("throws when a rule declares more than one action", async () => {
    const fs = memoryFs({
      "/p/fragments/a.md": "---\nid: a\n---\nA",
      "/p/rules/c.yaml": "name: c\nbase: [a]\nrules:\n  - add: [a]\n    forbid: [a]\n",
    });
    await expect(loadPrompts("/p", fs)).rejects.toThrow(/exactly one action/);
  });

  it("returns an empty book for a missing folder rather than throwing", async () => {
    const loadedBook = await loadPrompts("/does/not/exist", memoryFs({}));
    expect(loadedBook.fragments.size).toBe(0);
    expect(loadedBook.compositions.size).toBe(0);
  });
});
