# Goal — landing install (skills-first)

Make promptbook's install paths visible on the marketing surface, with the agent-skill install command as the primary entry point. The landing hero rebuilds around `npx skills add markbrutx/promptbook` as a copyable, highlighted focal element; a new "Three ways in" section between hero and pillars surfaces agent / CLI / library side by side; the README's `## Quickstart` is replaced wholesale to lead with the same skills install command.

## Shared understanding

See [`facts.md`](./facts.md) — the testable list of what changes in `apps/site/app/page.tsx` and `README.md`, what stays untouched, what's out of scope, and what verification proves the work is done.

## Execution plan

See [`plan.md`](./plan.md) — five ordered steps (hero rework, new install section, README replacement, full local verify, commit + push to `wip`) with files, commands, and risks. Uses Fumadocs' `DynamicCodeBlock` for copyable highlighted snippets, no hand-rolled components.

## Done condition

- `apps/site/app/page.tsx` hero shows `npx skills add markbrutx/promptbook` as the focal copyable code block with `See the demo` and `Read the docs` as secondary buttons; GitHub is gone from hero (still in `SiteShell` header + footer).
- A new `<section id="install">` sits between the hero and the `PILLARS` section, eyebrow `Install`, heading `Three ways in. Pick one.`, three copyable columns (`For your agent` / `For the CLI` / `For the library`) on `md+`, single column on mobile.
- `README.md` `## Quickstart` is fully replaced with the skills-first three-block content and the existing `## CLI` anchor still resolves from the new `(#cli)` link.
- `npm run build -w @markbrutx/promptbook-site`, `npm run typecheck`, `npm run check`, `npm run test` all pass from repo root. Manual `npm run start -w @markbrutx/promptbook-site` smoke confirms layout, responsiveness, and copyability.
- One commit pushed to `origin/wip` only, short message, no attribution lines. `origin/main` untouched.
