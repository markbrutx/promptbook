import type { CodePrompt, CodePromptSample, Composition, Fragment, PromptBook, Rule } from "./types.js";

/** Options for {@link serializeBook}. */
export interface SerializeBookOptions {
  /** Module specifier for the `import type { PromptBook }` line. Default `@markbrutx/promptbook-core`. */
  importSpecifier?: string;
  /**
   * Emit the `import type { PromptBook }` line and the `: PromptBook`
   * annotation. Default `true`. Set `false` for a plain, inference-typed
   * module — useful for runtimes that cannot resolve the type-only import
   * (e.g. Deno consuming the raw build), where the value still resolves fine.
   */
  typed?: boolean;
}

/** Locale-independent string order so serialized output is byte-stable across machines. */
function compareKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Map entries sorted by key with a locale-independent comparator. */
function sortedEntries<T>(map: Map<string, T>): [string, T][] {
  return [...map.entries()].sort((a, b) => compareKeys(a[0], b[0]));
}

/** Drop keys whose value is `undefined`, preserving insertion (declaration) order. */
function compact(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      out[key] = value;
    }
  }
  return out;
}

// The canonical builders below list every key explicitly via a
// `Record<keyof Required<…>>` literal: adding a field to the data model is then
// a compile error here until it is serialized, so the bundler never silently
// drops data. Key order follows the type declaration; absent optionals are
// compacted away. `JSON.stringify` of the result is a deterministic literal.

function canonicalFragment(fragment: Fragment): Record<string, unknown> {
  const ordered: Record<keyof Required<Fragment>, unknown> = {
    id: fragment.id,
    kind: fragment.kind,
    tags: fragment.tags,
    body: fragment.body,
    sourceFile: fragment.sourceFile,
  };
  return compact(ordered);
}

function canonicalRule(rule: Rule): Record<string, unknown> {
  const ordered: Record<keyof Required<Rule>, unknown> = {
    index: rule.index,
    when: rule.when,
    action: rule.action,
    add: rule.add,
    after: rule.after,
    replace: rule.replace,
    forbid: rule.forbid,
    order: rule.order,
  };
  return compact(ordered);
}

function canonicalComposition(composition: Composition): Record<string, unknown> {
  const ordered: Record<keyof Required<Composition>, unknown> = {
    name: composition.name,
    base: composition.base,
    order: composition.order,
    rules: composition.rules.map(canonicalRule),
    sourceFile: composition.sourceFile,
  };
  return compact(ordered);
}

function canonicalCodePromptSample(sample: CodePromptSample): Record<string, unknown> {
  const ordered: Record<keyof Required<CodePromptSample>, unknown> = {
    label: sample.label,
    context: sample.context,
    output: sample.output,
  };
  return compact(ordered);
}

function canonicalCodePrompt(codePrompt: CodePrompt): Record<string, unknown> {
  const ordered: Record<keyof Required<CodePrompt>, unknown> = {
    name: codePrompt.name,
    description: codePrompt.description,
    samples: codePrompt.samples.map(canonicalCodePromptSample),
    sourceFile: codePrompt.sourceFile,
  };
  return compact(ordered);
}

/** Emit `new Map([...])` with one `[key, value]` entry per line (entries pre-sorted). */
function serializeMap<T>(entries: [string, T][], canonical: (value: T) => unknown): string {
  if (entries.length === 0) {
    return "new Map([])";
  }
  const lines = entries.map(
    ([key, value]) => `    [${JSON.stringify(key)}, ${JSON.stringify(canonical(value))}],`,
  );
  return `new Map([\n${lines.join("\n")}\n  ])`;
}

/**
 * Serialize a {@link PromptBook} to a deterministic, evaluable expression:
 * `{ fragments: new Map([...]), compositions: new Map([...]),
 *    codePrompts: new Map([...]), warnings: [...] }`.
 *
 * The result is pure JavaScript (only `new Map`, arrays, object and scalar
 * literals) so it can be embedded in a module or reconstructed directly. Map
 * entries are sorted by key and optional fields are omitted when absent, so the
 * same book always produces byte-identical output.
 */
export function serializeBookExpression(book: PromptBook): string {
  const fragments = serializeMap(sortedEntries(book.fragments), canonicalFragment);
  const compositions = serializeMap(sortedEntries(book.compositions), canonicalComposition);
  const codePrompts = serializeMap(sortedEntries(book.codePrompts), canonicalCodePrompt);
  const warnings = JSON.stringify(book.warnings);
  return `{\n  fragments: ${fragments},\n  compositions: ${compositions},\n  codePrompts: ${codePrompts},\n  warnings: ${warnings},\n}`;
}

/**
 * Serialize a {@link PromptBook} to an importable TypeScript module exporting
 * `book: PromptBook`. Folding a prompts folder into a single module lets a
 * runtime (e.g. a Deno edge function) import the book instead of reading the
 * disk. Deterministic: the same book yields the same module text.
 *
 * The `: PromptBook` annotation is required so literal rule actions narrow to
 * `RuleAction` via contextual typing; pass `typed: false` (or use
 * {@link serializeBookExpression}) for the annotation-free value.
 */
export function serializeBook(book: PromptBook, options: SerializeBookOptions = {}): string {
  const typed = options.typed !== false;
  const importSpecifier = options.importSpecifier ?? "@markbrutx/promptbook-core";
  return [
    "// Code generated by `promptbook bundle`; do not edit by hand.",
    ...(typed ? [`import type { PromptBook } from "${importSpecifier}";`] : []),
    "",
    `export const book${typed ? ": PromptBook" : ""} = ${serializeBookExpression(book)};`,
    "",
    "export default book;",
    "",
  ].join("\n");
}

/**
 * Serialize a {@link PromptBook} to a deterministic JSON dump: fragments,
 * compositions and code-prompts as key-sorted arrays of their canonical objects,
 * plus warnings.
 * Shares the canonical key order and locale-independent sort with
 * {@link serializeBook}, so the JSON and module outputs never drift.
 */
export function serializeBookJson(book: PromptBook): string {
  const fragments = sortedEntries(book.fragments).map(([, value]) => canonicalFragment(value));
  const compositions = sortedEntries(book.compositions).map(([, value]) => canonicalComposition(value));
  const codePrompts = sortedEntries(book.codePrompts).map(([, value]) => canonicalCodePrompt(value));
  return `${JSON.stringify({ fragments, compositions, codePrompts, warnings: book.warnings }, null, 2)}\n`;
}
