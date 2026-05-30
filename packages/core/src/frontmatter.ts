import { parse as parseYaml } from "yaml";
import { isMapping } from "./guards.js";

export interface ParsedFrontmatter {
  data: Record<string, unknown>;
  body: string;
}

/** Matches a leading `---\n ... \n---` YAML frontmatter block. */
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/**
 * Split a Markdown file into YAML frontmatter (parsed) and the body text.
 *
 * Intentionally dependency-light: a single YAML parser, no extra frontmatter
 * library, so the core stays small and easy to run anywhere.
 */
export function parseFrontmatter(raw: string): ParsedFrontmatter {
  const match = raw.match(FRONTMATTER_RE);
  if (!match) {
    return { data: {}, body: raw };
  }
  const yamlText = match[1] ?? "";
  const parsed = parseYaml(yamlText) as unknown;
  const data = isMapping(parsed) ? parsed : {};
  const body = raw.slice(match[0].length);
  return { data, body };
}
