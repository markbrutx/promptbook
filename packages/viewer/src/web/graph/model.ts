import type { BookResponse } from "../types.js";

/** Kinds of nodes the book graph renders. */
export type GraphNodeKind = "composition" | "fragment" | "code";

/** One node of the book graph: a composition, a fragment, or a code-prompt. */
export interface GraphNode {
  /** Unique key, namespaced by kind so names never collide across kinds. */
  key: string;
  kind: GraphNodeKind;
  /** Full name (composition/code-prompt) or fragment id — the navigation target. */
  name: string;
  /** Short label drawn next to the node (last path segment). */
  label: string;
  /** Visual radius in world units; fragments grow with usage. */
  radius: number;
  /** Incident edge count (a fragment's usage). */
  degree: number;
}

/** Why an edge exists: composition base list, a rule target, or a `${…}` reference. */
export type GraphEdgeKind = "base" | "rule" | "ref";

/** One undirected edge; endpoints are indices into {@link GraphData.nodes}. */
export interface GraphEdge {
  source: number;
  target: number;
  kind: GraphEdgeKind;
}

/** The book reduced to a renderable graph. */
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Adjacency list: node index → neighbor node indices. */
  neighbors: number[][];
}

/**
 * Node indices visible in the graph's local mode: the focused node plus its
 * 1-hop neighborhood. An out-of-range focus yields an empty set, which the
 * renderer treats as "show everything".
 */
export function neighborhoodOf(neighbors: number[][], focus: number): Set<number> {
  const adjacent = neighbors[focus];
  if (adjacent === undefined) {
    return new Set();
  }
  return new Set([focus, ...adjacent]);
}

/** Mirrors core's `${path}` placeholder syntax (interpolate / extractVariables). */
const REF_RE = /(\\?)\$\{([^}]+)\}/g;

function shortLabel(name: string): string {
  const segments = name.split("/").filter((s) => s !== "");
  return segments[segments.length - 1] ?? name;
}

function radiusOf(kind: GraphNodeKind, degree: number): number {
  if (kind === "composition") {
    return Math.min(9 + degree * 0.3, 14);
  }
  if (kind === "code") {
    return 7;
  }
  return Math.min(3.5 + 1.6 * Math.sqrt(degree), 10);
}

/**
 * Derive the book's graph from the wire DTO alone: composition→fragment edges
 * from `base`/`order` and every rule's targets (add/after/replace/forbid/order),
 * plus fragment→fragment edges where a `${key}` placeholder names another
 * fragment. Dangling references are skipped (lint reports those); duplicate
 * mentions of the same pair collapse into one edge (first mention wins, so
 * `base` outranks rule targets).
 */
export function buildGraph(book: BookResponse): GraphData {
  const nodes: GraphNode[] = [];
  const indexByKey = new Map<string, number>();

  const addNode = (key: string, kind: GraphNodeKind, name: string, label: string): void => {
    indexByKey.set(key, nodes.length);
    nodes.push({ key, kind, name, label, radius: 0, degree: 0 });
  };

  for (const composition of book.compositions) {
    addNode(`c:${composition.name}`, "composition", composition.name, shortLabel(composition.name));
  }
  for (const codePrompt of book.codePrompts) {
    addNode(`x:${codePrompt.name}`, "code", codePrompt.name, shortLabel(codePrompt.name));
  }
  for (const fragment of book.fragments) {
    addNode(`f:${fragment.id}`, "fragment", fragment.id, fragment.id);
  }

  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  const connect = (a: number | undefined, b: number | undefined, kind: GraphEdgeKind): void => {
    if (a === undefined || b === undefined || a === b) {
      return;
    }
    const pair = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (seen.has(pair)) {
      return;
    }
    seen.add(pair);
    edges.push({ source: a, target: b, kind });
  };
  const fragmentIndex = (id: string): number | undefined => indexByKey.get(`f:${id}`);

  for (const composition of book.compositions) {
    const self = indexByKey.get(`c:${composition.name}`);
    for (const id of composition.base) {
      connect(self, fragmentIndex(id), "base");
    }
    for (const id of composition.order ?? []) {
      connect(self, fragmentIndex(id), "rule");
    }
    for (const rule of composition.rules) {
      for (const id of rule.add ?? []) {
        connect(self, fragmentIndex(id), "rule");
      }
      if (rule.after !== undefined) {
        connect(self, fragmentIndex(rule.after), "rule");
      }
      for (const [from, to] of Object.entries(rule.replace ?? {})) {
        connect(self, fragmentIndex(from), "rule");
        connect(self, fragmentIndex(to), "rule");
      }
      for (const id of rule.forbid ?? []) {
        connect(self, fragmentIndex(id), "rule");
      }
      for (const id of rule.order ?? []) {
        connect(self, fragmentIndex(id), "rule");
      }
    }
  }

  for (const fragment of book.fragments) {
    const self = fragmentIndex(fragment.id);
    for (const match of fragment.body.matchAll(REF_RE)) {
      const [, escaped, expr] = match;
      if (escaped || expr === undefined) {
        continue;
      }
      connect(self, fragmentIndex(expr.trim()), "ref");
    }
  }

  const neighbors: number[][] = nodes.map(() => []);
  for (const edge of edges) {
    neighbors[edge.source]?.push(edge.target);
    neighbors[edge.target]?.push(edge.source);
  }
  nodes.forEach((node, index) => {
    node.degree = neighbors[index]?.length ?? 0;
    node.radius = radiusOf(node.kind, node.degree);
  });

  return { nodes, edges, neighbors };
}
