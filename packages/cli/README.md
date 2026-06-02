# @markbrutx/promptbook-cli

Thin terminal surface over [`@markbrutx/promptbook-core`](https://www.npmjs.com/package/@markbrutx/promptbook-core):
the command surface for agents and CI. Part of [promptbook](https://github.com/markbrutx/promptbook).

```
npm i -D @markbrutx/promptbook-cli
```

## Commands

```
promptbook resolve <name> --explain     # assemble a prompt; print the explain trace
promptbook ls                           # list fragments / compositions / code-prompts
promptbook lint <name>                  # static checks: token budget, banned tokens, dead rules…
promptbook eval --case <fixture>        # run fixtures against a model adapter → pass-rate
promptbook bundle -o book.generated.ts  # serialize a prompts folder to a portable module
promptbook view                         # open the viewer (needs @markbrutx/promptbook-viewer)
promptbook annotations list|resolve|clear
```

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
