import { spawn } from "node:child_process";
import { type FSWatcher, watch } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import type { FsAdapter } from "@markbrutx/promptbook-core";
import { createRequestHandler } from "./api.js";
import { createBookSource } from "./book-source.js";

export interface ViewerOptions {
  /** Folder containing `fragments/`, `rules/` and optional `fixtures/`. */
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

/** Watch the prompts folder and call `onChange` (debounced) on any edit. */
function watchFolder(promptsDir: string, onChange: () => void): FSWatcher | undefined {
  try {
    let timer: NodeJS.Timeout | undefined;
    const watcher = watch(promptsDir, { recursive: true }, () => {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
      timer = setTimeout(onChange, 50);
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
  const source = createBookSource(promptsDir, fs);
  const handler = createRequestHandler({ source, promptsDir, webRoot });

  const server = createServer((req, res) => handler.handle(req, res));
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });

  const address = server.address();
  const boundPort = typeof address === "object" && address !== null ? address.port : port;
  const url = `http://localhost:${boundPort}`;

  const watcher = watchFolder(promptsDir, () => handler.notifyReload());

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
