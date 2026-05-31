import { useEffect, useMemo, useRef, useState } from "react";
import { type AnchorSpec, markAnchors } from "../annotations.js";
import { fragmentAccent, fragmentColor } from "../colors.js";
import type { Annotation, Segment } from "../types.js";

interface CanvasProps {
  title: string;
  subtitle?: string;
  segments: Segment[];
  tokens?: number;
  /** Open annotations for this variant, highlighted inside their fragment. */
  annotations: Annotation[];
  /** Persist a new annotation for the selected fragment text. */
  onAnnotate: (fragmentId: string, anchorText: string, comment: string) => Promise<void>;
}

/** A pending selection awaiting a comment, anchored near the selected text. */
interface Draft {
  fragmentId: string;
  anchorText: string;
  top: number;
  left: number;
}

/** Read the current text selection, if it lands inside a segment's body. */
function selectionDraft(): Draft | null {
  const selection = window.getSelection();
  if (selection === null || selection.isCollapsed) {
    return null;
  }
  const anchorText = selection.toString().trim();
  if (anchorText === "") {
    return null;
  }
  const node = selection.anchorNode;
  const element = node instanceof Element ? node : (node?.parentElement ?? null);
  const host = element?.closest<HTMLElement>("[data-fragment-id]") ?? null;
  const fragmentId = host?.dataset.fragmentId;
  if (fragmentId === undefined) {
    return null;
  }
  const rect = selection.getRangeAt(0).getBoundingClientRect();
  return { fragmentId, anchorText, top: rect.bottom, left: rect.left };
}

/**
 * The assembled prompt, each segment tinted by its source fragment. The
 * segments concatenate (with blank lines between them) into the exact resolved
 * text, so what is shown here is byte-for-byte the prompt the model would see.
 * Selecting text opens a comment popover; existing annotations are highlighted.
 */
export function Canvas({ title, subtitle, segments, tokens, annotations, onAnnotate }: CanvasProps) {
  const ids = [...new Set(segments.map((s) => s.fragmentId))];
  const [draft, setDraft] = useState<Draft | null>(null);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // A document-level listener keeps interaction handlers off the static prompt
  // markup (and selections outside a segment are simply ignored).
  useEffect(() => {
    const onMouseUp = (): void => {
      const next = selectionDraft();
      if (next !== null) {
        setDraft(next);
        setComment("");
      }
    };
    document.addEventListener("mouseup", onMouseUp);
    return () => document.removeEventListener("mouseup", onMouseUp);
  }, []);

  useEffect(() => {
    if (draft !== null) {
      textareaRef.current?.focus();
    }
  }, [draft]);

  // Group anchors by fragment once per annotations change, so each segment does
  // a map lookup instead of scanning the whole list on every render.
  const anchorsByFragment = useMemo(() => {
    const byFragment = new Map<string, AnchorSpec[]>();
    for (const a of annotations) {
      const list = byFragment.get(a.anchor.fragmentId) ?? [];
      list.push({ id: a.id, anchorText: a.anchor.anchorText });
      byFragment.set(a.anchor.fragmentId, list);
    }
    return byFragment;
  }, [annotations]);

  const submit = async (): Promise<void> => {
    if (draft === null || comment.trim() === "") {
      return;
    }
    setSaving(true);
    try {
      await onAnnotate(draft.fragmentId, draft.anchorText, comment.trim());
      setDraft(null);
      setComment("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="canvas">
      <header className="canvas-head">
        <div>
          <h1 className="canvas-title">{title}</h1>
          {subtitle ? <p className="muted">{subtitle}</p> : null}
        </div>
        {tokens !== undefined ? <span className="badge">~{tokens} tokens</span> : null}
      </header>

      {ids.length > 0 ? (
        <ul className="legend">
          {ids.map((id) => (
            <li key={id}>
              <span className="swatch" style={{ background: fragmentAccent(id) }} />
              {id}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="prompt">
        {segments.length === 0 ? (
          <p className="muted">No fragments rendered for this context.</p>
        ) : (
          segments.map((segment) => (
            <pre
              key={segment.fragmentId}
              className="segment"
              data-fragment-id={segment.fragmentId}
              style={{
                background: fragmentColor(segment.fragmentId),
                borderColor: fragmentAccent(segment.fragmentId),
              }}
              title={segment.fragmentId}
            >
              <span className="segment-tag">{segment.fragmentId}</span>
              {annotations.length === 0
                ? segment.text
                : markAnchors(segment.text, anchorsByFragment.get(segment.fragmentId) ?? []).map(
                    (run, index) =>
                      run.annotationId !== undefined ? (
                        <mark key={index} className="annot-mark">
                          {run.text}
                        </mark>
                      ) : (
                        <span key={index}>{run.text}</span>
                      ),
                  )}
            </pre>
          ))
        )}
      </div>

      {draft !== null ? (
        <div className="annot-popover" style={{ top: draft.top, left: draft.left }}>
          <p className="annot-quote">“{draft.anchorText}”</p>
          <textarea
            ref={textareaRef}
            value={comment}
            placeholder="Comment for the agent…"
            onChange={(event) => setComment(event.target.value)}
          />
          <div className="annot-actions">
            <button type="button" className="link" onClick={() => setDraft(null)}>
              Cancel
            </button>
            <button type="button" disabled={saving || comment.trim() === ""} onClick={() => void submit()}>
              Save
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
