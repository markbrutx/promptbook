# Facts — promptbook demo site

## Repo structure

- A new top-level `apps/` directory is introduced; `apps/site/` holds the demo-site Next.js app.
- A new `examples/sports-broadcast/` directory holds the flagship synthetic example book.
- The existing `examples/support-assistant/` stays in place and remains the minimal quickstart referenced by `README.md`.
- `apps/site` is a workspace in root `package.json` and participates in root `npm run build | typecheck | test | check`.
- `apps/site` is **not** published to npm (no `npm publish`, no entry under `publishConfig`).
- The site is the only artifact under `apps/`; all reusable code stays in `packages/`.

## Stack

- The site is a Next.js 15 App Router application written in TypeScript with `strict`, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes` enabled.
- Every route except `/demo/*` is statically rendered (`export const dynamic = "force-static"`) and ships zero client JS beyond a theme toggle.
- Styling uses Tailwind v4 with CSS variables for light/dark themes; the theme follows the OS preference by default and is toggleable.
- Documentation is rendered via Fumadocs (MDX, typed frontmatter, built-in Orama search, file tabs, line numbers, diff blocks).
- UI primitives come from shadcn/ui; landing sections use ready-made shadcn (and optionally Magic UI / Origin UI) blocks.
- No custom UI component is written when an equivalent ready-made block exists in the chosen libraries.
- The site has no database, no auth, no CMS, no i18n framework, no analytics, and no telemetry.

## Routes

- `/` is a landing page: hero, mental model (WHAT / WHEN / HOW), three concrete code snippets, CTA to `/demo` and to GitHub.
- `/docs` is the documentation index produced by Fumadocs.
- `/docs/introduction` explains what promptbook is, who it is for, and the problem it solves.
- `/docs/concepts` explains the WHAT / WHEN / HOW model.
- `/docs/fragments` covers fragment file layout, frontmatter, and `${path}` placeholders.
- `/docs/rules` covers `when` / `add` / `replace` / `forbid` / `order`, declaration order, and the last-wins + `forbid`-final cascade.
- `/docs/resolve-and-trace` explains the deterministic resolve, the trace shape, warnings on missing `${var}` or unknown fragment refs, and the never-throw-on-data rule.
- `/docs/cli` documents `promptbook ls`, `resolve`, `view`, `lint`, and other commands; the exact command list is sourced from `promptbook --help`.
- `/docs/viewer` explains what the viewer shows and how to read the rule explain.
- `/docs/examples` lists the bundled example books with short descriptions and links to `/demo/<book>`.
- `/demo` redirects to `/demo/sports-broadcast`.
- `/demo/sports-broadcast` renders the sports-broadcast book inside the embedded viewer SPA.
- `/demo/support-assistant` renders the existing quickstart book inside the same embedded viewer SPA.
- The site exposes `sitemap.xml`, `robots.txt`, a favicon, and per-route OG images.

## Demo integration

- During `apps/site` build, every book in scope is pre-resolved across its declared context combinations using `@markbrutx/promptbook-core`; the result is emitted as static JSON files under `apps/site/public/demo/<book>/`.
- The viewer SPA bundle from `@markbrutx/promptbook-viewer` is loaded only on `/demo/*` routes (client island) and reads the pre-resolved JSON; no Node viewer server runs in production.
- No live model calls happen on the deployed site; every rendered prompt is the deterministic `resolve()` output captured at build time.
- The site has a single `apps/site/src/lib/demo/` module that owns book discovery, pre-resolution, JSON emission, and the typed contract the viewer consumes.

## Sports-broadcast example

- The example is a synthetic broadcaster persona; no real league, team, broadcaster, athlete, or sponsor name appears anywhere in fragments, rules, fixtures, code, comments, or docs.
- The book contains 10 compositions covering the broadcaster lifecycle: pre-game preview, live-commentary line, half-time recap, post-game analysis, social-media post, push-notification headline, score-ticker overlay text, statistical sidebar, multilingual subtitle blurb, sponsor-integrated mention.
- Rules vary output across six context axes: `sport` (football / basketball / tennis / motorsport), `locale` (English / Spanish / Portuguese / Japanese), `tier` (free / premium / vip), `platform` (broadcast-tv / mobile-app / social), `model` (gpt / claude / open-source), `compliance` (kid-safe / standard / betting-allowed-region).
- At least one composition uses `replace` to swap output-format fragments per model (prose / JSON / XML-tagged), mirroring the multi-model compilation example in `README.md`.
- At least one composition uses `forbid` to enforce a compliance constraint that wins over any earlier `add`.
- Each composition has at least one fixture under `examples/sports-broadcast/fixtures/` capturing a named context combination.
- The example passes the existing core-agnostic guard test that scans `src/bin/fixtures` for domain terms (the guard runs against `packages/core`, `packages/cli`, and example fixtures; the new book must not introduce dogfood vocabulary that breaks it).
- `examples/sports-broadcast/README.md` describes the persona, the axes, and how to view it locally via `promptbook view --dir examples/sports-broadcast`.

## Build, CI, and hosting

- The site builds successfully with `npm run build -w @markbrutx/promptbook-site` (workspace name TBD at plan time) from a clean checkout.
- Root `npm run build`, `npm run typecheck`, `npm run test`, and `npm run check` succeed with the new app and example included.
- The site deploys to Vercel from the repo with a preview deployment created for every pull request that touches `apps/site/`, `packages/core/`, `packages/viewer/`, or `examples/`.
- A production deployment is bound to the user-purchased domain (domain name TBD; not blocking facts).
- The deployed site achieves a Lighthouse score ≥ 95 on Performance, Accessibility, Best Practices, and SEO for `/` and at least one `/docs/*` page; `/demo/*` is exempt from the perf threshold but must remain accessible.

## Constraints and invariants preserved

- `packages/core` and `packages/cli` keep zero dependency on the new site or example beyond the existing public API surface.
- The site does not import from `packages/core/src` or `packages/cli/src` directly; it consumes the published-package shape (`@markbrutx/promptbook-core`, `@markbrutx/promptbook-viewer`) via workspace links.
- The CLI/UI / core / examples separation defined in `CLAUDE.md` is preserved: no domain vocabulary leaks from the example into core, and core stays agnostic.
- Docs are authored fresh as Markdown/MDX in `apps/site/src/content/docs/`; the local-only `codemaps/` files are not copied, regenerated, or surfaced on the site.

## Out of scope for v1

- No interactive playground that ingests user-supplied prompts folders.
- No live model calls or API-key-required features on the deployed site.
- No versioned docs, no changelog page, no blog.
- No site-level i18n (the sports example itself is multilingual; the site UI is English only).
- No analytics, no cookie banner, no consent flow.
- No first-class static-export mode inside `packages/viewer` (the build-time JSON snapshot path lives in `apps/site` for now; promoting it into the viewer package is a separate goal).
- No custom design system on top of Fumadocs beyond a light typography/color override.

## Done condition

- The user-purchased domain serves `/`, `/docs/*`, `/demo/sports-broadcast`, and `/demo/support-assistant` from a Vercel production deployment built off `main`.
- Visiting `/demo/sports-broadcast` lets a visitor change context axes and see the assembled prompt and trace update without any network call to a model provider.
- Root `npm run build | typecheck | test | check` is green on `main` after the work lands.
