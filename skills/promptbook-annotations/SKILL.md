---
name: promptbook-annotations
description: >-
  Drain the promptbook viewer's annotation queue. Use when a human has left
  comments on assembled prompts in `promptbook view` and you need to turn that
  feedback into concrete changes — a new rule, fragment, or eval fixture.
---

# promptbook annotations → agent

The viewer (`promptbook view`) lets a human select text in an assembled prompt
and attach a comment. Each comment is appended to a file queue:

```
<promptsDir>/.annotations/inbox.jsonl   # one JSON annotation per line
```

This file is the **only** bridge. It is terminal-agnostic: any agent in any
terminal drains it through the CLI — no editor or terminal integration needed.

## The annotation shape

```jsonc
{
  "id": "…",                         // stable id, used to resolve
  "createdAt": "2026-…Z",
  "target": {                        // what was annotated
    "prompt": "assistant",           //   a composition variant…
    "context": { "mode": "terse" }   //   …resolved under this context
    // or: "fragmentId": "voice", "sourceFile": "fragments/voice.md"
  },
  "anchor": {                        // where the comment is anchored
    "fragmentId": "voice",           //   which fragment carries the text
    "anchorText": "be concise"       //   the exact selected text
  },
  "comment": "tone is too harsh here",
  "status": "open"
}
```

`target` tells you which variant the human was looking at; `anchor` tells you
which fragment to open (`fragments/<id>.md`) and the exact text they meant.

## Workflow

1. **Read the queue.**
   ```sh
   promptbook annotations list --json        # machine-readable; add --dir <path> if needed
   ```

2. **For each open annotation**, locate the source via the anchor:
   - `anchor.fragmentId` → the fragment file (`promptbook ls --fragments` shows paths).
   - `target.prompt` + `target.context` → the variant. Reproduce what the human saw:
     ```sh
     promptbook resolve <prompt> --ctx key=value … --explain
     ```

3. **Apply the discipline — vague feedback becomes a concrete artifact.**
   Never "just understand" a comment and silently tweak prose. Convert every
   annotation into one of:
   - a **rule** change (`rules/*.yaml`) — when the feedback is conditional
     ("for `mode=terse`, drop this sentence") → add/replace/forbid/order;
   - a **fragment** edit (`fragments/*.md`) — when the text itself is wrong
     for every variant that uses it;
   - an **eval fixture** (`fixtures/*.json`) — when the feedback is about model
     behavior ("it keeps ignoring this") → encode it as an assertion so the
     fix is measurable, not guessed.

   This keeps the runtime dumb and deterministic: intelligence (turning taste
   into a rule/fixture) lives here, in the agent, at edit time.

4. **Verify** the change reproduces the desired output and stays green:
   ```sh
   promptbook resolve <prompt> --ctx … --explain   # the hole is closed
   promptbook lint <prompt> --ctx …                # no new findings
   promptbook eval <fixture>                        # if you added/changed an assertion
   ```

5. **Resolve the annotation** so it leaves the queue:
   ```sh
   promptbook annotations resolve <id>
   ```
   Use `promptbook annotations clear` only to drop the whole queue at once.

## Notes

- The queue is append-only JSONL; `resolve`/`clear` rewrite it. Safe for a
  single local user.
- `.annotations/` is gitignored — feedback is local working state, not history.
- If `anchorText` appears more than once in a fragment, use the surrounding
  `target.context` and your judgment; the anchor is a hint, not a guarantee.
- Pair `promptbook watch` with `promptbook view` for a tight feedback loop:
  edit a fragment → watch rebundles the book → the viewer renders the new
  assembly → the human selects text and leaves the next annotation. No
  manual `bundle` between iterations.
