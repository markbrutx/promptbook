/**
 * Self-contained entrypoint for edge / Deno runtimes that only need to resolve
 * an already-bundled book at request time (no folder loading). Its module graph
 * is just {@link resolveBook} + {@link interpolate} — zero filesystem, YAML, or
 * Node builtins — so `scripts/build-edge.mjs` bundles it to one portable ESM
 * file with no external imports. Consumers (e.g. a Supabase edge function) vendor
 * that file and pair it with a `promptbook bundle` book.
 */
export { interpolate } from "./interpolate.js";
export { resolveBook } from "./resolve-book.js";
export type { Context, PromptBook, ResolveResult, Trace } from "./types.js";
