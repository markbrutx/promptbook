import type {
  AnnotateRequest,
  Annotation,
  AnnotationsResponse,
  BookResponse,
  BooksResponse,
  Context,
  LintResponse,
  ResolveResponse,
  UsedInResponse,
} from "./types.js";

/**
 * The viewer's UI talks to the world through this small interface only. The
 * CLI viewer wires the fetch-based implementation below; the static demo site
 * passes an in-browser implementation that resolves against a bundled book.
 */
export interface Api {
  books(): Promise<BooksResponse>;
  book(book: string | null): Promise<BookResponse>;
  resolve(book: string | null, prompt: string, context: Context): Promise<ResolveResponse>;
  lint(book: string | null, prompt: string, context: Context): Promise<LintResponse>;
  usedIn(book: string | null, fragmentId: string): Promise<UsedInResponse>;
  annotations(book: string | null): Promise<AnnotationsResponse>;
  annotate(book: string | null, body: AnnotateRequest): Promise<Annotation>;
  resolveAnnotation(book: string | null, id: string): Promise<{ id: string; removed: boolean }>;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(`${path} → ${res.status}`);
  }
  return (await res.json()) as T;
}

async function sendJson<T>(method: "POST" | "DELETE", path: string, body?: unknown): Promise<T> {
  const init: RequestInit = {
    method,
    headers: { "content-type": "application/json" },
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  const res = await fetch(path, init);
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? `${path} → ${res.status}`);
  }
  return (await res.json()) as T;
}

/** Append `?book=<name>` so a request targets the active book in the workspace. */
function scoped(path: string, book: string | null): string {
  if (book === null || book === "") {
    return path;
  }
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}book=${encodeURIComponent(book)}`;
}

/** The fetch-based default API the CLI viewer uses. */
export const api: Api = {
  books: () => getJson<BooksResponse>("/api/books"),
  book: (book) => getJson<BookResponse>(scoped("/api/book", book)),
  resolve: (book, prompt, context) =>
    sendJson<ResolveResponse>("POST", scoped("/api/resolve", book), { prompt, context }),
  lint: (book, prompt, context) =>
    sendJson<LintResponse>("POST", scoped("/api/lint", book), { prompt, context }),
  usedIn: (book, fragmentId) =>
    getJson<UsedInResponse>(scoped(`/api/used-in/${encodeURIComponent(fragmentId)}`, book)),
  annotations: (book) => getJson<AnnotationsResponse>(scoped("/api/annotations", book)),
  annotate: (book, body) => sendJson<Annotation>("POST", scoped("/api/annotate", book), body),
  resolveAnnotation: (book, id) =>
    sendJson<{ id: string; removed: boolean }>(
      "DELETE",
      scoped(`/api/annotations/${encodeURIComponent(id)}`, book),
    ),
};

/** Subscribe to the CLI viewer's SSE hot-reload stream. */
export function subscribeFetchReload(callback: (changedBook: string | undefined) => void): () => void {
  const source = new EventSource("/api/events");
  source.addEventListener("reload", (event) => {
    let changed: string | undefined;
    try {
      changed = (JSON.parse((event as MessageEvent).data) as { book?: string }).book;
    } catch {
      changed = undefined;
    }
    callback(changed);
  });
  return () => source.close();
}
