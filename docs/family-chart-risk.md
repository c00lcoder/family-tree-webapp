# family-chart: dependency risk assessment

We render the tree with [`family-chart`](https://github.com/donatso/family-chart)
(v0.9.0, MIT). Decision: **stay on upstream, keep it isolated**, and fork only if
a specific bug blocks us. This doc tracks the relevant open issues so that
decision stays informed.

## Why deferring a fork is safe

`family-chart` is touched in exactly two places:

- `src/components/tree/family-chart.tsx` — the only importer of the library
- `src/lib/gedcom/to-family-chart.ts` — our stable internal `FamilyChartDatum`
  shape that feeds it

Everything else (DB, API, person editor, uploads) is renderer-agnostic. Forking,
patching, or swapping the renderer changes only those two files.

We also **don't use the library's built-in editing** (`EditTree`) — we have our
own `PersonEditor`. So the large class of upstream editing bugs does not affect us.

## Maintenance snapshot (June 2026)

- License: **MIT** (a fork is unencumbered)
- ~66 open issues / ~7 open PRs — active but busy tracker
- TypeScript-first, recent commits in 2026

## Open issues mapped to our usage

| Issue | Summary | Relevance to us | Risk |
| ----- | ------- | --------------- | ---- |
| #104 | Multi-spouse layout: children don't descend from the correct couple | **High** — remarriages/step-families are common; our data model already supports multiple unions per person | **Watch** |
| #92 | `calculateEnterAndExitPositions` → `translate(undefined, undefined)` crash on nodes lacking position data | **Medium** — our importer only links existing xrefs, but partial/manually-edited trees could trigger it | Watch |
| #88 | Tree doesn't fill the container on init | Low — **mitigated** by `tree_position: "fit"` in our wrapper | Mitigated |
| #102 | `cardToMiddle` centers incorrectly at zoom ≠ 1 | Low — cosmetic on recenter after card click | Low |
| #98 | Card transition leaves inline `opacity: 1`, blocking CSS overrides | Low — only matters if we theme card opacity | Low |
| #94 | No lazy-loading of avatar images | Low — our avatars are client-compressed and small | Low |
| #100 | Doesn't render correctly inside a Bootstrap 5.3 modal | **N/A** — we render in a normal page container, not a modal | None |
| #101 | Tree link 90° bend rendering | Low — cosmetic | Low |
| #97 / #90 | Feature requests (subtitle line, limit children) | N/A — not needed yet | None |

## Triggers that would justify forking

Fork (vendor the source, point the wrapper at it, patch) if any of these bite:

1. **#104 multi-spouse** produces visibly wrong parentage for real user trees.
2. **#92** crashes the chart on data we legitimately produce.
3. We need a card/interaction change upstream won't accept.

Until then, the isolation seam keeps upstream's churn out of our codebase.
