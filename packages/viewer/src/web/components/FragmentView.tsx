import { fragmentAccent } from "../colors.js";
import type { FragmentSummary, UsedInResponse } from "../types.js";

interface FragmentViewProps {
  fragment: FragmentSummary;
  usedIn: UsedInResponse | null;
  onSelectVariant: (composition: string) => void;
}

/** Inspect a fragment: its body, metadata, and where it is used (the graph). */
export function FragmentView({ fragment, usedIn, onSelectVariant }: FragmentViewProps) {
  return (
    <main className="canvas">
      <header className="canvas-head">
        <div>
          <h1 className="canvas-title">
            <span className="swatch" style={{ background: fragmentAccent(fragment.id) }} />
            {fragment.id}
          </h1>
          <p className="muted">
            {fragment.kind ?? "·"}
            {fragment.tags.length > 0 ? ` · ${fragment.tags.join(", ")}` : ""} · {fragment.sourceFile}
          </p>
        </div>
      </header>

      <pre className="segment" style={{ background: "var(--panel)" }}>
        {fragment.body}
      </pre>

      <section className="used-in">
        <h3>Used in</h3>
        {usedIn === null || usedIn.references.length === 0 ? (
          <p className="muted">Not referenced by any composition.</p>
        ) : (
          <ul className="used-list">
            {usedIn.references.map((ref, index) => (
              <li key={`${ref.composition}:${ref.role}:${index}`}>
                <button type="button" className="link" onClick={() => onSelectVariant(ref.composition)}>
                  {ref.composition}
                </button>
                <span className="muted">
                  {" "}
                  {ref.role}
                  {ref.ruleIndex !== undefined ? ` (rule #${ref.ruleIndex})` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
