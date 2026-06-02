# Migrate from flat `.md` / `.txt` files

The user already has prompts as files, just not in a promptbook book.
Common shapes:

```
prompts/
├─ system.md
├─ assistant.txt
├─ v2/
│  ├─ system.md
│  └─ helper.md
└─ archive/...

# or co-located with code
src/agents/
├─ summarizer.prompt.md
└─ explainer.prompt.md
```

This is the easiest migration in principle — you already have files —
but the easiest mistake is **rename and stop**. A flat file is just a
literal in a file; it still has no fragmentation, no rules, no shared
parts. The migration is doing the work the original author skipped.

## Step-by-step

### 1. Inventory

```bash
# at the repo root, find prompt-looking files
rg --files -g '*.prompt.md' -g '*.prompt.txt' -g 'prompts/**/*.{md,txt}'
```

Show the list to the user and confirm scope. Some files might be docs,
not prompts (READMEs, design notes) — drop those.

For each file, capture: path, the body text, and any frontmatter / template
syntax already present (`{{var}}`, `${var}`, Handlebars, Mustache).

### 2. Map files → compositions

Default: **one source file → one composition**. The composition name is
the file stem (`system.md` → `system`).

Exceptions:

- A file ending in something obviously fragment-like (`-persona.md`,
  `-guardrails.md`, `_format.md`) and not used standalone in code is
  probably a fragment author has already factored out by hand. Treat it
  as a fragment, not a composition.
- A pair of files like `reply.gpt.md` / `reply.claude.md` is one
  composition with a `model` axis rule, not two compositions.

### 3. Split each file into fragments

Open each candidate composition and slice along the same seams as for any
migration — persona / guardrails / task / format / tone / locale. The body
of one `.md` file usually contains 3-6 fragments worth of material.

If the file already has Markdown headings (`## Persona`, `## Output
format`), use those as the cut points. Don't blindly cut by paragraphs —
think about what's reusable across the menu.

### 4. Handle existing template syntax

If the file already uses placeholders, decide upfront which syntax becomes
the promptbook one (`${name}`):

| Source | Action |
|---|---|
| `{{name}}` (Handlebars/Mustache) | Replace with `${name}`. |
| `${name}` (JS-style) | Keep as-is. |
| `<name>` (XML-tag-style) | Replace with `${name}` if it was a placeholder; leave if it was actual XML output. |
| `{name}` (Python f-string style) | Replace with `${name}`. |

Do the replacement consistently across the whole file in one pass; show
the diff to the user so they can spot any cases where `{{ }}` was
intentional Markdown/templating noise rather than a value to interpolate.

### 5. Write fragments + rule

Same as for hardcoded strings — `fragments/*.md` with YAML frontmatter +
`rules/<comp>.yaml` declaring base order and rules. If the source file
already had YAML frontmatter, keep the metadata that makes sense (`tags`,
`description`) and drop anything that isn't recognized.

### 6. Rewire the consumer

Find where the file was read:

```bash
rg "readFile.*prompts" --type ts
rg "import .*\\?raw['\"]"     # Vite / esbuild ?raw imports
rg "readFileSync.*\\.prompt\\.md"
```

Replace each read with a `resolve()` call:

```ts
// before
import systemPrompt from "./prompts/system.md?raw";

// after
import { resolve } from "@markbrutx/promptbook-core";
const { text: systemPrompt } = await resolve({
  promptsDir: "./prompts",
  prompt: "system",
  context: { /* whatever the file used as placeholders */ },
});
```

If the consumer is a build-time tool (codegen, scripts), and reading via
filesystem at runtime isn't appropriate, use `promptbook bundle` to emit
a self-contained module.

### 7. Verify and delete

```bash
promptbook resolve <comp> --ctx <known-vars>
# Compare to the original file's content with placeholders filled in.

promptbook lint <comp> --ctx <known-vars>
```

When the assembled text matches and lint is green, delete the original
file. Don't leave it as `*.legacy.md` or move it to `archive/`. The book
is the new source of truth; git remembers the rest.

## Co-located prompt files (`*.prompt.md` next to source)

A common pattern is putting `summarizer.prompt.md` next to
`summarizer.ts`. Two approaches; pick one and apply consistently:

- **Centralize** — move all of them into `<promptsDir>/`. Pro: one place
  to lint/view/audit. Con: code and prompt drift apart in PRs.
- **Keep co-located, multi-book workspace** — make each agent folder its
  own book with `promptbook.json`+`rules/`. The CLI discovers sibling
  books at one level under the workspace root; addressing becomes
  `<book>/<comp>` (e.g. `summarizer/system`). Pro: prompt lives with its
  caller. Con: lint must traverse multiple books.

The centralized form is simpler and the right default unless the user
specifically asked to keep things co-located.
