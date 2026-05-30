import type { PromptBook } from "../types.js";

/** A single mention of a fragment id, with enough context to report it. */
export interface FragmentReference {
  id: string;
  composition: string;
  /** Where in a composition the fragment id is mentioned. */
  role: "base" | "order" | "add" | "after" | "replace-from" | "replace-to" | "forbid" | "rule-order";
  /** Index of the rule the reference came from, when it came from a rule. */
  ruleIndex?: number;
}

/**
 * Yield every place a fragment id is referenced across all compositions: base
 * and explicit order lists, and each rule's add/after/replace/forbid/order.
 * Shared by the `unused-fragment` and `dangling-reference` rules so both see
 * the same reference surface.
 */
export function* iterateReferences(book: PromptBook): Generator<FragmentReference> {
  for (const composition of book.compositions.values()) {
    const composed = composition.name;
    for (const id of composition.base) {
      yield { id, composition: composed, role: "base" };
    }
    if (composition.order) {
      for (const id of composition.order) {
        yield { id, composition: composed, role: "order" };
      }
    }
    for (const rule of composition.rules) {
      const ruleIndex = rule.index;
      for (const id of rule.add ?? []) {
        yield { id, composition: composed, role: "add", ruleIndex };
      }
      if (rule.after !== undefined) {
        yield { id: rule.after, composition: composed, role: "after", ruleIndex };
      }
      for (const [from, to] of Object.entries(rule.replace ?? {})) {
        yield { id: from, composition: composed, role: "replace-from", ruleIndex };
        yield { id: to, composition: composed, role: "replace-to", ruleIndex };
      }
      for (const id of rule.forbid ?? []) {
        yield { id, composition: composed, role: "forbid", ruleIndex };
      }
      for (const id of rule.order ?? []) {
        yield { id, composition: composed, role: "rule-order", ruleIndex };
      }
    }
  }
}
