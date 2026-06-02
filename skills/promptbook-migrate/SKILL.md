---
name: promptbook-migrate
description: >-
  Migrate a project's existing prompts onto promptbook. Use whenever the user
  has prompts living somewhere else — hardcoded TypeScript/JavaScript string
  literals passed to OpenAI/Anthropic/AI SDK calls, standalone .md or .txt
  files, LangChain PromptTemplate / ChatPromptTemplate, Vercel AI SDK
  `streamText({ system: "..." })`, or any ad-hoc prompt registry — and wants
  them assembled deterministically from fragments + rules. Trigger even when
  the user only says "move my prompts to promptbook", "switch us to
  promptbook", or "refactor these strings into promptbook".
---

# Migrate prompts onto promptbook

You are turning prompts that live in code/strings/markdown into a promptbook
**book** (`fragments/` + `rules/`) so the same prompt can be assembled
deterministically, varied by context, and explained without a model call.

This skill assumes promptbook is already installed in the project (CLI +
core, with a working `promptbook.json` + `<promptsDir>/`). If it isn't,
hand off to `promptbook-install` first, then come back.

## The migration mindset

The trap is "find string, paste into fragments/foo.md, done". That gives you
file-shaped strings, not a book. A migration is good when **the next change
the user makes to a prompt is faster than it would have been before**.

That happens when:

- the **same text** that was duplicated across two call-sites becomes one
  fragment shared by two compositions;
- the **conditional logic** that lived in `if (mode === 'terse') prompt = X`
  becomes one `when: { mode: terse } → replace: …` rule, not code;
- the **per-model differences** (a JSON contract for GPT, XML for Claude)
  stop being three near-identical strings and become one composition + a
  rule on the `model` axis;
- the **`${var}` interpolation** that was `template.replace("{{name}}", …)`
  becomes `${name}` in a fragment, supplied via `context`.

If you cannot point at one of those gains for a given prompt, the prompt
might not belong in a book. Tell the user, leave it where it is, move on.

## Pick the source playbook

Read the matching reference file based on where the user's prompts currently
live:

- **Hardcoded string literals in TS/JS** (`` `You are an expert…` `` passed
  to `openai.chat.completions.create`, `anthropic.messages.create`, or
  similar SDK calls) → read `references/from-hardcoded-strings.md`.
- **Flat `.md` / `.txt` files in a directory** (`prompts/system.md`,
  `prompts/v2/assistant.txt`, etc.) → read `references/from-flat-files.md`.
- **LangChain** (`PromptTemplate.fromTemplate`, `ChatPromptTemplate`, hub
  pulls) → read `references/from-langchain.md`.
- **Vercel AI SDK / OpenAI SDK helpers** (`streamText({ system })`,
  `generateText({ messages: [{ role: 'system', content: … }] })`) → read
  `references/from-ai-sdk.md`.

If the user has more than one source (very common — some hardcoded, some in
`.md`), do them one source at a time. Don't try to migrate everything in one
pass; you will lose track of what was already done.

## Common pipeline (every source uses this)

Each reference fills in the source-specific parts. The pipeline is the same:

### 1. Inventory

Make a flat list of every prompt the user wants migrated. For each, capture:

- **call-site** (file:line if from code; path if from a file);
- **the literal text** (full string);
- **what varies** across call-sites (model? language? mode? user-supplied
  values like `${name}`?);
- **what differs** between near-duplicate prompts (compare with `diff`).

Write this list to a scratch file (e.g., `tmp/prompt-migration.md`) and show
it to the user before touching anything. They almost always notice missing
ones or want to drop ones you found. This step is cheap and saves a rewrite.

### 2. Decide composition boundaries

A **composition** corresponds to one logical prompt the user calls in their
code. Per call-site is the default; collapse two compositions into one only
if the texts are identical *or* differ only along a context axis (model,
locale, mode). Do not merge unrelated prompts just because they share
boilerplate — that is what fragments are for.

### 3. Identify shared and variable parts

For each composition, split the text into the smallest reasonable fragments
along these natural seams:

- **persona** ("You are X") — almost always shareable across compositions;
- **guardrails** ("Do not …", "Only use facts from …") — usually shared;
- **task** ("Reply to the customer" / "Summarize") — usually unique per
  composition;
- **format** ("Respond as JSON {…}" / "Use XML tags") — the prime candidate
  for a `replace` rule on the `model` axis;
- **tone / style** ("Be concise" / "Be warm") — candidate for a `replace`
  rule on a `tone`/`mode` axis;
- **locale / language directive** ("Respond in ${locale}") — single fragment,
  parameterized by `${locale}`, kept at an edge of the prompt so the
  language-directive-position lint stays happy.

If a chunk appears in two compositions verbatim → extract a fragment. If it
appears in two compositions with a small variation along a context axis →
extract two fragments and write a rule that swaps them.

### 4. Write the fragments

One Markdown file per fragment in `<promptsDir>/fragments/`. The YAML
frontmatter holds at minimum the `id`:

```markdown
---
id: persona
kind: persona
tags: [voice]
---
You are a customer support assistant. You are accurate, calm, and helpful,
and you only state things you can verify from the conversation.
```

`id` must be the filename's stem and unique across the book. `kind` and
`tags` are free-form and useful for human navigation in the viewer — pick
short, neutral tokens (`persona`, `guardrails`, `task`, `style`, `format`,
`tone`, `locale`).

