import type { CodePromptSummary, CompositionSummary, FragmentSummary, VariantSummary } from "./types.js";

/** A selectable variant (composition assembled under a named context). */
interface VariantNode {
  type: "variant";
  composition: string;
  variant: VariantSummary;
}

/** A composition leaf in the sidebar; its variants render when expanded. */
interface CompositionNode {
  type: "composition";
  /** Full composition name (path-like, e.g. `assistant/terse`). */
  name: string;
  /** Last path segment, shown as the leaf label. */
  label: string;
  variants: VariantNode[];
}

/** A code-prompt leaf in the sidebar; its samples render when expanded. */
interface CodePromptNode {
  type: "code";
  /** Full code-prompt name (path-like). */
  name: string;
  /** Last path segment, shown as the leaf label. */
  label: string;
  /** Sample labels, in declaration order. */
  samples: string[];
}

/** A folder grouping path-like prompt names (Storybook-style headings). */
export interface GroupNode {
  type: "group";
  label: string;
  children: CompositionTreeNode[];
}

export type CompositionTreeNode = GroupNode | CompositionNode | CodePromptNode;

/** The implicit, context-free variant every composition always has. */
export const DEFAULT_VARIANT: VariantSummary = { name: "Default", context: {} };

function variantNodes(composition: CompositionSummary): VariantNode[] {
  const variants = [DEFAULT_VARIANT, ...composition.variants];
  return variants.map((variant) => ({ type: "variant", composition: composition.name, variant }));
}

/** Walk/create folder groups for a path-like name, returning the leaf's group + label. */
function leafSlot(root: GroupNode, name: string): { group: GroupNode; label: string } {
  const segments = name.split("/").filter((s) => s !== "");
  let group = root;
  for (const segment of segments.slice(0, -1)) {
    let next = group.children.find(
      (child): child is GroupNode => child.type === "group" && child.label === segment,
    );
    if (next === undefined) {
      next = { type: "group", label: segment, children: [] };
      group.children.push(next);
    }
    group = next;
  }
  return { group, label: segments[segments.length - 1] ?? name };
}

/**
 * Build the hierarchical prompt tree: compositions and code-prompts side by
 * side in one menu. A `/` in a name nests it under folder groups (like
 * Storybook titles); the final segment is the leaf. Groups sort before leaves;
 * leaves (composition or code) sort alphabetically at each level.
 */
export function buildCompositionTree(
  compositions: CompositionSummary[],
  codePrompts: CodePromptSummary[] = [],
): CompositionTreeNode[] {
  const root: GroupNode = { type: "group", label: "", children: [] };

  for (const composition of compositions) {
    const { group, label } = leafSlot(root, composition.name);
    group.children.push({
      type: "composition",
      name: composition.name,
      label,
      variants: variantNodes(composition),
    });
  }
  for (const codePrompt of codePrompts) {
    const { group, label } = leafSlot(root, codePrompt.name);
    group.children.push({
      type: "code",
      name: codePrompt.name,
      label,
      samples: codePrompt.samples.map((s) => s.label),
    });
  }

  sortGroup(root);
  return root.children;
}

function sortGroup(group: GroupNode): void {
  group.children.sort((a, b) => {
    const aGroup = a.type === "group";
    const bGroup = b.type === "group";
    if (aGroup !== bGroup) {
      return aGroup ? -1 : 1;
    }
    return a.label.localeCompare(b.label);
  });
  for (const child of group.children) {
    if (child.type === "group") {
      sortGroup(child);
    }
  }
}

/** A group of fragments sharing a `kind` (or "other" when unset). */
export interface FragmentGroup {
  kind: string;
  fragments: FragmentSummary[];
}

/** Group fragments by `kind` for the sidebar's Fragments section. */
export function buildFragmentGroups(fragments: FragmentSummary[]): FragmentGroup[] {
  const byKind = new Map<string, FragmentSummary[]>();
  for (const fragment of fragments) {
    const kind = fragment.kind ?? "other";
    const list = byKind.get(kind) ?? [];
    list.push(fragment);
    byKind.set(kind, list);
  }
  return [...byKind.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([kind, list]) => ({ kind, fragments: list }));
}
