import type { Context, PromptBook } from "@markbrutx/promptbook-core";
import { interpolate } from "@markbrutx/promptbook-core";
import type { Segment } from "../shared/types.js";

/**
 * Re-derive the per-fragment slices of an assembled prompt for coloring.
 *
 * `resolveBook` joins the interpolated bodies of `trace.finalOrder` with
 * `"\n\n"`. Running the same interpolation over the same ids reproduces those
 * parts exactly, so `segments.map(s => s.text).join("\n\n")` is byte-identical
 * to the resolved `text`. This is asserted in the tests.
 */
export function deriveSegments(book: PromptBook, finalOrder: string[], context: Context): Segment[] {
  const segments: Segment[] = [];
  for (const fragmentId of finalOrder) {
    const fragment = book.fragments.get(fragmentId);
    if (fragment === undefined) {
      continue;
    }
    segments.push({
      fragmentId,
      text: interpolate(fragment.body, context, () => {}),
    });
  }
  return segments;
}
