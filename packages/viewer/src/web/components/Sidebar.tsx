import { fragmentAccent } from "../colors.js";
import type { Selection } from "../selection.js";
import type { CompositionTreeNode, FragmentGroup, GroupNode } from "../tree.js";

interface SidebarProps {
  tree: CompositionTreeNode[];
  fragmentGroups: FragmentGroup[];
  selection: Selection | null;
  onSelectVariant: (composition: string, variant: string) => void;
  onSelectFragment: (id: string) => void;
}

function isVariantSelected(selection: Selection | null, composition: string, variant: string): boolean {
  return (
    selection?.kind === "variant" && selection.composition === composition && selection.variant === variant
  );
}

function CompositionNodes({
  nodes,
  selection,
  onSelectVariant,
}: {
  nodes: CompositionTreeNode[];
  selection: Selection | null;
  onSelectVariant: SidebarProps["onSelectVariant"];
}) {
  return (
    <ul className="tree">
      {nodes.map((node) =>
        node.type === "group" ? (
          <GroupItem
            key={`g:${node.label}`}
            group={node}
            selection={selection}
            onSelectVariant={onSelectVariant}
          />
        ) : (
          <li key={`c:${node.name}`} className="tree-leaf">
            <details open>
              <summary className="tree-composition">{node.label}</summary>
              <ul className="tree">
                {node.variants.map((variant) => {
                  const active = isVariantSelected(selection, node.name, variant.variant.name);
                  return (
                    <li key={variant.variant.name}>
                      <button
                        type="button"
                        className={`tree-item${active ? " active" : ""}`}
                        onClick={() => onSelectVariant(node.name, variant.variant.name)}
                      >
                        {variant.variant.name}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </details>
          </li>
        ),
      )}
    </ul>
  );
}

function GroupItem({
  group,
  selection,
  onSelectVariant,
}: {
  group: GroupNode;
  selection: Selection | null;
  onSelectVariant: SidebarProps["onSelectVariant"];
}) {
  return (
    <li className="tree-group">
      <details open>
        <summary className="tree-folder">{group.label}</summary>
        <CompositionNodes nodes={group.children} selection={selection} onSelectVariant={onSelectVariant} />
      </details>
    </li>
  );
}

export function Sidebar({
  tree,
  fragmentGroups,
  selection,
  onSelectVariant,
  onSelectFragment,
}: SidebarProps) {
  return (
    <nav className="sidebar">
      <section>
        <h2 className="sidebar-title">Compositions</h2>
        {tree.length === 0 ? (
          <p className="muted">(none)</p>
        ) : (
          <CompositionNodes nodes={tree} selection={selection} onSelectVariant={onSelectVariant} />
        )}
      </section>

      <section>
        <h2 className="sidebar-title">Fragments</h2>
        {fragmentGroups.map((group) => (
          <details key={group.kind} className="tree-group" open>
            <summary className="tree-folder">{group.kind}</summary>
            <ul className="tree">
              {group.fragments.map((fragment) => {
                const active = selection?.kind === "fragment" && selection.id === fragment.id;
                return (
                  <li key={fragment.id}>
                    <button
                      type="button"
                      className={`tree-item${active ? " active" : ""}`}
                      onClick={() => onSelectFragment(fragment.id)}
                    >
                      <span className="swatch" style={{ background: fragmentAccent(fragment.id) }} />
                      {fragment.id}
                    </button>
                  </li>
                );
              })}
            </ul>
          </details>
        ))}
      </section>
    </nav>
  );
}
