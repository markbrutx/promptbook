import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CLI_UI_DEPS, findDomainLeaks } from "../../../test-support/agnostic-guard.js";

const pkgPath = fileURLToPath(new URL("../package.json", import.meta.url));
// Shippable surface (server + web + shared) and test fixtures. The guard now
// scans .tsx/.css/.html too, so the React web app is covered.
const scanDirs = ["../src", "../test"].map((rel) => fileURLToPath(new URL(rel, import.meta.url)));

describe("agnosticism guard", () => {
  it("contains no domain strings in src or test fixtures", async () => {
    expect(await findDomainLeaks(scanDirs)).toEqual([]);
  });

  it("keeps the server runtime dependency to @promptbook/core only", async () => {
    const pkg = JSON.parse(await readFile(pkgPath, "utf8")) as {
      dependencies?: Record<string, string>;
    };
    // react/vite are build-time devDependencies; the running server needs only core.
    expect(Object.keys(pkg.dependencies ?? {})).toEqual(["@promptbook/core"]);
    for (const dep of Object.keys(pkg.dependencies ?? {})) {
      expect(CLI_UI_DEPS).not.toContain(dep);
    }
  });
});
