import { describe, expect, it } from "vitest";
import { buildGraph } from "../src/web/graph/model.js";
import type { BookResponse } from "../src/web/types.js";

/** Synthetic book: one composition, one code-prompt, four fragments. */
function makeBook(): BookResponse {
  return {
    compositions: [
      {
        name: "assistant",
        base: ["intro", "notes-digest"],
        rules: [
          { index: 0, when: { variant: "terse" }, action: "replace", replace: { intro: "intro-terse" } },
          { index: 1, when: {}, action: "forbid", forbid: ["notes-digest"] },
          { index: 2, when: { variant: "terse" }, action: "add", add: ["missing-fragment"] },
        ],
        sourceFile: "rules/assistant.yaml",
        variants: [],
      },
      {
        name: "digest/table",
        base: ["intro"],
        rules: [],
        sourceFile: "rules/digest-table.yaml",
        variants: [],
      },
    ],
    codePrompts: [
      {
        name: "summarizer",
        samples: [{ label: "sample-a", output: "digest" }],
        sourceFile: "code-prompts/summarizer.yaml",
      },
    ],
    fragments: [
      {
        id: "intro",
        kind: "task",
        tags: [],
        body: "Do the task for ${subjectName}.",
        sourceFile: "fragments/intro.md",
      },
      {
        id: "intro-terse",
        tags: [],
        body: "Terse. See ${intro} and \\${notes-digest}.",
        sourceFile: "fragments/intro-terse.md",
      },
      { id: "notes-digest", tags: [], body: "Digest the notes.", sourceFile: "fragments/notes-digest.md" },
      { id: "unused", tags: [], body: "Nobody references this.", sourceFile: "fragments/unused.md" },
    ],
    warnings: [],
  };
}

describe("buildGraph", () => {
  const graph = buildGraph(makeBook());
  const byKey = new Map(graph.nodes.map((node, index) => [node.key, index]));
  const edgeBetween = (a: string, b: string) => {
    const ai = byKey.get(a);
    const bi = byKey.get(b);
    return graph.edges.find(
      (e) => (e.source === ai && e.target === bi) || (e.source === bi && e.target === ai),
    );
  };

  it("namespaces nodes by kind so names never collide", () => {
    expect(graph.nodes.map((n) => n.key).sort()).toEqual([
      "c:assistant",
      "c:digest/table",
      "f:intro",
      "f:intro-terse",
      "f:notes-digest",
      "f:unused",
      "x:summarizer",
    ]);
  });

  it("labels path-like names by their last segment", () => {
    const digest = graph.nodes.find((n) => n.key === "c:digest/table");
    expect(digest?.label).toBe("table");
    expect(digest?.name).toBe("digest/table");
  });

  it("connects compositions to base and rule-target fragments, deduped (base wins)", () => {
    expect(edgeBetween("c:assistant", "f:intro")?.kind).toBe("base");
    expect(edgeBetween("c:assistant", "f:intro-terse")?.kind).toBe("rule");
    // Mentioned in base first, then forbidden by a rule: one edge, base kind.
    expect(edgeBetween("c:assistant", "f:notes-digest")?.kind).toBe("base");
    const assistantIndex = byKey.get("c:assistant");
    expect(
      graph.edges.filter((e) => e.source === assistantIndex || e.target === assistantIndex),
    ).toHaveLength(3);
  });

  it("skips dangling rule targets instead of inventing nodes", () => {
    expect(byKey.has("f:missing-fragment")).toBe(false);
  });

  it("adds a ref edge when a ${…} placeholder names another fragment", () => {
    expect(edgeBetween("f:intro-terse", "f:intro")?.kind).toBe("ref");
  });

  it("ignores escaped placeholders and plain context variables", () => {
    // \${notes-digest} is escaped; ${subjectName} is a context var, not a fragment.
    expect(edgeBetween("f:intro-terse", "f:notes-digest")).toBeUndefined();
    expect(graph.nodes.find((n) => n.key === "f:intro")?.degree).toBe(3);
  });

  it("sizes fragments by usage and keeps unused ones smallest", () => {
    const intro = graph.nodes.find((n) => n.key === "f:intro");
    const unused = graph.nodes.find((n) => n.key === "f:unused");
    expect(intro).toBeDefined();
    expect(unused).toBeDefined();
    expect((intro?.radius ?? 0) > (unused?.radius ?? 0)).toBe(true);
    expect(unused?.degree).toBe(0);
  });

  it("keeps the adjacency list symmetric", () => {
    graph.neighbors.forEach((list, index) => {
      for (const neighbor of list) {
        expect(graph.neighbors[neighbor]).toContain(index);
      }
    });
  });
});
