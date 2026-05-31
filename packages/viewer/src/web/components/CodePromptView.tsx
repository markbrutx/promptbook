import { useState } from "react";
import { kvLabel } from "../format.js";
import type { CodePromptSummary } from "../types.js";
import { Diff } from "./Diff.js";

interface CodePromptViewProps {
  codePrompt: CodePromptSummary;
  /** The sample label currently shown. */
  sample: string;
  onSelectSample: (label: string) => void;
}

/**
 * A code-prompt node: a builder-backed prompt the core never executes. The
 * canvas shows a captured snapshot of its output (no fragment breakdown, since
 * the builder is opaque) with a "code" badge, lets you switch samples, and
 * diffs two snapshots. Honest about being computed, not declarative.
 */
export function CodePromptView({ codePrompt, sample, onSelectSample }: CodePromptViewProps) {
  const [compare, setCompare] = useState("");
  const samples = codePrompt.samples;
  const current = samples.find((s) => s.label === sample) ?? samples[0];
  const other = samples.find((s) => s.label === compare);

  return (
    <main className="canvas">
      <header className="canvas-head">
        <div>
          <h1 className="canvas-title">
            {codePrompt.name} <span className="badge badge-code">code</span>
          </h1>
          {codePrompt.description ? <p className="muted">{codePrompt.description}</p> : null}
        </div>
      </header>

      {samples.length === 0 || current === undefined ? (
        <p className="muted">No samples captured for this code-prompt.</p>
      ) : (
        <>
          <div className="code-tabs">
            {samples.map((s) => (
              <button
                key={s.label}
                type="button"
                className={`code-tab${s.label === current.label ? " active" : ""}`}
                onClick={() => onSelectSample(s.label)}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="prompt">
            <pre className="segment code-sample">
              <span className="segment-tag">
                code{current.context ? ` · ${kvLabel(current.context)}` : ""}
              </span>
              {current.output}
            </pre>
          </div>

          <section className="code-diff">
            <h3>Diff</h3>
            <select value={compare} onChange={(event) => setCompare(event.target.value)}>
              <option value="">Compare with…</option>
              {samples
                .filter((s) => s.label !== current.label)
                .map((s) => (
                  <option key={s.label} value={s.label}>
                    {s.label}
                  </option>
                ))}
            </select>
            {other !== undefined ? (
              <Diff
                leftLabel={other.label}
                rightLabel={current.label}
                leftText={other.output}
                rightText={current.output}
              />
            ) : null}
          </section>
        </>
      )}
    </main>
  );
}
