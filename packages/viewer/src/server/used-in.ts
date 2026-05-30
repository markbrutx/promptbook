import type { PromptBook } from "@promptbook/core";
import { iterateReferences } from "@promptbook/core";
import type { UsedInReference } from "../shared/types.js";

/**
 * All references to `fragmentId` across compositions (base/order + each rule's
 * add/after/replace/forbid/order), reported per-composition for the used-in
 * panel. Reuses core's reference walk so the viewer can't drift from lint.
 */
export function usedIn(book: PromptBook, fragmentId: string): UsedInReference[] {
  const references: UsedInReference[] = [];
  for (const ref of iterateReferences(book)) {
    if (ref.id !== fragmentId) {
      continue;
    }
    references.push(
      ref.ruleIndex === undefined
        ? { composition: ref.composition, role: ref.role }
        : { composition: ref.composition, role: ref.role, ruleIndex: ref.ruleIndex },
    );
  }
  return references;
}
