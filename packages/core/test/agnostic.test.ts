import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CLI_UI_DEPS, findDomainLeaks } from "../../../test-support/agnostic-guard.js";

const pkgPath = fileURLToPath(new URL("../package.json", import.meta.url));
// Shippable surface + test fixtures. Domain leaks must not appear in any of these.
const scanDirs = ["../src", "../test"].map((rel) => fileURLToPath(new URL(rel, import.meta.url)));

describe("agnosticism guard", () => {
  it("contains no domain strings in src or test fixtures", async () => {
    expect(await findDomainLeaks(scanDirs)).toEqual([]);
  });

  it("does not depend on CLI/UI libraries", async () => {
    const pkg = JSON.parse(await readFile(pkgPath, "utf8")) as {
      dependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };
    const runtimeDeps = {
      ...(pkg.dependencies ?? {}),
      ...(pkg.peerDependencies ?? {}),
    };
    for (const dep of Object.keys(runtimeDeps)) {
      expect(CLI_UI_DEPS).not.toContain(dep);
    }
    // The runtime surface stays tiny on purpose.
    expect(Object.keys(pkg.dependencies ?? {})).toEqual(["yaml"]);
  });
});
