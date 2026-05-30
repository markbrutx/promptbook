import { useState } from "react";
import type { Context, ContextValue } from "../types.js";

interface ControlsProps {
  /** Keys worth offering: the union of rule `when` keys and current context. */
  keys: string[];
  context: Context;
  onChange: (context: Context) => void;
}

const NUMERIC = /^-?\d+(?:\.\d+)?$/;

/** Coerce a raw input string like the CLI's `--ctx`: bool, number, else string. */
function coerce(raw: string): ContextValue {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (NUMERIC.test(raw)) return Number(raw);
  return raw;
}

/**
 * Context pickers = Storybook Controls. Editing a field re-resolves the variant
 * live. Keys come from the composition's `when` conditions plus whatever the
 * selected variant set; an extra row adds ad-hoc keys.
 */
export function Controls({ keys, context, onChange }: ControlsProps) {
  const [newKey, setNewKey] = useState("");

  const setValue = (key: string, raw: string): void => {
    const next: Context = { ...context };
    if (raw === "") {
      delete next[key];
    } else {
      next[key] = coerce(raw);
    }
    onChange(next);
  };

  const offered = [...new Set([...keys, ...Object.keys(context)])].sort();

  return (
    <div className="controls">
      {offered.length === 0 ? <p className="muted">No context axes.</p> : null}
      {offered.map((key) => (
        <label key={key} className="control-row">
          <span className="control-key">{key}</span>
          <input
            value={context[key] === undefined ? "" : String(context[key])}
            placeholder="(unset)"
            onChange={(event) => setValue(key, event.target.value)}
          />
        </label>
      ))}

      <form
        className="control-add"
        onSubmit={(event) => {
          event.preventDefault();
          const key = newKey.trim();
          if (key !== "") {
            onChange({ ...context, [key]: "" });
            setNewKey("");
          }
        }}
      >
        <input value={newKey} placeholder="add axis…" onChange={(event) => setNewKey(event.target.value)} />
        <button type="submit">+</button>
      </form>
    </div>
  );
}
