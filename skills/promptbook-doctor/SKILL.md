---
name: promptbook-doctor
description: >-
  Audit a promptbook book for bloat, drift, and structural smells, then
  recommend concrete refactors — split a giant fragment, lift conditional
  text into a rule, deduplicate near-identical fragments, fix dead rules,
  bring a language directive to an edge. Use whenever the user asks to
  review / clean up / tighten / audit their prompts, says a prompt feels
  too long or messy, runs `promptbook lint` and wants to act on the
  findings, or finishes a migration and wants a quality pass. Trigger
  even when the user only says "look at my prompts" in a project that
  uses promptbook.
---

# promptbook doctor — audit and refactor a book

You are reviewing a promptbook book (`<promptsDir>/`) and turning every
finding into a concrete edit the user can accept or reject. The goal is
**actionable diagnoses**, not a wall of "this might be wrong".

Two things you should know going in:

1. **`promptbook lint` already encodes the structural checks** the engine
   can do statically: token-budget, banned-tokens, dangling-reference,
   unused-fragment, dead-rule, language-directive-position,
   example-balance. Doctor's first job is to run lint and interpret it —
   not to reinvent those checks.
2. **The interesting smells are the ones lint can't see** — semantic
   duplication, conditional text frozen into a megafragment, contradictory
   guardrails across compositions, inconsistent persona voice. Those need
   you to actually read the book.

## Workflow

### 0. Prereqs

`promptbook` CLI is installed and the project has a working
`promptbook.json` + `<promptsDir>/`. If `promptbook ls` errors out, fix
the install first (hand off to `promptbook-install`) — there's nothing to
audit if the book doesn't load.

### 0.5. Sanity — is the checked-in bundle current?

Before the real audit, run a one-line freshness check:

```bash
promptbook bundle --check --all
```

If any book's `book.generated.ts` is stale or missing the doctor's findings
can otherwise be misleading (the user is reading old assembled output in the
viewer / their app). Either rebundle (`promptbook bundle --all` or
`promptbook watch` in a side terminal) and continue, or note the drift in
the diagnosis report so the user fixes it before acting on the rest of the
findings. This is **in addition to** the deeper checks below — not a
replacement for them.

### 1. Inventory the book

```bash
promptbook ls --json
```

For a multi-book workspace:

```bash
promptbook ls --all --json
```

Note: number of compositions, number of fragments, which fragments are
shared across compositions (used-in count). Compositions with only one
fragment, or fragments used by only one composition, are normal — but if
*every* fragment is used by exactly one composition you have file-shaped
literals, not a book. Tell the user; that's the headline finding.

### 2. Run lint book-wide and per-composition

```bash
# book-level rules (dangling-reference, unused-fragment, dead-rule)
promptbook lint --json

# resolved-rules need a composition + context
promptbook lint <comp> --ctx <axis>=<value> ... --json
```

Hit every meaningful context combination, not just defaults. If the book
has a `model` axis with `{ gpt, claude }`, run lint under both. The
resolved lints (token-budget, language-directive-position, banned-tokens,
example-balance) only check the assembled output, so they need actual
context to produce real numbers.

Aggregate findings across runs. For each finding, look up the playbook
entry in `references/lint-findings-playbook.md` to know what the fix
shape is.

### 3. Read the fragments

Do this even if lint is green — most interesting smells aren't lintable.
Open each fragment file. As you go, note:

- **Length.** A fragment over ~30-40 lines is a candidate to split. Not a
  hard rule; some legitimately are persona/guardrails monoliths. But ask
  the user about every long one.
- **Mixed concerns.** A fragment that contains both persona ("you are X")
  and task ("answer the user's question") and format ("respond as JSON")
  is three fragments waiting to be split. Splitting unlocks reuse — every
  other composition that needs the persona can pull just that.
- **Hardcoded context.** A fragment that says "Respond in English" when
  there's a `locale` axis nearby — should be `Respond in ${locale}` with
  the value supplied via context. Parameterize and centralize.
- **Voice inconsistency.** "You are an X." vs "You're an X." vs "Acting
  as an X." across persona fragments — pick one and rewrite. Models are
  sensitive to register; consistency matters.

### 4. Find near-duplicate fragments

The lint engine doesn't compare fragment bodies. You should.

```bash
# quick visual scan: list each fragment with its line count
wc -l <promptsDir>/fragments/*.md | sort -n
```

For any two fragments that have similar names (`tone-warm.md` and
`tone-friendly.md`) or similar lengths in similar areas:

```bash
diff -u <promptsDir>/fragments/tone-warm.md <promptsDir>/fragments/tone-friendly.md
```

If the diff is mostly identical text with one or two differing lines,
the pair is a deduplication candidate. Options:

- **Merge into one fragment** if the difference doesn't matter for any
  real call-site.
