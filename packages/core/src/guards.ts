import type { ContextValue } from "./types.js";

/** True for a plain object (a YAML/JSON mapping); excludes arrays and null. */
export function isMapping(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** True for a scalar that is a valid {@link ContextValue} (string/number/boolean). */
export function isContextValue(value: unknown): value is ContextValue {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}
