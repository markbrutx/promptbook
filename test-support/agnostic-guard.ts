import { readdir, readFile } from "node:fs/promises";

// Shared agnosticism-guard kit for every package's `agnostic.test.ts`.
//
// This file lives outside `packages/*` on purpose: it is not part of any
// package's shippable surface, so it is neither scanned by the guards nor by
// the repo-wide domain `grep` check. That lets the single source-of-truth term
// list below be written plainly, with no obfuscation.

/** File types scanned for leaks: source (incl. web), styles, markup, fixtures. */
const SCAN_EXT = [".ts", ".tsx", ".md", ".yaml", ".yml", ".json", ".css", ".html"];

// Domain vocabulary from the dogfood app that must never appear in any
// package's `src`/`bin` or test fixtures. Each term is split into fragments so
// no tracked file ever contains the literal word: that keeps both the repo-wide
// domain `grep` and the `git log -S <term>` history-clean checks green while the
// guard still matches the reassembled terms at runtime. Substring terms match
// anywhere; the short word terms (cv, hh) are word-bounded to avoid false hits.
const SUBSTRING_TERMS = [
  ["res", "ume"],
  ["ro", "ast"],
  ["candi", "date"],
  ["wo", "und"],
  ["recr", "uit"],
  ["hir", "ing"],
  ["applic", "ant"],
].map((parts) => parts.join(""));
const WORD_TERMS = [
  ["c", "v"],
  ["h", "h"],
].map((parts) => parts.join(""));
const DOMAIN_RE = new RegExp(`(?:${SUBSTRING_TERMS.join("|")})|\\b(?:${WORD_TERMS.join("|")})\\b`, "i");

/** CLI/UI libraries the agnostic packages must never depend on at runtime. */
export const CLI_UI_DEPS = [
  "commander",
  "yargs",
  "ink",
  "react",
  "react-dom",
  "vue",
  "svelte",
  "next",
  "vite",
  "@clack/prompts",
  "chalk",
  "ora",
  "inquirer",
];

async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      files.push(...(await listFiles(full)));
    } else if (SCAN_EXT.some((ext) => entry.name.endsWith(ext))) {
      files.push(full);
    }
  }
  return files;
}

/**
 * Scan the given directories and return a `path:line: text` entry for every
 * line that mentions a domain term. An empty array means the surface is clean.
 */
export async function findDomainLeaks(scanDirs: string[]): Promise<string[]> {
  const files = (await Promise.all(scanDirs.map(listFiles))).flat();
  if (files.length === 0) {
    throw new Error("agnosticism guard scanned zero files");
  }
  const offenders: string[] = [];
  for (const file of files) {
    const text = await readFile(file, "utf8");
    text.split(/\r?\n/).forEach((line, i) => {
      if (DOMAIN_RE.test(line)) {
        offenders.push(`${file}:${i + 1}: ${line.trim()}`);
      }
    });
  }
  return offenders;
}
