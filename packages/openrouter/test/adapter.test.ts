import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openRouterAdapter } from "../src/index.js";

interface FetchCall {
  url: string;
  init: RequestInit;
}

/** A fetch stub that records its call and returns a canned JSON response. */
function jsonFetch(body: unknown, init: { ok?: boolean; status?: number; statusText?: string } = {}) {
  const calls: FetchCall[] = [];
  const fn = (async (url: string, requestInit: RequestInit) => {
    calls.push({ url, init: requestInit });
    return {
      ok: init.ok ?? true,
      status: init.status ?? 200,
      statusText: init.statusText ?? "OK",
      json: async () => body,
      text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
    } as Response;
  }) as unknown as typeof fetch;
  return { fn, calls };
}

const SAVED_KEY = process.env.OPENROUTER_API_KEY;

beforeEach(() => {
  process.env.OPENROUTER_API_KEY = undefined;
  delete process.env.OPENROUTER_API_KEY;
});

afterEach(() => {
  if (SAVED_KEY === undefined) {
    delete process.env.OPENROUTER_API_KEY;
  } else {
    process.env.OPENROUTER_API_KEY = SAVED_KEY;
  }
  vi.restoreAllMocks();
});

describe("openRouterAdapter", () => {
  it("maps system/input to messages and parses the reply", async () => {
    const { fn, calls } = jsonFetch({
      choices: [{ message: { content: "hello back" } }],
      usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
    });
    const adapter = openRouterAdapter({ model: "test/model", apiKey: "k-123", fetch: fn });

    const response = await adapter.complete({ system: "be terse", input: "say hi" });

    expect(response.text).toBe("hello back");
    expect(response.usage).toEqual({ promptTokens: 10, completionTokens: 4, totalTokens: 14 });
    expect(response.raw).toBeDefined();

    expect(calls).toHaveLength(1);
    const call = calls[0];
    expect(call?.url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(call?.init.method).toBe("POST");
    const headers = call?.init.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer k-123");
    const payload = JSON.parse(call?.init.body as string) as {
      model: string;
      messages: { role: string; content: string }[];
    };
    expect(payload.model).toBe("test/model");
    expect(payload.messages).toEqual([
      { role: "system", content: "be terse" },
      { role: "user", content: "say hi" },
    ]);
  });

  it("omits the system message when the system prompt is empty", async () => {
    const { fn, calls } = jsonFetch({ choices: [{ message: { content: "ok" } }] });
    const adapter = openRouterAdapter({ model: "m", apiKey: "k", fetch: fn });
    await adapter.complete({ system: "", input: "hi" });
    const payload = JSON.parse(calls[0]?.init.body as string) as { messages: { role: string }[] };
    expect(payload.messages.map((m) => m.role)).toEqual(["user"]);
  });

  it("reads the key from the environment when no option is given", async () => {
    process.env.OPENROUTER_API_KEY = "env-key";
    const { fn, calls } = jsonFetch({ choices: [{ message: { content: "x" } }] });
    const adapter = openRouterAdapter({ model: "m", fetch: fn });
    await adapter.complete({ system: "s", input: "i" });
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer env-key");
  });

  it("honors a per-request model override and a custom baseUrl", async () => {
    const { fn, calls } = jsonFetch({ choices: [{ message: { content: "x" } }] });
    const adapter = openRouterAdapter({
      model: "default",
      apiKey: "k",
      baseUrl: "https://proxy/v1/",
      fetch: fn,
    });
    await adapter.complete({ system: "s", input: "i", model: "override/model" });
    expect(calls[0]?.url).toBe("https://proxy/v1/chat/completions");
    const payload = JSON.parse(calls[0]?.init.body as string) as { model: string };
    expect(payload.model).toBe("override/model");
  });

  it("throws a clear error when no key is available", async () => {
    const { fn } = jsonFetch({});
    const adapter = openRouterAdapter({ model: "m", fetch: fn });
    await expect(adapter.complete({ system: "s", input: "i" })).rejects.toThrow(/API key missing/);
  });

  it("throws with status and body on an HTTP error", async () => {
    const { fn } = jsonFetch("rate limited", { ok: false, status: 429, statusText: "Too Many Requests" });
    const adapter = openRouterAdapter({ model: "m", apiKey: "k", fetch: fn });
    await expect(adapter.complete({ system: "s", input: "i" })).rejects.toThrow(
      /429 Too Many Requests: rate limited/,
    );
  });
});
