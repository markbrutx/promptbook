import { describe, expect, it } from "vitest";
import { run } from "../src/run.js";
import { capture, fixtureDir, promptsDir } from "./helpers.js";

const subject = ["--ctx", "subjectName=Ada", "--ctx", "notesDigest=thin metrics"];

describe("resolve command", () => {
  it("prints the assembled text to stdout and exits 0", async () => {
    const cap = capture();
    const code = await run(["resolve", "assistant", "--dir", promptsDir, ...subject], cap.io);
    expect(code).toBe(0);
    expect(cap.out()).toContain("You are a sharp, candid writing assistant.");
    expect(cap.out()).toContain("Subject: Ada");
    expect(cap.out()).toContain("Points to address: thin metrics");
    expect(cap.err()).toBe("");
  });

  it("keeps stdout text-only while --explain prints the trace to stderr", async () => {
    const cap = capture();
    const code = await run(
      ["resolve", "assistant", "--dir", promptsDir, "--ctx", "mode=terse", ...subject, "--explain"],
      cap.io,
    );
    expect(code).toBe(0);

    // stdout is only the assembled terse text, no trace leakage.
    expect(cap.out()).toContain("optimize for fast skim-reading");
    expect(cap.out()).not.toContain("final order:");
    expect(cap.out()).not.toContain("replaced:");

    // stderr shows the 3 replaces + 1 add and the terse final order.
    const err = cap.err();
    expect(err).toContain("voice → terse-voice");
    expect(err).toContain("task-framing → terse-task-framing");
    expect(err).toContain("input-context → terse-input-context");
    expect(err).toContain("line-by-content after bans");
    expect(err).toContain(
      "final order: terse-voice → terse-task-framing → locale → native-language → bans → line-by-content → terse-input-context → json-return",
    );
  });

  it("emits valid JSON with text and trace for --json", async () => {
    const cap = capture();
    const code = await run(["resolve", "assistant", "--dir", promptsDir, ...subject, "--json"], cap.io);
    expect(code).toBe(0);
    const parsed = JSON.parse(cap.out()) as { text: string; trace: { prompt: string } };
    expect(typeof parsed.text).toBe("string");
    expect(parsed.text).toContain("Subject: Ada");
    expect(parsed.trace.prompt).toBe("assistant");
    expect(cap.err()).toBe("");
  });

  it("flags an unmatched axis for industry=zoo under --explain", async () => {
    const cap = capture();
    const code = await run(
      ["resolve", "assistant", "--dir", promptsDir, "--ctx", "industry=zoo", ...subject, "--explain"],
      cap.io,
    );
    expect(code).toBe(0);
    expect(cap.err()).toContain("no rules matched for industry=zoo");
  });

  it("fails with a stderr message for an unknown prompt", async () => {
    const cap = capture();
    const code = await run(["resolve", "nonexistent", "--dir", promptsDir], cap.io);
    expect(code).toBe(1);
    expect(cap.out()).toBe("");
    expect(cap.err()).toContain('Unknown prompt "nonexistent"');
  });

  it("fails with a clear message for a missing prompts folder", async () => {
    const cap = capture();
    const code = await run(["resolve", "assistant", "--dir", "/no/such/place"], cap.io);
    expect(code).toBe(1);
    expect(cap.err()).toContain("prompts folder not found");
  });

  it("requires a prompt name", async () => {
    const cap = capture();
    const code = await run(["resolve", "--dir", promptsDir], cap.io);
    expect(code).toBe(1);
    expect(cap.err()).toContain("requires a <prompt> name");
  });

  it("surfaces resolve warnings on stderr without polluting stdout", async () => {
    const cap = capture();
    // No subject context -> the input fragment reports missing variables.
    const code = await run(["resolve", "assistant", "--dir", promptsDir], cap.io);
    expect(code).toBe(0);
    expect(cap.err()).toContain("warning:");
    expect(cap.err()).toContain("Missing variable");
    expect(cap.out()).not.toContain("warning:");
  });

  it("respects NO_COLOR while still allowing color on a TTY", async () => {
    const explainArgs = ["resolve", "assistant", "--dir", promptsDir, ...subject, "--explain"];

    const colored = capture({ colorDefault: true, env: {} });
    await run(explainArgs, colored.io);
    // biome-ignore lint/suspicious/noControlCharactersInRegex: asserting ANSI escapes.
    expect(colored.err()).toMatch(/\x1b\[/);

    const plain = capture({ colorDefault: true, env: { NO_COLOR: "1" } });
    await run(explainArgs, plain.io);
    // biome-ignore lint/suspicious/noControlCharactersInRegex: asserting no ANSI escapes.
    expect(plain.err()).not.toMatch(/\x1b\[/);
  });
});

interface ResolveAllJson {
  [key: string]:
    | { kind: "composition"; text: string; trace: { prompt: string } }
    | { kind: "code-prompt"; samples: { label: string; output: string }[] };
}

describe("resolve addressing + --all (workspace)", () => {
  const workspaceDir = fixtureDir("workspace");

  it("assembles a qualified <book>/<comp> address", async () => {
    const cap = capture();
    const code = await run(
      ["resolve", "greeter/greeting", "--dir", workspaceDir, "--ctx", "name=Ada"],
      cap.io,
    );
    expect(code).toBe(0);
    expect(cap.out()).toContain("Hello Ada, glad you are here.");
  });

  it("resolves a unique bare name across books", async () => {
    const cap = capture();
    const code = await run(["resolve", "digest", "--dir", workspaceDir, "--ctx", "topic=onboarding"], cap.io);
    expect(code).toBe(0);
    expect(cap.out()).toContain("Summarize onboarding in three tight bullet points.");
  });

  it("errors clearly for a bare name in no book", async () => {
    const cap = capture();
    const code = await run(["resolve", "ghost", "--dir", workspaceDir], cap.io);
    expect(code).toBe(1);
    expect(cap.err()).toContain('Unknown prompt "ghost" in any book');
    expect(cap.out()).toBe("");
  });

  it("assembles every composition and lists code-prompts as inventory (--all --json)", async () => {
    const cap = capture();
    const code = await run(
      ["resolve", "--all", "--json", "--dir", workspaceDir, "--ctx", "name=Ada", "--ctx", "topic=onboarding"],
      cap.io,
    );
    expect(code).toBe(0);
    const parsed = JSON.parse(cap.out()) as ResolveAllJson;
    // Deterministic key order: by book then by node name.
    expect(Object.keys(parsed)).toEqual(["greeter/greeting", "summarizer/digest", "summarizer/table"]);
    const greeting = parsed["greeter/greeting"];
    expect(greeting?.kind).toBe("composition");
    if (greeting?.kind === "composition") {
      expect(greeting.text).toContain("Hello Ada");
    }
    const table = parsed["summarizer/table"];
    expect(table?.kind).toBe("code-prompt");
    if (table?.kind === "code-prompt") {
      expect(table.samples[0]?.label).toBe("short");
    }
  });

  it("prints composition blocks with headers and notes skipped code-prompts (--all plain)", async () => {
    const cap = capture();
    const code = await run(
      ["resolve", "--all", "--dir", workspaceDir, "--ctx", "name=Ada", "--ctx", "topic=onboarding"],
      cap.io,
    );
    expect(code).toBe(0);
    expect(cap.out()).toContain("=== greeter/greeting ===");
    expect(cap.out()).toContain("=== summarizer/digest ===");
    expect(cap.out()).not.toContain("summarizer/table");
    expect(cap.err()).toContain("skipped 1 code-prompt(s)");
    expect(cap.err()).toContain("summarizer/table");
  });

  it("surfaces missing-var warnings on stderr without throwing (--all)", async () => {
    const cap = capture();
    const code = await run(["resolve", "--all", "--dir", workspaceDir], cap.io);
    expect(code).toBe(0);
    expect(cap.err()).toContain("warning:");
    expect(cap.err()).toContain('greeter/greeting: Missing variable "name"');
  });
});
