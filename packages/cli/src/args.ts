import { parseArgs } from "node:util";

/** Normalized view of the command line, independent of `parseArgs` shape. */
export interface ParsedArgs {
  /** First positional: the subcommand, or undefined when none was given. */
  command: string | undefined;
  /** Positionals after the subcommand (e.g. the prompt name). */
  operands: string[];
  help: boolean;
  version: boolean;
  dir?: string;
  json: boolean;
  explain: boolean;
  /** bundle: write the generated module to this file instead of stdout. */
  out?: string;
  /** bundle: emit a plain module without the type-only import/annotation. */
  plain: boolean;
  /**
   * bundle: module specifier for the `import type { PromptBook }` line in typed
   * mode. Point it at a runtime-resolvable specifier (e.g.
   * `npm:@markbrutx/promptbook-core@1.2.3`) so a Deno consumer keeps the typed
   * annotation instead of falling back to `--plain`.
   */
  importSpecifier?: string;
  /** Repeated `--ctx key=value` pairs, parsed later by config. */
  ctx: string[];
  contextFile?: string;
  fragments: boolean;
  compositions: boolean;
  /** ls/resolve/bundle: operate across every book in the workspace. */
  all: boolean;
  /** bundle: compare the generated output with the existing artifact and exit non-zero on drift. */
  check: boolean;
  /** bundle: serialize without code-prompts so a runtime bundle stays lean. */
  excludeCodePrompts: boolean;
  /** lint: estimated token ceiling for the token-budget rule. */
  maxTokens?: number;
  /** lint: treat warnings as failures for the exit code. */
  strict: boolean;
  /** eval: model id passed to the adapter (overrides promptbook.json). */
  model?: string;
  /** eval: default samples per fixture when the fixture sets none. */
  samples?: number;
  /** eval: a fixture passes when passRate >= this threshold. */
  threshold?: number;
  /** eval: run lint on each resolved variant before sampling. */
  lint: boolean;
  /** view: port for the viewer server (0/undefined picks a free port). */
  port?: number;
  /** view: do not open the browser after the server starts. */
  noOpen: boolean;
}

/** Constraints for a numeric flag, used by {@link parseNumberFlag}. */
interface NumberFlagSpec {
  integer?: boolean;
  min?: number;
  max?: number;
  /** Human-readable expectation, e.g. "a positive integer". */
  expected: string;
}

/**
 * Parse an optional numeric flag, validating against `spec`. Returns undefined
 * when the flag was not given; throws a uniform `invalid --name` error when the
 * value is not a number or falls outside the allowed range.
 */
function parseNumberFlag(raw: string | undefined, name: string, spec: NumberFlagSpec): number | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const parsed = Number(raw);
  const valid =
    Number.isFinite(parsed) &&
    (!spec.integer || Number.isInteger(parsed)) &&
    (spec.min === undefined || parsed >= spec.min) &&
    (spec.max === undefined || parsed <= spec.max);
  if (!valid) {
    throw new Error(`invalid --${name} "${raw}"; expected ${spec.expected}`);
  }
  return parsed;
}

/**
 * Parse argv into {@link ParsedArgs}. Strict mode throws on unknown flags; the
 * caller turns that into a friendly stderr message and a non-zero exit.
 */
export function parseCliArgs(argv: string[]): ParsedArgs {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
      dir: { type: "string" },
      json: { type: "boolean" },
      explain: { type: "boolean" },
      out: { type: "string", short: "o" },
      plain: { type: "boolean" },
      "import-specifier": { type: "string" },
      ctx: { type: "string", multiple: true },
      "context-file": { type: "string" },
      fragments: { type: "boolean" },
      compositions: { type: "boolean" },
      all: { type: "boolean" },
      check: { type: "boolean" },
      "exclude-code-prompts": { type: "boolean" },
      "max-tokens": { type: "string" },
      strict: { type: "boolean" },
      model: { type: "string" },
      samples: { type: "string" },
      threshold: { type: "string" },
      lint: { type: "boolean" },
      port: { type: "string" },
      "no-open": { type: "boolean" },
    },
  });
  const maxTokens = parseNumberFlag(values["max-tokens"], "max-tokens", {
    integer: true,
    min: 1,
    expected: "a positive integer",
  });
  const samples = parseNumberFlag(values.samples, "samples", {
    integer: true,
    min: 1,
    expected: "a positive integer",
  });
  const threshold = parseNumberFlag(values.threshold, "threshold", {
    min: 0,
    max: 1,
    expected: "a number between 0 and 1",
  });
  const port = parseNumberFlag(values.port, "port", {
    integer: true,
    min: 0,
    max: 65535,
    expected: "a port between 0 and 65535",
  });
  return {
    command: positionals[0],
    operands: positionals.slice(1),
    help: values.help ?? false,
    version: values.version ?? false,
    dir: values.dir,
    json: values.json ?? false,
    explain: values.explain ?? false,
    out: values.out,
    plain: values.plain ?? false,
    importSpecifier: values["import-specifier"],
    ctx: values.ctx ?? [],
    contextFile: values["context-file"],
    fragments: values.fragments ?? false,
    compositions: values.compositions ?? false,
    all: values.all ?? false,
    check: values.check ?? false,
    excludeCodePrompts: values["exclude-code-prompts"] ?? false,
    maxTokens,
    strict: values.strict ?? false,
    model: values.model,
    samples,
    threshold,
    lint: values.lint ?? false,
    port,
    noOpen: values["no-open"] ?? false,
  };
}
