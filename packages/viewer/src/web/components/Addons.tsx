import { useState } from "react";
import { kvLabel } from "../format.js";
import type { LintResponse, RuleTrace, Trace, When } from "../types.js";

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
    return <p className="muted">no data</p>;
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

function FiredRule({ rule }: { rule: RuleTrace }) {
  return (
    <li className="rule rule-fired">
      <span className="rule-mark" aria-hidden>
        ✓
      </span>
      <div className="rule-body">
        <div className="rule-head">
          <span className="rule-action">{rule.action}</span>
          <span className="rule-when">when {whenLabel(rule.when)}</span>
        </div>
        {rule.effect ? <p className="rule-effect">{rule.effect}</p> : null}
      </div>
    </li>
  );
}

function SkippedRule({ rule }: { rule: RuleTrace }) {
  return (
    <li className="rule rule-skipped">
      <span className="rule-mark" aria-hidden>
        ·
      </span>
      <div className="rule-body">
        <div className="rule-head">
          <span className="rule-action">{rule.action}</span>
          <span className="rule-when">when {whenLabel(rule.when)}</span>
        </div>
        {rule.reason ? <p className="rule-reason">{rule.reason}</p> : null}
      </div>
    </li>
  );
}

/** Explain trace panel: which rules fired, what they did, and (collapsed) the
 *  rules that did not match — kept out of the way so the trace reads as a
 *  trace, not as a list of errors. */
function ExplainPanel({ trace }: { trace: Trace }) {
  const fired = trace.rules.filter((r) => r.fired);
  const skipped = trace.rules.filter((r) => !r.fired);
  const [showSkipped, setShowSkipped] = useState(false);

  return (
    <div className="explain">
      <h4>Fired rules ({fired.length})</h4>
      {fired.length === 0 ? (
        <p className="muted small">No rules matched this context, so the base order is the final order.</p>
      ) : (
        <ul className="rules">
          {fired.map((rule) => (
            <FiredRule key={rule.index} rule={rule} />
          ))}
        </ul>
      )}

      {skipped.length > 0 ? (
        <details
          className="skipped-block"
          open={showSkipped}
          onToggle={(event) => setShowSkipped((event.target as HTMLDetailsElement).open)}
        >
          <summary className="skipped-summary">
            {skipped.length} rule{skipped.length === 1 ? "" : "s"} didn't match
          </summary>
          <ul className="rules">
            {skipped.map((rule) => (
              <SkippedRule key={rule.index} rule={rule} />
            ))}
          </ul>
        </details>
      ) : null}

      <h4>Final order</h4>
      <p className="order">{trace.finalOrder.join(" → ") || "(empty)"}</p>

      {trace.replaced.length > 0 || trace.added.length > 0 || trace.forbidden.length > 0 ? (
        <dl className="effects">
          {trace.replaced.length > 0 ? (
            <>
              <dt>replaced</dt>
              <dd>{trace.replaced.map((r) => `${r.from} → ${r.to}`).join(", ")}</dd>
            </>
          ) : null}
          {trace.added.length > 0 ? (
            <>
              <dt>added</dt>
              <dd>{trace.added.map((a) => a.id).join(", ")}</dd>
            </>
          ) : null}
          {trace.forbidden.length > 0 ? (
            <>
              <dt>forbidden</dt>
              <dd>{trace.forbidden.map((f) => f.id).join(", ")}</dd>
            </>
          ) : null}
        </dl>
      ) : null}

      {trace.unmatchedAxes.length > 0 ? (
        <p className="notice">
          <strong>Context axes some rule names but none matched:</strong>{" "}
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
        <p className="tokens">{lint ? `~${lint.tokens}` : "·"}</p>
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
