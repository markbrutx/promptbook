import { nodeFs } from "../fs.js";
import { isContextValue, isMapping } from "../guards.js";
import { joinPath, listFiles, stripExt } from "../paths.js";
import type { Context, FsAdapter } from "../types.js";
import type { Assertion, Fixture } from "./types.js";

function parseContext(raw: unknown, file: string): Context | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (!isMapping(raw)) {
    throw new Error(`Fixture "${file}" has a "context" that is not an object.`);
  }
  const context: Context = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!isContextValue(value)) {
      throw new Error(`Fixture "${file}" context key "${key}" must be a string, number or boolean.`);
    }
    context[key] = value;
  }
  return context;
}

function parseAssertions(raw: unknown, file: string): Assertion[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error(`Fixture "${file}" must declare a non-empty "assert" array.`);
  }
  return raw.map((entry, index) => {
    if (!isMapping(entry) || typeof entry.type !== "string" || entry.type === "") {
      throw new Error(`Fixture "${file}" assertion #${index} must be an object with a string "type".`);
    }
    return entry as unknown as Assertion;
  });
}

function parseFixture(raw: unknown, file: string, fallbackName: string): Fixture {
  if (!isMapping(raw)) {
    throw new Error(`Fixture "${file}" is not a JSON object.`);
  }
  if (typeof raw.prompt !== "string" || raw.prompt === "") {
    throw new Error(`Fixture "${file}" must declare a string "prompt".`);
  }
  if (typeof raw.input !== "string") {
    throw new Error(`Fixture "${file}" must declare a string "input".`);
  }
  const name = typeof raw.name === "string" && raw.name !== "" ? raw.name : fallbackName;
  const fixture: Fixture = {
    name,
    prompt: raw.prompt,
    input: raw.input,
    assert: parseAssertions(raw.assert, file),
    sourceFile: file,
  };
  const context = parseContext(raw.context, file);
  if (context !== undefined) {
    fixture.context = context;
  }
  if (raw.samples !== undefined) {
    if (typeof raw.samples !== "number" || !Number.isInteger(raw.samples) || raw.samples <= 0) {
      throw new Error(`Fixture "${file}" "samples" must be a positive integer.`);
    }
    fixture.samples = raw.samples;
  }
  return fixture;
}

/**
 * Load eval fixtures from `<dir>/fixtures/*.json` into {@link Fixture}s.
 *
 * Mirrors {@link loadPrompts}: the same `dir` that holds `fragments/` and
 * `rules/` also holds `fixtures/`. A missing `fixtures/` folder yields an empty
 * list; a malformed fixture throws with its file path so the caller can report
 * it. Files are read in sorted order for deterministic results.
 */
export async function loadFixtures(dir: string, fs: FsAdapter = nodeFs()): Promise<Fixture[]> {
  const fixturesDir = joinPath(dir, "fixtures");
  const files = await listFiles(fs, fixturesDir, [".json"]);
  const fixtures: Fixture[] = [];
  for (const file of files) {
    const full = joinPath(fixturesDir, file);
    const raw = await fs.readFile(full);
    let doc: unknown;
    try {
      doc = JSON.parse(raw);
    } catch (error) {
      throw new Error(`Fixture "${full}" is not valid JSON: ${(error as Error).message}`);
    }
    fixtures.push(parseFixture(doc, full, stripExt(file)));
  }
  return fixtures;
}
