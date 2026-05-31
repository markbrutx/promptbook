/** One run of a segment's text; `annotationId` marks an annotated span. */
export interface TextRun {
  text: string;
  annotationId?: string;
}

/** An existing annotation's anchor, reduced to what highlighting needs. */
export interface AnchorSpec {
  id: string;
  anchorText: string;
}

/**
 * Split `text` into runs, marking the first non-overlapping occurrence of each
 * anchor. Used to highlight existing annotations inside a colored segment.
 * Pure and DOM-free so it is unit-tested directly.
 */
export function markAnchors(text: string, anchors: AnchorSpec[]): TextRun[] {
  interface Range {
    start: number;
    end: number;
    id: string;
  }
  const ranges: Range[] = [];
  for (const anchor of anchors) {
    if (anchor.anchorText === "") {
      continue;
    }
    let from = 0;
    while (from <= text.length) {
      const start = text.indexOf(anchor.anchorText, from);
      if (start === -1) {
        break;
      }
      const end = start + anchor.anchorText.length;
      if (!ranges.some((r) => start < r.end && end > r.start)) {
        ranges.push({ start, end, id: anchor.id });
        break;
      }
      from = start + 1;
    }
  }
  ranges.sort((a, b) => a.start - b.start);

  const runs: TextRun[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start > cursor) {
      runs.push({ text: text.slice(cursor, range.start) });
    }
    runs.push({ text: text.slice(range.start, range.end), annotationId: range.id });
    cursor = range.end;
  }
  if (cursor < text.length || runs.length === 0) {
    runs.push({ text: text.slice(cursor) });
  }
  return runs;
}
