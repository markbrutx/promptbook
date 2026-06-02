# Migrate from hardcoded TS/JS string literals

The most common source: template literals or plain strings passed straight
to an LLM SDK call.

## What you are looking at

Typical shapes:

```ts
// Shape A - template literal at the call site
const result = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    { role: "system", content: `You are a customer support assistant.
You are accurate and calm. Respond in ${locale}.
Reply with a JSON object: { "reply": "..." }` },
    { role: "user", content: userMessage },
  ],
});

// Shape B - named constant module
// prompts.ts
export const REPLY_SYSTEM = `You are a customer support assistant. ...`;
export const ESCALATION_SYSTEM = `You are an escalation specialist. ...`;

// Shape C - a function that builds the prompt with `if`s
function buildSystem(opts: { mode: 'terse' | 'warm'; model: 'gpt' | 'claude' }) {
  let s = "You are a customer support assistant.\n";
  if (opts.mode === 'terse') s += "Be terse and direct.\n";
  else s += "Be warm and welcoming.\n";
  if (opts.model === 'gpt') s += "Reply as JSON: { ... }\n";
  else s += "Reply with XML tags: <reply>...</reply>\n";
  return s;
}
```

Shape C is the most rewarding to migrate: every `if` becomes a rule, and
the function call site loses a parameter.

## Step-by-step

### 1. Find the call sites

```bash
# template literals (anchor on common system-prompt openers + SDK names)
rg -n "role:\s*['\"]system['\"]|system:\s*[\`'\"]" --type ts --type tsx --type js
rg -n "content:\s*[\`'\"]You are" --type ts --type tsx --type js

# named constants (likely module exports of multi-line strings)
rg -n "^export const [A-Z_]+\s*=\s*[\`'\"]" --type ts

# AI SDK / OpenAI / Anthropic helpers
rg -n "streamText|generateText|chat\.completions\.create|messages\.create" --type ts
```

Build the inventory list (file:line, full literal, what varies). Show it
to the user before extracting.

### 2. Normalize template-literal interpolation

If the literal uses JS interpolation `${expr}`, the migration is **not** a
1:1 paste. Two cases:

**Case A — the interpolated value is plain data** (`${locale}`, `${userName}`).
Keep `${locale}` as-is in the fragment; the value will come from
`context` at resolve time. Update the call site to pass it:

```ts
// before
content: `Respond in ${locale}.`

// fragment: fragments/locale.md
// body: Respond in ${locale}.

// call site
const { text } = await resolve({ ..., context: { locale } });
```

**Case B — the interpolated value is itself a chunk of conditional text**
(`${mode === 'terse' ? 'Be terse.' : 'Be warm.'}`). This is what becomes a
rule. Extract both branches as fragments (`tone-terse`, `tone-warm`), pick
one as the base, and write a `replace` rule on a `mode` (or `tone`) context
axis.

### 3. Pull out personas, guardrails, formats

For each composition, scan for fragments that look like:

- "You are X" — extract as `persona-*` (likely one persona reused by every
  composition in this project; check before duplicating).
- "Do not / Only / Always …" — extract as `guardrails`.
- "Respond as JSON …" / "Use the following format …" — extract as
  `format-*`, one per output shape. This is the prime swap target for the
  `model` axis if the project supports multiple models.

### 4. Build the composition

`rules/<name>.yaml`:

```yaml
name: reply
base:
  - persona
  - guardrails
  - reply-task
  - reply-format-json     # default; swap below if needed
  - locale                # language-directive at the edge
rules:
  - when: { tone: terse }
    replace: { tone-warm: tone-terse }

  - when: { model: claude }
    replace: { reply-format-json: reply-format-xml }
```

If the original built the prompt in code (shape C), each branch maps to one
rule. Walk the original `if` tree and translate top-to-bottom; rules apply
in declaration order, later wins.

### 5. Rewire the call site

```ts
// before
const system = buildSystem({ mode, model });
await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    { role: "system", content: system },
    { role: "user", content: userMessage },
  ],
});

// after
import { resolve } from "@markbrutx/promptbook-core";

const { text } = await resolve({
  promptsDir: "./prompts",
  prompt: "reply",
  context: { mode, model, locale },
});
await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    { role: "system", content: text },
    { role: "user", content: userMessage },
  ],
});
```

The SDK call doesn't change. The `model` API id (`"gpt-4o-mini"`) stays in
code; it is separate from the `model` *context axis* (`"gpt"`/`"claude"`)
that picks the prompt variant.

### 6. Cache `resolve()` if hot

`resolve()` reads the folder from disk and parses YAML/Markdown. Fine for
build steps and warm processes, hot enough at request time that you'd
notice in p99. For high-frequency calls, build the book once at module load
or use `bundle`:

```bash
promptbook bundle ./prompts -o ./src/generated/book.ts
```

Then import the generated module and call `resolveBook` (from
`@markbrutx/promptbook-core`). The CLI's `bundle` command is exactly for
this — including edge runtimes that can't read the filesystem.

### 7. Delete the original literal/function

After verification (`promptbook resolve <comp>` matches the original output
for a known context, and one real model call passes), delete:

- the template literal block;
- the `buildSystem` function;
- the `prompts.ts` module of named constants.

Imports of `REPLY_SYSTEM` / `buildSystem` from elsewhere in the codebase
all need to flip to `resolve(...)` calls. Search and replace; don't leave
half-migrated.

## Verification

```bash
promptbook resolve reply --ctx model=gpt --ctx tone=terse --ctx locale=English
# Compare byte-for-byte against `buildSystem({ mode: 'terse', model: 'gpt' })`
# called with the original code (or against the original template literal
# with the same interpolations applied).

promptbook lint reply --ctx model=gpt --ctx tone=terse --ctx locale=English
```

If the text matches and lint is green, the migration is faithful and the
delete is safe.
