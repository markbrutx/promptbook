# Contributing

`promptbook` is a small, agnostic, deterministic toolkit. Two rules keep it that
way; please read them before opening a PR.

## 1. Keep the shippable surface domain-agnostic

`@promptbook/core`, `@promptbook/cli` and `@promptbook/openrouter` know nothing
about any specific application. They only **select**, **order**, **interpolate**,
**lint** and **eval** prompt fragments.

No domain vocabulary may appear in package source, bin, or test fixtures. An
`agnosticism guard` test in each package scans `src`/`bin`/`test` (including
`.md`/`.yaml`/`.json` fixtures) and fails on any leak. Test fixtures must use
neutral, synthetic content (e.g. an `assistant` composition with a `terse`
variant), never content lifted from a real downstream app.

## 2. Test against real projects only inside `tmp/`

When you dogfood against a real downstream application, do it inside the
gitignored `tmp/` sandbox. Nothing project-specific is ever committed to this
repo. `tmp/`, `.env`, `.env.*`, `*.local`, `*.log` and `.cache/` are all
gitignored — keep secrets (such as `OPENROUTER_API_KEY`) there.

## Toolchain

npm workspaces, Node ≥ 20.6, TypeScript (NodeNext, strict), tsgo, vitest, biome.
No pnpm.

```
npm run build       # tsgo per package
npm run typecheck   # tsgo --noEmit
npm run test        # vitest --run
npm run check       # biome check . + knip dead-code scan
npm run deadcode    # knip only
```

`npm run check` must be green before you push: it runs Biome on every package and
then `knip`, which fails on unused files, exports or dependencies.
