# Facts — landing install (skills-first)

Scope: `apps/site/app/page.tsx` and `README.md`. Core, CLI, examples, skills, and other site pages stay untouched.

## Hero (rebuilt — install command is the focal element)

- Hero on `apps/site/app/page.tsx` keeps the existing eyebrow text `promptbook`, the existing H1 `Deterministic prompt composition from reusable fragments.`, and the existing subhead about WHAT / WHEN / HOW.
- Hero removes all three current buttons: `See the live demo`, `Read the docs`, `GitHub`.
- Hero shows a short one-liner directly above the install command that names the agents this works for (Claude Code, Cursor, Codex, Copilot, Gemini, and 15+ other agents).
- Hero shows `npx skills add markbrutx/promptbook` as a copyable code block as the focal element of the first viewport.
- The hero code block is visually larger / heavier than the secondary `<Code>` blocks used elsewhere on the page, so it reads as the primary CTA, not as documentation.
- The copy affordance on the hero code block comes from a ready-made library (Fumadocs or shadcn/ui), not a hand-rolled component.
- Below the hero code block, the hero shows two secondary actions: `See the demo` (outline button) linking to `/demo/sports-broadcast`, and `Read the docs` (ghost button) linking to `/docs`.
- The hero has no GitHub button. The GitHub link remains in `SiteShell` header and footer, which is enough.
- Hero retains the existing vertical rhythm (`py-24`, `gap-6`) and `max-w-5xl` container so the rest of the page does not shift.

## Install section (new, between hero and pillars)

- A new `<section>` is inserted on `apps/site/app/page.tsx` between the hero `<section>` and the `PILLARS` `<section>`.
- The new section has `id="install"` so the URL `/#install` lands on it.
- The new section uses the same top border (`border-t border-fd-border`) and vertical padding pattern (`py-16`) as the adjacent sections.
- The new section's eyebrow is `Install`, using the existing eyebrow class pattern `text-xs font-medium uppercase tracking-widest text-fd-muted-foreground`.
- The new section's heading is `Three ways in. Pick one.`, using the same `text-2xl font-semibold tracking-tight` as the "The whole API" heading.
- The new section uses a three-column grid on `md` and up, single column on smaller viewports, mirroring the "The whole API" grid layout.
- The new section uses the existing `<Code>` component already defined in `page.tsx` for every snippet.
- Column 1 heading is `For your agent`; snippet is `npx skills add markbrutx/promptbook`; caption is one short paragraph naming the agents and listing the four shipped skills (`promptbook-install`, `promptbook-migrate`, `promptbook-doctor`, `promptbook-annotations`) with a link to `https://skills.sh/markbrutx/promptbook`.
- Column 2 heading is `For the CLI`; snippet is `npx @markbrutx/promptbook-cli view --dir ./prompts`; caption is one short paragraph listing the CLI verbs `ls · resolve · view · lint · eval` and noting it runs without installation.
- Column 3 heading is `For the library`; snippet is `npm i @markbrutx/promptbook-core`; caption is one short paragraph saying you import `resolve()` in any Node or edge runtime and get `text` + `trace`.

## README

- The current `## Quickstart` section in `README.md` (between the `## Quickstart` heading on line 15 and the next `##` heading on line 54) is replaced wholesale.
- The new `## Quickstart` opens with the one-line lead `Three ways to use promptbook. Pick one.`
- The first sub-block is `For your agent`, with the command `npx skills add markbrutx/promptbook`, the agent list (Claude Code, Cursor, Codex, Copilot, Gemini, 15+ others), the four shipped skill names, and a link to `https://skills.sh/markbrutx/promptbook`.
- The second sub-block is `For the CLI`, with the command `npx @markbrutx/promptbook-cli view --dir examples/support-assistant` and a one-liner linking to the existing `## CLI` section via `(#cli)`.
- The third sub-block is `For the library`, with `npm i @markbrutx/promptbook-core`, a TypeScript `resolve()` snippet, and a paragraph explaining that `text` is the assembled prompt, `trace` is the explain output, and the engine never throws on missing data.
- All other README sections (`## The model`, `## Multi-model compilation`, `## CLI`, `## Workspaces`, `## Viewer`, `## Packages`, `## Develop`, `## License`) are unchanged.

## Out of scope

- No edits to `packages/core`, `packages/cli`, `examples/`, or `skills/`.
- No edits to other pages under `apps/site/` (docs, demo, layout, shell). Header and footer GitHub links stay as they are.
- No changes to the `PILLARS`, "The whole API", or "Try the cascade in the browser" sections on the landing.
- No theme, dark-mode, or typography overhaul. Light theme stays.
- No new domain vocabulary anywhere. The agnostic guard test stays green.
- No hand-rolled copy-to-clipboard component. Use Fumadocs or shadcn primitives that already ship in `apps/site`.

## Verification (definition of done)

- `npm run build -w @markbrutx/promptbook-site` passes from repo root.
- `npm run typecheck` passes at root (fans out to all workspaces).
- `npm run check` passes at root (Biome / lint).
- `npm run test` at root stays green (includes the core agnostic guard).
- `npm run start -w @markbrutx/promptbook-site` serves the built site and a manual visual pass confirms: hero shows the `npx skills add markbrutx/promptbook` command as the focal element with secondary `See the demo` / `Read the docs` buttons below; the new Install section sits between hero and pillars; three columns on `md+`, single column on mobile; every code block is copyable; light theme intact.
- `README.md` renders on GitHub with the new `## Quickstart` and the existing `## CLI` anchor target still works.

## Workflow constraints (from `CLAUDE.md`)

- Commits go to `origin/wip` only. No push, merge, or fast-forward to `main`.
- Commit message is short, what-the-commit-does, no attribution / co-authored-by / generated-by lines.
- No noise comments in changed files.
