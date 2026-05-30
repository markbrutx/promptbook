import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api.js";
import { Addons } from "./components/Addons.js";
import { Canvas } from "./components/Canvas.js";
import { Controls } from "./components/Controls.js";
import { Diff } from "./components/Diff.js";
import { FragmentView } from "./components/FragmentView.js";
import { Sidebar } from "./components/Sidebar.js";
import type { Selection } from "./selection.js";
import { buildCompositionTree, buildFragmentGroups, DEFAULT_VARIANT } from "./tree.js";
import type {
  BookResponse,
  CompositionSummary,
  Context,
  LintResponse,
  ResolveResponse,
  UsedInResponse,
} from "./types.js";

/** The context a named variant carries (Default = empty). */
function variantContext(composition: CompositionSummary | undefined, variant: string): Context {
  if (composition === undefined || variant === DEFAULT_VARIANT.name) {
    return {};
  }
  return composition.variants.find((v) => v.name === variant)?.context ?? {};
}

/** The context axes worth offering as Controls for a composition. */
function controlKeys(composition: CompositionSummary | undefined): string[] {
  if (composition === undefined) {
    return [];
  }
  const keys = new Set<string>();
  for (const rule of composition.rules) {
    for (const key of Object.keys(rule.when)) {
      keys.add(key);
    }
  }
  return [...keys];
}

export function App() {
  const [book, setBook] = useState<BookResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [context, setContext] = useState<Context>({});
  const [resolved, setResolved] = useState<ResolveResponse | null>(null);
  const [lint, setLint] = useState<LintResponse | null>(null);
  const [usedIn, setUsedIn] = useState<UsedInResponse | null>(null);
  const [compareVariant, setCompareVariant] = useState<string>("");
  const [compareResolved, setCompareResolved] = useState<ResolveResponse | null>(null);
  const requestId = useRef(0);

  const loadBook = useCallback(async () => {
    try {
      const next = await api.book();
      setBook(next);
      setError(null);
      return next;
    } catch (e) {
      setError((e as Error).message);
      return null;
    }
  }, []);

  // Initial load + pick the first composition's Default variant.
  useEffect(() => {
    void loadBook().then((next) => {
      const first = next?.compositions[0];
      if (first !== undefined) {
        setSelection({ kind: "variant", composition: first.name, variant: DEFAULT_VARIANT.name });
        setContext({});
      }
    });
  }, [loadBook]);

  // Hot-reload: refetch the book on folder changes. The new book object is a
  // fresh reference, so the resolve/used-in effects below re-run automatically.
  useEffect(() => {
    const source = new EventSource("/api/events");
    source.addEventListener("reload", () => void loadBook());
    return () => source.close();
  }, [loadBook]);

  const compositions = book?.compositions ?? [];
  const selectedComposition =
    selection?.kind === "variant" ? compositions.find((c) => c.name === selection.composition) : undefined;

  useEffect(() => {
    if (book === null || selection?.kind !== "variant") {
      setResolved(null);
      setLint(null);
      return;
    }
    requestId.current += 1;
    const id = requestId.current;
    const { composition } = selection;
    void Promise.all([api.resolve(composition, context), api.lint(composition, context)])
      .then(([r, l]) => {
        if (requestId.current === id) {
          setResolved(r);
          setLint(l);
          setError(null);
        }
      })
      .catch((e) => {
        if (requestId.current === id) {
          setError((e as Error).message);
        }
      });
  }, [book, selection, context]);

  useEffect(() => {
    if (book === null || selection?.kind !== "fragment") {
      setUsedIn(null);
      return;
    }
    void api
      .usedIn(selection.id)
      .then(setUsedIn)
      .catch(() => setUsedIn(null));
  }, [book, selection]);

  // Resolve the comparison variant for the Diff panel.
  useEffect(() => {
    if (selection?.kind !== "variant" || compareVariant === "") {
      setCompareResolved(null);
      return;
    }
    const ctx = variantContext(selectedComposition, compareVariant);
    void api
      .resolve(selection.composition, ctx)
      .then(setCompareResolved)
      .catch(() => setCompareResolved(null));
  }, [selection, compareVariant, selectedComposition]);

  const selectVariant = useCallback(
    (composition: string, variant: string) => {
      const summary = compositions.find((c) => c.name === composition);
      setSelection({ kind: "variant", composition, variant });
      setContext(variantContext(summary, variant));
      setCompareVariant("");
    },
    [compositions],
  );

  const selectFragment = useCallback((id: string) => {
    setSelection({ kind: "fragment", id });
  }, []);

  const tree = useMemo(() => buildCompositionTree(compositions), [compositions]);
  const fragmentGroups = useMemo(() => buildFragmentGroups(book?.fragments ?? []), [book]);
  const selectedFragment =
    selection?.kind === "fragment" ? book?.fragments.find((f) => f.id === selection.id) : undefined;

  return (
    <div className="layout">
      <Sidebar
        tree={tree}
        fragmentGroups={fragmentGroups}
        selection={selection}
        onSelectVariant={selectVariant}
        onSelectFragment={selectFragment}
      />

      {error !== null ? (
        <main className="canvas">
          <p className="warn">{error}</p>
        </main>
      ) : null}

      {error === null && selection?.kind === "variant" && resolved !== null ? (
        <Canvas
          title={selection.composition}
          subtitle={selection.variant}
          segments={resolved.segments}
          tokens={lint?.tokens}
        />
      ) : null}

      {error === null && selectedFragment !== undefined ? (
        <FragmentView
          fragment={selectedFragment}
          usedIn={usedIn}
          onSelectVariant={(composition) => selectVariant(composition, DEFAULT_VARIANT.name)}
        />
      ) : null}

      {selection?.kind === "variant" && resolved !== null ? (
        <aside className="rail">
          <section>
            <h3>Controls</h3>
            <Controls keys={controlKeys(selectedComposition)} context={context} onChange={setContext} />
          </section>
          <section>
            <h3>Diff</h3>
            <select value={compareVariant} onChange={(event) => setCompareVariant(event.target.value)}>
              <option value="">Compare with…</option>
              <option value={DEFAULT_VARIANT.name}>{DEFAULT_VARIANT.name}</option>
              {(selectedComposition?.variants ?? []).map((variant) => (
                <option key={variant.name} value={variant.name}>
                  {variant.name}
                </option>
              ))}
            </select>
            {compareResolved !== null ? (
              <Diff
                leftLabel={compareVariant}
                rightLabel={selection.variant}
                leftText={compareResolved.text}
                rightText={resolved.text}
              />
            ) : null}
          </section>
          <Addons trace={resolved.trace} lint={lint} />
        </aside>
      ) : null}
    </div>
  );
}
