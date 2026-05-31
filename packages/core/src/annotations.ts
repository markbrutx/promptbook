/**
 * The viewer→agent feedback queue: the annotation data shape plus the JSONL
 * (de)serialization both ends share. The on-disk file is the cross-process
 * contract — the viewer writes it, an agent's CLI reads and clears it — so the
 * schema lives in one place. These helpers are pure and deterministic; the
 * non-deterministic parts (id/timestamp generation, disk IO) live in the
 * writer, not here.
 */
import type { Context } from "./types.js";

/** Queue directory, relative to the prompts folder — the cross-process contract. */
export const ANNOTATION_QUEUE_DIR = ".annotations";
/** Queue file inside {@link ANNOTATION_QUEUE_DIR}, one annotation per line. */
export const ANNOTATION_QUEUE_FILE = "inbox.jsonl";

/** An annotation is open until an agent resolves it. */
export type AnnotationStatus = "open" | "resolved";

/** What an annotation points at: a composition variant or a standalone fragment. */
export interface AnnotationTarget {
  /** Composition the annotated variant was assembled from. */
  prompt?: string;
  /** Context the variant was resolved under (present alongside `prompt`). */
  context?: Context;
  /** A fragment id, when annotating a fragment directly rather than a variant. */
  fragmentId?: string;
  /** Source file of the fragment/composition, to help the agent locate it. */
  sourceFile?: string;
}

/** Where, inside the source text, the comment is anchored. */
export interface AnnotationAnchor {
  /** Fragment whose body carries the selected text. */
  fragmentId: string;
  /** The exact text the user selected. */
  anchorText: string;
  /** Optional character offset within the fragment body, for disambiguation. */
  offset?: number;
}

/** One queued piece of human feedback, waiting for an agent to act on it. */
export interface Annotation {
  id: string;
  /** ISO-8601 creation time. */
  createdAt: string;
  target: AnnotationTarget;
  anchor: AnnotationAnchor;
  comment: string;
  status: AnnotationStatus;
}

/** True when `value` has the minimal required shape of an {@link Annotation}. */
function isAnnotation(value: unknown): value is Annotation {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  const anchor = record.anchor as Record<string, unknown> | undefined;
  return (
    typeof record.id === "string" &&
    typeof record.comment === "string" &&
    typeof anchor === "object" &&
    anchor !== null &&
    typeof anchor.fragmentId === "string"
  );
}

/**
 * Parse the inbox JSONL: one annotation per non-empty line. Malformed lines are
 * skipped rather than thrown — the queue must never crash on data, so a single
 * bad line cannot block the rest.
 */
export function parseInbox(text: string): Annotation[] {
  const annotations: Annotation[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === "") {
      continue;
    }
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (isAnnotation(parsed)) {
        annotations.push(parsed);
      }
    } catch {
      // skip a malformed line; the rest of the queue stays usable
    }
  }
  return annotations;
}

/** Serialize one annotation as a single append-safe JSONL line (with newline). */
export function serializeAnnotationLine(annotation: Annotation): string {
  return `${JSON.stringify(annotation)}\n`;
}

/** Serialize a whole queue back to JSONL, used when removing/rewriting entries. */
export function serializeInbox(annotations: Annotation[]): string {
  return annotations.map(serializeAnnotationLine).join("");
}