- **Keep both but extract their shared part** into a third fragment, and
  reduce each to just the differing line(s).
- **Replace both with one parameterized fragment** if the difference is
  data (`Be ${tone}` with `tone` in context) rather than copy.

### 5. Spot conditional text that should be rules

Open each composition's rule file. Then look at fragments referenced
only by that composition. Patterns that smell:

- **A fragment whose body contains "if" / "when" / "for X users" in
  prose.** That conditional should be lifted into a `when:` rule that
  swaps fragments, not text the model has to interpret. Models follow
  fragment-shaped instructions far better than they follow conditional
  prose inside a fragment.
- **A fragment that contains a multi-paragraph alternative
  ("alternatively, you could …").** Almost always one of the
  alternatives is dead and the other is what's actually wanted under
  some context. Promote the choice into a rule.

### 6. Cross-composition consistency

When the book has multiple compositions sharing fragments, check:

- **Are the shared fragments actually a coherent voice/contract?** If
  `persona.md` says "be terse and direct" but is used by both a
  customer-support composition and a marketing-copy composition, the
  shared fragment is a lie. Split into `persona-support` and
  `persona-marketing`.
- **Do non-shared fragments duplicate something a shared one already
  says?** E.g., a per-composition `reply-task.md` re-stating the
  guardrails that `guardrails.md` already covers. Trim.
- **Are `forbid` rules in one composition contradicted by `add` rules in
  another for the same fragment id?** That's fine as long as it's
  intentional, but flag it — usually one was forgotten when the other
  was added.

### 7. Token-budget sanity

If `token-budget` fired, don't just bump `lint.maxTokens`. Diagnose:

```bash
promptbook resolve <comp> --ctx ... --explain
```

Read the `finalOrder` and skim each fragment. The candidates for trimming
are almost always: (a) examples that grew over time, (b) a guardrails
section with overlapping bullet points, (c) verbose persona prose. Cut
where the model isn't actually paying attention — the middle of the
prompt, away from start/end where the language directive lives.

If the budget is genuinely tight for the task, *then* bump `maxTokens` in
`promptbook.json`. But the diagnose-first order matters.

### 8. Hand back a diagnosis report

Don't dump every finding. Group like a doctor would:

```
# Diagnosis for prompts/

## Critical (fix before next deploy)
- 2 dangling references (typos): rules/reply.yaml lines 7, 14
- 1 dead rule (replace target consumed): rules/escalation.yaml line 9

## Bloat (worth one focused PR)
- token-budget exceeded on reply{model=gpt}: 8210 / 8000
  → guardrails.md has 3 near-duplicate bullets at lines 12-16; trim
- persona.md and persona-v2.md are 92% identical
  → merge; rules referencing persona-v2 already point at the same content

## Drift (low priority, surface for awareness)
- locale.md is referenced but its `kind: language-directive` puts it at
  position 4 of 8 in `escalation`; consider moving to an edge
- inconsistent voice: persona.md says "You are X", reply-task.md says
  "You're answering"

## Healthy
- No unused fragments
- All compositions resolve with --explain showing all rules accounted for
```

Show the user this report and ask which sections they want acted on now.
Don't batch-apply edits without confirmation; refactors at this level
often have judgment calls only the user can make.

### 9. Apply fixes one at a time, re-lint after each

For each accepted finding:

1. Make the edit.
2. Re-run `promptbook lint <affected-comp> --ctx ...`.
3. Re-run `promptbook resolve <affected-comp> --ctx ... --explain` and
   show the diff in `finalOrder` and assembled text. Confirm the change
   was intentional.

Tempting shortcut: edit five things, lint once. Don't — when something
breaks you've lost which edit caused it.

### 10. If fixtures exist, run eval

```bash
promptbook eval --json
```

After significant refactors (especially merges/splits of fragments), run
the eval fixtures if the project has them and a model is configured. A
green fixture run is the only proof the model behavior didn't drift.
Pass-rate dropping means a fragment refactor changed something semantic
— roll back and try a smaller cut.

## Reference

`references/lint-findings-playbook.md` — for each lint ruleId, what it
means in plain English and the concrete fix shapes. Read it whenever you
need to translate a finding into an edit.

## Things to keep in mind

- The doctor is not a linter; it's a reviewer. Lint catches the
  mechanical; the doctor catches the human-judgment ones. Lean on `rg` +
  `diff` + reading the files — those are your real tools.
- Cite the file:line for every finding you raise. Vague reviews ("some
  fragments feel long") get ignored; specific ones get fixed.
- Respect the user's choices when they push back. A 60-line persona
  fragment may be deliberate. If they say "leave it", leave it and
  move on; doctor is advisory, not enforcement.
- Run `promptbook view` to see the used-in graph at any point if the
  book is small enough to look at. Shared-fragment patterns are easier
  to spot visually than in JSON.
