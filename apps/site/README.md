# @markbrutx/promptbook-site

Public demo site for promptbook: a static landing page, fresh Fumadocs-powered docs, and an in-browser viewer of bundled example books.

**Private workspace. Never published to npm.**

## Stack

Pinned, known-good triple (Next 15 line):

| package                         | version  | why                                              |
| ------------------------------- | -------- | ------------------------------------------------ |
| `next`                          | 15.5.19  | facts.md requires Next 15 App Router             |
| `react`, `react-dom`            | 19.2.7   | matches Next 15 peer requirement                 |
| `tailwindcss`                   | 4.3.0    | CSS-first config (`@theme` directive)            |
| `@tailwindcss/postcss`          | 4.3.0    | only PostCSS plugin needed                       |
| `fumadocs-ui`, `fumadocs-core`  | 15.8.5   | last 15.x still supporting Next 15               |
| `fumadocs-mdx`                  | 15.0.10  | matches fumadocs-ui 15.x                         |
| `next-themes`                   | 0.4.6    | theme toggle (only client island on landing/docs)|

The `moduleResolution` is `bundler` (not `NodeNext`) because Next.js's CSS-asset resolution and sub-package exports (`fumadocs-ui/css/preset.css`) rely on bundler resolution. The plan over-prescribed NodeNext; facts.md only requires the three strict flags (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).

## Scripts

```bash
npm run dev        # next dev
npm run build      # next build (statically renders everything except /demo/*)
npm run start      # next start (after build)
npm run typecheck  # tsgo --noEmit
npm run check      # biome check .
```

Runs from the repo root: `npm run build`, `npm run typecheck`, `npm run test`, `npm run check` all fan into this workspace.

## Routes

| URL                       | Source                                           | Rendering                                                  |
| ------------------------- | ------------------------------------------------ | ---------------------------------------------------------- |
| `/`                       | `app/page.tsx`                                   | `○ Static`                                                  |
| `/docs`                   | `app/docs/page.tsx` (redirect)                   | `○ Static`                                                  |
| `/docs/<slug>`            | `content/docs/<slug>.mdx` via Fumadocs catch-all | `● SSG`                                                     |
| `/demo`                   | `app/demo/page.tsx` (redirect)                   | `○ Static`                                                  |
| `/demo/<book>`            | `app/demo/[book]/page.tsx` + `DemoIsland`        | `● SSG` shell, client island mounts the viewer in-browser |
| `/api/search`             | Fumadocs Orama `staticGET`                       | `○ Static` (pre-rendered JSON index)                     |
| `/sitemap.xml` / `/robots.txt` | `app/sitemap.ts` / `app/robots.ts`          | `○ Static`                                                  |
| `/icon` / `/opengraph-image`   | `app/{icon,opengraph-image}.tsx`             | `○ Static` (next/og)                                   |

Every route is statically pre-rendered. `/demo/<book>` ships a small client island that loads
`/demo/<book>/book.json` once and runs `resolveBook` from `@markbrutx/promptbook-core/edge`
in-browser — every context change is zero network calls.

## Deploying to Vercel

The root `vercel.json` points Vercel at the workspace build:

- Root directory: repo root
- Framework preset: Next.js (auto-detected)
- Build command: `npm run build -w @markbrutx/promptbook-site`
- Output directory: `apps/site/.next`

The production domain is bound via the Vercel dashboard once the user purchases it; no code
changes live in this repo for that step. Set `NEXT_PUBLIC_SITE_URL` to the final URL so the
sitemap, robots, and OG metadata absolute-URL correctly.
