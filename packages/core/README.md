# @markbrutx/promptbook-core

Agnostic, deterministic core for composing prompts from reusable fragments via
declarative rules. No CLI, no UI, no domain knowledge — it only **selects**,
**orders** and **interpolates** fragments, and explains what it did.

## Model

- **fragment** (WHAT) — a reusable micro-prompt: a Markdown file with YAML
  frontmatter (`id`, optional `kind`/`tags`) and a body that may contain
  `${path}` placeholders.
- **composition** — a full system prompt declared in `rules/<name>.yaml`:
  an ordered `base` list of fragment ids, an optional `order`, and `rules`.
- **rule** (WHEN) — `when <context> → one action`. Actions: `add` (optionally
  `after: <id>`), `replace` (old → new), `forbid`, `order`. Empty `when` always
  fires.
- **context** — a flat bag of scalar facts. Any computed value (digests,
  scores, sorted lists) is pre-computed by the caller and passed in.

## Folder layout

```
prompts/
├─ fragments/   *.md   (text + frontmatter)
└─ rules/       *.yaml  (composition + rules)
```

## Usage

```ts
import { resolve } from "@markbrutx/promptbook-core";

const { text, trace } = await resolve({
  promptsDir: "./prompts",
  prompt: "assistant",
  context: { mode: "terse", locale: "ru", subjectName: "Ada" },
});
```

`resolve` returns `{ text, trace }`. `text` is the fragments joined with `\n\n`,
in final order, with `${...}` substituted. `trace` is the explain output: every
rule (fired + why), the final id order, what was replaced/added/forbidden,
context axes no rule matched, and warnings.

## Guarantees

- **Deterministic.** Same folder contents + input → byte-identical `text`.
- **Never throws on data.** A missing `${var}` renders empty and is recorded in
  `trace.warnings`; an unknown fragment reference is a warning, not a crash.
- **Conflict strategy.** Rules apply in order, later wins (cascade). `forbid` is
  the one exception: it is a final filter and always wins.
- **Runtime-agnostic.** Pure functions; the filesystem is injectable
  (`FsAdapter`), so it runs under Node, Deno and Bun.
