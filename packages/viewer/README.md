# @markbrutx/promptbook-viewer

Storybook-for-prompts: a local web app that renders a prompts folder via
[`@markbrutx/promptbook-core`](https://www.npmjs.com/package/@markbrutx/promptbook-core).
Part of [promptbook](https://github.com/markbrutx/promptbook).

```
npm i -D @markbrutx/promptbook-viewer
```

Usually you don't import this directly — run `promptbook view` from
[`@markbrutx/promptbook-cli`](https://www.npmjs.com/package/@markbrutx/promptbook-cli),
which lazily loads it.

## What it shows

- a sidebar tree: Fragments / Compositions → variants
- the assembled prompt with each fragment colored by source + a legend
- context pickers (mode, locale, target-model, …) → live re-resolve
- token count, inline lint warnings, and the explain trace
- a used-in graph for any fragment ("shared by 10 of 20")
- a diff between two variants
- select text → comment → send to the agent inbox queue

## Programmatic use

```ts
import { startViewer } from "@markbrutx/promptbook-viewer";

const { url, close } = await startViewer({ promptsDir: "./prompts", open: true });
```

The server is a thin wrapper over `core`; the React UI is built into static
assets at publish time.

## License

[MIT](./LICENSE)
