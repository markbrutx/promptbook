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

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(`${path} → ${res.status}`);
  }
  return (await res.json()) as T;
}

async function sendJson<T>(method: "POST" | "DELETE", path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
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

export const api = {
  books: () => getJson<BooksResponse>("/api/books"),
  book: (book: string | null) => getJson<BookResponse>(scoped("/api/book", book)),
  resolve: (book: string | null, prompt: string, context: Context) =>
    sendJson<ResolveResponse>("POST", scoped("/api/resolve", book), { prompt, context }),
  lint: (book: string | null, prompt: string, context: Context) =>
    sendJson<LintResponse>("POST", scoped("/api/lint", book), { prompt, context }),
  usedIn: (book: string | null, fragmentId: string) =>
    getJson<UsedInResponse>(scoped(`/api/used-in/${encodeURIComponent(fragmentId)}`, book)),
  annotations: (book: string | null) => getJson<AnnotationsResponse>(scoped("/api/annotations", book)),
  annotate: (book: string | null, body: AnnotateRequest) =>
    sendJson<Annotation>("POST", scoped("/api/annotate", book), body),
  resolveAnnotation: (book: string | null, id: string) =>
    sendJson<{ id: string; removed: boolean }>(
      "DELETE",
      scoped(`/api/annotations/${encodeURIComponent(id)}`, book),
    ),
};
