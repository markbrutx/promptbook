import type { ModelAdapter, ModelRequest, ModelResponse, ModelUsage } from "@markbrutx/promptbook-core";

/** OpenRouter chat-completions base URL (no trailing slash). */
const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";

/** Environment variable consulted when no explicit `apiKey` is given. */
const API_KEY_ENV = "OPENROUTER_API_KEY";

export interface OpenRouterOptions {
  /** Default model id, e.g. "openai/gpt-4o-mini". Overridable per request. */
  model: string;
  /** API key; falls back to `process.env.OPENROUTER_API_KEY` at call time. */
  apiKey?: string;
  /** Override the API base URL (e.g. a proxy). */
  baseUrl?: string;
  /** Inject a `fetch` implementation; defaults to the global `fetch`. */
  fetch?: typeof fetch;
}

/** Shape of the fields we read from an OpenRouter chat-completions reply. */
interface ChatCompletion {
  choices?: { message?: { content?: string } }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

function mapUsage(usage: ChatCompletion["usage"]): ModelUsage | undefined {
  if (!usage) {
    return undefined;
  }
  const mapped: ModelUsage = {};
  if (typeof usage.prompt_tokens === "number") {
    mapped.promptTokens = usage.prompt_tokens;
  }
  if (typeof usage.completion_tokens === "number") {
    mapped.completionTokens = usage.completion_tokens;
  }
  if (typeof usage.total_tokens === "number") {
    mapped.totalTokens = usage.total_tokens;
  }
  return mapped;
}

async function readErrorBody(response: Response): Promise<string> {
  try {
    const body = (await response.text()).trim();
    return body.length > 0 ? `: ${body}` : "";
  } catch {
    return "";
  }
}

/**
 * Build a {@link ModelAdapter} backed by OpenRouter's chat-completions API.
 *
 * This is the one piece that performs network IO; the eval engine in
 * `@markbrutx/promptbook-core` only sees the adapter interface. The request maps
 * `{ system, input }` to `system`/`user` messages and parses the first
 * choice's content back into `{ text, usage, raw }`. A missing key (option or
 * env) or a non-2xx response raises a clear error.
 */
export function openRouterAdapter(options: OpenRouterOptions): ModelAdapter {
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const doFetch = options.fetch ?? globalThis.fetch;

  return {
    async complete(request: ModelRequest): Promise<ModelResponse> {
      const apiKey = options.apiKey ?? process.env[API_KEY_ENV];
      if (!apiKey) {
        throw new Error(
          `OpenRouter API key missing: pass { apiKey } or set the ${API_KEY_ENV} environment variable.`,
        );
      }

      const messages: { role: string; content: string }[] = [];
      if (request.system.length > 0) {
        messages.push({ role: "system", content: request.system });
      }
      messages.push({ role: "user", content: request.input });

      const response = await doFetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model: request.model ?? options.model, messages }),
      });

      if (!response.ok) {
        const body = await readErrorBody(response);
        throw new Error(`OpenRouter request failed: ${response.status} ${response.statusText}${body}`);
      }

      const data = (await response.json()) as ChatCompletion;
      const result: ModelResponse = {
        text: data.choices?.[0]?.message?.content ?? "",
        raw: data,
      };
      const usage = mapUsage(data.usage);
      if (usage !== undefined) {
        result.usage = usage;
      }
      return result;
    },
  };
}
