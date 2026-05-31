import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Annotation, AnnotationAnchor, AnnotationTarget, Context } from "@promptbook/core";
import {
  ANNOTATION_QUEUE_DIR,
  ANNOTATION_QUEUE_FILE,
  parseInbox,
  serializeAnnotationLine,
  serializeInbox,
} from "@promptbook/core";

/** The flat body the viewer posts; the store expands it into an {@link Annotation}. */
export interface AnnotateInput {
  /** Composition the variant was assembled from (omit for a fragment target). */
  prompt?: string;
  /** Context the variant was resolved under (kept with `prompt`). */
  context?: Context;
  fragmentId: string;
  anchorText: string;
  comment: string;
  offset?: number;
  /** Source file of the fragment, when annotating a fragment directly. */
  sourceFile?: string;
}

/** The append-safe queue under `<promptsDir>/.annotations/inbox.jsonl`. */
export interface AnnotationStore {
  /** Append a new open annotation and return it. */
  append(input: AnnotateInput): Promise<Annotation>;
  /** Open annotations in queue order (oldest first). */
  list(): Promise<Annotation[]>;
  /** Remove one annotation by id; resolves to whether it existed. */
  remove(id: string): Promise<boolean>;
}

/** Expand the posted body into a full annotation (id + timestamp added here). */
function buildAnnotation(input: AnnotateInput): Annotation {
  const target: AnnotationTarget =
    input.prompt !== undefined
      ? { prompt: input.prompt, context: input.context ?? {} }
      : { fragmentId: input.fragmentId, ...(input.sourceFile ? { sourceFile: input.sourceFile } : {}) };
  const anchor: AnnotationAnchor = {
    fragmentId: input.fragmentId,
    anchorText: input.anchorText,
    ...(input.offset !== undefined ? { offset: input.offset } : {}),
  };
  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    target,
    anchor,
    comment: input.comment,
    status: "open",
  };
}

/**
 * File-backed annotation queue. Appends are line-atomic (one JSONL line);
 * removals rewrite the file. A missing queue simply reads as empty. This is the
 * viewer's only write surface — `@promptbook/core` stays read-only.
 */
export function createAnnotationStore(promptsDir: string): AnnotationStore {
  const dir = join(promptsDir, ANNOTATION_QUEUE_DIR);
  const file = join(dir, ANNOTATION_QUEUE_FILE);

  const readAll = async (): Promise<Annotation[]> => {
    try {
      return parseInbox(await readFile(file, "utf8"));
    } catch {
      return [];
    }
  };

  return {
    async append(input) {
      const annotation = buildAnnotation(input);
      await mkdir(dir, { recursive: true });
      await appendFile(file, serializeAnnotationLine(annotation));
      return annotation;
    },
    async list() {
      return (await readAll()).filter((annotation) => annotation.status === "open");
    },
    async remove(id) {
      const all = await readAll();
      const next = all.filter((annotation) => annotation.id !== id);
      if (next.length === all.length) {
        return false;
      }
      // The dir/file already exist (an annotation was present), so no mkdir.
      await writeFile(file, serializeInbox(next));
      return true;
    },
  };
}
