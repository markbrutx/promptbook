import { describe, expect, it } from "vitest";
import type { CodePromptSummary, CompositionSummary } from "../src/shared/types.js";
import { buildCompositionTree, buildFragmentGroups, DEFAULT_VARIANT } from "../src/web/tree.js";

function composition(name: string, variants: string[] = []): CompositionSummary {
  return {
    name,
    base: [],
    rules: [],
    sourceFile: `rules/${name}.yaml`,
    variants: variants.map((v) => ({ name: v, context: {} })),
  };
}

function codePrompt(name: string, samples: string[] = []): CodePromptSummary {
  return {
    name,
    samples: samples.map((label) => ({ label, output: `${label} output` })),
    sourceFile: `code-prompts/${name}.yaml`,
  };
}

describe("buildCompositionTree", () => {
  it("nests path-like names under folder groups", () => {
    const tree = buildCompositionTree([
      composition("cover-letter/quick"),
      composition("cover-letter/long"),
      composition("assistant"),
    ]);

    // Groups sort before leaves; the group holds the two cover-letter leaves.
    const group = tree.find((n) => n.type === "group");
    expect(group?.type).toBe("group");
    if (group?.type === "group") {
      expect(group.label).toBe("cover-letter");
      expect(group.children.map((c) => c.type === "composition" && c.label)).toEqual(["long", "quick"]);
    }
    expect(tree.some((n) => n.type === "composition" && n.name === "assistant")).toBe(true);
  });

  it("prepends a Default variant to every composition leaf", () => {
    const [leaf] = buildCompositionTree([composition("assistant", ["terse"])]);
    expect(leaf?.type).toBe("composition");
    if (leaf?.type === "composition") {
      expect(leaf.variants.map((v) => v.variant.name)).toEqual([DEFAULT_VARIANT.name, "terse"]);
    }
  });

  it("places code-prompts as code leaves beside compositions, sorted by label", () => {
    const tree = buildCompositionTree(
      [composition("assistant")],
      [codePrompt("quiz-pack", ["empty", "filled"])],
    );
    const code = tree.find((n) => n.type === "code");
    expect(code?.type).toBe("code");
    if (code?.type === "code") {
      expect(code.name).toBe("quiz-pack");
      expect(code.samples).toEqual(["empty", "filled"]);
    }
    // The two leaves sort alphabetically (assistant before quiz-pack).
    expect(tree.map((n) => (n.type === "group" ? n.label : n.name))).toEqual(["assistant", "quiz-pack"]);
  });

  it("nests a path-like code-prompt name under its group", () => {
    const tree = buildCompositionTree([], [codePrompt("computed/quiz-pack", ["empty"])]);
    const group = tree.find((n) => n.type === "group");
    expect(group?.type).toBe("group");
    if (group?.type === "group") {
      expect(group.label).toBe("computed");
      const leaf = group.children[0];
      expect(leaf?.type === "code" && leaf.label).toBe("quiz-pack");
    }
  });
});

describe("buildFragmentGroups", () => {
  it("groups fragments by kind, defaulting to other", () => {
    const groups = buildFragmentGroups([
      { id: "a", kind: "persona", tags: [], body: "", sourceFile: "fragments/a.md" },
      { id: "b", tags: [], body: "", sourceFile: "fragments/b.md" },
    ]);
    expect(groups.map((g) => g.kind)).toEqual(["other", "persona"]);
  });
});
