import { describe, expect, it } from "vitest";
import { loadFixtures } from "../src/index.js";
import { memoryFs } from "./helpers.js";

const DIR = "/p";

function fs(files: Record<string, string>) {
  return memoryFs(files);
}

describe("loadFixtures", () => {
  it("reads fixtures/*.json in sorted order and fills defaults", async () => {
    const adapter = fs({
      "/p/fixtures/b.json": JSON.stringify({
        prompt: "greet",
        input: "hi",
        assert: [{ type: "contains", value: "x" }],
      }),
      "/p/fixtures/a.json": JSON.stringify({
        name: "explicit",
        prompt: "greet",
        context: { who: "Ada", n: 2, flag: true },
        input: "hi",
        assert: [{ type: "json-valid" }],
        samples: 3,
      }),
    });
    const fixtures = await loadFixtures(DIR, adapter);
    expect(fixtures.map((f) => f.name)).toEqual(["explicit", "b"]);
    expect(fixtures[0]?.context).toEqual({ who: "Ada", n: 2, flag: true });
    expect(fixtures[0]?.samples).toBe(3);
    expect(fixtures[0]?.sourceFile).toBe("/p/fixtures/a.json");
    // Name defaults to the file stem when omitted.
    expect(fixtures[1]?.name).toBe("b");
    expect(fixtures[1]?.context).toBeUndefined();
  });

  it("returns an empty list when there is no fixtures folder", async () => {
    const fixtures = await loadFixtures(DIR, fs({ "/p/rules/x.yaml": "name: x" }));
    expect(fixtures).toEqual([]);
  });

  it("ignores non-JSON files", async () => {
    const fixtures = await loadFixtures(
      DIR,
      fs({
        "/p/fixtures/notes.md": "ignore me",
        "/p/fixtures/ok.json": JSON.stringify({ prompt: "g", input: "i", assert: [{ type: "json-valid" }] }),
      }),
    );
    expect(fixtures).toHaveLength(1);
  });

  it("throws with the file path on invalid JSON", async () => {
    await expect(loadFixtures(DIR, fs({ "/p/fixtures/bad.json": "{not json" }))).rejects.toThrow(
      /bad\.json.*not valid JSON/,
    );
  });

  it("throws when prompt is missing", async () => {
    await expect(
      loadFixtures(
        DIR,
        fs({ "/p/fixtures/x.json": JSON.stringify({ input: "i", assert: [{ type: "x" }] }) }),
      ),
    ).rejects.toThrow(/must declare a string "prompt"/);
  });

  it("throws when assert is empty", async () => {
    await expect(
      loadFixtures(
        DIR,
        fs({ "/p/fixtures/x.json": JSON.stringify({ prompt: "g", input: "i", assert: [] }) }),
      ),
    ).rejects.toThrow(/non-empty "assert"/);
  });

  it("throws when an assertion has no type", async () => {
    await expect(
      loadFixtures(
        DIR,
        fs({ "/p/fixtures/x.json": JSON.stringify({ prompt: "g", input: "i", assert: [{ value: "x" }] }) }),
      ),
    ).rejects.toThrow(/assertion #0 must be an object with a string "type"/);
  });

  it("throws when samples is not a positive integer", async () => {
    await expect(
      loadFixtures(
        DIR,
        fs({
          "/p/fixtures/x.json": JSON.stringify({
            prompt: "g",
            input: "i",
            assert: [{ type: "json-valid" }],
            samples: 0,
          }),
        }),
      ),
    ).rejects.toThrow(/positive integer/);
  });
});
