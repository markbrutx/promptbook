# Plan — landing install (skills-first)

## Solution approach

Two files change: `apps/site/app/page.tsx` and `README.md`. Nothing under `packages/`, `examples/`, or `skills/`.

For copyable, syntax-highlighted bash one-liners (hero focal command + three install-section snippets) reuse `DynamicCodeBlock` from `fumadocs-ui/components/dynamic-codeblock` — it ships with Shiki highlighting and a copy button by default. No new component.

Deviation from `facts.md`: the install section uses `DynamicCodeBlock` rather than the existing inline `<Code>` `<pre>` component. Reason: the goal demands copyable code blocks; `<Code>` has no copy affordance. The existing `<Code>` stays where it is (the "The whole API" section), since those snippets are larger prose-style samples meant for reading.

The hero rework is option (b) confirmed: install command is the focal element on the first viewport. `See the demo` and `Read the docs` are secondary buttons under the command. GitHub stays only in `SiteShell` header and footer.

## Ordered steps

### Step 1 — Hero rework on `apps/site/app/page.tsx`

Files: `apps/site/app/page.tsx`.

Changes:
- Import `DynamicCodeBlock` from `fumadocs-ui/components/dynamic-codeblock` at the top of the file.
- In the hero `<section>`:
  - Keep the existing `<p>` eyebrow `promptbook`.
  - Keep the existing `<h1>`.
  - Keep the existing subhead `<p>`.
  - Add a short one-line `<p>` after the subhead naming the agents (Claude Code, Cursor, Codex, Copilot, Gemini, and 15+ other agents) so the command below has context.
  - Replace the existing `flex flex-wrap gap-3 pt-2` button row with:
    - A `<DynamicCodeBlock lang="bash" code="npx skills add markbrutx/promptbook" />` wrapper sized to read as the focal CTA (constrained width via `max-w-xl` so it sits as a hero element, not full-bleed).
    - Below it, a button row with `See the demo` (`Button variant="outline"` → `/demo/sports-broadcast`) and `Read the docs` (`Button variant="ghost"` → `/docs`).
  - Remove the GitHub `<Button asChild variant="ghost">` entirely.

Verification:
- `npm run build -w @markbrutx/promptbook-site` from repo root → must succeed.
- `npm run typecheck` from repo root → must succeed.
- Manual: `npm run start -w @markbrutx/promptbook-site`, open `/`, confirm hero shows the command as a syntax-highlighted copyable block with the two secondary buttons below; no GitHub button in hero.

### Step 2 — Insert Install section on `apps/site/app/page.tsx`

Files: `apps/site/app/page.tsx`.

Changes:
- Define a `INSTALL` constant at the module top (mirroring `PILLARS`) with three entries: `{ title, code, caption }`:
  - `For your agent` · `npx skills add markbrutx/promptbook` · caption naming the agents, listing the four skill names, linking to `https://skills.sh/markbrutx/promptbook`.
  - `For the CLI` · `npx @markbrutx/promptbook-cli view --dir ./prompts` · caption listing `ls · resolve · view · lint · eval` and the "runs without installing" line.
  - `For the library` · `npm i @markbrutx/promptbook-core` · caption mentioning `resolve()`, `text`, `trace`, Node or edge runtime.
- Insert a new `<section id="install">` between the hero `<section>` and the `PILLARS` `<section>` using `border-t border-fd-border py-16 flex flex-col gap-12`.
- Section header reuses the same shape as "The whole API" header: eyebrow `<p>` `Install` with class `text-xs font-medium uppercase tracking-widest text-fd-muted-foreground`, then `<h2>` `Three ways in. Pick one.` with class `text-2xl font-semibold tracking-tight`.
- Grid: `grid gap-6 md:grid-cols-3`. Each cell is a `flex flex-col gap-3` with `<h3 class="text-sm font-semibold">` for the column title, `<DynamicCodeBlock lang="bash" code={item.code} />`, and `<p class="text-sm text-fd-muted-foreground">` for the caption. The skills.sh link inside the first caption is a plain `<a href="…">` with `className="underline underline-offset-2 hover:text-fd-foreground"`.

