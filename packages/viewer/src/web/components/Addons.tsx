import { kvLabel } from "../format.js";
import type { LintResponse, Trace, When } from "../types.js";

interface AddonsProps {
  trace: Trace;
  lint: LintResponse | null;
}

function whenLabel(when: When): string {
  return Object.keys(when).length === 0 ? "always" : kvLabel(when);
}

/** Lint findings panel: severity-tagged messages with the fragment/rule origin. */
function LintPanel({ lint }: { lint: LintResponse | null }) {
  if (lint === null) {
    return <p className="muted">—</p>;
  }
  if (lint.findings.length === 0) {
    return <p className="muted">No findings ({lint.tokens} tokens).</p>;
  }
  return (
    <ul className="findings">
      {lint.findings.map((finding, index) => (
        <li key={`${finding.ruleId}:${index}`} className={`finding ${finding.severity}`}>
          <span className="finding-sev">{finding.severity}</span>
          <span className="finding-rule">{finding.ruleId}</span>
          <span>{finding.message}</span>
          {finding.fragmentId ? <code className="finding-frag">{finding.fragmentId}</code> : null}
        </li>
      ))}
    </ul>
  );
}

/** Explain trace panel: which rules fired and why, plus the net effects. */
function ExplainPanel({ trace }: { trace: Trace }) {
  return (
    <div className="explain">
      <h4>Rules</h4>
      <ul className="rules">
        {trace.rules.map((rule) => (
          <li key={rule.index} className={rule.fired ? "fired" : "skipped"}>
            <span className="rule-mark">{rule.fired ? "✓" : "·"}</span>
            <span className="rule-action">{rule.action}</span>
            <span className="muted">when {whenLabel(rule.when)}</span>
            {rule.effect ? <div className="rule-effect">{rule.effect}</div> : null}
            {rule.reason ? <div className="rule-reason">{rule.reason}</div> : null}
          </li>
        ))}
        {trace.rules.length === 0 ? <li className="muted">No rules.</li> : null}
      </ul>

      <h4>Final order</h4>
      <p className="order">{trace.finalOrder.join(" → ") || "(empty)"}</p>

      {trace.replaced.length > 0 ? (
        <p>
          <strong>replaced:</strong> {trace.replaced.map((r) => `${r.from}→${r.to}`).join(", ")}
        </p>
      ) : null}
      {trace.added.length > 0 ? (
        <p>
          <strong>added:</strong> {trace.added.map((a) => a.id).join(", ")}
        </p>
      ) : null}
      {trace.forbidden.length > 0 ? (
        <p>
          <strong>forbidden:</strong> {trace.forbidden.map((f) => f.id).join(", ")}
        </p>
      ) : null}

      {trace.unmatchedAxes.length > 0 ? (
        <p className="warn">
          <strong>unmatched axes:</strong>{" "}
          {trace.unmatchedAxes.map((axis) => `${axis.key}=${axis.value}`).join(", ")}
        </p>
      ) : null}
      {trace.warnings.length > 0 ? (
        <ul className="warnings">
          {trace.warnings.map((warning) => (
            <li key={warning} className="warn">
              {warning}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Right-hand Addons rail: tokens, lint, and the explain trace. */
export function Addons({ trace, lint }: AddonsProps) {
  return (
    <aside className="addons">
      <section>
        <h3>Tokens</h3>
        <p className="tokens">{lint ? `~${lint.tokens}` : "—"}</p>
      </section>
      <section>
        <h3>Lint</h3>
        <LintPanel lint={lint} />
      </section>
      <section>
        <h3>Explain</h3>
        <ExplainPanel trace={trace} />
      </section>
    </aside>
  );
}
