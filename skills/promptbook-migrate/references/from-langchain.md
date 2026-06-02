# Migrate from LangChain prompts

LangChain prompts come in a few shapes — translate each to promptbook
primitives. The big idea: LangChain mixes assembly + variables + chat
structure into one object; promptbook separates assembly (rules) from
content (fragments) from variables (`${...}` + context) and stays out of
chat structure entirely (you keep using whatever SDK builds the messages).

## Common LangChain shapes → promptbook

### `PromptTemplate.fromTemplate`

```ts
// before
import { PromptTemplate } from "@langchain/core/prompts";

const prompt = PromptTemplate.fromTemplate(
  `You are a customer support assistant.
Respond in {locale}.
Reply with: { "reply": "..." }`
);

const text = await prompt.format({ locale: "English" });
```

After:

- Fragments `persona.md`, `format-json.md`, `locale.md`.
- Composition `reply.yaml` listing them in `base`.
- Rewrite `{locale}` as `${locale}` in the fragment body.

```ts
import { resolve } from "@markbrutx/promptbook-core";
const { text } = await resolve({
  promptsDir: "./prompts",
  prompt: "reply",
  context: { locale: "English" },
});
```

### `ChatPromptTemplate.fromMessages`

```ts
import { ChatPromptTemplate } from "@langchain/core/prompts";

const prompt = ChatPromptTemplate.fromMessages([
  ["system", "You are a customer support assistant. Respond in {locale}."],
  ["human", "{question}"],
]);
```

LangChain bakes chat structure into the prompt object. In promptbook:

- The **system message** is one composition (`reply`). Migrate its
  template content as above.
- The **user message** stays in the consumer's code. promptbook does not
  manage chat turns; it gives you the system prompt string, you put it
  in the `messages` array yourself.

```ts
const { text: system } = await resolve({
  promptsDir: "./prompts",
  prompt: "reply",
  context: { locale },
});

const messages = [
  { role: "system", content: system },
  { role: "user", content: question },
];
```

If the same conversation has multiple system-prompt variants (e.g., a
"few-shot" prefix appended for one mode), those become rules in
`reply.yaml`, not separate prompt objects.

### `FewShotPromptTemplate` / examples

LangChain's few-shot wrapper interleaves examples + instructions. In
promptbook, examples are just fragments — write each example as its own
fragment (`example-1.md`, `example-2.md`) and list them in `base` between
the instructions and the user-input directive. Conditional inclusion
(`add` an example only when `mode: 'detailed'`) is a rule:

```yaml
- when: { mode: detailed }
  add: [example-1, example-2, example-3]
```

The `example-balance` lint will flag if you've got, say, only one positive
and three negative examples — handy after a migration to spot lopsided
demonstrations.

### `MessagesPlaceholder` (chat history)

```ts
new MessagesPlaceholder("history")
```

This is **conversation state**, not prompt content. Don't put it in a
fragment. Pass it as `messages` array entries in your SDK call alongside
the resolved system prompt. promptbook is for the system prompt; turn
history is application data.

### `hub.pull("rlm/rag-prompt")`

If the project pulls prompts from the LangChain hub at runtime, the
migration step is "snapshot them". Run the pull once, write the resolved
text into your fragments, version-control it, and stop pulling at runtime.
The hub's value (sharing) is real but orthogonal to deterministic
assembly; you can re-pull when you want an update, but the runtime should
read from your own folder.

## Things LangChain does that promptbook deliberately doesn't

When migrating, don't try to preserve these — they live elsewhere in the
new world or they go away:

- **Output parsers / format instructions** — promptbook gives you a
  string; parsing the model response is your code (often a Zod schema or
  a JSON parse with a fallback). The instruction "respond as JSON {...}"
  is a fragment in the book; the parsing is in code. They were entangled
  in LangChain; separate them.
- **Runnable chains (`prompt | model | parser`)** — there is no chain
  primitive. The model call lives in user code or in a thin adapter
  (`@markbrutx/promptbook-openrouter` is one); the parser is user code.
- **Callbacks / tracing** — promptbook's `trace` covers prompt assembly
  only (which rules fired, what was replaced, warnings). Model-call
  tracing is the responsibility of whatever SDK / observability tool you
  use around the call.

## Verification

Same as any migration:

```bash
promptbook resolve <comp> --ctx <known-vars>
# Should equal `await prompt.format({...})` with the same variables.

promptbook lint <comp> --ctx <known-vars>
```

For chat prompts, you only verify the system-message text. The user/human
template stays in your code, unchanged.
