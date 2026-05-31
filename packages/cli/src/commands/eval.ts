import type {
  EvalReport,
  Fixture,
  LintFinding,
  LintRule,
  ModelAdapter,
  PromptBook,
} from "@markbrutx/promptbook-core";
import {
  defaultRules,
  evaluate,
  lint,
  loadFixtures,
  loadPrompts,
  resolveBook,
} from "@markbrutx/promptbook-core";
import { openRouterAdapter } from "@markbrutx/promptbook-openrouter";
import type { ParsedArgs } from "../args.js";
import { type EvalConfig, evalConfigFrom, loadConfig, requirePromptsDir } from "../config.js";
import { type AdapterOptions, colorEnabled, type IO } from "../io.js";
import { renderEvalReport } from "../render-eval.js";

/** Convert a `name|glob` pattern (only `*` is special) into an anchored regex. */
function globToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}

/** Build the model adapter: the injected one for tests, else OpenRouter. */
function buildAdapter(io: IO, options: AdapterOptions): ModelAdapter {
  if (io.makeAdapter) {
    return io.makeAdapter(options);
  }
  if (options.model === undefined) {
    throw new Error('eval requires a model: pass --model <id> or set "eval.model" in promptbook.json.');
  }
  const adapterOptions = { model: options.model, apiKey: options.apiKey, baseUrl: options.baseUrl };
  return openRouterAdapter(adapterOptions);
}

/** Lint every resolved variant; return findings with error severity. */
function lintGate(book: PromptBook, fixtures: Fixture[], rules: LintRule[]): LintFinding[] {
  const errors: LintFinding[] = [];
  for (const fixture of fixtures) {
    const result = resolveBook(book, fixture.prompt, fixture.context ?? {});
    const report = lint({ book, result }, rules);
    for (const finding of report.findings) {
      if (finding.severity === "error") {
        errors.push({ ...finding, message: `${fixture.name}: ${finding.message}` });
      }
    }
  }
  return errors;
}

/**
 * `eval [<name|glob>]`: load fixtures from `<dir>/fixtures`, assemble each
 * prompt, sample it through a model adapter and report pass-rate. A fixture
 * passes when its `passRate >= --threshold` (default 1). Exit is non-zero when
 * any fixture fails the gate or on any error (no key, unknown prompt/fixture,
 * missing folder). `--lint` runs a static gate over every variant first; with
 * any lint error it aborts before spending tokens. Adapter is injectable via
 * `io.makeAdapter` so tests never touch the network.
 */
export async function cmdEval(args: ParsedArgs, io: IO): Promise<number> {
  const config = await loadConfig(io);
  const promptsDir = await requirePromptsDir(io, args.dir, config);
  if (promptsDir === null) {
    return 1;
  }

  let fixtures: Fixture[];
  try {
    fixtures = await loadFixtures(promptsDir, io.fs);
  } catch (error) {
    io.stderr(`error: ${(error as Error).message}\n`);
    return 1;
  }

  const filter = args.operands[0];
  if (filter !== undefined) {
    const re = globToRegExp(filter);
    fixtures = fixtures.filter((f) => re.test(f.name));
    if (fixtures.length === 0) {
      io.stderr(`error: no fixtures match "${filter}".\n`);
      return 1;
    }
  }
  if (fixtures.length === 0) {
    io.stderr(`error: no fixtures found in ${promptsDir}/fixtures.\n`);
    return 1;
  }

  const book = await loadPrompts(promptsDir, io.fs);
  const threshold = args.threshold ?? 1;

  let report: EvalReport;
  try {
    if (args.lint) {
      const errors = lintGate(book, fixtures, defaultRules());
      if (errors.length > 0) {
        io.stderr("error: lint gate failed before sampling:\n");
        for (const finding of errors) {
          io.stderr(`  ${finding.ruleId}: ${finding.message}\n`);
        }
        return 1;
      }
    }

    const evalConfig: EvalConfig = evalConfigFrom(config);
    const adapter = buildAdapter(io, {
      model: args.model ?? evalConfig.model,
      apiKey: io.env.OPENROUTER_API_KEY,
      baseUrl: evalConfig.baseUrl,
    });

    const evalInput = {
      book,
      fixtures,
      adapter,
      passThreshold: threshold,
      ...(args.samples !== undefined ? { samples: args.samples } : {}),
    };
    report = await evaluate(evalInput);
  } catch (error) {
    io.stderr(`error: ${(error as Error).message}\n`);
    return 1;
  }

  if (args.json) {
    io.stdout(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    io.stdout(renderEvalReport(report, threshold, colorEnabled(io)));
  }

  return report.failed > 0 ? 1 : 0;
}
