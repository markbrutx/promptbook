import { diffLines } from "../diff.js";

interface DiffProps {
  leftLabel: string;
  rightLabel: string;
  leftText: string;
  rightText: string;
}

const MARK: Record<string, string> = { equal: " ", add: "+", remove: "-" };

/** Line diff of two variants of the same composition. */
export function Diff({ leftLabel, rightLabel, leftText, rightText }: DiffProps) {
  const rows = diffLines(leftText, rightText);
  return (
    <div className="diff">
      <p className="muted">
        − {leftLabel} &nbsp; + {rightLabel}
      </p>
      <pre className="diff-body">
        {rows.map((row, index) => (
          <div key={`${index}:${row.text}`} className={`diff-row ${row.type}`}>
            <span className="diff-mark">{MARK[row.type]}</span>
            {row.text}
          </div>
        ))}
      </pre>
    </div>
  );
}
