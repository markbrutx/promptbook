# @markbrutx/promptbook-cli

Thin terminal surface over [`@markbrutx/promptbook-core`](https://www.npmjs.com/package/@markbrutx/promptbook-core):
the command surface for agents and CI. Part of [promptbook](https://github.com/markbrutx/promptbook).

```
npm i -D @markbrutx/promptbook-cli
```

## Commands

```
promptbook resolve <name> --explain         # assemble a prompt; print the explain trace
promptbook ls                               # list fragments / compositions / code-prompts
promptbook lint <name>                      # static checks: token budget, banned tokens, dead rules…
promptbook eval --case <fixture>            # run fixtures against a model adapter → pass-rate
promptbook bundle -o book.generated.ts      # serialize a prompts folder to a portable module
promptbook bundle --all                     # rebundle every book in a workspace (one artifact per book)
promptbook bundle --check [--all]           # CI gate: exit 1 when book.generated.ts is stale or missing
promptbook bundle --exclude-code-prompts    # serialize code-prompts as an empty map (runtime-lean bundle)
promptbook watch                            # rebundle book.generated.ts on every fragment/rule edit
promptbook view                             # open the viewer (needs @markbrutx/promptbook-viewer)
promptbook annotations list|resolve|clear
```

Dev loop:

- `promptbook watch` keeps `book.generated.ts` in sync while you edit
  `fragments/`, `rules/`, `code-prompts/` or `promptbook.json`
  (one rebundle per book, debounced 250 ms; multi-book workspaces rebundle in
  parallel).
- `promptbook bundle --check --all` is the CI gate: it exits non-zero when any
  book's checked-in `book.generated.ts` drifts from the prompts folder, so
  `book.generated.ts` and the source files cannot fall out of sync silently.
- `promptbook bundle --exclude-code-prompts` ships a runtime-lean bundle while
  keeping `code-prompts/` on disk as metadata for `ls` / the viewer.

The prompts folder is resolved from `--dir`, then `promptbook.json` (the
nearest one found by walking up from the current directory — same model as
`git`/`biome`/`eslint`; the `promptsDir` value is taken relative to wherever
the config file lives, so one config at the repo root works from every
subfolder), then `./prompts`.

```
promptbook resolve assistant --ctx mode=terse --ctx locale=ru
```

- **stdout** = payload; **stderr** = explain / warnings / errors.
- `--json` = machine-readable output on stdout.
- Honors `NO_COLOR`.

`eval` uses [`@markbrutx/promptbook-openrouter`](https://www.npmjs.com/package/@markbrutx/promptbook-openrouter)
as its default model adapter; `view` lazily imports the optional
[`@markbrutx/promptbook-viewer`](https://www.npmjs.com/package/@markbrutx/promptbook-viewer).

## License

[MIT](./LICENSE)
