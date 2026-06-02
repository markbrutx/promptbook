#!/usr/bin/env node
/**
 * Generate the static demo book JSON for every entry the site ships.
 *
 * For each book under examples/<slug>/:
 *   1. `loadPrompts(dir)` over the absolute path.
 *   2. Re-write every `sourceFile` to a stable, repo-relative POSIX path.
 *   3. `serializeBookJson` → write to apps/site/public/demo/<slug>/book.json.
 *
 * Also emits apps/site/public/demo/index.json: a small catalog so a server
 * component (or a curious developer) can list everything that ships without
 * touching the file system.
 *
 * Run from apps/site/package.json's `prebuild` hook. Deterministic: identical
 * inputs yield byte-identical JSON.
 */
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { loadPrompts, serializeBookJson } from "@markbrutx/promptbook-core";

const here = dirname(fileURLToPath(import.meta.url));
const siteRoot = resolve(here, "..");
const repoRoot = resolve(siteRoot, "..", "..");
const examplesRoot = resolve(repoRoot, "examples");
const outRoot = resolve(siteRoot, "public", "demo");

// Order here drives /demo landing order; must match apps/site/src/lib/demo/discover.ts.
const BOOKS = [
  {
    slug: "sports-broadcast",
    title: "Sports broadcast",
    description:
      "Synthetic broadcaster across 10 compositions and six context axes; demonstrates the multi-model output cascade and the forbid-wins compliance cascade.",
  },
  {
    slug: "support-assistant",
    title: "Support assistant",
    description:
      "Minimal quickstart book: shared fragments across two compositions, with a model-axis swap from prose to JSON to XML output.",
  },
];

/** Repo-relative POSIX path, suitable for the wire. */
function repoRelative(absPath) {
  return relative(repoRoot, absPath).split(sep).join("/");
}

/** Rewrite every sourceFile in a loaded book to a repo-relative POSIX path. */
function normalizeSourcePaths(book) {
  for (const fragment of book.fragments.values()) {
    fragment.sourceFile = repoRelative(fragment.sourceFile);
  }
  for (const composition of book.compositions.values()) {
    composition.sourceFile = repoRelative(composition.sourceFile);
  }
  for (const codePrompt of book.codePrompts.values()) {
    codePrompt.sourceFile = repoRelative(codePrompt.sourceFile);
  }
}

async function buildOne(entry) {
  const dir = resolve(examplesRoot, entry.slug);
  const book = await loadPrompts(dir);
  normalizeSourcePaths(book);

  if (book.compositions.size === 0) {
    throw new Error(`Book "${entry.slug}" has no compositions; refusing to ship an empty demo.`);
  }

  const outDir = resolve(outRoot, entry.slug);
  await mkdir(outDir, { recursive: true });
  const jsonPath = join(outDir, "book.json");
  await writeFile(jsonPath, serializeBookJson(book), "utf8");

  console.log(
    `wrote ${repoRelative(jsonPath)} · ${book.compositions.size} compositions · ${book.fragments.size} fragments`,
  );

  return {
    slug: entry.slug,
    title: entry.title,
    description: entry.description,
    href: `/demo/${entry.slug}`,
    bookJsonUrl: `/demo/${entry.slug}/book.json`,
    compositions: book.compositions.size,
    fragments: book.fragments.size,
  };
}

async function main() {
  await rm(outRoot, { recursive: true, force: true });
  await mkdir(outRoot, { recursive: true });

  const entries = [];
  for (const entry of BOOKS) {
    entries.push(await buildOne(entry));
  }

  const indexPath = join(outRoot, "index.json");
  await writeFile(
    indexPath,
    `${JSON.stringify({ books: entries, generatedAt: new Date(0).toISOString() }, null, 2)}\n`,
    "utf8",
  );
  console.log(`wrote ${repoRelative(indexPath)}`);
}

await main();
