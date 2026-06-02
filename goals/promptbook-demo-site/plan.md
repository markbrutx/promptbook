# Plan — promptbook demo site

## Solution approach

Add an `apps/site` workspace (Next.js 15, App Router, Fumadocs, shadcn/ui, Tailwind v4) and a flagship `examples/sports-broadcast` book. The demo is fully static: at build time the site loads each example book with `loadPrompts`, serializes it via the existing `serializeBookJson` to a flat `book.json` under `public/demo/<book>/`, and the `/demo/[book]` route mounts the viewer's existing React UI configured with a client-side `api` implementation that calls `resolveBook` from `@markbrutx/promptbook-core/edge` against the bundled JSON. No model calls, no Node viewer server in production. Vercel hosts everything; the (yet-to-be-purchased) domain points at the production deployment.

The leverage points already in the codebase:

- `packages/core` exports `loadPrompts`, `resolveBook`, `serializeBookJson`, and a pre-tree-shaken `./edge` build that is browser-safe.
- `packages/viewer/src/web/` is a Vite-built React SPA whose API surface is the small `api` object in `web/api.ts` — the only thing that needs to change to run static is that `api` instance.
- `test-support/agnostic-guard.ts` bans dogfood vocabulary (`res|ume`, `ro|ast`, `candi|date`, `wo|und`, `recr|uit`, `hir|ing`, `applic|ant`, `c|v`, `h|h`) but **not** any sports vocabulary, so the new book is unrestricted on its chosen synthetic domain.

The only `packages/viewer` change is additive: expose a `mountWebApp({ container, api })` entry that the site can call with its own `api`. The default (fetch-based) `api` stays the default for the local CLI `view` command. This is **not** the larger "first-class static-export mode" the facts marked OUT — it is one ~50-LOC extraction.

## Ordered steps

### 1. Wire the monorepo to host an app

Files: root `package.json`, `knip.json`, `tsconfig` base (if any is added), `.gitignore`.

- Change `workspaces` from `["packages/*"]` to `["packages/*", "apps/*"]`.
- Add `apps/*` entries to `knip.json` so root `npm run check` does not fail on the new workspace.
- Add `apps/site/.next` and `apps/site/.vercel` to `.gitignore`.
- Extend the root `build` script to fan into the site (`-w @markbrutx/promptbook-site`); leave `typecheck`/`test`/`check` as `-ws --if-present` (already fan out).

Verify: `npm install` succeeds. `npm ls -ws` lists the new workspace. `npm run check` is green with an empty `apps/site`.

### 2. Bootstrap `apps/site` with Next 15 App Router

Files: `apps/site/{package.json,tsconfig.json,next.config.mjs,postcss.config.mjs,tailwind.config.ts,app/layout.tsx,app/page.tsx,app/globals.css}`.

- `package.json`: name `@markbrutx/promptbook-site`, private, `type: module`, scripts `dev`, `build` (`next build`), `start`, `typecheck` (`tsgo --noEmit`), `check` (biome), `lint` (biome).
- Strict TS: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `moduleResolution: NodeNext`.
- Tailwind v4 via `@tailwindcss/postcss`; CSS variables for light/dark in `globals.css`.
- `next.config.mjs`: `output: undefined` (default), `trailingSlash: false`, transpile workspace packages if needed.
- Add `export const dynamic = "force-static"` and `export const revalidate = false` at the root segment so every page is statically rendered unless a child overrides.

Verify: `npm run dev -w @markbrutx/promptbook-site` serves a placeholder `/`. `npm run build -w @markbrutx/promptbook-site` emits a fully prerendered build (no `λ`/dynamic markers in the output summary).

### 3. Install and configure Fumadocs

Files: `apps/site/source.config.ts`, `apps/site/app/docs/layout.tsx`, `apps/site/app/docs/[[...slug]]/page.tsx`, `apps/site/app/api/search/route.ts`, `apps/site/content/docs/meta.json`, one stub `content/docs/index.mdx`.

- Add `fumadocs-core`, `fumadocs-ui`, `fumadocs-mdx`, and their peer deps.
- Configure the MDX source pointing at `apps/site/content/docs`.
- Wire the Orama search route (it ships with Fumadocs).

Verify: `/docs` lists the stub page; `/docs/<stub>` renders MDX with code highlighting; `curl /api/search?query=intro` returns the stub.

### 4. Install shadcn/ui and lock the theme

