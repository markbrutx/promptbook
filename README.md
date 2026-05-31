# promptbook

**Storybook for prompts.** Compose system prompts from reusable fragments by
declarative rules, *see* every assembled variant, and let agents test and edit
them in a deterministic loop. Model-, provider-, language- and platform-agnostic.

Prompts start as throwaway text, then get reused across flows, grow conditional
logic, and return structured data — they become production code but are still
written like sticky notes. promptbook treats them as code: which fragments are
shared, what is safe to change, and what the final prompt looks like under a
given context are all answerable without running a single model call.

## The model: WHAT / WHEN / HOW

- **WHAT — `fragment`** — a reusable micro-prompt: a Markdown file with YAML
  frontmatter and a body that may contain `${path}` placeholders.
- **WHEN — `rule`** — declarative `when <context> → add / replace / forbid /
  order <fragment>`, expressed as *data*, not code.
- **HOW — `resolve()`** — a pure function returning the assembled string; a thin
  adapter sends it to a model.

Think of it as CSS for prompts: fragments are declarations, rules are selectors,
the resolver is the cascade. Assembly is deterministic (same folder + context →
byte-identical string); the only stochastic step, the model call, lives behind
an adapter.

## Packages

| Package | What it is |
|---------|------------|
| [`@markbrutx/promptbook-core`](packages/core) | The library. `resolve()`, `lint()`, `eval()`, bundle. Pure functions, zero CLI/UI deps. Ships a zero-dep `./edge` build for edge runtimes. |
| [`@markbrutx/promptbook-cli`](packages/cli) | `promptbook resolve \| ls \| lint \| eval \| bundle \| view \| annotations`. The surface for agents and CI. |
| [`@markbrutx/promptbook-viewer`](packages/viewer) | `promptbook view` → a local web app. Sidebar tree, colored segments, context pickers, used-in graph, diff, annotate-to-agent. |
| [`@markbrutx/promptbook-openrouter`](packages/openrouter) | OpenRouter `ModelAdapter` for `eval`. Network lives here; core stays pure. |

## Usage

```ts
import { resolve } from "@markbrutx/promptbook-core";

const { text, trace } = await resolve({
  promptsDir: "./prompts",
  prompt: "assistant",
  context: { mode: "terse", locale: "ru", subjectName: "Ada" },
});
```

`text` is the fragments joined with `\n\n`, in final order, with `${...}`
substituted. `trace` is the explain output: every rule (fired + why), the final
id order, what was replaced / added / forbidden, context axes no rule matched,
and warnings. A missing `${var}` renders empty and is recorded in
`trace.warnings` — the engine never throws on data.

A prompts folder looks like:

```
prompts/
├─ fragments/   *.md    (text + frontmatter)
└─ rules/       *.yaml   (composition + rules)
```

## Develop

npm workspaces, Node ≥ 20.6, TypeScript (NodeNext, strict), tsgo, vitest, biome.

```
npm run build       # tsgo per package (+ edge bundle, + viewer web)
npm run typecheck
npm run test
npm run check       # biome + knip
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the two invariants that keep this
toolkit small and agnostic.

## License

[MIT](LICENSE)
