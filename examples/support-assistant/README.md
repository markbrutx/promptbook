# Demo: support-assistant

A self-contained prompts folder for a customer-support assistant. It shows the
three things that make promptbook different from a flat prompt registry:

1. **Composition** — prompts are assembled from reusable fragments, and the same
   fragments are shared across more than one prompt.
2. **Variants by rule** — context axes (tone, language) pick fragments
   declaratively, as data, not string-building in code.
3. **Multi-model compilation** — the *target model* is just another context axis,
   and the output format a model wants is just a rule. One logical prompt compiles
   to a different format per model.

Nothing here is wired to a model; everything below is the deterministic assembly
layer you can run, see, and lint without a single API call.

Run every command from this folder (`examples/support-assistant`). It ships a
`promptbook.json` with `promptsDir: "."`, so `--dir` is optional once you `cd` in.

```bash
npm i -g @markbrutx/promptbook-cli   # or: npx @markbrutx/promptbook-cli <cmd>
cd examples/support-assistant
```

## The menu

```bash
promptbook ls
```

Two **compositions** (`reply`, `escalation`) and one **code-prompt**
(`status-digest`). A code-prompt is a builder that stays in code: the book holds
only its metadata and frozen output samples, so the menu is complete without the
core ever executing a builder.

## Multi-model compilation (the headline)

The `reply` composition assembles a support reply. Its output format is a single
fragment in the base order, and a rule swaps that fragment based on the `model`
axis. Same logical prompt, three different compiled contracts:

```bash
# default: plain prose
promptbook resolve reply --ctx locale=English

# model=gpt: a JSON object contract
promptbook resolve reply --ctx model=gpt --ctx locale=English

# model=claude: XML-tagged output
promptbook resolve reply --ctx model=claude --ctx locale=English
```

The customer's message arrives as the user turn (the fixtures' `input`), so the
system prompt is instructions only. Only the output-format block changes between
models; persona, guardrails, task and language directive stay identical. The rule
that does it is plain data:

```yaml
- when: { model: gpt }
  replace: { reply-format-prose: reply-format-json }
- when: { model: claude }
  replace: { reply-format-prose: reply-format-xml }
```

This is the differentiator: incumbents store a flat string per model. Here the
target model and its format live as one context axis over one shared prompt.

## See which rules fired

```bash
promptbook resolve reply --ctx model=gpt --ctx tone=terse --ctx locale=English --explain
```

The trace (on stderr) lists every rule, whether it fired and why, the final
fragment order, and what was replaced. Drop `--ctx locale=English` and the
`${locale}` directive renders empty with a recorded warning rather than throwing:
the engine shows holes, never crashes.

## Static checks, no model

```bash
promptbook lint            # book-level rules: dead rules, unused or dangling fragments
promptbook lint reply      # plus resolved checks: token budget, banned tokens, directive position
```

The `locale` fragment is a `language-directive`, and the lint keeps it at an edge
of the prompt so a model cannot miss it.

## Shared fragments across the menu

`escalation` is a second composition that reuses `persona`, `guardrails` and
`locale` from `reply`. Open the viewer and the used-in graph shows exactly which
fragments are shared ("which parts are common, what is safe to change"):

```bash
promptbook view
```

The sidebar tree lists both compositions, their variants (the `fixtures/` presets
`gpt-json` and `claude-xml` show up as named variants), and the `status-digest`
code-prompt with a `code` badge and its sample output. Pick a context in the UI
to re-assemble live and diff two variants.

## Files

```
support-assistant/
├─ fragments/     reusable micro-prompts (persona, guardrails, tone, formats, ...)
├─ rules/         reply.yaml + escalation.yaml (base order + when-rules)
├─ code-prompts/  status-digest.yaml (+ frozen sample) — a builder in the menu
├─ fixtures/      gpt-json / claude-xml (eval cases + viewer variant presets)
└─ promptbook.json
```
