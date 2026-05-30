import type { FsAdapter } from "./types.js";

/** Join a directory and child with a single `/`, tolerating a trailing slash. */
export function joinPath(dir: string, child: string): string {
  return dir.endsWith("/") ? `${dir}${child}` : `${dir}/${child}`;
}

/** Drop a file extension, e.g. `assistant.yaml` -> `assistant`. */
export function stripExt(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? name : name.slice(0, dot);
}

/**
 * List files in `dir` whose name ends with one of `exts`, sorted for
 * deterministic processing. A missing/unreadable directory yields `[]` so
 * callers can treat an absent folder as "no files".
 */
export async function listFiles(fs: FsAdapter, dir: string, exts: string[]): Promise<string[]> {
  let entries: string[];
  try {
    entries = await fs.readDir(dir);
  } catch {
    return [];
  }
  return entries.filter((name) => exts.some((ext) => name.endsWith(ext))).sort();
}
