import type { PromptBook } from "@markbrutx/promptbook-core";
import type { BookJson } from "./types";

/**
 * Reconstruct a {@link PromptBook} from the canonical `serializeBookJson`
 * output. The site's `prebuild` script writes the JSON at build time; this
 * deserializer runs in the browser to feed it into `resolveBook` from
 * `@markbrutx/promptbook-core/edge`.
 *
 * The round-trip is lossless: a unit test in this workspace serializes a
 * loaded book, parses it back, and asserts `resolveBook` produces byte-for-byte
 * identical text against the original. If that test fails, the fix lives in
 * core (serialize/resolve), not in the site.
 */
export function parseBookJson(json: BookJson): PromptBook {
  const fragments = new Map<string, PromptBook["fragments"] extends Map<string, infer F> ? F : never>();
  for (const fragment of json.fragments) {
    fragments.set(fragment.id, {
      id: fragment.id,
      ...(fragment.kind !== undefined ? { kind: fragment.kind } : {}),
      ...(fragment.tags !== undefined ? { tags: fragment.tags } : {}),
      body: fragment.body,
      sourceFile: fragment.sourceFile,
    });
  }

  const compositions = new Map<string, PromptBook["compositions"] extends Map<string, infer C> ? C : never>();
  for (const composition of json.compositions) {
    compositions.set(composition.name, {
      name: composition.name,
      base: composition.base,
      ...(composition.order !== undefined ? { order: composition.order } : {}),
      rules: composition.rules.map((rule) => ({
        index: rule.index,
        when: rule.when,
        action: rule.action,
        ...(rule.add !== undefined ? { add: rule.add } : {}),
        ...(rule.after !== undefined ? { after: rule.after } : {}),
        ...(rule.replace !== undefined ? { replace: rule.replace } : {}),
        ...(rule.forbid !== undefined ? { forbid: rule.forbid } : {}),
        ...(rule.order !== undefined ? { order: rule.order } : {}),
      })),
      sourceFile: composition.sourceFile,
    });
  }

  const codePrompts = new Map<string, PromptBook["codePrompts"] extends Map<string, infer C> ? C : never>();
  for (const codePrompt of json.codePrompts) {
    codePrompts.set(codePrompt.name, {
      name: codePrompt.name,
      ...(codePrompt.description !== undefined ? { description: codePrompt.description } : {}),
      samples: codePrompt.samples.map((sample) => ({
        label: sample.label,
        ...(sample.context !== undefined ? { context: sample.context } : {}),
        output: sample.output,
      })),
      sourceFile: codePrompt.sourceFile,
    });
  }

  return {
    fragments,
    compositions,
    codePrompts,
    warnings: [...json.warnings],
  };
}
