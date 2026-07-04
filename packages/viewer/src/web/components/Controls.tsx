import { useState } from "react";
import { starterPairs } from "../examples.js";
import type { Context, ContextValue } from "../types.js";

interface ControlsProps {
  /** Keys worth offering: the union of rule `when` keys and current context. */
  keys: string[];
  context: Context;
  /** Known values per axis (from the composition's rules and variants);
   * fuels placeholders, datalists and the empty-state starter chips. */
  examples: Record<string, ContextValue[]>;
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
 * selected variant set; an extra row adds ad-hoc keys. When no context is set,
 * starter chips (sourced from the book's own rules) teach the first flip.
 */
export function Controls({ keys, context, examples, onChange }: ControlsProps) {
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
  const starters = Object.keys(context).length === 0 ? starterPairs(examples) : [];

  return (
    <div className="controls">
      {offered.length === 0 ? <p className="muted">No context axes.</p> : null}
      {starters.length > 0 ? (
        <>
          <p className="muted control-hint">No context set — this is the base prompt. Try:</p>
          <div className="control-chips">
            {starters.map(({ key, value }) => (
              <button
                key={key}
                type="button"
                className="chip"
                onClick={() => onChange({ ...context, [key]: value })}
              >
                {key}={String(value)}
              </button>
            ))}
          </div>
        </>
      ) : null}
      {offered.map((key) => {
        const known = examples[key] ?? [];
        return (
          <label key={key} className="control-row">
            <span className="control-key">{key}</span>
            <input
              value={context[key] === undefined ? "" : String(context[key])}
              placeholder={known[0] === undefined ? "(unset)" : `e.g. ${String(known[0])}`}
              list={known.length > 0 ? `axis-${key}` : undefined}
              onChange={(event) => setValue(key, event.target.value)}
            />
            {known.length > 0 ? (
              <datalist id={`axis-${key}`}>
                {known.map((value) => (
                  <option key={String(value)} value={String(value)} />
                ))}
              </datalist>
            ) : null}
          </label>
        );
      })}

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
