# Lint findings playbook

Every `ruleId` the engine raises, what it means, and the concrete fix
shapes. Use this to translate a finding into an edit you can recommend.

## `dangling-reference` (error, book-scope)

**Meaning**: A `base`, `order`, or rule's `add`/`replace`/`forbid`/
`order`/`after` names a fragment id that doesn't exist in the book.

**Common causes**:
- typo in a `rules/*.yaml` (the id refers to `persona` but the file is
  `personas.md` → id `personas`);
- a fragment file was deleted but a rule still references it;
- a rename that touched the fragment file but not the rule.

**Fix shapes**:
- Restore the missing fragment file (if the deletion was accidental).
- Rename the reference in the rule to match an existing fragment id.
- Add the missing fragment (`<promptsDir>/fragments/<id>.md` with
  matching `id:` in frontmatter).

Hard error. Block any release with this.

## `unused-fragment` (warning, book-scope)

**Meaning**: A fragment file exists but no composition / rule references
it anywhere (not in `base`, `order`, or any rule action).

**Common causes**:
- a fragment was added in anticipation of a use case that never landed;
- a rule that referenced it was removed but the file wasn't.

**Fix shapes**:
- **Delete the fragment** if no one needs it. Git remembers.
- **Wire it into a composition** — add to `base` of the composition that
  was supposed to use it, or to a rule (`add`, or as the target of a
  `replace`).
- If the fragment is a draft/work-in-progress, prefix its filename with
  `_` so it's clearly parked, and add a TODO to the composition that
  will eventually use it. (The loader still picks it up — it just
  signals intent.)

## `dead-rule` (warning, book-scope)

**Meaning**: A rule's action statically cannot have an effect under any
context. Three sub-shapes:

- `add` of an id already present in `base` (under the rule's `when`
  conditions).
- `replace` whose source has already been removed/replaced by an
  earlier guaranteed-to-co-fire rule.
- `order` naming an id that can never appear under the rule's `when`.

**Common causes**:
- you wrote the `add` rule and then later added the same id to `base` —
  the rule is now redundant;
- two `replace` rules where the second tries to replace what the first
  already swapped out;
- copy-paste from another composition that had a different `base`.

**Fix shapes**:
- Delete the dead rule.
- If the rule's *intent* was correct but the assumption about `base` is
  outdated, fix the assumption: remove the id from `base`, or change
  the rule's `when` so it co-fires with whatever puts the id in.

This rule has a known limitation: "a rule that never fires under any
context" (which requires enumerating all contexts) is out of scope.
You'll still need to eyeball that case by reading the rule file.

## `token-budget` (warning, resolved-scope)

**Meaning**: The assembled prompt's estimated tokens exceed
`lint.maxTokens` (default 8000). Estimate is chars/4 — heuristic, not a
real tokenizer.

**Common causes**:
- a fragment grew over time with redundant bullet points;
- a few-shot examples block doubled because someone added a third
  example "just in case";
- two near-duplicate fragments are both being included;
- the budget is genuinely tight for this task.

**Fix shapes** (in priority order):
1. **Find the heaviest fragment** — read the `--explain` trace's
   `finalOrder`, then `wc -c` each fragment file. The top one usually
   has room to cut.
2. **Trim redundant guardrails / persona** — a 4-bullet "be helpful" /
   "be accurate" / "be honest" / "be calm" list can usually become 2
   bullets without losing meaning.
3. **Reduce few-shot examples** — three examples often work as well as
   five for many tasks; test by reducing and watching eval pass-rate.
4. **Lift conditional text into rules** — if a fragment hedges ("if X,
   then say A; else B"), splitting into two fragments with a rule
   swap removes the dead branch from the assembled text.
5. **Bump `maxTokens`** in `promptbook.json` — only after trying 1-4. If
   the prompt is genuinely large for a complex task, the budget is the
   wrong number; raise it deliberately, not as a way to hide bloat.

## `language-directive-position` (warning, resolved-scope)

**Meaning**: A fragment marked `kind: language-directive` appears in the
middle of `finalOrder` instead of at the start or end. Buried language
directives are often ignored by models.

**Common causes**:
- you split a megafragment and the locale chunk landed in the middle;
- the composition's `base` lists the locale fragment in the middle for
  no reason (it just looks tidy that way);
- a rule's `order` action moved it inward.

**Fix shapes**:
- Move the locale fragment id to the first or last position of `base`.
  Last is conventional ("speak in X" right before the model takes
  over).
- If the rule that does ordering misplaced it, fix the rule's `order`
  list to put the locale at the edge.

The `edgeWindow` defaults to 2 (first 2 or last 2 positions count as
"at an edge"). If the prompt is very long, that may be too tight —
consider whether the lint default still makes sense for this book.

## `banned-tokens` (error, resolved-scope)

**Meaning**: The assembled text contains a substring/pattern listed in
`lint.bannedTokens`. The default bans em-dash (`—`).

**Common causes**:
- a fragment uses em-dashes (very common in editor auto-formatting);
- the user has banned typo'd words ("teh"), brand names that must not
  appear ("Internal Project X"), or style markers ("As an AI…").

**Fix shapes**:
- Edit the fragment to remove/replace the banned substring.
- If the ban is overzealous (the em-dash one trips up legitimate prose),
  remove it from `lint.bannedTokens` in `promptbook.json`. Defaults are
  starting points, not laws.

Hard error. CI should block.

## `example-balance` (warning, resolved-scope)

**Meaning**: Few-shot example fragments (`kind: example`, grouped by a
tag prefix like `case:`) are skewed — the largest group has more than
`maxSkew` (default 1) more entries than the smallest.

**Common causes**:
- you added two more positive examples last week and forgot to add
  matching negatives;
- you're demonstrating one class of inputs much more than another.

**Fix shapes**:
- Add examples to the underrepresented group(s) until the skew is ≤
  `maxSkew`.
- Remove examples from the overrepresented group(s) if the rule's
  default of "balanced groups" doesn't apply to your task.
- If the task genuinely benefits from skewed examples (e.g., 9 hard
  cases + 1 easy reference), bump `maxSkew` via the rule config — but
  do it intentionally, not as a way to silence the lint.

## What lint cannot see (and the doctor needs to)

These are not lint findings; they're things the doctor catches by
reading the book:

- **Near-duplicate fragments** — diff fragment bodies; merge or extract
  shared parts.
- **Conditional text inside a fragment** — prose like "if the user is X,
  do Y; otherwise Z" belongs in a rule, not as text the model must
  interpret.
- **Voice/register drift** — persona says "You are X", task says "Acting
  as X", guardrails says "As an X you should". Pick one; rewrite.
- **Hardcoded values that should be context** — "respond in English"
  should be `respond in ${locale}` with `locale` in context.
- **Cross-composition contradictions** — composition A's `add` of a
  fragment that composition B's `forbid` rejects; one of them is wrong.
- **Stale code-prompt samples** — `code-prompts/<name>.yaml` ships a
  frozen sample; if the builder it documents has changed, the sample
  needs a refresh. (No automatic check for this; you have to read.)

For each of these, the fix shape is the same: name what you see, point
at file:line, propose the edit. Then let the user accept or reject.
