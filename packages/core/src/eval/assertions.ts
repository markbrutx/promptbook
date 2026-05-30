/**
 * Built-in, pluggable assertions for the eval engine.
 *
 * Each checker is pure: it inspects a model output against an {@link Assertion}
 * spec and returns an {@link AssertionResult}. Callers can pass their own
 * registry to {@link evaluate} to add or replace checkers, exactly like lint
 * rules. The `language` checker is a script heuristic, not an LLM judge.
 */
import type { Assertion, AssertionFn, AssertionRegistry, AssertionResult } from "./types.js";

const EXCERPT_LIMIT = 160;

/** A short, single-line excerpt of the output for failure messages. */
function excerpt(text: string): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length > EXCERPT_LIMIT ? `${collapsed.slice(0, EXCERPT_LIMIT)}…` : collapsed;
}

function result(type: string, pass: boolean, message: string, output: string): AssertionResult {
  return { type, pass, message, excerpt: excerpt(output) };
}

/** Require a spec field to be present, with a clear error when it is not. */
function need<T>(value: T | undefined, type: string, field: string): T {
  if (value === undefined) {
    throw new Error(`assertion "${type}" requires a "${field}" field.`);
  }
  return value;
}

function buildRegex(assertion: Assertion): RegExp {
  const pattern = need(assertion.pattern, assertion.type, "pattern");
  try {
    return new RegExp(pattern, assertion.flags);
  } catch (error) {
    throw new Error(`assertion "${assertion.type}" has an invalid pattern: ${(error as Error).message}`);
  }
}

const contains: AssertionFn = (output, a) => {
  const value = need(a.value, "contains", "value");
  const pass = output.includes(value);
  return result("contains", pass, pass ? `contains "${value}"` : `missing "${value}"`, output);
};

const notContains: AssertionFn = (output, a) => {
  const value = need(a.value, "not-contains", "value");
  const pass = !output.includes(value);
  return result(
    "not-contains",
    pass,
    pass ? `does not contain "${value}"` : `unexpectedly contains "${value}"`,
    output,
  );
};

const matches: AssertionFn = (output, a) => {
  const re = buildRegex({ ...a, type: "matches" });
  const pass = re.test(output);
  return result("matches", pass, pass ? `matches /${re.source}/` : `does not match /${re.source}/`, output);
};

const notMatches: AssertionFn = (output, a) => {
  const re = buildRegex({ ...a, type: "not-matches" });
  const pass = !re.test(output);
  return result(
    "not-matches",
    pass,
    pass ? `does not match /${re.source}/` : `unexpectedly matches /${re.source}/`,
    output,
  );
};

const equals: AssertionFn = (output, a) => {
  const value = need(a.value, "equals", "value");
  const pass = output.trim() === value.trim();
  return result("equals", pass, pass ? "equals expected text" : "does not equal expected text", output);
};

const jsonValid: AssertionFn = (output) => {
  try {
    JSON.parse(output);
    return result("json-valid", true, "output is valid JSON", output);
  } catch (error) {
    return result("json-valid", false, `output is not valid JSON: ${(error as Error).message}`, output);
  }
};

const maxLength: AssertionFn = (output, a) => {
  const max = need(a.max, "max-length", "max");
  const pass = output.length <= max;
  return result(
    "max-length",
    pass,
    pass ? `length ${output.length} within ${max}` : `length ${output.length} exceeds ${max}`,
    output,
  );
};

/** Map common language tags to the script the `language` heuristic checks. */
const SCRIPT_BY_LANGUAGE: Record<string, "cyrillic" | "latin"> = {
  ru: "cyrillic",
  uk: "cyrillic",
  be: "cyrillic",
  bg: "cyrillic",
  sr: "cyrillic",
  mk: "cyrillic",
  en: "latin",
  fr: "latin",
  es: "latin",
  de: "latin",
  it: "latin",
  pt: "latin",
  nl: "latin",
  pl: "latin",
  cs: "latin",
  ro: "latin",
  tr: "latin",
  sv: "latin",
  da: "latin",
  no: "latin",
  fi: "latin",
};

const CYRILLIC = /\p{Script=Cyrillic}/gu;
const LATIN = /\p{Script=Latin}/gu;

function count(text: string, re: RegExp): number {
  return text.match(re)?.length ?? 0;
}

/**
 * `language`: script-based heuristic. Resolves the spec `lang` to a script
 * ("cyrillic"/"latin", either directly or via a language tag) and passes when
 * that script has at least one letter and is at least as frequent as the
 * other. Not an LLM judge — it detects script, not fluency.
 */
const language: AssertionFn = (output, a) => {
  const lang = need(a.lang, "language", "lang").toLowerCase();
  const script = SCRIPT_BY_LANGUAGE[lang] ?? lang;
  if (script !== "cyrillic" && script !== "latin") {
    return result("language", false, `unsupported language "${a.lang}" (no script heuristic)`, output);
  }
  const cyrillic = count(output, CYRILLIC);
  const latin = count(output, LATIN);
  const expected = script === "cyrillic" ? cyrillic : latin;
  const other = script === "cyrillic" ? latin : cyrillic;
  const pass = expected > 0 && expected >= other;
  return result(
    "language",
    pass,
    pass
      ? `output is predominantly ${script}`
      : `expected predominantly ${script} (cyrillic=${cyrillic}, latin=${latin})`,
    output,
  );
};

/**
 * The built-in assertion registry. Pass a merged/replaced object to
 * {@link evaluate} to customize: `{ ...defaultAssertions(), myType: fn }`.
 */
export function defaultAssertions(): AssertionRegistry {
  return {
    contains,
    "not-contains": notContains,
    matches,
    "not-matches": notMatches,
    equals,
    "json-valid": jsonValid,
    "max-length": maxLength,
    language,
  };
}