For variable substitution: write `${name}` in the body. At resolve time the
caller passes `context: { name: 'Alex' }`. A missing `${name}` renders empty
and is recorded in `trace.warnings` — the engine never throws. So
parameterize freely; the safety net is built in.

### 5. Write the composition rule file

One YAML file per composition in `<promptsDir>/rules/`. The skeleton:

```yaml
name: <composition-id>
# Base order: the default fragment sequence.
base:
  - persona
  - guardrails
  - task
  - format-prose
  - locale            # language-directive at an edge
rules:
  # Each rule: when <context matches> → action <fragments>
  - when:
      tone: terse
    replace:
      tone-warm: tone-terse

  - when:
      model: gpt
    replace:
      format-prose: format-json
```

Rule actions are `add`, `replace`, `forbid`, `order` (and `after` for
ordering relative to another fragment). Rules apply in declaration order,
later wins; `forbid` is the final filter. Don't build a solver — declaration
order is the cascade.

### 6. Replace the call-site

Now wire the user's code to call `resolve()` instead of holding the string:

```ts
import { resolve } from "@markbrutx/promptbook-core";

const { text, trace } = await resolve({
  promptsDir: "./prompts",
  prompt: "reply",                                // the composition name
  context: { model: "gpt", tone: "terse", locale: "English" },
});

// Pass `text` as the system prompt to your existing SDK call.
const result = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    { role: "system", content: text },
    { role: "user", content: userMessage },
  ],
});
```

Three things to preserve from the user's existing code:

- the **user-turn content** stays where it was. promptbook is for the system
  prompt; the user message comes from the user's app logic.
- the **SDK choice** stays. promptbook doesn't replace OpenAI/Anthropic
  clients; it just gives you the string to pass.
- the **model id** stays. The `model` *context axis* in promptbook is for
  picking between prompt variants (JSON vs XML format). The actual API model
  id (`gpt-4o-mini`) is still passed to the SDK as before.

### 7. Verify byte-equivalence on a known case

Before the user re-runs anything against a real model, prove the migration
is faithful:

```bash
promptbook resolve <comp> --ctx <known-context-values>
```

Compare against the original literal. They should match (modulo trailing
newlines and whitespace at fragment seams — pick `\n\n` as the joiner; that
is what `resolve` uses). If they don't:

- check fragment order in `base`;
- check that `when` conditions actually match the context you passed;
- run `--explain` and read the trace.

Then run lint:

```bash
promptbook lint <comp> --ctx <known-context-values>
```

Findings that almost always show up on migrations and what they mean:

- `unused-fragment` — you wrote a fragment and forgot to put it in any
  composition. Either delete it or add it to `base` / a rule.
- `dangling-reference` — a `base` or rule names a fragment id that doesn't
  exist. Typo in the id, or the fragment file is missing.
- `dead-rule` — the rule will never do anything (e.g., `add` of an
  already-present id). Often a sign your `base` already contains what the
  rule was supposed to add; remove one of them.
- `token-budget` — the assembled prompt is bigger than `lint.maxTokens`.
  Either the budget is too tight or there's actual bloat to remove (this is
  exactly when `promptbook-doctor` becomes useful).

### 8. Migrate fixtures (optional but recommended)

If the user has tests/eval cases for the old prompt (snapshot tests, eval
harness, hand-curated examples), convert them to promptbook fixtures in
`<promptsDir>/fixtures/<name>.json`:

```json
{
  "name": "gpt-json",
  "context": { "model": "gpt", "tone": "terse", "locale": "English" },
  "input": "My order arrived broken.",
  "expected": { ... }
}
```

Fixtures double as named variants in the viewer and as cases for
`promptbook eval`. They are the single best place to encode "the model must
behave this way" so future edits don't quietly regress.

### 9. Delete the old prompt

Once `resolve` returns the expected text and the SDK call passes one real
test, delete the original literal/file. Don't leave a "for reference" copy
— it becomes the wrong source of truth within a week. Git history is the
backup.

## Migration smells to flag to the user

If during migration you notice any of these, surface them before finishing
— the user may want to fix them now, or hand off to `promptbook-doctor`:

- **Two prompts that are ~90% the same but with no clean context axis** —
  often a sign the original author copy-pasted; the migration should pick
  one fragment hierarchy, not preserve both.
- **A prompt with `${foo}` template syntax used inconsistently** (e.g.
  `{{foo}}`, `${foo}`, `<foo>` all in the same file) — pick `${foo}`
  (promptbook syntax) and tell the user the rename you did.
- **A prompt that is one giant string with every concern jammed in** —
  worth splitting into fragments aggressively. If the user pushes back
  ("just paste it as-is"), do that, but leave a `# TODO: split` comment in
  the rule file pointing at `promptbook-doctor`.
- **A prompt assembled with `if`s in code** — that conditional logic should
  become rules. Don't preserve it as a single megafragment plus runtime
  `context` interpolation; the whole point is to lift the conditional into
  data.

## When migration is done

Final checks:

```bash
promptbook lint                # book-level rules across all compositions
promptbook ls                  # everything you migrated is listed
```

Both green = ship it. Then:

- Suggest the user run `promptbook view` to see what they built (the
  sidebar tree + used-in graph make shared fragments obvious — often
  surprising even to the author).
- Suggest `promptbook-doctor` for a pass over the freshly migrated book to
  catch bloat the migration itself didn't address.
