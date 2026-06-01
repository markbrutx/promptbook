import { spawn } from "node:child_process";
import { type FSWatcher, watch } from "node:fs";
import { createServer } from "node:http";
import { sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { FsAdapter } from "@markbrutx/promptbook-core";
import { createRequestHandler } from "./api.js";
import { createWorkspaceSource } from "./book-source.js";

export interface ViewerOptions {
  /** Workspace root (a single book, or a folder of sibling books). */
  promptsDir: string;
  /** Port to listen on; 0 (default) picks a free port. */
  port?: number;
  /** Open the URL in the default browser once listening. Default false. */
  open?: boolean;
  /** Filesystem adapter forwarded to the core loader (defaults to Node fs). */
  fs?: FsAdapter;
}

/** A running viewer: its URL, the bound port, and a shutdown hook. */
export interface Viewer {
  url: string;
  port: number;
  close(): Promise<void>;
}

/** Best-effort: open `url` in the OS default browser; never throws. */
function openBrowser(url: string): void {
  const command =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  try {
    const child = spawn(command, [url], {
      stdio: "ignore",
      detached: true,
      shell: process.platform === "win32",
    });
    child.on("error", () => {});
    child.unref();
  } catch {
    // opening a browser is a convenience, not a requirement
  }
}

/**
 * Watch the workspace root and call `onChange` (debounced) with the changed
 * book. A change path's first segment names its top-level book; when several
 * books or unknown paths change in one window, `undefined` is passed so the
 * client refetches the active book regardless.
 */
function watchFolder(rootDir: string, onChange: (book: string | undefined) => void): FSWatcher | undefined {
  try {
    let timer: NodeJS.Timeout | undefined;
    let changed = new Set<string | undefined>();
    const watcher = watch(rootDir, { recursive: true }, (_event, filename) => {
      const name = typeof filename === "string" && filename.length > 0 ? filename : undefined;
      changed.add(name === undefined ? undefined : name.split(sep)[0]);
      if (timer !== undefined) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        const books = [...changed];
        changed = new Set();
        onChange(books.length === 1 ? books[0] : undefined);
      }, 50);
    });
    watcher.on("error", () => {});
    return watcher;
  } catch {
    return undefined;
  }
}

/**
 * Start the viewer server: serves the built web bundle and the `/api/*` routes
 * over a prompts folder, hot-reloading on folder edits. Render-only; no model
 * calls. Resolves once the server is listening.
 */
export async function startViewer(options: ViewerOptions): Promise<Viewer> {
  const { promptsDir, port = 0, open = false, fs } = options;
  const webRoot = fileURLToPath(new URL("../web", import.meta.url));
  const workspace = createWorkspaceSource(promptsDir, fs);
  const handler = createRequestHandler({ workspace, webRoot });

  const server = createServer((req, res) => handler.handle(req, res));
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });

  const address = server.address();
  const boundPort = typeof address === "object" && address !== null ? address.port : port;
  const url = `http://localhost:${boundPort}`;

  const watcher = watchFolder(promptsDir, (book) => handler.notifyReload(book));

  if (open) {
    openBrowser(url);
  }

  return {
    url,
    port: boundPort,
    close() {
      watcher?.close();
      return new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
