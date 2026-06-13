import { dirname, isAbsolute, resolve as resolvePath } from "node:path";
import type { Context, ContextValue, PromptBook } from "@markbrutx/promptbook-core";
import { loadPrompts } from "@markbrutx/promptbook-core";
import type { IO } from "./io.js";

const NUMERIC = /^-?\d+(?:\.\d+)?$/;

/** True for a plain JSON object: an object that is neither null nor an array. */
function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Coerce a raw `--ctx` value to a {@link ContextValue}: `true`/`false` become
 * booleans, integer/decimal literals become numbers, everything else stays a
 * string. For values that must stay strings (e.g. "123"), use `--context-file`.
 */
export function coerceScalar(raw: string): ContextValue {
  if (raw === "true") {
    return true;
  }
  if (raw === "false") {
    return false;
  }
  if (NUMERIC.test(raw)) {
    return Number(raw);
  }
  return raw;
}

/** Parse repeated `key=value` pairs into a context bag, coercing each value. */
export function parseCtxPairs(pairs: string[]): Context {
  const context: Context = {};
  for (const pair of pairs) {
    const eq = pair.indexOf("=");
    if (eq === -1) {
      throw new Error(`invalid --ctx "${pair}"; expected key=value`);
    }
    const key = pair.slice(0, eq);
    if (key === "") {
      throw new Error(`invalid --ctx "${pair}"; key is empty`);
    }
    context[key] = coerceScalar(pair.slice(eq + 1));
  }
  return context;
}

function parseContextFile(raw: string, path: string): Context {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    throw new Error(`context file "${path}" is not valid JSON: ${(error as Error).message}`);
  }
  if (!isJsonObject(data)) {
    throw new Error(`context file "${path}" must be a JSON object`);
  }
  const context: Context = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      context[key] = value;
    } else {
      throw new Error(`context file "${path}" key "${key}" must be a string, number or boolean`);
    }
  }
  return context;
}

/**
 * Build the resolve context: `--context-file` first, then `--ctx` pairs layered
 * on top so explicit flags win over the file.
 */
export async function buildContext(io: IO, pairs: string[], contextFile?: string): Promise<Context> {
  let fileContext: Context = {};
  if (contextFile !== undefined) {
    const path = resolvePath(io.cwd(), contextFile);
    let raw: string;
    try {
      raw = await io.fs.readFile(path);
    } catch {
      throw new Error(`context file not found: ${path}`);
    }
    fileContext = parseContextFile(raw, path);
  }
  return { ...fileContext, ...parseCtxPairs(pairs) };
}

interface PromptbookConfig {
  promptsDir?: unknown;
  lint?: unknown;
  eval?: unknown;
}

/** A loaded `promptbook.json`: parsed data plus the directory that held it. */
export interface LoadedConfig {
  /** Parsed JSON object (or `{}` when no file was found or parsing failed). */
  data: PromptbookConfig;
  /** Absolute directory where the config was found; `undefined` if nothing matched up the tree. */
  dir?: string;
}

/** lint options sourced from the `lint` section of `promptbook.json`. */
export interface LintConfig {
  maxTokens?: number;
  bannedTokens?: string[];
}

/**
 * Walk up from `io.cwd()` to find the first `promptbook.json`, parse it, and
 * return its data + the directory it lived in. Walking up (rather than only
 * checking cwd) is what makes `promptbook` work like `git`/`biome`/`eslint`:
 * one config at the repo root reaches every subfolder. Path-valued keys
 * (currently just `promptsDir`) are resolved relative to {@link LoadedConfig.dir}
 * by {@link resolvePromptsDir}, not relative to wherever the shell happens to
 * be — so `pnpm exec` snapping cwd to a workspace package cannot break the
 * lookup. Missing, unreadable or malformed files yield an empty config
 * (best-effort), so callers can layer flags on top.
 */
export async function loadConfig(io: IO): Promise<LoadedConfig> {
  let dir = resolvePath(io.cwd());
  for (;;) {
    const configPath = resolvePath(dir, "promptbook.json");
    let raw: string | undefined;
    try {
      raw = await io.fs.readFile(configPath);
    } catch {
      // not found at this level; try the parent
    }
    if (raw !== undefined) {
      try {
        const parsed = JSON.parse(raw) as unknown;
        return { data: isJsonObject(parsed) ? parsed : {}, dir };
      } catch {
        return { data: {}, dir };
      }
    }
    const parent = dirname(dir);
    if (parent === dir) {
      return { data: {} };
    }
    dir = parent;
  }
}

/** Extract the `lint` section from an already-loaded config. */
export function lintConfigFrom(loaded: LoadedConfig): LintConfig {
  const section = loaded.data.lint;
  if (!isJsonObject(section)) {
    return {};
  }
  const lint: LintConfig = {};
  if (typeof section.maxTokens === "number") {
    lint.maxTokens = section.maxTokens;
  }
  if (Array.isArray(section.bannedTokens)) {
    lint.bannedTokens = section.bannedTokens.filter((token): token is string => typeof token === "string");
  }
  return lint;
}

