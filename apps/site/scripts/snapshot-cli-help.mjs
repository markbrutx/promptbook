#!/usr/bin/env node
/**
 * Capture the built CLI's `--help` text into a JSON file the docs MDX renders.
 * Keeps the documented command list from drifting from what the CLI actually
 * ships. Run from apps/site/package.json's `prebuild` hook, after `build-demo`.
 */
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const siteRoot = resolve(here, "..");
const repoRoot = resolve(siteRoot, "..", "..");
const cliEntry = resolve(repoRoot, "packages/cli/dist/bin/promptbook.js");
const outFile = resolve(siteRoot, "src/content/cli-help.json");

let helpText;
try {
  helpText = execFileSync("node", [cliEntry, "--help"], { encoding: "utf8" });
} catch (cause) {
  throw new Error(
    `failed to run "node ${cliEntry} --help"; build the CLI first (npm run build -w @markbrutx/promptbook-cli)`,
    { cause },
  );
}

const captured = {
  // Frozen epoch keeps the file byte-stable across builds — same input, same JSON.
  generatedAt: new Date(0).toISOString(),
  helpText: helpText.replace(/\r\n/g, "\n").trimEnd(),
};

await mkdir(dirname(outFile), { recursive: true });
await writeFile(outFile, `${JSON.stringify(captured, null, 2)}\n`, "utf8");
console.log(`wrote ${outFile}`);
