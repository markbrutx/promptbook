import { join } from "node:path";
import type { Annotation } from "@markbrutx/promptbook-core";
import {
  ANNOTATION_QUEUE_DIR,
  ANNOTATION_QUEUE_FILE,
  parseInbox,
  serializeInbox,
} from "@markbrutx/promptbook-core";
import type { ParsedArgs } from "../args.js";
import { requirePromptsDir } from "../config.js";
import type { IO } from "../io.js";
import { formatContext, plural } from "../style.js";

function queueFile(promptsDir: string): string {
  return join(promptsDir, ANNOTATION_QUEUE_DIR, ANNOTATION_QUEUE_FILE);
}

/** Read the queue via the injected fs; a missing file reads as empty. */
async function readQueue(io: IO, file: string): Promise<Annotation[]> {
  try {
    return parseInbox(await io.fs.readFile(file));
  } catch {
    return [];
  }
}

function describeTarget(annotation: Annotation): string {
  const { target } = annotation;
  if (target.prompt !== undefined) {
    const ctx = formatContext(target.context ?? {});
    return ctx === "" ? target.prompt : `${target.prompt} @ ${ctx}`;
  }
  return target.fragmentId ?? "(unknown)";
}

function renderAnnotation(annotation: Annotation): string {
  return [
    `• ${annotation.id}  [${describeTarget(annotation)}]`,
    `  anchor: ${annotation.anchor.fragmentId} — “${annotation.anchor.anchorText}”`,
    `  ${annotation.comment}`,
  ].join("\n");
}

async function listAnnotations(args: ParsedArgs, io: IO, file: string): Promise<number> {
  const open = (await readQueue(io, file)).filter((a) => a.status === "open");
  if (args.json) {
    io.stdout(`${JSON.stringify(open, null, 2)}\n`);
    return 0;
  }
  if (open.length === 0) {
    io.stdout("No open annotations.\n");
    return 0;
  }
  io.stdout(`${open.map(renderAnnotation).join("\n\n")}\n`);
  return 0;
}

async function resolveAnnotation(args: ParsedArgs, io: IO, file: string): Promise<number> {
  const id = args.operands[1];
  if (id === undefined || id === "") {
    io.stderr('error: "annotations resolve" needs an <id>.\n');
    return 1;
  }
  const all = await readQueue(io, file);
  const next = all.filter((a) => a.id !== id);
  if (next.length === all.length) {
    io.stderr(`error: no annotation with id "${id}".\n`);
    return 1;
  }
  await io.writeFile(file, serializeInbox(next));
  io.stdout(`Resolved ${id}.\n`);
  return 0;
}

async function clearAnnotations(io: IO, file: string): Promise<number> {
  const open = (await readQueue(io, file)).filter((a) => a.status === "open");
  await io.writeFile(file, "");
  io.stdout(`Cleared ${plural(open.length, "annotation")}.\n`);
  return 0;
}

/**
 * `annotations`: the terminal-agnostic side of the viewer's feedback bridge.
 * `list` prints open annotations (or `--json`), `resolve <id>` removes one, and
 * `clear` empties the queue. All operate on `<dir>/.annotations/inbox.jsonl` —
 * the same file the viewer writes — so any agent can drain it from any terminal.
 */
export async function cmdAnnotations(args: ParsedArgs, io: IO): Promise<number> {
  const promptsDir = await requirePromptsDir(io, args.dir);
  if (promptsDir === null) {
    return 1;
  }
  const file = queueFile(promptsDir);
  const action = args.operands[0] ?? "list";

  switch (action) {
    case "list":
      return listAnnotations(args, io, file);
    case "resolve":
      return resolveAnnotation(args, io, file);
    case "clear":
      return clearAnnotations(io, file);
    default:
      io.stderr(`error: unknown annotations action "${action}". Use list, resolve <id> or clear.\n`);
      return 1;
  }
}
