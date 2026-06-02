import { type Context, interpolate, type PromptBook } from "@markbrutx/promptbook-core/edge";
import type { Segment } from "@markbrutx/promptbook-viewer";

/**
 * Re-derive per-fragment slices of an assembled prompt for the viewer's
 * coloring. Mirrors `packages/viewer/src/server/segments.ts` exactly: running
 * the same interpolation over the same ids reproduces the parts joined with
 * `"\n\n"` in `resolveBook`'s text output.
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
