# Architecture

## System Overview

`codex_career_ops_v1` keeps the original Career-Ops pipeline shape but makes Codex Terminal the primary runtime.

```text
User in Codex Terminal
  -> AGENTS.md + CODEX.md
  -> mode routing
  -> Career-Ops workflow execution
  -> report / PDF / tracker artifacts

Main paths:
- auto-pipeline for a single JD or URL
- scan for portal discovery
- pipeline for queued URLs
- deep for Codex-native company research
- batch for parallel processing
```

## Core Principle

This fork is not a new product. It is the same Career-Ops system with:

- the same modes
- the same tracker and report flow
- the same personalization boundaries
- the same user-facing commands and habits

The difference is the terminal agent runtime: Codex comes first.

## Evaluation Flow

1. Input: user pastes JD text or a job URL
2. Extract: Playwright or the configured retrieval flow reads the posting
3. Evaluate: the relevant mode loads shared context plus mode-specific instructions
4. Output:
   - evaluation report in `reports/`
   - tailored PDF in `output/`
   - tracker TSV addition in `batch/tracker-additions/`
5. Merge: `merge-tracker.mjs` updates `data/applications.md`

## Deep-Dive Flow

The Codex-native deep-dive design is defined in `docs/CODEX_DEEP_ARCHITECTURE.md`.

Target shape:

1. load local candidate context
2. collect company evidence
3. synthesize candidate-fit insights
4. save a reusable deep-dive report
5. support later interview, outreach, and freelance workflows

## Batch Processing

The repository still contains the inherited batch assets from Career-Ops.

Current migration stance:

- user-facing batch behavior should remain conceptually the same
- Codex-first orchestration is the target direction
- legacy Claude-oriented batch implementation may remain during transition until a Codex-native worker strategy is implemented

## Data Flow

```text
cv.md                     -> candidate source of truth
config/profile.yml        -> profile and preferences
modes/_profile.md         -> user-specific targeting
article-digest.md         -> proof points
portals.yml               -> scanner configuration
reports/                  -> evaluation and research artifacts
data/applications.md      -> canonical tracker
```

## Pipeline Integrity

The same integrity rules continue to apply:

- new application entries flow through TSV additions, not direct row insertion
- `merge-tracker.mjs` merges tracker additions
- `verify-pipeline.mjs` checks consistency
- `normalize-statuses.mjs` keeps states canonical
- `dedup-tracker.mjs` removes duplicates

## Migration Focus

Priority order for this fork:

1. Codex-first instructions and onboarding
2. Codex-native deep-dive workflow
3. Codex-native batch orchestration
4. later freelance opportunity discovery built on deep-dive outputs