/** Convenience wrapper: load config and extract its `lint` section. */
export async function loadLintConfig(io: IO): Promise<LintConfig> {
  return lintConfigFrom(await loadConfig(io));
}

/** eval options sourced from the `eval` section of `promptbook.json`. */
export interface EvalConfig {
  model?: string;
  baseUrl?: string;
}

/** Extract the `eval` section from an already-loaded config. */
export function evalConfigFrom(loaded: LoadedConfig): EvalConfig {
  const section = loaded.data.eval;
  if (!isJsonObject(section)) {
    return {};
  }
  const evalConfig: EvalConfig = {};
  if (typeof section.model === "string") {
    evalConfig.model = section.model;
  }
  if (typeof section.baseUrl === "string") {
    evalConfig.baseUrl = section.baseUrl;
  }
  return evalConfig;
}

/**
 * Resolve the prompts folder by priority:
 *   1. `--dir <path>` — relative to **cwd** (explicit per-invocation override).
 *   2. `promptbook.json` `promptsDir` — relative to **the config file's directory**
 *      (so the value can stay stable while the user shells around in subfolders).
 *   3. `./prompts` — relative to cwd (back-compat default when no config exists).
 *
 * All results are absolute. Pass a preloaded {@link LoadedConfig} to reuse a
 * single read; otherwise it is loaded here.
 */
export async function resolvePromptsDir(io: IO, dirFlag?: string, loaded?: LoadedConfig): Promise<string> {
  if (dirFlag !== undefined) {
    return resolvePath(io.cwd(), dirFlag);
  }
  const resolved = loaded ?? (await loadConfig(io));
  if (typeof resolved.data.promptsDir === "string" && resolved.dir !== undefined) {
    return resolvePath(resolved.dir, resolved.data.promptsDir);
  }
  return resolvePath(io.cwd(), "prompts");
}

/** True when a loaded book carries neither fragments nor compositions. */
export function isEmptyBook(book: PromptBook): boolean {
  return book.fragments.size === 0 && book.compositions.size === 0;
}

/**
 * When `pnpm exec` snapped cwd to a package root, the *same* relative dir often
 * still names a real book under `INIT_CWD` (the shell's original directory).
 * Resolve it there and, if a non-empty book lives at that path, return a hint
 * pointing the user back — without ever switching resolution silently.
 */
async function emptyBookCwdHint(
  io: IO,
  dirInput: string | undefined,
  promptsDir: string,
): Promise<string | null> {
  const initCwd = io.env.INIT_CWD;
  if (initCwd === undefined || initCwd === "" || initCwd === io.cwd()) {
    return null;
  }
  if (dirInput === undefined || isAbsolute(dirInput)) {
    return null;
  }
  const altDir = resolvePath(initCwd, dirInput);
  if (altDir === promptsDir) {
    return null;
  }
  try {
    if (!isEmptyBook(await loadPrompts(altDir, io.fs))) {
      return `a book exists at ${altDir}; pnpm exec snaps cwd to the nearest package root — rerun from there or pass an absolute --dir`;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Guard against a silently-empty book: a folder that exists but holds zero
 * fragments and zero compositions resolves to an empty book that `bundle` would
 * write as a hollow artifact and `lint` would pass as "no findings". Treat it as
 * an error (exit 1) with the absolute path, plus a cwd hint when `INIT_CWD`
 * reveals the real book sits elsewhere. Returns false when the caller must exit.
 */
export async function ensureBookNotEmpty(
  io: IO,
  book: PromptBook,
  promptsDir: string,
  dirInput: string | undefined,
): Promise<boolean> {
  if (!isEmptyBook(book)) {
    return true;
  }
  io.stderr(`error: no prompts in ${promptsDir} (zero fragments, zero compositions)\n`);
  const hint = await emptyBookCwdHint(io, dirInput, promptsDir);
  if (hint !== null) {
    io.stderr(`hint: ${hint}\n`);
  }
  return false;
}

/** Whether a directory can be listed; used to give a clear missing-folder error. */
async function dirExists(io: IO, dir: string): Promise<boolean> {
  try {
    await io.fs.readDir(dir);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve the prompts folder and confirm it exists. On a missing folder, write
 * a clear error to stderr and return null so the caller can exit non-zero.
 */
export async function requirePromptsDir(
  io: IO,
  dirFlag?: string,
  loaded?: LoadedConfig,
): Promise<string | null> {
  const promptsDir = await resolvePromptsDir(io, dirFlag, loaded);
  if (!(await dirExists(io, promptsDir))) {
    io.stderr(`error: prompts folder not found: ${promptsDir}\n`);
    return null;
  }
  return promptsDir;
}
