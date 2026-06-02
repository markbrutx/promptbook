---
name: promptbook-install
description: >-
  Install and wire up @markbrutx/promptbook in a project from scratch. Use
  whenever the user wants to start using promptbook, set up a prompts folder,
  add the CLI/core deps, write the first `promptbook.json`, or scaffold a
  minimal book they can run `promptbook resolve` / `promptbook view` against.
  Trigger even when the user only says "set up promptbook" or "add promptbook
  to this repo" without further detail.
---

# Install promptbook in a project

You are setting up `@markbrutx/promptbook` in a user's project so they can
assemble prompts deterministically from reusable fragments. There is no
`promptbook init` CLI — install is a small set of file edits + one or two
npm installs. Do them, then verify with `promptbook ls` and `promptbook lint`.

## Mental model — what you are creating

promptbook reads one folder ("a book") of plain files:

```
prompts/
├─ fragments/    *.md   - reusable micro-prompts (text + YAML frontmatter)
├─ rules/       *.yaml  - one declarative composition per file (base order + when-rules)
├─ code-prompts/ *.yaml - optional, builders that stay in code
├─ fixtures/    *.json  - optional, eval cases / named variants
└─ promptbook.json     - config (promptsDir, lint, eval)
```

`fragments/` + `rules/` is the minimum. The CLI resolves the folder from
`--dir`, then the nearest `promptbook.json`'s `promptsDir`, then `./prompts`.

## Decide before you edit anything

Ask the user — or infer with high confidence from the repo and tell them what
you picked — these three things:

1. **Where the prompts live.** Default `prompts/` at repo root. Pick a different
   path if the repo already has a `prompts/` directory used for something else.
2. **Whether they want the CLI globally or per-project.** Per-project is the
   safe default (`devDependency`). Global is fine for solo experiments. The
   library (`@markbrutx/promptbook-core`) is a runtime dep separately.
3. **Whether to scaffold a minimal example or start empty.** If they have no
   existing prompts, scaffold the example so `promptbook resolve` works on
   first try. If they came in saying "I want to migrate my prompts onto
   promptbook", do not scaffold — hand off to `promptbook-migrate`.

Do not silently pick. Either ask (one short batched question) or state your
choice in one sentence before applying it.

## Steps

### 1. Install packages

For the library + CLI in one project (most common):

```bash
npm i @markbrutx/promptbook-core
npm i -D @markbrutx/promptbook-cli
```

Optional, only if relevant:

- `@markbrutx/promptbook-openrouter` — model adapter for `promptbook eval`.
  Add only if the user wants to run fixtures against a real model.
- `@markbrutx/promptbook-viewer` — local web UI; CLI `view` lazy-imports it.
  Add only if the user explicitly wants `promptbook view`.

Match the user's package manager if it is not npm (pnpm, yarn, bun) — the
package names are identical. Note: the project itself is an npm-workspaces
monorepo, but consumers can use any manager.

### 2. Create `promptbook.json` at the repo root

Minimum:

```json
{
  "promptsDir": "prompts"
}
```

Useful additions when the user has opinions:

```json
{
  "promptsDir": "prompts",
  "lint": {
    "maxTokens": 8000,
    "bannedTokens": ["—"]
  },
  "eval": {
    "model": "openai/gpt-4o-mini"
  }
}
```

- `lint.maxTokens` — token-budget ceiling (default 8000, chars/4 heuristic).
- `lint.bannedTokens` — substrings the assembled text must not contain.
- `eval.model` — default model id for `promptbook eval`.

`promptsDir` is resolved relative to the directory holding `promptbook.json`,
not the shell cwd, so one config at the repo root works from every subfolder.

### 3. Create the prompts folder

Make `<promptsDir>/fragments/` and `<promptsDir>/rules/`. If you are
scaffolding the minimal example, write these three files:

`<promptsDir>/fragments/persona.md`:

```markdown
---
id: persona
kind: persona
---
You are a helpful assistant. You answer clearly and only state facts you can
verify from the conversation.
```

`<promptsDir>/fragments/task.md`:

```markdown
---
id: task
kind: task
---
Answer the user's question.
```

`<promptsDir>/rules/assistant.yaml`:

```yaml
name: assistant
base:
  - persona
  - task
rules: []
```

A composition file declares its `name`, the `base` order of fragments, and
zero or more rules. With no rules, `resolve` just joins the base fragments
with blank lines.

### 4. Add a script (optional, very small win)

In the project's `package.json`, add:

```json
{
  "scripts": {
    "prompts:lint": "promptbook lint",
    "prompts:view": "promptbook view"
  }
}
```

### 5. Verify

Run, in order:

```bash
npx promptbook ls           # should print the "assistant" composition + 2 fragments
npx promptbook resolve assistant
npx promptbook lint
```

`ls` is the smoke test (the folder is wired). `resolve` is the canonical
output. `lint` should exit 0 with no findings on the scaffolded example.

If `npx promptbook ls` prints "no compositions found", the most common cause
is `promptsDir` not matching where you put the files. Fix that, do not patch
around it.

## What not to do

- **Do not invent CLI commands.** There is no `promptbook init`, no
  `promptbook new fragment`, no `promptbook scaffold`. The install is file
  edits plus `npm i`.
- **Do not put runtime model-call code in the prompts folder.** The folder is
  data: fragments + rules + fixtures. The model call happens in user code via
  `resolve()` from `@markbrutx/promptbook-core`.
- **Do not add a `prompts/index.ts` or any TS files in the prompts folder.**
  The runtime loader expects `fragments/*.md`, `rules/*.yaml`,
  `code-prompts/*.yaml`, `fixtures/*.json`. Other files are ignored, but a
  `.ts` file in there is a sign someone is trying to script around the engine
  — don't.
- **Do not commit a build artifact (`bundle`'s output) unless the user asks**
  for it. `bundle` is for shipping a book to an edge runtime; it is a build
  step, not part of the source of truth.

## Hand-off

When the install verifies green:

- If the user came in with existing prompts elsewhere — hand off to
  `promptbook-migrate` and stop.
- Otherwise, point them at `npx promptbook view` (after installing the viewer
  package if they want it) so they can see the assembled output, and at the
  `examples/support-assistant` folder in the promptbook repo as the canonical
  shape to grow towards.
