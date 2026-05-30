import type { IncomingMessage, ServerResponse } from "node:http";
import type { Context } from "@promptbook/core";
import type { ResolveRequest } from "../shared/types.js";
import type { BookSource } from "./book-source.js";
import {
  buildBookResponse,
  buildLintResponse,
  buildResolveResponse,
  buildUsedInResponse,
} from "./responses.js";
import { serveStatic } from "./static.js";

export interface RequestHandlerOptions {
  source: BookSource;
  promptsDir: string;
  /** Directory of the built web bundle (dist/web). */
  webRoot: string;
}

/** A request handler plus the hook the folder watcher uses to push reloads. */
export interface RequestHandler {
  handle(req: IncomingMessage, res: ServerResponse): void;
  /** Invalidate the cached book and notify connected clients to refetch. */
  notifyReload(): void;
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(body);
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (raw === "") {
    return {};
  }
  return JSON.parse(raw);
}

function asResolveRequest(body: unknown): { prompt: string; context: Context } {
  const data = (body ?? {}) as Partial<ResolveRequest>;
  if (typeof data.prompt !== "string" || data.prompt === "") {
    throw new Error('request body must include a "prompt" name');
  }
  return { prompt: data.prompt, context: data.context ?? {} };
}

export function createRequestHandler(options: RequestHandlerOptions): RequestHandler {
  const { source, promptsDir, webRoot } = options;
  const sseClients = new Set<ServerResponse>();

  const handle = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const path = url.pathname;
    const method = req.method ?? "GET";

    try {
      if (path === "/api/book" && method === "GET") {
        sendJson(res, 200, buildBookResponse(await source.get(), promptsDir));
        return;
      }
      if (path === "/api/resolve" && method === "POST") {
        const { prompt, context } = asResolveRequest(await readJsonBody(req));
        sendJson(res, 200, buildResolveResponse(await source.get(), prompt, context));
        return;
      }
      if (path === "/api/lint" && method === "POST") {
        const { prompt, context } = asResolveRequest(await readJsonBody(req));
        sendJson(res, 200, buildLintResponse(await source.get(), prompt, context));
        return;
      }
      if (path.startsWith("/api/used-in/") && method === "GET") {
        const id = decodeURIComponent(path.slice("/api/used-in/".length));
        sendJson(res, 200, buildUsedInResponse(await source.get(), id));
        return;
      }
      if (path === "/api/events" && method === "GET") {
        addSseClient(res);
        return;
      }
      if (path.startsWith("/api/")) {
        sendJson(res, 404, { error: `unknown route ${method} ${path}` });
        return;
      }
      await serveStatic(res, webRoot, path);
    } catch (error) {
      sendJson(res, 400, { error: (error as Error).message });
    }
  };

  function addSseClient(res: ServerResponse): void {
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    res.write(": connected\n\n");
    sseClients.add(res);
    res.on("close", () => sseClients.delete(res));
  }

  return {
    handle(req, res) {
      void handle(req, res);
    },
    notifyReload() {
      source.invalidate();
      for (const client of sseClients) {
        client.write("event: reload\ndata: {}\n\n");
      }
    },
  };
}
