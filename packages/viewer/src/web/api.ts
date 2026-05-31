import type {
  AnnotateRequest,
  Annotation,
  AnnotationsResponse,
  BookResponse,
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

export const api = {
  book: () => getJson<BookResponse>("/api/book"),
  resolve: (prompt: string, context: Context) =>
    sendJson<ResolveResponse>("POST", "/api/resolve", { prompt, context }),
  lint: (prompt: string, context: Context) =>
    sendJson<LintResponse>("POST", "/api/lint", { prompt, context }),
  usedIn: (fragmentId: string) => getJson<UsedInResponse>(`/api/used-in/${encodeURIComponent(fragmentId)}`),
  annotations: () => getJson<AnnotationsResponse>("/api/annotations"),
  annotate: (body: AnnotateRequest) => sendJson<Annotation>("POST", "/api/annotate", body),
  resolveAnnotation: (id: string) =>
    sendJson<{ id: string; removed: boolean }>("DELETE", `/api/annotations/${encodeURIComponent(id)}`),
};
