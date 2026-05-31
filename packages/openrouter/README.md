# @markbrutx/promptbook-openrouter

OpenRouter `ModelAdapter` for [`@markbrutx/promptbook-core`](https://www.npmjs.com/package/@markbrutx/promptbook-core)
eval. The network lives here so the core stays pure. Part of
[promptbook](https://github.com/markbrutx/promptbook).

```
npm i @markbrutx/promptbook-openrouter
```

## Usage

```ts
import { evaluate } from "@markbrutx/promptbook-core";
import { openRouterAdapter } from "@markbrutx/promptbook-openrouter";

const adapter = openRouterAdapter({
  apiKey: process.env.OPENROUTER_API_KEY,
  model: "openai/gpt-4o-mini",
});

const report = await evaluate({ promptsDir: "./prompts", adapter /* … */ });
```

`core` only ever sees the `ModelAdapter` interface; this package maps a request
to OpenRouter's HTTP API and back. Swap it for any provider by implementing the
same interface.

## License

[MIT](./LICENSE)
