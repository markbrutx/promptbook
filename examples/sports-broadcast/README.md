# Demo: sports-broadcast

A self-contained prompts folder for a synthetic sports broadcaster. It is the
flagship example: 10 compositions across the broadcaster lifecycle, six context
axes, the multi-model output-format cascade, and the forbid-wins compliance
cascade — all assembled deterministically with zero model calls.

Nothing here is wired to a model; everything below is the assembly layer you can
run, see, lint, and diff without an API key.

## Persona

The persona is fully synthetic: no real league, team, broadcaster, athlete, or
sponsor name appears anywhere in fragments, rules, fixtures, code, comments, or
docs. The `${sponsor}` placeholder is filled by the caller at resolve time.

## Context axes

| Axis         | Values                                                            |
| ------------ | ----------------------------------------------------------------- |
| `sport`      | football, basketball, tennis, motorsport                          |
| `locale`     | English, Spanish, Portuguese, Japanese                            |
| `tier`       | free, premium, vip                                                |
| `platform`   | broadcast-tv, mobile-app, social                                  |
| `model`      | gpt, claude, open-source                                          |
| `compliance` | kid-safe, standard, betting-allowed-region                        |

Each composition's `base` order names a default value per axis. Rules swap
fragments declaratively as data — never string-building in code — and the
cascade is the boring one: later rules win, `forbid` is the final filter.

## The menu

```bash
cd examples/sports-broadcast
promptbook ls
```

Ten compositions:

| Composition           | What it produces                                           |
| --------------------- | ---------------------------------------------------------- |
| `pre-game-preview`    | a one-paragraph matchup framing before kickoff             |
| `live-commentary-line`| one line of play-by-play during the action                 |
| `half-time-recap`     | two-paragraph mid-event analytic recap                     |
| `post-game-analysis`  | three-paragraph post-event analysis (multi-model output)   |
| `social-post`         | one social-platform post                                   |
| `push-headline`       | one mobile push-notification headline                      |
| `ticker-overlay`      | one ticker-overlay line for the on-screen score graphic    |
| `stat-sidebar`        | up to five bullet lines for a statistical sidebar          |
| `subtitle-blurb`      | one-sentence captioning blurb                              |
| `sponsor-mention`     | one sponsor-integrated 25-to-40-word mention               |

## Multi-model compilation

The `post-game-analysis` composition is the model-cascade exhibit. The output
format is one fragment in the base order; a rule swaps that fragment based on
the `model` axis. Same logical prompt, three different output contracts:

```bash
# default: plain prose
promptbook resolve post-game-analysis --ctx sport=football --ctx locale=English

# model=gpt: a JSON object contract
promptbook resolve post-game-analysis --ctx sport=football --ctx locale=English --ctx model=gpt

# model=claude: XML-tagged output
promptbook resolve post-game-analysis --ctx sport=football --ctx locale=English --ctx model=claude
```

The rule that does it is plain data:

```yaml
- when: { model: gpt }
  replace: { format-prose: format-json }
- when: { model: claude }
  replace: { format-prose: format-xml }
```

## Forbid wins (compliance cascade)

The `social-post` composition shows the cascade: `tier=vip` adds a sponsor
integration block, and `compliance=kid-safe` forbids it. `forbid` is the final
filter, so a vip+kid-safe request still produces a clean post with no sponsor
content. The viewer's trace makes the chain visible.

```bash
promptbook resolve social-post --ctx tier=vip --ctx compliance=kid-safe --explain
```

## See which rules fired

```bash
promptbook resolve post-game-analysis \
  --ctx sport=motorsport --ctx locale=English --ctx tier=premium \
  --ctx platform=broadcast-tv --ctx model=claude --ctx compliance=standard \
  --explain
```

The trace (on stderr) lists every rule, whether it fired and why, the final
fragment order, and what was replaced. Drop `--ctx locale=English` and the
`${locale}` directive renders empty with a recorded warning rather than
throwing.

## View it locally

```bash
promptbook view --dir examples/sports-broadcast
```

The viewer's sidebar lists all ten compositions; pick a context combination to
re-assemble live and diff two variants.

## Files

```
sports-broadcast/
├─ fragments/   reusable micro-prompts (persona, guardrails, sports, tiers, ...)
├─ rules/       10 composition rule files (base order + when-rules)
├─ fixtures/    12 named context combinations used by the viewer + as eval inputs
└─ promptbook.json
```
