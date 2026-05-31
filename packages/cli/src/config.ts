import { resolve as resolvePath } from "node:path";
import type { Context, ContextValue } from "@markbrutx/promptbook-core";
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

/** lint options sourced from the `lint` section of `promptbook.json`. */
export interface LintConfig {
  maxTokens?: number;
  bannedTokens?: string[];
}

/**
 * Read and parse `promptbook.json` from cwd once. Missing, unreadable or
 * malformed config yields an empty object, so callers treat it as best-effort
 * and layer flags on top. Pass the result to {@link resolvePromptsDir} and
 * {@link lintConfigFrom} to avoid re-reading the file per command.
 */
export async function loadConfig(io: IO): Promise<PromptbookConfig> {
  const configPath = resolvePath(io.cwd(), "promptbook.json");
  let raw: string;
  try {
    raw = await io.fs.readFile(configPath);
  } catch {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isJsonObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/** Extract the `lint` section from an already-loaded config. */
export function lintConfigFrom(config: PromptbookConfig): LintConfig {
  const section = config.lint;
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
export function evalConfigFrom(config: PromptbookConfig): EvalConfig {
  const section = config.eval;
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
 * Resolve the prompts folder by priority: `--dir` flag > `promptbook.json`
 * (`promptsDir` key) in cwd > `./prompts`. All results are absolute. Pass a
 * preloaded `config` to reuse a single read; otherwise it is loaded here.
 */
export async function resolvePromptsDir(
  io: IO,
  dirFlag?: string,
  config?: PromptbookConfig,
): Promise<string> {
  if (dirFlag !== undefined) {
    return resolvePath(io.cwd(), dirFlag);
  }
  const resolved = config ?? (await loadConfig(io));
  if (typeof resolved.promptsDir === "string") {
    return resolvePath(io.cwd(), resolved.promptsDir);
  }
  return resolvePath(io.cwd(), "prompts");
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
  config?: PromptbookConfig,
): Promise<string | null> {
  const promptsDir = await resolvePromptsDir(io, dirFlag, config);
  if (!(await dirExists(io, promptsDir))) {
    io.stderr(`error: prompts folder not found: ${promptsDir}\n`);
    return null;
  }
  return promptsDir;
}
