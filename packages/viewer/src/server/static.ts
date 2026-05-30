import { readFile, stat } from "node:fs/promises";
import type { ServerResponse } from "node:http";
import { extname, join, normalize } from "node:path";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

/** Placeholder shown when the web bundle is missing (folder not built yet). */
const NOT_BUILT = `<!doctype html><meta charset="utf-8"><title>promptbook viewer</title>
<body style="font-family:system-ui;padding:2rem;line-height:1.5">
<h1>promptbook viewer</h1>
<p>The web bundle was not found. Build it with:</p>
<pre>npm -w @promptbook/viewer run build</pre>
<p>The API is live at <code>/api/book</code>.</p>`;

/** Resolve a request path to a file inside the web root, blocking traversal. */
function resolveAsset(webRoot: string, urlPath: string): string {
  const clean = normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  const rel = clean === "/" || clean === "" ? "index.html" : clean.replace(/^\/+/, "");
  return join(webRoot, rel);
}

async function readIfFile(path: string): Promise<Buffer | undefined> {
  try {
    if ((await stat(path)).isFile()) {
      return await readFile(path);
    }
  } catch {
    // fall through
  }
  return undefined;
}

/**
 * Serve a static asset from the built web bundle. Unknown paths fall back to
 * `index.html` (single-page app), and a missing bundle yields a friendly page
 * pointing at the build command rather than a bare 404.
 */
export async function serveStatic(res: ServerResponse, webRoot: string, urlPath: string): Promise<void> {
  const asset = resolveAsset(webRoot, urlPath);
  const direct = await readIfFile(asset);
  if (direct !== undefined) {
    res.writeHead(200, { "content-type": MIME[extname(asset)] ?? "application/octet-stream" });
    res.end(direct);
    return;
  }

  const index = await readIfFile(join(webRoot, "index.html"));
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(index ?? NOT_BUILT);
}