Files: `apps/site/components.json`, `apps/site/src/components/ui/*`, `apps/site/app/globals.css`.

- `npx shadcn@latest init` against `apps/site`, Tailwind v4 mode.
- Add only the primitives the landing actually needs (Button, Card, Badge, plus typography tokens). No "just in case" components.
- Add a `ThemeProvider` (next-themes) at the root layout; the toggle is the single client island on docs/landing pages.

Verify: `<Button>` renders; `data-theme="dark"` on `<html>` flips the palette via CSS variables; `/` and `/docs` ship a tiny JS bundle (only theme toggle).

### 5. Build the `sports-broadcast` example

Files: `examples/sports-broadcast/{promptbook.json, README.md, fragments/*.md, rules/*.yaml, fixtures/*.json, code-prompts/*.yaml?}`.

- 10 compositions: `pre-game-preview`, `live-commentary-line`, `half-time-recap`, `post-game-analysis`, `social-post`, `push-headline`, `ticker-overlay`, `stat-sidebar`, `subtitle-blurb`, `sponsor-mention`.
- Shared fragments for persona, guardrails, locale directive, compliance, format variants (prose / JSON / XML-tagged) — mirror the structure already proven in `examples/support-assistant`.
- Rules covering six axes: `sport` (football / basketball / tennis / motorsport), `locale` (English / Spanish / Portuguese / Japanese), `tier` (free / premium / vip), `platform` (broadcast-tv / mobile-app / social), `model` (gpt / claude / open-source), `compliance` (kid-safe / standard / betting-allowed-region).
- At least one composition uses `replace` to swap format-fragment per `model` (matches the README's multi-model example).
- At least one composition uses `forbid` to drop a sponsor-mention or betting-related fragment when `compliance: kid-safe`.
- Fixtures: at least one per composition under `fixtures/`, naming the context combination.
- README explains the synthetic broadcaster, the axes, and `promptbook view --dir examples/sports-broadcast` for local exploration.

Verify:

- `npx promptbook ls --dir examples/sports-broadcast` lists 10 compositions.
- `npx promptbook resolve pre-game-preview --dir examples/sports-broadcast --ctx sport=football --ctx locale=English --ctx tier=premium --ctx platform=broadcast-tv --ctx model=claude --ctx compliance=standard --explain` returns text + trace.
- `npx promptbook lint --dir examples/sports-broadcast` is clean (or has only intentional findings we'd document).
- `npm test` is green; specifically, the existing core/cli `agnostic.test.ts` does not regress (it scans package sources, not `examples/`, so the new book is structurally outside the scan, but we re-run the suite to confirm).
- A new tiny check in `apps/site` test suite (or a script) runs `serializeBookJson(await loadPrompts(…))` for the new book and asserts the round-trip parses back into a usable `PromptBook` shape.

### 6. Expose a mountable web UI from `packages/viewer`

Files: `packages/viewer/src/web/{main.tsx,api.ts}` (refactor), `packages/viewer/src/web/mount.ts` (new), `packages/viewer/src/index.ts` (re-export), `packages/viewer/package.json` (`exports`), `packages/viewer/vite.config.ts` (lib build, optional).

- Refactor `web/main.tsx` so the bootstrap is `mountWebApp({ container, api })` where `api` matches the existing `Api` shape (the object in `web/api.ts`). The current default keeps using fetch.
- Add a published export at `@markbrutx/promptbook-viewer/web` (sub-export) so the site can import the React entry without forking the bundle.
- Update viewer's `vite.config.ts` to additionally emit a library build (`build.lib`) under `dist/web-lib/` consumable by Next; alternatively, ship the existing CSS + a tiny ESM wrapper.
- No behavioural change for the existing `promptbook view` CLI path; viewer unit tests stay green.

Verify:

- `npm run build -w @markbrutx/promptbook-viewer` succeeds and emits both `dist/web/` (CLI-served) and the new lib output.
- `node -e 'import("@markbrutx/promptbook-viewer/web").then(m => console.log(Object.keys(m)))'` lists `mountWebApp`.
- `promptbook view --dir examples/support-assistant` still works.

### 7. Build the demo integration layer in `apps/site`

Files: `apps/site/src/lib/demo/{discover.ts,bundle.ts,types.ts,client-api.ts}`, `apps/site/scripts/build-demo.mjs`, `apps/site/public/demo/<book>/book.json` (generated).

- `discover.ts`: list `examples/*` directories that contain a `promptbook.json` and a `fragments/` folder.
- `bundle.ts`: for each book, `await loadPrompts(dir)` → `serializeBookJson(book)` → write to `apps/site/public/demo/<slug>/book.json`. Also emit a thin `index.json` listing books for the demo landing.
- `scripts/build-demo.mjs`: Node script invoked from `prebuild` in `apps/site/package.json`. Uses workspace import of `@markbrutx/promptbook-core`.
- `client-api.ts`: implements the viewer's `Api` interface entirely in-browser. `resolve` deserialises the book JSON once on mount, calls `resolveBook` from `@markbrutx/promptbook-core/edge`. `books`/`book`/`usedIn`/`lint` operate on the same in-memory book. `annotations`/`annotate`/`resolveAnnotation` are no-ops or backed by `localStorage` (decision: no-op for v1, since annotations require write access and demos are read-only).

Verify:

- `npm run build -w @markbrutx/promptbook-site` runs the prebuild and produces `apps/site/public/demo/sports-broadcast/book.json` and `apps/site/public/demo/support-assistant/book.json`.
- The book JSON parses through `JSON.parse` and contains the expected `fragments`, `compositions`, and `rules` arrays.
- A unit test in `apps/site` loads the bundled JSON, calls the client `api.resolve("pre-game-preview", {…})`, and asserts the resolved text matches what `npx promptbook resolve` returns for the same context (byte-for-byte; this is the determinism contract).

### 8. Wire `/demo/[book]` to the mounted viewer

Files: `apps/site/app/demo/page.tsx`, `apps/site/app/demo/[book]/page.tsx`, `apps/site/src/components/demo-island.tsx`, `apps/site/app/demo/[book]/loading.tsx`.

- `/demo` is a server component that redirects to `/demo/sports-broadcast`.
- `/demo/[book]` is a server component that: validates `book` against the discovered list, returns 404 otherwise; emits SEO metadata; renders the page shell with the `<DemoIsland book={book} />` client component.
- `<DemoIsland>` is a `"use client"` component that calls `mountWebApp({ container, api: clientApi(book) })` against a `ref` div.
- Pre-bundle the viewer's CSS into the page (Next handles this via standard CSS imports from the client component).

Verify:

- `curl /demo` → 308 to `/demo/sports-broadcast`.
- `curl /demo/sports-broadcast` returns prerendered HTML with the SSR shell and metadata; only the island fetches `/demo/sports-broadcast/book.json`.
- In a real browser: changing context selectors updates the rendered prompt and trace with zero network requests after the initial `book.json` load (verified via DevTools Network panel; record an HAR for regression).

### 9. Author docs and landing content

Files: `apps/site/content/docs/{introduction,concepts,fragments,rules,resolve-and-trace,cli,viewer,examples}.mdx`, `apps/site/content/docs/meta.json`, `apps/site/app/page.tsx`, `apps/site/scripts/snapshot-cli-help.mjs`, `apps/site/src/content/cli-help.json` (generated).

- Docs MDX written fresh (no copy from `codemaps/`); each page concise, code-heavy, examples drawn from `examples/support-assistant` and `examples/sports-broadcast`.
- `cli.mdx` imports a generated `cli-help.json` so the documented commands cannot drift from `promptbook --help`. `snapshot-cli-help.mjs` runs the built CLI in a Node child process at prebuild time.
- Landing assembled from shadcn blocks: Hero, three-column "WHAT / WHEN / HOW" card section, code-snippet section with CLI / library / viewer snippets pulled from README, footer with GitHub link and "see the demo" CTA pointing at `/demo/sports-broadcast`.

Verify:

- `npm run build -w @markbrutx/promptbook-site` succeeds.
- The Fumadocs sidebar lists all 8 docs entries in the order defined by `meta.json`.
- `cli.mdx` reflects exactly what the built CLI prints (snapshot diff test in `apps/site` confirms this so docs do not silently drift).
- Lighthouse run against the local production build (`next start`) for `/` and `/docs/introduction` reports ≥ 95 on Performance, Accessibility, Best Practices, SEO. `/demo/sports-broadcast` is checked for Accessibility and Best Practices only.

### 10. SEO and asset essentials

Files: `apps/site/app/{sitemap.ts,robots.ts,opengraph-image.tsx,favicon.ico}`, optional per-route `opengraph-image.tsx`.

- `sitemap.ts` enumerates `/`, all `/docs/*`, and `/demo/*` URLs.
- `robots.ts` allows all.
- Default OG image generated via `next/og`; per-route override for `/docs/<slug>` showing the page title.

Verify: `curl /sitemap.xml` lists every public URL. OG image for `/` renders (visible via Vercel preview or `curl -I` confirms 200 on the OG endpoint).

### 11. Vercel deployment and domain binding

Files: `vercel.json` (root or `apps/site`), no code changes elsewhere.

- Configure the Vercel project with `apps/site` as the root, build command `npm run build -w @markbrutx/promptbook-site`, output `apps/site/.next`.
- Enable preview deployments on every PR.
- Bind the production domain once the user purchases it (separate Vercel dashboard step, not a code task).

Verify: PR to a feature branch produces a working preview URL covering all three routes. Merge to `main` produces a production URL. Once the domain is bound, the production URL serves the same content over the custom domain with valid HTTPS.

### 12. Lock the green build

Files: root `package.json` scripts, `knip.json`, possibly `wb/errors/` entries for any incidental fixes surfaced during the work.

- Root `npm run build | typecheck | test | check` must be green from a clean checkout with `apps/site` and `examples/sports-broadcast` present.
- Knip configured for `apps/site` so dead-code detection runs there too.
- Update `codemaps/` (`architecture.md`, `frontend.md`, `data.md` as relevant) after the work lands, per the repo workflow.
- README quickstart additions: a short pointer to the live demo URL once the domain is live.

Verify: clean clone → `npm install && npm run build && npm run typecheck && npm run test && npm run check` is green. `git status` shows nothing untracked except expected build artifacts (already gitignored).

## Risks and open questions

- **Viewer injection extraction (step 6) is the only `packages/viewer` change.** It is additive and small but it does touch a published package's surface. If review prefers zero viewer change, the fallback is to fork `web/api.ts` and `web/main.tsx` into `apps/site/src/components/demo-fork/` and ship a tiny rebundled SPA from the site itself. This costs duplication and a maintenance burden; we accept the additive viewer change as the lesser evil.
- **`annotations` API in the static `api`.** Annotations are write operations in the local CLI. For v1 the site's client `api` returns empty lists and rejects writes; the viewer UI must tolerate that (verify the UI does not crash when annotations are absent). If it does crash, hide the annotation UI in the static mount via a feature flag prop on `mountWebApp`.
- **Tailwind v4 + shadcn/ui compatibility.** Tailwind v4 changed the config shape; shadcn updated its templates accordingly in 2025 — pin the shadcn CLI version actually used so a future contributor cannot regenerate components against a stale schema.
- **Fumadocs version pinning.** Fumadocs tracks Next closely; pin Next, Fumadocs, and Tailwind to a known-good triple in `package.json` and document the combo in `apps/site/README.md`.
- **Determinism contract on the JSON bundle.** The `serializeBookJson` round-trip must reconstruct everything `resolveBook` needs (`fragments`, `compositions`, `rules`, frontmatter). Step 7's unit test that compares `apps/site` client resolve output against `npx promptbook resolve` for the same input is the explicit verification that the round trip is lossless. If it fails, the fix is in `serializeBookJson` / `resolveBook`, not in the site.
- **Agnostic-guard scope.** The guard scans `packages/*/src` and known test fixture paths; it does not scan `examples/` or `apps/`. If anyone widens the scan later, the sports vocabulary in the example would not match any banned dogfood term anyway, but the new dependencies (`next`, `react`) added by `apps/site` would trip the `CLI_UI_DEPS` check if it were extended over apps. The plan is to keep `apps/` explicitly out of the guard's `scanDirs`; reviewer must not "tidy up" by adding it.
- **`apps/site` not published to npm.** `package.json` must not include `publishConfig.access`; `private: true` is mandatory. The publish workflow must not pick up the new workspace.
- **Domain not yet purchased.** Production binding is unblocked separately; preview URL works without the domain.
- **The 432 context combinations are not pre-computed.** Because resolve runs in-browser via `core/edge`, the combinatorial space is irrelevant to the build. The bundle is the *book*, not the cartesian product of resolves. This is a deliberate departure from a literal reading of the facts' phrase "pre-resolved across its declared context combinations": we ship the book and let the deterministic resolver run client-side, which is functionally equivalent — every prompt rendered is still the byte-for-byte output of `resolveBook` against build-time-frozen book data, with no model calls. Flagging this for the plan reviewer to bless or have us pivot to literal pre-computation.
