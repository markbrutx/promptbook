import type { BookResponse, Context, LintResponse, ResolveResponse, UsedInResponse } from "./types.js";

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(`${path} → ${res.status}`);
  }
  return (await res.json()) as T;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
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
    postJson<ResolveResponse>("/api/resolve", { prompt, context }),
  lint: (prompt: string, context: Context) => postJson<LintResponse>("/api/lint", { prompt, context }),
  usedIn: (fragmentId: string) => getJson<UsedInResponse>(`/api/used-in/${encodeURIComponent(fragmentId)}`),
};
