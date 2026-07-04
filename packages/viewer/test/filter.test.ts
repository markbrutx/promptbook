import { describe, expect, it } from "vitest";
import { applySidebarFilter } from "../src/web/filter.js";
import { buildCompositionTree, buildFragmentGroups } from "../src/web/tree.js";
import type { CodePromptSummary, CompositionSummary, FragmentSummary } from "../src/web/types.js";

const compositions: CompositionSummary[] = [
  {
    name: "assistant",
    base: ["intro"],
    rules: [],
    sourceFile: "rules/assistant.yaml",
    variants: [
      { name: "terse", context: { variant: "terse" } },
      { name: "verbose", context: { variant: "verbose" } },
    ],
  },
  {
    name: "digest/table",
    base: ["intro"],
    rules: [],
    sourceFile: "rules/digest-table.yaml",
    variants: [],
  },
];

const codePrompts: CodePromptSummary[] = [
  {
    name: "summarizer",
    samples: [
      { label: "sample-a", output: "digest" },
      { label: "sample-b", output: "digest" },
    ],
    sourceFile: "code-prompts/summarizer.yaml",
  },
];

const fragments: FragmentSummary[] = [
  { id: "intro", kind: "task", tags: ["greeting"], body: "Do the task.", sourceFile: "fragments/intro.md" },
  { id: "notes-digest", tags: [], body: "Digest the notes.", sourceFile: "fragments/notes-digest.md" },
  {
    id: "unused",
    kind: "task",
    tags: [],
    body: "Nobody references this.",
    sourceFile: "fragments/unused.md",
  },
];

const tree = buildCompositionTree(compositions, codePrompts);
const groups = buildFragmentGroups(fragments);

// Leaves: assistant + digest/table + summarizer + 3 fragments.
const TOTAL = 6;

describe("applySidebarFilter", () => {
  it("is a no-op for an empty or whitespace query, still reporting totals", () => {
    for (const query of ["", "   "]) {
      const result = applySidebarFilter(tree, groups, query);
      expect(result.tree).toBe(tree);
      expect(result.fragmentGroups).toBe(groups);
      expect(result.matched).toBe(TOTAL);
      expect(result.total).toBe(TOTAL);
    }
  });

  it("matches compositions by name, case-insensitively", () => {
    const result = applySidebarFilter(tree, groups, "ASSIST");
    expect(result.tree).toHaveLength(1);
    expect(result.tree[0]).toMatchObject({ type: "composition", name: "assistant" });
    expect(result.matched).toBe(1);
    expect(result.total).toBe(TOTAL);
  });

  it("keeps all variants when the composition name itself matches", () => {
    const result = applySidebarFilter(tree, groups, "assistant");
    const node = result.tree[0];
    expect(node?.type === "composition" && node.variants.map((v) => v.variant.name)).toEqual([
      "Default",
      "terse",
      "verbose",
    ]);
  });

  it("narrows to matching variants when only a variant name matches", () => {
    const result = applySidebarFilter(tree, groups, "terse");
    const node = result.tree[0];
    expect(node?.type === "composition" && node.variants.map((v) => v.variant.name)).toEqual(["terse"]);
  });

  it("matches a nested composition through its full path-like name", () => {
    for (const query of ["digest/ta", "table"]) {
      const result = applySidebarFilter(tree, groups, query);
      const group = result.tree.find((n) => n.type === "group");
      expect(group?.type === "group" && group.children).toHaveLength(1);
    }
  });

  it("prunes groups whose children all miss", () => {
    const result = applySidebarFilter(tree, groups, "assistant");
    expect(result.tree.some((n) => n.type === "group")).toBe(false);
  });

  it("narrows code-prompts to matching samples", () => {
    const result = applySidebarFilter(tree, groups, "sample-b");
    const node = result.tree[0];
    expect(node?.type === "code" && node.samples).toEqual(["sample-b"]);
  });

  it("matches fragments by id and by tag, dropping emptied groups", () => {
    const byId = applySidebarFilter(tree, groups, "notes");
    expect(byId.fragmentGroups.flatMap((g) => g.fragments.map((f) => f.id))).toEqual(["notes-digest"]);

    const byTag = applySidebarFilter(tree, groups, "greeting");
    expect(byTag.fragmentGroups.flatMap((g) => g.fragments.map((f) => f.id))).toEqual(["intro"]);
    expect(byTag.fragmentGroups.map((g) => g.kind)).toEqual(["task"]);
  });

  it("counts surviving leaves across both sections", () => {
    // "digest" hits the digest/table composition, the summarizer sample output
    // is not searched, but notes-digest the fragment matches by id.
    const result = applySidebarFilter(tree, groups, "digest");
    expect(result.matched).toBe(2);
    expect(result.total).toBe(TOTAL);
  });

  it("returns empty sections and a zero count when nothing matches", () => {
    const result = applySidebarFilter(tree, groups, "zzz-nothing");
    expect(result.tree).toEqual([]);
    expect(result.fragmentGroups).toEqual([]);
    expect(result.matched).toBe(0);
    expect(result.total).toBe(TOTAL);
  });
});
