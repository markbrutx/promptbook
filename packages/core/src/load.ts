import { parse as parseYaml } from "yaml";
import { parseFrontmatter } from "./frontmatter.js";
import { nodeFs } from "./fs.js";
import { isContextValue, isMapping } from "./guards.js";
import { joinPath, listFiles, stripExt } from "./paths.js";
import type { Composition, ContextValue, Fragment, FsAdapter, PromptBook, Rule, When } from "./types.js";

const ACTION_KEYS = ["add", "replace", "forbid", "order"] as const;

function toStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((value) => String(value));
}

function toScalar(value: unknown): ContextValue {
  return isContextValue(value) ? value : String(value);
}

function parseWhen(raw: unknown): When {
  if (!isMapping(raw)) {
    return {};
  }
  const when: When = {};
  for (const [key, value] of Object.entries(raw)) {
    when[key] = toScalar(value);
  }
  return when;
}

function parseReplaceMap(raw: unknown, index: number, file: string): Record<string, string> {
  if (!isMapping(raw)) {
    throw new Error(`Rule #${index} in "${file}" has a "replace" that is not a mapping.`);
  }
  const map: Record<string, string> = {};
  for (const [from, to] of Object.entries(raw)) {
    map[from] = String(to);
  }
  return map;
}

function parseRule(entry: unknown, index: number, file: string): Rule {
  if (!isMapping(entry)) {
    throw new Error(`Rule #${index} in "${file}" must be a mapping.`);
  }
  const obj = entry;
  const present = ACTION_KEYS.filter((key) => obj[key] !== undefined);
  if (present.length !== 1) {
    throw new Error(
      `Rule #${index} in "${file}" must declare exactly one action (${ACTION_KEYS.join(
        " / ",
      )}); found ${present.length}.`,
    );
  }
  const action = present[0] as (typeof ACTION_KEYS)[number];
  const rule: Rule = { index, when: parseWhen(obj.when), action };
  switch (action) {
    case "add":
      rule.add = toStringArray(obj.add);
      if (typeof obj.after === "string") {
        rule.after = obj.after;
      }
      break;
    case "replace":
      rule.replace = parseReplaceMap(obj.replace, index, file);
      break;
    case "forbid":
      rule.forbid = toStringArray(obj.forbid);
      break;
    case "order":
      rule.order = toStringArray(obj.order);
      break;
  }
  return rule;
}

function parseRules(raw: unknown, file: string): Rule[] {
  if (raw === undefined || raw === null) {
    return [];
  }
  if (!Array.isArray(raw)) {
    throw new Error(`"rules" in "${file}" must be a list.`);
  }
  return raw.map((entry, index) => parseRule(entry, index, file));
}

async function loadFragments(fs: FsAdapter, dir: string): Promise<Map<string, Fragment>> {
  const fragments = new Map<string, Fragment>();
  const sourceById = new Map<string, string>();
  const fragmentsDir = joinPath(dir, "fragments");
  const files = await listFiles(fs, fragmentsDir, [".md", ".markdown"]);
  // Reads run in parallel; the sorted file order still drives processing,
  // so duplicate detection and output stay deterministic.
  const loaded = await Promise.all(
    files.map(async (file) => {
      const full = joinPath(fragmentsDir, file);
      return { full, raw: await fs.readFile(full) };
    }),
  );
  for (const { full, raw } of loaded) {
    const { data, body } = parseFrontmatter(raw);
    const id = typeof data.id === "string" ? data.id : undefined;
    if (!id) {
      throw new Error(`Fragment "${full}" is missing a string "id" in its frontmatter.`);
    }
    const existing = sourceById.get(id);
    if (existing) {
      throw new Error(`Duplicate fragment id "${id}" in "${existing}" and "${full}".`);
    }
    sourceById.set(id, full);
    const fragment: Fragment = { id, body: body.trim(), sourceFile: full };
    if (typeof data.kind === "string") {
      fragment.kind = data.kind;
    }
    if (Array.isArray(data.tags)) {
      fragment.tags = data.tags.map((tag) => String(tag));
    }
    fragments.set(id, fragment);
  }
  return fragments;
}

async function loadCompositions(
  fs: FsAdapter,
  dir: string,
  warnings: string[],
): Promise<Map<string, Composition>> {
  const compositions = new Map<string, Composition>();
  const rulesDir = joinPath(dir, "rules");
  const files = await listFiles(fs, rulesDir, [".yaml", ".yml"]);
  const loaded = await Promise.all(
    files.map(async (file) => {
      const full = joinPath(rulesDir, file);
      return { file, full, raw: await fs.readFile(full) };
    }),
  );
  for (const { file, full, raw } of loaded) {
    const doc = parseYaml(raw) as unknown;
    if (!isMapping(doc)) {
      warnings.push(`Composition file "${full}" is empty or not a mapping; skipped.`);
      continue;
    }
    const obj = doc;
    const name = typeof obj.name === "string" ? obj.name : stripExt(file);
    const composition: Composition = {
      name,
      base: toStringArray(obj.base),
      rules: parseRules(obj.rules, full),
      sourceFile: full,
    };
    if (obj.order !== undefined) {
      composition.order = toStringArray(obj.order);
    }
    const previous = compositions.get(name);
    if (previous) {
      warnings.push(
        `Duplicate composition name "${name}" in "${previous.sourceFile}" and "${full}"; using the latter.`,
      );
    }
    compositions.set(name, composition);
  }
  return compositions;
}

/**
 * Load a prompts folder (`fragments/` + `rules/`) into a {@link PromptBook}.
 *
 * Throws only on structural errors (missing/duplicate fragment id, malformed
 * rule). Soft issues (empty rules file, duplicate composition name) become
 * warnings. Reference checks against the context happen in `resolve`.
 */
export async function loadPrompts(promptsDir: string, fs: FsAdapter = nodeFs()): Promise<PromptBook> {
  const warnings: string[] = [];
  const [fragments, compositions] = await Promise.all([
    loadFragments(fs, promptsDir),
    loadCompositions(fs, promptsDir, warnings),
  ]);
  return { fragments, compositions, warnings };
}
