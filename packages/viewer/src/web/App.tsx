import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Api } from "./api.js";
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
  WorkspaceBook,
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

/** Props passed to the viewer's root component. */
export interface AppProps {
  /** API surface the viewer talks to. The CLI viewer wires the default fetch
   * implementation; the static demo site supplies an in-browser one. */
  api: Api;
  /** Subscribe to hot-reload events. When omitted, no live-reload wiring runs
   * (e.g. the static-mount path). The unsubscribe callback is returned. */
  subscribeReload?: (callback: (changedBook: string | undefined) => void) => () => void;
}

export function App({ api, subscribeReload }: AppProps) {
  const [books, setBooks] = useState<WorkspaceBook[]>([]);
  const [activeBook, setActiveBook] = useState<string | null>(null);
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
  // Mirror activeBook into a ref so the (book-independent) SSE subscription can
  // read the current book without re-subscribing on every switch.
  const activeBookRef = useRef<string | null>(null);
  activeBookRef.current = activeBook;

  const loadBooks = useCallback(async () => {
    try {
      const { books: next } = await api.books();
      setBooks(next);
      return next;
    } catch {
      setBooks([]);
      return [];
    }
  }, [api.books]);

  const loadAnnotations = useCallback(
    async (which: string | null) => {
      try {
        const { annotations: next } = await api.annotations(which);
        setAnnotations(next);
      } catch {
        setAnnotations([]);
      }
    },
    [api.annotations],
  );

  const loadBook = useCallback(
    async (which: string | null) => {
      try {
        const next = await api.book(which);
        setBook(next);
        setError(null);
        return next;
      } catch (e) {
        setError((e as Error).message);
        return null;
      }
    },
    [api.book],
  );

  // Discover the workspace's books, then activate the first one.
  useEffect(() => {
    void loadBooks().then((list) => {
      setActiveBook((current) => current ?? list[0]?.name ?? null);
    });
  }, [loadBooks]);

  // Load the active book's tree + annotations and reset the selection to its
  // first composition. Re-runs on every book switch (a fresh menu each time).
  useEffect(() => {
    if (activeBook === null) {
      setBook(null);
      setSelection(null);
      return;
    }
    void loadBook(activeBook).then((next) => {
      const first = next?.compositions[0];
      setSelection(
        first !== undefined
          ? { kind: "variant", composition: first.name, variant: DEFAULT_VARIANT.name }
          : null,
      );
      setContext({});
      setCompareVariant("");
    });
    void loadAnnotations(activeBook);
  }, [activeBook, loadBook, loadAnnotations]);

  // Hot-reload: refetch the book list, and the active book's tree when it (or
  // an unknown path) changed. The CLI viewer wires this to its SSE stream; the
  // static demo site omits it entirely (no live reload). The selection persists.
  useEffect(() => {
    if (subscribeReload === undefined) {
      return;
    }
    return subscribeReload((changed) => {
      void loadBooks();
      const active = activeBookRef.current;
      if (active !== null && (changed === undefined || changed === active)) {
        void loadBook(active);
      }
    });
  }, [loadBook, loadBooks, subscribeReload]);

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
    void Promise.all([
      api.resolve(activeBook, composition, context),
      api.lint(activeBook, composition, context),
    ])
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
  }, [book, selection, context, activeBook, api.lint, api.resolve]);

  useEffect(() => {
    if (book === null || selection?.kind !== "fragment") {
      setUsedIn(null);
      return;
    }
    void api
      .usedIn(activeBook, selection.id)
      .then(setUsedIn)
      .catch(() => setUsedIn(null));
  }, [book, selection, activeBook, api.usedIn]);

  // Resolve the comparison variant for the Diff panel.
  useEffect(() => {
    if (selection?.kind !== "variant" || compareVariant === "") {
      setCompareResolved(null);
      return;
    }
    const ctx = variantContext(selectedComposition, compareVariant);
    void api
      .resolve(activeBook, selection.composition, ctx)
      .then(setCompareResolved)
      .catch(() => setCompareResolved(null));
  }, [selection, compareVariant, selectedComposition, activeBook, api.resolve]);

  const selectBook = useCallback((name: string) => {
    setActiveBook(name);
  }, []);

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
      await api.annotate(activeBook, {
        prompt: selection.composition,
        context,
        fragmentId,
        anchorText,
        comment,
      });
      await loadAnnotations(activeBook);
    },
    [selection, context, activeBook, loadAnnotations, api.annotate],
  );

  const resolveAnnotation = useCallback(
    async (id: string) => {
      await api.resolveAnnotation(activeBook, id);
      await loadAnnotations(activeBook);
    },
    [activeBook, loadAnnotations, api.resolveAnnotation],
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
        books={books}
        activeBook={activeBook}
        onSelectBook={selectBook}
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
          {...(lint?.tokens !== undefined ? { tokens: lint.tokens } : {})}
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
