import type { DefaultRulesOptions, LintReport } from "@promptbook/core";
import { defaultRules, lint, loadPrompts, resolveBook } from "@promptbook/core";
import type { ParsedArgs } from "../args.js";
import { buildContext, lintConfigFrom, loadConfig, requirePromptsDir } from "../config.js";
import { colorEnabled, emitWarnings, type IO } from "../io.js";
import { renderLintReport } from "../render-lint.js";

/**
 * `lint [<prompt>]`: run static checks over the prompts folder. With a prompt
 * it resolves under the given context and runs both book- and resolved-scope
 * rules; without one it runs book-scope rules over the whole book. The report
 * (human-readable or `--json`) goes to stdout; warnings go to stderr. Exit is
 * non-zero when any error is found, or any warning under `--strict`.
 */
export async function cmdLint(args: ParsedArgs, io: IO): Promise<number> {
  const config = await loadConfig(io);
  const promptsDir = await requirePromptsDir(io, args.dir, config);
  if (promptsDir === null) {
    return 1;
  }

  const lintConfig = lintConfigFrom(config);
  const ruleOptions: DefaultRulesOptions = {};
  const maxTokens = args.maxTokens ?? lintConfig.maxTokens;
  if (maxTokens !== undefined) {
    ruleOptions.maxTokens = maxTokens;
  }
  if (lintConfig.bannedTokens !== undefined) {
    ruleOptions.bannedTokens = lintConfig.bannedTokens;
  }
  const rules = defaultRules(ruleOptions);

  const book = await loadPrompts(promptsDir, io.fs);

  const prompt = args.operands[0];
  let report: LintReport;
  let label: string;
  let warnings: string[] = book.warnings;
  try {
    if (prompt !== undefined) {
      const context = await buildContext(io, args.ctx, args.contextFile);
      const result = resolveBook(book, prompt, context);
      // trace.warnings already includes the load-time book.warnings.
      warnings = result.trace.warnings;
      report = lint({ book, result }, rules);
      label = prompt;
    } else {
      report = lint({ book }, rules);
      label = "book";
    }
  } catch (error) {
    io.stderr(`error: ${(error as Error).message}\n`);
    return 1;
  }

  emitWarnings(io, warnings);

  if (args.json) {
    io.stdout(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    io.stdout(renderLintReport(report, label, colorEnabled(io)));
  }

  if (report.errorCount > 0) {
    return 1;
  }
  if (args.strict && report.warningCount > 0) {
    return 1;
  }
  return 0;
}
