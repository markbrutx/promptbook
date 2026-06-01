import type { IncomingMessage, ServerResponse } from "node:http";
import type { Context } from "@markbrutx/promptbook-core";
import type { AnnotateRequest, ResolveRequest } from "../shared/types.js";
import { type AnnotateInput, type AnnotationStore, createAnnotationStore } from "./annotations.js";
import type { ResolvedBook, WorkspaceSource } from "./book-source.js";
import {
  buildBookResponse,
  buildLintResponse,
  buildResolveResponse,
  buildUsedInResponse,
} from "./responses.js";
import { serveStatic } from "./static.js";

export interface RequestHandlerOptions {
  workspace: WorkspaceSource;
  /** Directory of the built web bundle (dist/web). */
  webRoot: string;
}

/** A request handler plus the hook the folder watcher uses to push reloads. */
export interface RequestHandler {
  handle(req: IncomingMessage, res: ServerResponse): void;
  /** Invalidate a changed book (or all) and notify clients to refetch. */
  notifyReload(book?: string): void;
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

function asAnnotateRequest(body: unknown): AnnotateInput {
  const data = (body ?? {}) as Partial<AnnotateRequest>;
  if (typeof data.fragmentId !== "string" || data.fragmentId === "") {
    throw new Error('request body must include a "fragmentId"');
  }
  if (typeof data.anchorText !== "string" || data.anchorText === "") {
    throw new Error('request body must include "anchorText"');
  }
  if (typeof data.comment !== "string" || data.comment.trim() === "") {
    throw new Error('request body must include a non-empty "comment"');
  }
  const input: AnnotateInput = {
    fragmentId: data.fragmentId,
    anchorText: data.anchorText,
    comment: data.comment,
  };
  if (typeof data.prompt === "string" && data.prompt !== "") {
    input.prompt = data.prompt;
    input.context = data.context ?? {};
  }
  if (typeof data.offset === "number") {
    input.offset = data.offset;
  }
  if (typeof data.sourceFile === "string") {
    input.sourceFile = data.sourceFile;
  }
  return input;
}

const EMPTY_BOOK = { compositions: [], codePrompts: [], fragments: [], warnings: [] } as const;

export function createRequestHandler(options: RequestHandlerOptions): RequestHandler {
  const { workspace, webRoot } = options;
  const sseClients = new Set<ServerResponse>();
  const annotationStores = new Map<string, AnnotationStore>();

  /** Per-book annotation queue, keyed by directory; bookless roots write at root. */
  const annotationsFor = async (bookName: string | undefined): Promise<AnnotationStore> => {
    const resolved = await workspace.resolve(bookName);
    const dir = resolved?.book.dir ?? workspace.root;
    let store = annotationStores.get(dir);
    if (store === undefined) {
      store = createAnnotationStore(dir);
      annotationStores.set(dir, store);
    }
    return store;
  };

  /** Resolve the active book or throw a 400-worthy error when the workspace is empty. */
  const requireBook = async (bookName: string | undefined): Promise<ResolvedBook> => {
    const resolved = await workspace.resolve(bookName);
    if (resolved === undefined) {
      throw new Error("no book found in the workspace");
    }
    return resolved;
  };

  const handle = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const path = url.pathname;
    const method = req.method ?? "GET";
    const bookName = url.searchParams.get("book") ?? undefined;

    try {
      if (path === "/api/books" && method === "GET") {
        sendJson(res, 200, { books: await workspace.books() });
        return;
      }
      if (path === "/api/book" && method === "GET") {
        const resolved = await workspace.resolve(bookName);
        if (resolved === undefined) {
          sendJson(res, 200, EMPTY_BOOK);
          return;
        }
        sendJson(res, 200, buildBookResponse(resolved.folder, resolved.book.dir));
        return;
      }
      if (path === "/api/resolve" && method === "POST") {
        const { prompt, context } = asResolveRequest(await readJsonBody(req));
        const { folder } = await requireBook(bookName);
        sendJson(res, 200, buildResolveResponse(folder, prompt, context));
        return;
      }
      if (path === "/api/lint" && method === "POST") {
        const { prompt, context } = asResolveRequest(await readJsonBody(req));
        const { folder } = await requireBook(bookName);
        sendJson(res, 200, buildLintResponse(folder, prompt, context));
        return;
      }
      if (path.startsWith("/api/used-in/") && method === "GET") {
        const id = decodeURIComponent(path.slice("/api/used-in/".length));
        const { folder } = await requireBook(bookName);
        sendJson(res, 200, buildUsedInResponse(folder, id));
        return;
      }
      if (path === "/api/annotate" && method === "POST") {
        const store = await annotationsFor(bookName);
        const annotation = await store.append(asAnnotateRequest(await readJsonBody(req)));
        sendJson(res, 200, annotation);
        return;
      }
      if (path === "/api/annotations" && method === "GET") {
        const store = await annotationsFor(bookName);
        sendJson(res, 200, { annotations: await store.list() });
        return;
      }
      if (path.startsWith("/api/annotations/") && method === "DELETE") {
        const id = decodeURIComponent(path.slice("/api/annotations/".length));
        const store = await annotationsFor(bookName);
        const removed = await store.remove(id);
        sendJson(res, removed ? 200 : 404, { id, removed });
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
    notifyReload(book) {
      workspace.invalidate(book);
      const data = book !== undefined ? JSON.stringify({ book }) : "{}";
      for (const client of sseClients) {
        client.write(`event: reload\ndata: ${data}\n\n`);
      }
    },
  };
}
