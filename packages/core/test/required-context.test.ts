import { describe, expect, it } from "vitest";
import { loadPrompts, requiredContext } from "../src/index.js";
import { book, composition, fixtureDir, fragment } from "./helpers.js";

describe("requiredContext", () => {
  it("supersets vars across base, add and replace targets with provenance", async () => {
    const loaded = await loadPrompts(fixtureDir("sample"));
    const required = requiredContext(loaded, "assistant");

    // `${subjectName}`/`${notesDigest}` live in both input-context (base) and
    // terse-input-context (a replace target reachable only under mode=terse) —
    // the static superset reports them without running the cascade.
    expect(required.vars).toEqual(["notesDigest", "subjectName"]);
    expect(required.sources.subjectName).toEqual(["input-context", "terse-input-context"]);
    expect(required.sources.notesDigest).toEqual(["input-context", "terse-input-context"]);
  });

  it("collects when-axes with sorted unique option values", async () => {
    const loaded = await loadPrompts(fixtureDir("sample"));
    const required = requiredContext(loaded, "assistant");
    expect(required.axes).toEqual({ mode: ["terse"] });
  });

  it("ignores escaped placeholders and de-duplicates keys", () => {
    const reachable = fragment(
      "body",
      "Use ${subjectName}. Literal: \\${subjectName}. Again ${subjectName}.",
    );
    const unreached = fragment("orphan", "Never referenced ${ghost}.");
    const comp = composition("assistant", ["body"]);
    const required = requiredContext(book([reachable, unreached], [comp]), "assistant");

    expect(required.vars).toEqual(["subjectName"]);
    expect(required.sources).toEqual({ subjectName: ["body"] });
  });

  it("unions add-target vars only for reachable add roles", () => {
    const base = fragment("base", "Base ${a}.");
    const added = fragment("added", "Added ${b}.");
    const comp = composition(
      "assistant",
      ["base"],
      [{ index: 0, when: { tier: "pro" }, action: "add", add: ["added"] }],
    );
    const required = requiredContext(book([base, added], [comp]), "assistant");

    expect(required.vars).toEqual(["a", "b"]);
    expect(required.axes).toEqual({ tier: ["pro"] });
  });

  it("throws on an unknown composition like resolveBook", () => {
    const comp = composition("assistant", ["voice"]);
    expect(() => requiredContext(book([fragment("voice", "hi")], [comp]), "ghost")).toThrow(
      /Unknown prompt "ghost"/,
    );
  });
});
