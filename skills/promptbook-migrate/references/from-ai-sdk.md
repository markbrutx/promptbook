# Migrate from Vercel AI SDK / OpenAI SDK / Anthropic SDK helpers

The common pattern: a `system` field (or a `messages` array with a
`role: 'system'` entry) holds a literal string passed at the call site.
This is the simplest migration shape — the prompt is *already* a
parameter, you just lift the literal out into a book.

## Common shapes

```ts
// Vercel AI SDK - streamText / generateText
import { streamText } from "ai";

const result = streamText({
  model: openai("gpt-4o-mini"),
  system: `You are a customer support assistant. Respond in ${locale}.`,
  prompt: userMessage,
});

// OpenAI SDK
const completion = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    { role: "system", content: "You are a customer support assistant. ..." },
    { role: "user", content: userMessage },
  ],
});

// Anthropic SDK
const message = await anthropic.messages.create({
  model: "claude-3-5-sonnet-latest",
  system: "You are a customer support assistant. ...",
  messages: [{ role: "user", content: userMessage }],
});
```

All three pass the system prompt as a string. After migration, that
string comes from `resolve(...).text`.

## Step-by-step

### 1. Find call sites

```bash
rg -n "streamText|generateText|generateObject|streamObject" --type ts
rg -n "messages\.create|chat\.completions\.create" --type ts
rg -n "system:\s*[\`'\"]" --type ts
```

Inventory: file:line, the full system string (template literals: dump the
whole literal including interpolations), what varies between call sites.

### 2. Detect duplication across call sites

Two routes that both call `streamText` often share most of the system
prompt and differ in one line ("you reply briefly" vs "you reply at
length"). Diff them; the shared parts become a shared fragment.

```bash
# pull two suspect literals into scratch files and diff
diff -u /tmp/route-a-system.txt /tmp/route-b-system.txt
```

If the only difference is one paragraph → extract the shared part as a
fragment, the differing parts as two fragments, and write a rule that
swaps them on the appropriate context axis.

### 3. Migrate the prompt content

Same as the generic pipeline: fragments + rule file. See the parent
SKILL.md's "Common pipeline" section.

For Vercel AI SDK specifically, the `system` field is exactly the place
the resolved text goes — no message-array surgery needed:

```ts
import { streamText } from "ai";
import { resolve } from "@markbrutx/promptbook-core";

const { text: system } = await resolve({
  promptsDir: "./prompts",
  prompt: "reply",
  context: { locale, model: "gpt", tone },
});

const result = streamText({
  model: openai("gpt-4o-mini"),
  system,
  prompt: userMessage,
});
```

For OpenAI SDK with explicit messages, drop the system entry's content
in:

```ts
messages: [
  { role: "system", content: system },
  { role: "user", content: userMessage },
],
```

### 4. Per-route handlers (Next.js / app router)

A common project shape:

```
app/api/
├─ chat/route.ts        // streamText with system A
├─ summarize/route.ts   // streamText with system B
└─ classify/route.ts    // generateObject with system C
```

Decide upfront: one book at the repo root with three compositions
(`chat`, `summarize`, `classify`), or three sibling books in a workspace.

Default: **one book** with three compositions. The CLI workspace mode is
useful when teams own different agents and you want lint isolation, but
for a single small app it's overkill.

### 5. Tool / function calling

If the call uses tools (`tools`, `tool_choice`), the prompt that
describes the tools is usually inline in the system message. Migrate it
the same way — extract a fragment per tool-description section, list
them in the composition's `base`. The tool **definitions** (JSON schema)
stay in the SDK call; the **describing prose** ("you have access to a
calculator tool; use it when …") is prompt content and belongs in a
fragment.

If different routes use different tool subsets, that's a `forbid` /
`add` rule case:

```yaml
- when: { route: chat }
  forbid: [tool-doc-calculator]   # chat doesn't have the calculator
```

### 6. `generateObject` and schemas

`generateObject` calls bundle the system prompt with a Zod/JSON schema.
The Zod schema stays in code (it's not a prompt; it's a parse contract).
The system prompt migrates normally. If the system prompt contains a
hand-written description of the expected JSON shape ("respond with `{
title: ..., bullets: ... }`"), that **stays** in a `format-*` fragment —
it tells the model what shape to emit, the Zod schema validates it after.
Keep them in sync; consider a fixture that asserts the model output
parses against the schema.

### 7. Rewire and delete

After verification, delete the original system-string literal at every
call site. If you had a constants module (`prompts.ts` exporting the
strings), delete it; replace imports with `resolve(...)` calls.

## Verification

```bash
promptbook resolve reply --ctx model=gpt --ctx locale=English --ctx tone=warm
# Compare to the original system string with the same interpolations.

promptbook lint reply --ctx model=gpt --ctx locale=English --ctx tone=warm
```

Run one real model call after migration with a known input; the response
should be in the same shape as before. If the model behavior shifts,
your assembled text drifted somewhere — go back to the `--explain` trace
and find which rule did it.

## Edge runtimes (Cloudflare Workers, Vercel Edge, Supabase Edge)

If the call site runs on the edge, the runtime probably can't read the
filesystem at request time. Two options:

- **Bundle** the book: `promptbook bundle ./prompts -o ./src/book.gen.ts`,
  import the generated module, call `resolveBook` from
  `@markbrutx/promptbook-core/edge` (zero-dep build). This is the
  intended path for edge.
- **Vendor** the bundled module into the edge function's source if your
  bundler can't reach into `node_modules`.

Either way the source of truth stays the prompts folder; the bundled
module is a build artifact, regenerated on deploy.
