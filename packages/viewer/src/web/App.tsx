import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api.js";
import { Addons } from "./components/Addons.js";
import { Canvas } from "./components/Canvas.js";
import { CodePromptView } from "./components/CodePromptView.js";
import { Controls } from "./components/Controls.js";
import { Diff } from "./components/Diff.js";
import { FragmentView } from "./components/FragmentView.js";
import { Sidebar } from "./components/Sidebar.js";
import type { Selection } from "./selection.js";
import { buildCompositionTree, buildFragmentGroups, DEFAULT_VARIANT } from "./tree.js";
import type {
  Annotation,
  BookResponse,
  CompositionSummary,
  Context,
  LintResponse,
  ResolveResponse,
  UsedInResponse,
} from "./types.js";

/** Order-independent key for comparing two contexts (variant identity). */
function contextKey(context: Context): string {
  return JSON.stringify(Object.entries(context).sort(([a], [b]) => a.localeCompare(b)));
}

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
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const requestId = useRef(0);

  const loadAnnotations = useCallback(async () => {
    try {
      const { annotations: next } = await api.annotations();
      setAnnotations(next);
    } catch {
      setAnnotations([]);
    }
  }, []);

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
    void loadAnnotations();
  }, [loadBook, loadAnnotations]);

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

  const selectCode = useCallback((name: string, sample: string) => {
    setSelection({ kind: "code", name, sample });
  }, []);

  const selectFragment = useCallback((id: string) => {
    setSelection({ kind: "fragment", id });
  }, []);

  const addAnnotation = useCallback(
    async (fragmentId: string, anchorText: string, comment: string) => {
      if (selection?.kind !== "variant") {
        return;
      }
      await api.annotate({ prompt: selection.composition, context, fragmentId, anchorText, comment });
      await loadAnnotations();
    },
    [selection, context, loadAnnotations],
  );

  const resolveAnnotation = useCallback(
    async (id: string) => {
      await api.resolveAnnotation(id);
      await loadAnnotations();
    },
    [loadAnnotations],
  );

  // Annotations belonging to exactly the variant on screen (composition + context).
  const variantAnnotations = useMemo(() => {
    if (selection?.kind !== "variant") {
      return [];
    }
    const key = contextKey(context);
    return annotations.filter(
      (a) => a.target.prompt === selection.composition && contextKey(a.target.context ?? {}) === key,
    );
  }, [annotations, selection, context]);

  const codePrompts = book?.codePrompts ?? [];
  const tree = useMemo(() => buildCompositionTree(compositions, codePrompts), [compositions, codePrompts]);
  const fragmentGroups = useMemo(() => buildFragmentGroups(book?.fragments ?? []), [book]);
  const selectedFragment =
    selection?.kind === "fragment" ? book?.fragments.find((f) => f.id === selection.id) : undefined;
  const selectedCodePrompt =
    selection?.kind === "code" ? codePrompts.find((c) => c.name === selection.name) : undefined;

  return (
    <div className="layout">
      <Sidebar
        tree={tree}
        fragmentGroups={fragmentGroups}
        selection={selection}
        onSelectVariant={selectVariant}
        onSelectCode={selectCode}
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
          annotations={variantAnnotations}
          onAnnotate={addAnnotation}
        />
      ) : null}

      {error === null && selection?.kind === "code" && selectedCodePrompt !== undefined ? (
        <CodePromptView
          codePrompt={selectedCodePrompt}
          sample={selection.sample}
          onSelectSample={(label) => selectCode(selectedCodePrompt.name, label)}
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
          <section>
            <h3>Annotations</h3>
            {variantAnnotations.length === 0 ? (
              <p className="muted">None yet. Select text in the prompt to leave a comment for the agent.</p>
            ) : (
              <ul className="annot-list">
                {variantAnnotations.map((a) => (
                  <li key={a.id}>
                    <p className="annot-quote">“{a.anchor.anchorText}”</p>
                    <p className="annot-comment">{a.comment}</p>
                    <div className="annot-meta">
                      <code className="muted">{a.anchor.fragmentId}</code>
                      <button type="button" className="link" onClick={() => void resolveAnnotation(a.id)}>
                        Resolve
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <Addons trace={resolved.trace} lint={lint} />
        </aside>
      ) : null}
    </div>
  );
}
