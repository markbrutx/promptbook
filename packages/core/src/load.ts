import { parse as parseYaml } from "yaml";
import { parseFrontmatter } from "./frontmatter.js";
import { nodeFs } from "./fs.js";
import { isContextValue, isMapping } from "./guards.js";
import { joinPath, listFiles, stripExt } from "./paths.js";
import type {
  CodePrompt,
  CodePromptSample,
  Composition,
  Context,
  ContextValue,
  Fragment,
  FsAdapter,
  PromptBook,
  Rule,
  When,
} from "./types.js";

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

/** Parse a context bag, or `undefined` when absent/empty (keeps the field optional). */
function parseContextBag(raw: unknown): Context | undefined {
  const bag = parseWhen(raw);
  return Object.keys(bag).length > 0 ? bag : undefined;
}

/**
 * Load every `.yaml`/`.yml` file in `dir` into a name-keyed map. Owns the shared
 * scaffold: parallel reads, skip-with-warning on a non-mapping doc, and the
 * duplicate-name warning (later wins). The caller's `build` turns one parsed doc
 * into a named value; `noun` labels the warnings ("Composition", "Code-prompt").
 */
async function loadYamlDir<T extends { name: string; sourceFile: string }>(
  fs: FsAdapter,
  dir: string,
  noun: string,
  warnings: string[],
  build: (doc: Record<string, unknown>, file: string, full: string) => Promise<T> | T,
): Promise<Map<string, T>> {
  const map = new Map<string, T>();
  const files = await listFiles(fs, dir, [".yaml", ".yml"]);
  const loaded = await Promise.all(
    files.map(async (file) => {
      const full = joinPath(dir, file);
      return { file, full, raw: await fs.readFile(full) };
    }),
  );
  for (const { file, full, raw } of loaded) {
    const doc = parseYaml(raw) as unknown;
    if (!isMapping(doc)) {
      warnings.push(`${noun} file "${full}" is empty or not a mapping; skipped.`);
      continue;
    }
    const value = await build(doc, file, full);
    const previous = map.get(value.name);
    if (previous) {
      warnings.push(
        `Duplicate ${noun.toLowerCase()} name "${value.name}" in "${previous.sourceFile}" and "${full}"; using the latter.`,
      );
    }
    map.set(value.name, value);
  }
  return map;
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

function loadCompositions(fs: FsAdapter, dir: string, warnings: string[]): Promise<Map<string, Composition>> {
  return loadYamlDir(fs, joinPath(dir, "rules"), "Composition", warnings, (obj, file, full) => {
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
    return composition;
  });
}

/**
 * Load the captured output samples of one code-prompt manifest. A sample's text
 * comes inline (`output`) or from a sibling file (`file`). Malformed entries
 * and missing files become warnings, never throws — the core never runs the
 * builder, so a broken snapshot just drops out of the menu.
 */
async function loadCodePromptSamples(
  fs: FsAdapter,
  codeDir: string,
  raw: unknown,
  manifest: string,
  warnings: string[],
): Promise<CodePromptSample[]> {
  if (raw === undefined || raw === null) {
    return [];
  }
  if (!Array.isArray(raw)) {
    warnings.push(`"samples" in "${manifest}" must be a list; ignored.`);
    return [];
  }
  const samples: CodePromptSample[] = [];
  for (let index = 0; index < raw.length; index++) {
    const entry = raw[index];
    if (!isMapping(entry)) {
      warnings.push(`Sample #${index} in "${manifest}" must be a mapping; skipped.`);
      continue;
    }
    const label = typeof entry.label === "string" ? entry.label : undefined;
    if (!label) {
      warnings.push(`Sample #${index} in "${manifest}" is missing a string "label"; skipped.`);
      continue;
    }
    let output: string | undefined;
    if (typeof entry.output === "string") {
      output = entry.output;
    } else if (typeof entry.file === "string") {
      try {
        output = await fs.readFile(joinPath(codeDir, entry.file));
      } catch {
        warnings.push(`Sample "${label}" in "${manifest}" references missing file "${entry.file}"; skipped.`);
        continue;
      }
    } else {
      warnings.push(`Sample "${label}" in "${manifest}" must set "output" or "file"; skipped.`);
      continue;
    }
    const sample: CodePromptSample = { label, output };
    const context = parseContextBag(entry.context);
    if (context !== undefined) {
      sample.context = context;
    }
    samples.push(sample);
  }
  return samples;
}

function loadCodePrompts(fs: FsAdapter, dir: string, warnings: string[]): Promise<Map<string, CodePrompt>> {
  const codeDir = joinPath(dir, "code-prompts");
  return loadYamlDir(fs, codeDir, "Code-prompt", warnings, async (obj, file, full) => {
    const name = typeof obj.name === "string" ? obj.name : stripExt(file);
    const samples = await loadCodePromptSamples(fs, codeDir, obj.samples, full, warnings);
    const codePrompt: CodePrompt = { name, samples, sourceFile: full };
    if (typeof obj.description === "string") {
      codePrompt.description = obj.description;
    }
    return codePrompt;
  });
}

/**
 * Load a prompts folder (`fragments/` + `rules/` + optional `code-prompts/`)
 * into a {@link PromptBook}.
 *
 * Throws only on structural errors (missing/duplicate fragment id, malformed
 * rule). Soft issues (empty rules file, duplicate composition name, broken
 * code-prompt manifest/sample) become warnings. Code-prompts hold snapshot text
 * only — the builder is never executed. Reference checks happen in `resolve`.
 */
export async function loadPrompts(promptsDir: string, fs: FsAdapter = nodeFs()): Promise<PromptBook> {
  const warnings: string[] = [];
  const [fragments, compositions, codePrompts] = await Promise.all([
    loadFragments(fs, promptsDir),
    loadCompositions(fs, promptsDir, warnings),
    loadCodePrompts(fs, promptsDir, warnings),
  ]);
  return { fragments, compositions, codePrompts, warnings };
}
