import { describe, expect, it } from "vitest";
import type { CompositionSummary } from "../src/shared/types.js";
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
