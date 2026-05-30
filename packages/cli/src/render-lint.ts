import type { LintFinding, LintReport, Severity } from "@promptbook/core";
import { makeStyle, plural, type Style } from "./style.js";

const SEVERITY_ORDER: Severity[] = ["error", "warning", "info"];

function location(finding: LintFinding): string {
  const parts: string[] = [];
  if (finding.fragmentId !== undefined) {
    parts.push(`fragment: ${finding.fragmentId}`);
  }
  if (finding.ruleIndex !== undefined) {
    parts.push(`rule #${finding.ruleIndex}`);
  }
  return parts.length > 0 ? `  (${parts.join(", ")})` : "";
}

function colorize(s: Style, severity: Severity, text: string): string {
  if (severity === "error") {
    return s.red(text);
  }
  if (severity === "warning") {
    return s.warn(text);
  }
  return s.dim(text);
}

/**
 * Render a {@link LintReport} as a human-readable block grouped by severity.
 * A clean report is a single green line; otherwise a summary line is followed
 * by `errors:`/`warnings:`/`info:` sections listing `ruleId: message`.
 */
export function renderLintReport(report: LintReport, label: string, color: boolean): string {
  const s = makeStyle(color);
  const head = s.bold(`lint "${label}"`);
  if (report.findings.length === 0) {
    return `${head} ${s.green("— no findings")}\n`;
  }

  const infoCount = report.findings.length - report.errorCount - report.warningCount;
  const summary: string[] = [];
  if (report.errorCount > 0) {
    summary.push(s.red(plural(report.errorCount, "error")));
  }
  if (report.warningCount > 0) {
    summary.push(s.warn(plural(report.warningCount, "warning")));
  }
  if (infoCount > 0) {
    summary.push(s.dim(plural(infoCount, "info")));
  }

  const lines: string[] = [`${head} — ${summary.join(", ")}`];
  for (const severity of SEVERITY_ORDER) {
    const group = report.findings.filter((finding) => finding.severity === severity);
    if (group.length === 0) {
      continue;
    }
    lines.push(colorize(s, severity, s.bold(`${severity}s:`)));
    for (const finding of group) {
      lines.push(`  ${finding.ruleId}: ${finding.message}${location(finding)}`);
    }
  }
  return `${lines.join("\n")}\n`;
}
