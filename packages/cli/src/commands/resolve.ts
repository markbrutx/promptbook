import type { ResolveResult } from "@promptbook/core";
import { resolve } from "@promptbook/core";
import type { ParsedArgs } from "../args.js";
import { buildContext, requirePromptsDir } from "../config.js";
import { colorEnabled, emitWarnings, type IO } from "../io.js";
import { renderExplain } from "../render-explain.js";

/**
 * `resolve <prompt>`: assemble the prompt and print its text to stdout. With
 * `--json`, print `{ text, trace }` instead; with `--explain`, additionally
 * print the trace to stderr. Warnings always go to stderr so nothing is lost.
 */
export async function cmdResolve(args: ParsedArgs, io: IO): Promise<number> {
  const prompt = args.operands[0];
  if (prompt === undefined) {
    io.stderr('error: resolve requires a <prompt> name. Run "promptbook --help".\n');
    return 1;
  }

  const promptsDir = await requirePromptsDir(io, args.dir);
  if (promptsDir === null) {
    return 1;
  }

  let result: ResolveResult;
  try {
    const context = await buildContext(io, args.ctx, args.contextFile);
    result = await resolve({ promptsDir, prompt, context, fs: io.fs });
  } catch (error) {
    io.stderr(`error: ${(error as Error).message}\n`);
    return 1;
  }

  const { text, trace } = result;
  emitWarnings(io, trace.warnings);

  if (args.json) {
    io.stdout(`${JSON.stringify({ text, trace }, null, 2)}\n`);
    return 0;
  }

  if (args.explain) {
    io.stderr(renderExplain(trace, colorEnabled(io)));
  }
  io.stdout(`${text}\n`);
  return 0;
}
