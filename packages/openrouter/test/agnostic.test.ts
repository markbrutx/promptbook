import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { findDomainLeaks } from "../../../test-support/agnostic-guard.js";

const pkgPath = fileURLToPath(new URL("../package.json", import.meta.url));
// Shippable surface + test fixtures. Domain leaks must not appear in any of these.
const scanDirs = ["../src", "../test"].map((rel) => fileURLToPath(new URL(rel, import.meta.url)));

describe("agnosticism guard", () => {
  it("contains no domain strings in src or test fixtures", async () => {
    expect(await findDomainLeaks(scanDirs)).toEqual([]);
  });

  it("depends only on @promptbook/core at runtime", async () => {
    const pkg = JSON.parse(await readFile(pkgPath, "utf8")) as {
      dependencies?: Record<string, string>;
    };
    expect(Object.keys(pkg.dependencies ?? {})).toEqual(["@promptbook/core"]);
  });
});
