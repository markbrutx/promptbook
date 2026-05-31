import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseCliArgs } from "./args.js";
import { cmdAnnotations } from "./commands/annotations.js";
import { cmdBundle } from "./commands/bundle.js";
import { cmdEval } from "./commands/eval.js";
import { cmdLint } from "./commands/lint.js";
import { cmdLs } from "./commands/ls.js";
import { cmdResolve } from "./commands/resolve.js";
import { cmdView } from "./commands/view.js";
import { defaultIO, type IO } from "./io.js";

const HELP = `promptbook — compose prompts from reusable fragments

Usage:
  promptbook <command> [options]

Commands:
  resolve <prompt>        Assemble a prompt and print it to stdout
  lint [<prompt>]         Run static checks; with no prompt, book rules only
  eval [<name|glob>]      Run fixtures through a model adapter, report pass-rate
  bundle [<dir>]          Compile a prompts folder into an importable book module
  view                    Start the local web viewer over the prompts folder
  annotations <action>    Drain the viewer's feedback queue: list | resolve <id> | clear
  ls                      List compositions and fragments

Options:
  --dir <path>            Prompts folder (default: promptbook.json promptsDir, else ./prompts)
  --ctx key=value         Context value, repeatable (coerced to boolean/number/string)
  --context-file <json>   Merge context from a JSON file (--ctx overrides it)
  --explain               resolve: print the resolution trace to stderr
  --json                  Emit machine-readable JSON on stdout
  --max-tokens N          lint: token-budget ceiling (overrides promptbook.json)
  --strict                lint: exit non-zero on warnings too
  --model <id>            eval: model id for the adapter (overrides promptbook.json)
  --samples N             eval: default samples per fixture (default 1; a fixture's own samples wins)
  --threshold R           eval: a fixture passes when passRate >= R (default 1)
  --lint                  eval: run a static lint gate over every variant first
  -o, --out <file>        bundle: write the generated module to a file (default: stdout)
  --plain                 bundle: emit a plain module (no type-only import; e.g. for Deno)
  --port N                view: port for the viewer server (default: a free port)
  --no-open               view: do not open the browser after starting
  --fragments             ls: list fragments only
  --compositions          ls: list compositions only
  -h, --help              Show this help
  -v, --version           Show the version

Streams: stdout = payload (prompt text or JSON); stderr = explanations and errors.
`;

function readVersion(): string {
  try {
    const path = fileURLToPath(new URL("../../package.json", import.meta.url));
    const pkg = JSON.parse(readFileSync(path, "utf8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

/**
 * CLI entry point. Parses argv, handles `--help`/`--version`, then dispatches
 * to a subcommand. Returns the process exit code; never calls `process.exit`
 * so it stays testable. `io` injects all side effects (streams, fs, env, cwd).
 */
export async function run(argv: string[], io: IO = defaultIO()): Promise<number> {
  let args: ReturnType<typeof parseCliArgs>;
  try {
    args = parseCliArgs(argv);
  } catch (error) {
    io.stderr(`error: ${(error as Error).message}\n`);
    return 1;
  }

  if (args.help) {
    io.stdout(HELP);
    return 0;
  }
  if (args.version) {
    io.stdout(`${readVersion()}\n`);
    return 0;
  }
  if (args.command === undefined) {
    io.stdout(HELP);
    return 0;
  }

  switch (args.command) {
    case "resolve":
      return cmdResolve(args, io);
    case "lint":
      return cmdLint(args, io);
    case "eval":
      return cmdEval(args, io);
    case "bundle":
      return cmdBundle(args, io);
    case "view":
      return cmdView(args, io);
    case "annotations":
      return cmdAnnotations(args, io);
    case "ls":
      return cmdLs(args, io);
    default:
      io.stderr(`error: unknown command "${args.command}". Run "promptbook --help".\n`);
      return 1;
  }
}
