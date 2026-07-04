import type { CompositionTreeNode, FragmentGroup } from "./tree.js";

/** The sidebar after a quick-filter pass, plus the numbers for the "n of m" count. */
export interface SidebarFilterResult {
  tree: CompositionTreeNode[];
  fragmentGroups: FragmentGroup[];
  /** Leaves (compositions, code-prompts, fragments) that survived the filter. */
  matched: number;
  /** Same leaf count before filtering. */
  total: number;
}

const matches = (text: string, query: string): boolean => text.toLowerCase().includes(query);

/**
 * Keep every leaf whose full name matches; when only a variant (or sample)
 * name matches, keep the leaf narrowed to those entries — so typing a variant
 * name surfaces exactly the variants you meant. Matching the full path-like
 * name (not the short label) lets a folder query light up its whole group.
 */
function filterTree(nodes: CompositionTreeNode[], query: string): CompositionTreeNode[] {
  const out: CompositionTreeNode[] = [];
  for (const node of nodes) {
    if (node.type === "group") {
      const children = filterTree(node.children, query);
      if (children.length > 0) {
        out.push({ ...node, children });
      }
      continue;
    }
    if (matches(node.name, query)) {
      out.push(node);
      continue;
    }
    if (node.type === "composition") {
      const variants = node.variants.filter((v) => matches(v.variant.name, query));
      if (variants.length > 0) {
        out.push({ ...node, variants });
      }
      continue;
    }
    const samples = node.samples.filter((sample) => matches(sample, query));
    if (samples.length > 0) {
      out.push({ ...node, samples });
    }
  }
  return out;
}

function filterFragmentGroups(groups: FragmentGroup[], query: string): FragmentGroup[] {
  return groups
    .map((group) => ({
      ...group,
      fragments: group.fragments.filter(
        (f) => matches(f.id, query) || f.tags.some((tag) => matches(tag, query)),
      ),
    }))
    .filter((group) => group.fragments.length > 0);
}

function countTreeLeaves(nodes: CompositionTreeNode[]): number {
  let count = 0;
  for (const node of nodes) {
    count += node.type === "group" ? countTreeLeaves(node.children) : 1;
  }
  return count;
}

function countFragments(groups: FragmentGroup[]): number {
  return groups.reduce((sum, group) => sum + group.fragments.length, 0);
}

/**
 * Case-insensitive substring filter over the whole sidebar: compositions and
 * code-prompts (with their variants/samples) plus fragments (id or tag). An
 * empty/whitespace query is a no-op that still reports the totals.
 */
export function applySidebarFilter(
  tree: CompositionTreeNode[],
  fragmentGroups: FragmentGroup[],
  rawQuery: string,
): SidebarFilterResult {
  const total = countTreeLeaves(tree) + countFragments(fragmentGroups);
  const query = rawQuery.trim().toLowerCase();
  if (query === "") {
    return { tree, fragmentGroups, matched: total, total };
  }
  const nextTree = filterTree(tree, query);
  const nextGroups = filterFragmentGroups(fragmentGroups, query);
  return {
    tree: nextTree,
    fragmentGroups: nextGroups,
    matched: countTreeLeaves(nextTree) + countFragments(nextGroups),
    total,
  };
}
