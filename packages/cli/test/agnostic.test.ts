import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CLI_UI_DEPS, findDomainLeaks } from "../../../test-support/agnostic-guard.js";

const pkgPath = fileURLToPath(new URL("../package.json", import.meta.url));
// Shippable surface (src + bin) + test fixtures. Domain leaks must not appear here.
const scanDirs = ["../src", "../bin", "../test"].map((rel) => fileURLToPath(new URL(rel, import.meta.url)));

describe("agnosticism guard", () => {
  it("contains no domain strings in src, bin or test fixtures", async () => {
    expect(await findDomainLeaks(scanDirs)).toEqual([]);
  });

  it("depends only on @promptbook packages at runtime", async () => {
    const pkg = JSON.parse(await readFile(pkgPath, "utf8")) as {
      dependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>;
    };
    const runtimeDeps = {
      ...(pkg.dependencies ?? {}),
      ...(pkg.peerDependencies ?? {}),
      ...(pkg.optionalDependencies ?? {}),
    };
    for (const dep of Object.keys(runtimeDeps)) {
      expect(CLI_UI_DEPS).not.toContain(dep);
    }
    // Core, the model adapter, and chokidar for the `watch` command — no CLI/UI libraries.
    expect(Object.keys(pkg.dependencies ?? {}).sort()).toEqual([
      "@markbrutx/promptbook-core",
      "@markbrutx/promptbook-openrouter",
      "chokidar",
    ]);
    // The viewer is an optional dependency (lazily imported by `view`).
    expect(Object.keys(pkg.optionalDependencies ?? {})).toEqual(["@markbrutx/promptbook-viewer"]);
  });
});