Verification:
- `npm run build -w @markbrutx/promptbook-site` and `npm run typecheck` stay green.
- Visual smoke: section renders between hero and pillars; on `md+` three columns, on small viewports a single column; the URL `/#install` lands on this section.

### Step 3 — Replace `## Quickstart` in `README.md`

Files: `README.md`.

Changes:
- Replace everything from the `## Quickstart` heading on line 15 down to (but not including) the next `## ` heading (`## The model: WHAT / WHEN / HOW` on line 54) with the new content from the original request:
  - Lead: `Three ways to use promptbook. Pick one.`
  - `For your agent.` block: `npx skills add markbrutx/promptbook`, the four shipped skill names in inline code, the skills.sh link.
  - `For the CLI.` block: `npx @markbrutx/promptbook-cli view --dir examples/support-assistant` and the `ls · resolve · view · lint · eval` line linking to `(#cli)` (the existing `## CLI` section anchor stays valid).
  - `For the library.` block: `npm i @markbrutx/promptbook-core`, the TypeScript `resolve()` snippet, and the prose paragraph about `text` / `trace` / never throws on data.

Verification:
- `awk '/^## /{print NR": "$0}' README.md` shows `## Quickstart` still followed by `## The model: WHAT / WHEN / HOW` and the same downstream headings.
- `grep -n 'skills add markbrutx/promptbook' README.md` returns the new line.
- `grep -n '(#cli)' README.md` returns the new line.
- The existing `## CLI` anchor (line ~102) is unchanged so the `(#cli)` link resolves on GitHub.

### Step 4 — Full local verification sweep

From repo root:

```
npm run build -w @markbrutx/promptbook-site
npm run typecheck
npm run check
npm run test
```

All four must be green. The `test` run includes the core agnostic guard — confirm no new banned vocabulary leaked through the captions or README copy (the install section copy stays neutral: agents, prompts, CLI verbs, no roast/resume/candidate/recruit/hiring/applicant/cv/hh).

Manual smoke:

```
npm run start -w @markbrutx/promptbook-site
```

Open `/`, confirm: hero command visible and copyable; secondary buttons present; Install section sits above pillars; three columns on `md+`, single column at narrow viewport; light theme intact; pillars and "The whole API" sections unchanged; demo CTA section at the bottom unchanged.

### Step 5 — Commit and push to `wip`

- One commit covering both files.
- Short message, e.g. `landing+readme: skills-first install entry`.
- No attribution / co-authored-by / generated-by lines.
- Push to `origin/wip` only. Do not touch `origin/main`.

## Risks and open questions

- **Bundle weight.** `DynamicCodeBlock` pulls Shiki client-side where previously the landing rendered plain `<pre>`. The added weight is bounded (Fumadocs already ships Shiki for the docs route on the same site). Catch any regressions via the build size output; if it spikes unexpectedly, fall back to a single static highlighted snippet by precomputing HTML at build time. Recommendation: ship as-is, revisit only if `npm run build` flags it.
- **Mixed code-block styling.** The page will have two visual treatments for code: highlighted/copyable (hero + install section) and plain `<pre>` (the "The whole API" three snippets). This is acceptable because the two roles differ — copyable one-liners vs prose-style samples. Migrating "The whole API" snippets to `DynamicCodeBlock` is out of scope; flag as a follow-up if a reviewer asks.
- **Hero first-viewport height.** Adding a code block under the subhead lengthens the hero. On laptop viewports (~800 px tall) the pillars will sit slightly lower than today. This is intended — the install command is now the first-viewport anchor. No layout change to pillars or downstream sections.
- **Skills.sh link inside the caption.** The skills.sh URL is rendered as a plain anchor inside a `<p>`. No new dependency. The same link appears in the README via Markdown.
- **Re-gating the facts.** This plan deviates from the `<Code>`-in-install-section line in `facts.md` (uses `DynamicCodeBlock` instead). If the plannotator gate rejects on that ground, revise `facts.md` to read "uses `DynamicCodeBlock` for copy-button-enabled blocks" and re-gate, then proceed.
