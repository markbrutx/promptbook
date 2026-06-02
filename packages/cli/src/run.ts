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
import { cmdWatch } from "./commands/watch.js";
import { defaultIO, type IO } from "./io.js";

const HELP = `promptbook · compose prompts from reusable fragments

Usage:
  promptbook <command> [options]

Commands:
  resolve [<book>/]<prompt>  Assemble a prompt and print it to stdout (--all: every book)
  lint [<prompt>]         Run static checks; with no prompt, book rules only
  eval [<name|glob>]      Run fixtures through a model adapter, report pass-rate
  bundle [<dir>]          Compile a prompts folder into an importable book module (--all/--check)
  watch [<dir>]           Rebuild book.generated.ts as fragments/rules/compositions change
  view                    Start the local web viewer over the workspace (book switcher)
  annotations <action>    Drain the viewer's feedback queue: list | resolve <id> | clear
  ls                      List compositions and fragments (--all: cross-book inventory)

A <book>/<comp> operand addresses one book in a multi-book workspace; a bare
name resolves by uniqueness. With a single-book --dir, names work unqualified.

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
  -o, --out <file>        bundle/watch: write to a file (default: stdout for bundle, <bookDir>/book.generated.ts for watch/--all)
  --plain                 bundle/watch: emit a plain module (no type-only import; e.g. for Deno)
  --check                 bundle: compare with the existing output; exit 1 on drift or missing artifact
  --exclude-code-prompts  bundle/watch: serialize code-prompts as an empty map (runtime-lean bundle)
  --port N                view: port for the viewer server (default: a free port)
  --no-open               view: do not open the browser after starting
  --fragments             ls: list fragments only
  --compositions          ls: list compositions only
  --all                   ls/resolve/bundle: span every book in the workspace
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
    case "watch":
      return cmdWatch(args, io);
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
