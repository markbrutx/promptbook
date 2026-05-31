import { fileURLToPath } from "node:url";
import type { CodePrompt, Composition, Fragment, FsAdapter, PromptBook, Rule } from "../src/index.js";

/** Absolute path to a folder under `test/fixtures`. */
export function fixtureDir(name: string): string {
  return fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
}

/** Build a Fragment with sensible defaults for unit tests. */
export function fragment(id: string, body: string, extra: Partial<Fragment> = {}): Fragment {
  return { id, body, sourceFile: `memory:${id}`, ...extra };
}

/** Build a Composition with the given base/rules. */
export function composition(name: string, base: string[], rules: Rule[] = [], order?: string[]): Composition {
  const comp: Composition = { name, base, rules, sourceFile: `memory:${name}` };
  if (order) {
    comp.order = order;
  }
  return comp;
}

/** Assemble an in-memory PromptBook from fragments, compositions and code-prompts. */
export function book(
  fragments: Fragment[],
  compositions: Composition[],
  codePrompts: CodePrompt[] = [],
): PromptBook {
  return {
    fragments: new Map(fragments.map((f) => [f.id, f])),
    compositions: new Map(compositions.map((c) => [c.name, c])),
    codePrompts: new Map(codePrompts.map((c) => [c.name, c])),
    warnings: [],
  };
}

/** A filesystem adapter backed by an in-memory `path -> contents` map. */
export function memoryFs(files: Record<string, string>): FsAdapter {
  return {
    async readFile(path: string): Promise<string> {
      const contents = files[path];
      if (contents === undefined) {
        throw new Error(`memoryFs: no such file "${path}"`);
      }
      return contents;
    },
    async readDir(path: string): Promise<string[]> {
      const prefix = path.endsWith("/") ? path : `${path}/`;
      const names = new Set<string>();
      for (const full of Object.keys(files)) {
        if (full.startsWith(prefix)) {
          const rest = full.slice(prefix.length);
          if (!rest.includes("/")) {
            names.add(rest);
          }
        }
      }
      if (names.size === 0) {
        throw new Error(`memoryFs: no such dir "${path}"`);
      }
      return [...names];
    },
  };
}
