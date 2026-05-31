import { relative } from "node:path";
import { loadPrompts } from "@markbrutx/promptbook-core";
import type { ParsedArgs } from "../args.js";
import { requirePromptsDir } from "../config.js";
import { emitWarnings, type IO } from "../io.js";

/**
 * `ls`: list compositions (name, base length, rule count), code-prompts
 * (name, description, sample count) and fragments (id, kind, tags, source) —
 * the unified menu of every prompt in the book. `--fragments`/`--compositions`
 * narrow the output (code-prompts ride with compositions, both being prompts);
 * `--json` emits a structured list instead of the human-readable tree.
 */
export async function cmdLs(args: ParsedArgs, io: IO): Promise<number> {
  const promptsDir = await requirePromptsDir(io, args.dir);
  if (promptsDir === null) {
    return 1;
  }

  const book = await loadPrompts(promptsDir, io.fs);
  emitWarnings(io, book.warnings);

  const onlyOneSection = args.fragments || args.compositions;
  const showCompositions = args.compositions || !onlyOneSection;
  const showFragments = args.fragments || !onlyOneSection;

  const compositions = [...book.compositions.values()].sort((a, b) => a.name.localeCompare(b.name));
  const codePrompts = [...book.codePrompts.values()].sort((a, b) => a.name.localeCompare(b.name));
  const fragments = [...book.fragments.values()].sort((a, b) => a.id.localeCompare(b.id));

  if (args.json) {
    const out: Record<string, unknown> = {};
    if (showCompositions) {
      out.compositions = compositions.map((c) => ({
        name: c.name,
        base: c.base.length,
        rules: c.rules.length,
      }));
      out.codePrompts = codePrompts.map((c) => ({
        name: c.name,
        description: c.description ?? null,
        samples: c.samples.length,
      }));
    }
    if (showFragments) {
      out.fragments = fragments.map((f) => ({
        id: f.id,
        kind: f.kind ?? null,
        tags: f.tags ?? [],
        sourceFile: f.sourceFile,
      }));
    }
    io.stdout(`${JSON.stringify(out, null, 2)}\n`);
    return 0;
  }

  const lines: string[] = [];
  if (showCompositions) {
    lines.push("compositions:");
    if (compositions.length === 0) {
      lines.push("  (none)");
    }
    for (const c of compositions) {
      lines.push(`  ${c.name}  base=${c.base.length}  rules=${c.rules.length}`);
    }
    if (codePrompts.length > 0) {
      lines.push("");
      lines.push("code-prompts:");
      for (const c of codePrompts) {
        lines.push(`  ${c.name}  kind=code  samples=${c.samples.length}`);
      }
    }
  }
  if (showFragments) {
    if (lines.length > 0) {
      lines.push("");
    }
    lines.push("fragments:");
    if (fragments.length === 0) {
      lines.push("  (none)");
    }
    for (const f of fragments) {
      const tags = f.tags && f.tags.length > 0 ? f.tags.join(",") : "-";
      const source = relative(promptsDir, f.sourceFile) || f.sourceFile;
      lines.push(`  ${f.id}  kind=${f.kind ?? "-"}  tags=${tags}  ${source}`);
    }
  }
  io.stdout(`${lines.join("\n")}\n`);
  return 0;
}
