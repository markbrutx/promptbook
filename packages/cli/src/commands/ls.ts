import { relative } from "node:path";
import { loadPrompts } from "@promptbook/core";
import type { ParsedArgs } from "../args.js";
import { requirePromptsDir } from "../config.js";
import { emitWarnings, type IO } from "../io.js";

/**
 * `ls`: list compositions (name, base length, rule count) and fragments
 * (id, kind, tags, source). `--fragments`/`--compositions` narrow the output;
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
  const fragments = [...book.fragments.values()].sort((a, b) => a.id.localeCompare(b.id));

  if (args.json) {
    const out: Record<string, unknown> = {};
    if (showCompositions) {
      out.compositions = compositions.map((c) => ({
        name: c.name,
        base: c.base.length,
        rules: c.rules.length,
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
