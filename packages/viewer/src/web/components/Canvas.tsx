import { fragmentAccent, fragmentColor } from "../colors.js";
import type { Segment } from "../types.js";

interface CanvasProps {
  title: string;
  subtitle?: string;
  segments: Segment[];
  tokens?: number;
}

/**
 * The assembled prompt, each segment tinted by its source fragment. The
 * segments concatenate (with blank lines between them) into the exact resolved
 * text, so what is shown here is byte-for-byte the prompt the model would see.
 */
export function Canvas({ title, subtitle, segments, tokens }: CanvasProps) {
  const ids = [...new Set(segments.map((s) => s.fragmentId))];
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
              style={{
                background: fragmentColor(segment.fragmentId),
                borderColor: fragmentAccent(segment.fragmentId),
              }}
              title={segment.fragmentId}
            >
              <span className="segment-tag">{segment.fragmentId}</span>
              {segment.text}
            </pre>
          ))
        )}
      </div>
    </main>
  );
}
