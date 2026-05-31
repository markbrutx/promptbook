import type { ReactNode } from "react";
import { fragmentAccent } from "../colors.js";
import type { Selection } from "../selection.js";
import type { CompositionTreeNode, FragmentGroup, GroupNode } from "../tree.js";

interface SidebarProps {
  tree: CompositionTreeNode[];
  fragmentGroups: FragmentGroup[];
  selection: Selection | null;
  onSelectVariant: (composition: string, variant: string) => void;
  onSelectCode: (name: string, sample: string) => void;
  onSelectFragment: (id: string) => void;
}

function isVariantSelected(selection: Selection | null, composition: string, variant: string): boolean {
  return (
    selection?.kind === "variant" && selection.composition === composition && selection.variant === variant
  );
}

function isCodeSelected(selection: Selection | null, name: string, sample: string): boolean {
  return selection?.kind === "code" && selection.name === name && selection.sample === sample;
}

type NodeHandlers = {
  onSelectVariant: SidebarProps["onSelectVariant"];
  onSelectCode: SidebarProps["onSelectCode"];
};

/** One selectable button under an expandable leaf (a variant, sample, or fragment). */
interface LeafButton {
  key: string;
  label: string;
  active: boolean;
  onClick: () => void;
}

/** An expandable leaf: a label (with optional badge) over a list of select buttons. */
function LeafItem({ label, badge, items }: { label: string; badge?: ReactNode; items: LeafButton[] }) {
  return (
    <li className="tree-leaf">
      <details open>
        <summary className="tree-composition">
          {label}
          {badge !== undefined ? <> {badge}</> : null}
        </summary>
        <ul className="tree">
          {items.map((item) => (
            <li key={item.key}>
              <button
                type="button"
                className={`tree-item${item.active ? " active" : ""}`}
                onClick={item.onClick}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </details>
    </li>
  );
}

function CompositionNodes({
  nodes,
  selection,
  handlers,
}: {
  nodes: CompositionTreeNode[];
  selection: Selection | null;
  handlers: NodeHandlers;
}) {
  return (
    <ul className="tree">
      {nodes.map((node) => {
        if (node.type === "group") {
          return <GroupItem key={`g:${node.label}`} group={node} selection={selection} handlers={handlers} />;
        }
        if (node.type === "code") {
          return (
            <LeafItem
              key={`x:${node.name}`}
              label={node.label}
              badge={<span className="badge badge-code">code</span>}
              items={node.samples.map((sample) => ({
                key: sample,
                label: sample,
                active: isCodeSelected(selection, node.name, sample),
                onClick: () => handlers.onSelectCode(node.name, sample),
              }))}
            />
          );
        }
        return (
          <LeafItem
            key={`c:${node.name}`}
            label={node.label}
            items={node.variants.map((variant) => ({
              key: variant.variant.name,
              label: variant.variant.name,
              active: isVariantSelected(selection, node.name, variant.variant.name),
              onClick: () => handlers.onSelectVariant(node.name, variant.variant.name),
            }))}
          />
        );
      })}
    </ul>
  );
}

function GroupItem({
  group,
  selection,
  handlers,
}: {
  group: GroupNode;
  selection: Selection | null;
  handlers: NodeHandlers;
}) {
  return (
    <li className="tree-group">
      <details open>
        <summary className="tree-folder">{group.label}</summary>
        <CompositionNodes nodes={group.children} selection={selection} handlers={handlers} />
      </details>
    </li>
  );
}

export function Sidebar({
  tree,
  fragmentGroups,
  selection,
  onSelectVariant,
  onSelectCode,
  onSelectFragment,
}: SidebarProps) {
  const handlers: NodeHandlers = { onSelectVariant, onSelectCode };
  return (
    <nav className="sidebar">
      <section>
        <h2 className="sidebar-title">Compositions</h2>
        {tree.length === 0 ? (
          <p className="muted">(none)</p>
        ) : (
          <CompositionNodes nodes={tree} selection={selection} handlers={handlers} />
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
