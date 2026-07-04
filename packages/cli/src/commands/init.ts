import { isAbsolute, join, relative, resolve as resolvePath } from "node:path";
import type { ParsedArgs } from "../args.js";
import type { IO } from "../io.js";

/**
 * Starter book: the smallest folder that still demonstrates the whole model —
 * fragments as WHAT, one rule cascade as WHEN (a tone swap on one context
 * axis), `${message}` interpolation, and a composition to resolve. Vocabulary
 * mirrors `examples/support-assistant` (synthetic, agnostic-safe).
 */
const FRAGMENTS: Record<string, string> = {
  "persona.md": `---
id: persona
kind: persona
tags: [voice]
---
You are a support assistant. You are accurate, calm, and helpful, and you only state things you can verify from the conversation.
`,
  "reply-tone-warm.md": `---
id: reply-tone-warm
kind: tone
tags: [reply]
---
Open with one short empathetic sentence that acknowledges the customer, then answer. Warm and human, never stiff.
`,
  "reply-tone-terse.md": `---
id: reply-tone-terse
kind: tone
tags: [reply]
---
Answer in at most three sentences. No greetings, no filler, no apologies unless something actually went wrong.
`,
  "guardrails.md": `---
id: guardrails
kind: constraint
tags: [safety]
---
Never invent order numbers, prices, or policy details. If you are not sure, say exactly what you would need to check.
`,
  "reply-task.md": `---
id: reply-task
kind: task
tags: [reply]
---
Task: reply to the customer message below.

Customer message:
\${message}
`,
};

const RULE = `name: reply
base:
  - persona
  - reply-tone-warm
  - guardrails
  - reply-task
rules:
  # Tone is one context axis: swap the whole tone fragment, no string-building.
  - when: { tone: terse }
    replace: { reply-tone-warm: reply-tone-terse }
`;

/** True when the file exists (any readable content counts). */
async function exists(io: IO, path: string): Promise<boolean> {
  try {
    await io.fs.readFile(path);
    return true;
  } catch {
    return false;
  }
}

/** Write `contents` unless the file already exists; report either way. Returns true when written. */
async function writeFresh(io: IO, path: string, contents: string): Promise<boolean> {
  if (await exists(io, path)) {
    io.stderr(`skip   ${path} (exists)\n`);
    return false;
  }
  await io.writeFile(path, contents);
  io.stderr(`create ${path}\n`);
  return true;
}

/**
 * `init [<dir>]`: scaffold a starter book — `promptbook.json` at the cwd plus
 * a prompts folder with five fragments and one composition (`reply`) whose
 * rule swaps the tone fragment on `tone=terse`. Never overwrites: existing
 * files are skipped, so re-running is safe and adopting into a half-set-up
 * project just fills the gaps. All chatter goes to stderr (stdout stays
 * payload-only per the stream contract); exit 0 unless a write fails.
 */
export async function cmdInit(args: ParsedArgs, io: IO): Promise<number> {
  const dirInput = args.operands[0] ?? args.dir ?? "./prompts";
  const promptsDir = isAbsolute(dirInput) ? dirInput : resolvePath(io.cwd(), dirInput);
  const configPath = resolvePath(io.cwd(), "promptbook.json");

  try {
    const relDir = relative(io.cwd(), promptsDir) || ".";
    const configBody = `${JSON.stringify({ promptsDir: `./${relDir}` }, null, 2)}\n`;
    await writeFresh(io, configPath, configBody);

    for (const [name, contents] of Object.entries(FRAGMENTS)) {
      await writeFresh(io, join(promptsDir, "fragments", name), contents);
    }
    await writeFresh(io, join(promptsDir, "rules", "reply.yaml"), RULE);
  } catch (error) {
    io.stderr(`error: ${(error as Error).message}\n`);
    return 1;
  }

  io.stderr(`\nbook ready in ${promptsDir}\n\nnext:\n`);
  io.stderr("  promptbook ls\n");
  io.stderr('  promptbook resolve reply --ctx tone=terse --ctx message="Where is my order?" --explain\n');
  io.stderr("  promptbook view\n");
  return 0;
}
