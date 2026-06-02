# Goal — promptbook demo site

Ship a public demo site for promptbook on a user-purchased domain: a minimal landing, fresh documentation, and a live, interactive demo of the viewer against a flagship synthetic example. The site lives in this monorepo as `apps/site` (Next.js 15 + Fumadocs + shadcn/ui), uses ready-made libraries instead of custom UI, and runs the resolver client-side via `@markbrutx/promptbook-core/edge` so no model calls or Node viewer server are needed in production.

## Shared understanding

See [`facts.md`](./facts.md) — the gated, approved list of testable facts this goal must produce (repo layout, stack choices, routes, the sports-broadcast example, build/CI/hosting, preserved invariants, what is explicitly out of scope, and the done condition).

## Execution plan

See [`plan.md`](./plan.md) — the gated, approved ordered steps: workspace wiring, Next 15 bootstrap, Fumadocs and shadcn install, the new `examples/sports-broadcast` book, a small additive injection point in `packages/viewer`, the demo integration layer in `apps/site`, docs/landing authoring, SEO essentials, Vercel deployment, and the green-build lock-in. Each step lists files touched and concrete verification commands.

## Done

The done condition mirrors `facts.md`:

- The user-purchased domain serves `/`, `/docs/*`, `/demo/sports-broadcast`, and `/demo/support-assistant` from a Vercel production deployment built off `main`.
- Visiting `/demo/sports-broadcast` lets a visitor change context axes and see the assembled prompt and trace update with no network calls to any model provider.
- From a clean checkout, root `npm run build | typecheck | test | check` is green on `main` after the work lands.
