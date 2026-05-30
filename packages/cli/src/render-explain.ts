import type { ContextValue, Trace } from "@promptbook/core";
import { makeStyle } from "./style.js";

function whenLabel(when: Record<string, ContextValue>): string {
  const parts = Object.entries(when).map(([key, value]) => `${key}=${value}`);
  return parts.length > 0 ? parts.join(", ") : "always";
}

/**
 * Render an explain {@link Trace} as a human-readable block for stderr: which
 * rules fired (and why not), the final order, the replace/add/forbid effects,
 * and a highlighted "no rule matched" section for unmatched context axes.
 */
export function renderExplain(trace: Trace, color: boolean): string {
  const s = makeStyle(color);
  const lines: string[] = [];

  const contextLabel = whenLabel(trace.context);
  lines.push(`${s.bold(`resolve "${trace.prompt}"`)}${s.dim(` · context: ${contextLabel}`)}`);

  lines.push(s.bold("rules:"));
  if (trace.rules.length === 0) {
    lines.push(`  ${s.dim("(none)")}`);
  }
  for (const rule of trace.rules) {
    const head = `#${rule.index} ${rule.action} ${s.dim(`[${whenLabel(rule.when)}]`)}`;
    if (rule.fired) {
      lines.push(`  ${s.green("✓")} ${head} → ${rule.effect ?? ""}`);
    } else {
      lines.push(`  ${s.red("✗")} ${head} ${s.dim(`— ${rule.reason ?? "did not match"}`)}`);
    }
  }

  lines.push(`${s.bold("final order:")} ${trace.finalOrder.join(" → ") || "(empty)"}`);

  if (trace.replaced.length > 0) {
    lines.push(s.bold("replaced:"));
    for (const entry of trace.replaced) {
      lines.push(`  ${entry.from} → ${entry.to} ${s.dim(`(#${entry.ruleIndex})`)}`);
    }
  }
  if (trace.added.length > 0) {
    lines.push(s.bold("added:"));
    for (const entry of trace.added) {
      const anchor = entry.after !== undefined ? ` after ${entry.after}` : "";
      lines.push(`  ${entry.id}${anchor} ${s.dim(`(#${entry.ruleIndex})`)}`);
    }
  }
  if (trace.forbidden.length > 0) {
    lines.push(s.bold("forbidden:"));
    for (const entry of trace.forbidden) {
      lines.push(`  ${entry.id} ${s.dim(`(#${entry.ruleIndex})`)}`);
    }
  }

  if (trace.unmatchedAxes.length > 0) {
    lines.push(s.warn(s.bold("unmatched axes:")));
    for (const axis of trace.unmatchedAxes) {
      lines.push(`  ${s.warn(`⚠ no rules matched for ${axis.key}=${axis.value}`)}`);
    }
  }

  return `${lines.join("\n")}\n`;
}
