# Codex Deep-Dive Architecture

## Goal

Rewrite the current `deep` mode so it runs as a first-class Career-Ops workflow in Codex Terminal instead of behaving like a Claude-oriented prompt generator.

This rewrite should:

- Reuse the existing Career-Ops routing, modes, scripts, reports, and tracker conventions
- Preserve the data contract defined by `DATA_CONTRACT.md` and the inherited shared rules referenced from `CODEX.md`
- Stay compatible with `AGENTS.md` and `docs/CODEX.md`
- Keep freelance opportunity discovery as a second-phase extension, not part of the initial deep-dive rewrite

## Current State

Today `modes/deep.md` is only a static prompt template. It does not:

- gather source material itself
- structure a Codex-native research workflow
- persist a deep-dive artifact
- link the research back to an evaluated role or pipeline record
- define how Codex should use local context, web research, and existing Career-Ops files together

That makes `deep` useful as a manual handoff prompt, but not yet a real terminal workflow.

## Design Principles

1. Keep the existing Career-Ops mental model.
   Codex should use the same mode system, candidate profile, CV, reports, tracker flow, and output folders already used elsewhere in the repo.

2. Replace runtime assumptions, not the content model.
   We should not create a parallel "Codex version" of the business logic. We should adapt orchestration and tool usage to Codex Terminal.

3. Make `deep` an evidence-building mode.
   The output should be a reusable research brief that helps with interview prep, decision-making, outreach, and later freelance targeting.

4. Build phase 2 on phase 1.
   Freelance discovery should consume the same company intelligence, signal extraction, and narrative matching produced by the deep-dive system.

## Proposed Target Architecture

```text
User request
  -> AGENTS.md routing
  -> Career-Ops mode selection
  -> deep orchestration in Codex
  -> source collection
  -> evidence normalization
  -> candidate-fit synthesis
  -> saved deep-dive report
  -> optional follow-on actions

Phase 2 later:
deep-dive intelligence
  -> freelance opportunity detector
  -> outreach/draft generation
  -> tracker or lead artifact
```

## Runtime Layers

### 1. Entry Layer

Codex receives a request such as:

- "deep dive this company"
- "research this company before interview"
- "`/career-ops deep`"

Routing should continue to use:

- `AGENTS.md`
- `docs/CODEX.md`
- the existing Career-Ops mode map

The mode remains `deep`, but its behavior changes from "print a prompt" to "execute a research workflow."

### 2. Context Layer

The deep workflow should load:

- `modes/deep.md`
- `cv.md`
- `config/profile.yml`
- `modes/_profile.md`
- `article-digest.md` when present
- the most relevant report in `reports/` when the request is tied to a known role/company
- `data/applications.md` when an existing application should be cross-referenced

This keeps deep-dive output grounded in the candidate's actual positioning rather than generic company research.

### 3. Research Layer

Codex should gather evidence across four source groups:

1. Company-controlled sources
   - homepage
   - careers pages
   - engineering blog
   - docs
   - newsroom

2. Market and momentum sources
   - funding, leadership, launches, partnerships, acquisitions
   - hiring signals
   - product announcements

3. Talent and operating-model sources
   - job descriptions
   - public team pages
   - employee posts
   - review sites used cautiously as weak signals

4. Candidate-match sources
   - CV
   - proof points from `article-digest.md`
   - prior evaluation report and score rationale

### 4. Synthesis Layer

The deep-dive engine should transform raw findings into a reusable brief with these sections:

1. Company snapshot
2. Product and AI/technical strategy
3. Recent momentum and risks
4. Engineering or delivery culture signals
5. Likely business and technical challenges
6. Competitor landscape and differentiation
7. Candidate angle
8. Interview and outreach hooks
9. Open questions and confidence notes

This preserves the spirit of the current `modes/deep.md` while turning it into a structured deliverable.

### 5. Persistence Layer

Deep-dive outputs should be saved as markdown in a dedicated folder:

- `reports/deep/` recommended

Suggested filename:

- `{company-slug}-{role-slug}-{YYYY-MM-DD}-deep.md`
- fallback: `{company-slug}-{YYYY-MM-DD}-deep.md`

This avoids mixing deep research with scored evaluation reports while keeping everything in the existing report ecosystem.

### 6. Action Layer

Once a deep-dive exists, Codex can support adjacent actions without changing the underlying architecture:

- interview prep generation
- contact/outreach drafting
- application narrative refinement
- fit reassessment after new information

These are consumers of the deep-dive artifact, not separate research systems.

## Proposed Deep Workflow

```text
Resolve target
  -> detect company and optional role
Load local candidate context
  -> CV, profile, proof points, prior reports
Collect external evidence
  -> official sources first, then supporting signals
Extract structured facts
  -> products, strategy, team, momentum, risks, competitors
Map candidate relevance
  -> strongest proof points, likely objections, narrative hooks
Write deep-dive brief
  -> markdown artifact in reports/deep/
Offer next actions
  -> interview-prep, contact, reevaluate, later freelance scan
```

## Recommended File Responsibilities

### `modes/deep.md`

Change from a static external prompt template into an execution spec for Codex. It should define:

- required context files
- research order
- output schema
- evidence-quality rules
- when to save a report
- what follow-on suggestions to offer

### `docs/CODEX.md`

Keep as the high-level operating guide, but add a short note pointing `deep` implementers to this architecture doc.

### `docs/ARCHITECTURE.md`

Optional later cleanup:

- rename Claude-specific runtime labels into neutral agent/runtime terms
- describe Codex as a supported execution environment alongside legacy Claude assumptions

This is useful, but not required for phase 1.

## Data Contract Compatibility

This design does not require changing the personalization boundary:

- user-specific data stays in `config/profile.yml`, `modes/_profile.md`, `article-digest.md`, and related user-layer files
- shared system behavior stays in `modes/deep.md`, docs, and scripts

It also does not change the tracker rule that new application rows must flow through TSV additions and `merge-tracker.mjs`.

## Output Contract For Deep Reports

Recommended frontmatter or header fields:

- `Company`
- `Role` when known
- `Date`
- `Source context`
- `Related evaluation` when available
- `Confidence`

Recommended body sections:

- `## Executive Summary`
- `## Company Snapshot`
- `## Strategy Signals`
- `## Recent Moves`
- `## Operating Model`
- `## Risks And Challenges`
- `## Competitors`
- `## Candidate Angle`
- `## Interview Hooks`
- `## Open Questions`
- `## Sources`

## Migration Plan

### Phase 1: Codex-native deep dive

Deliver:

- a rewritten `modes/deep.md`
- consistent deep-dive report output
- clear routing behavior for Codex
- no freelance logic yet

Success criteria:

- user can ask for a deep dive in Codex Terminal
- Codex produces a saved, reusable markdown brief
- output uses local candidate context
- workflow does not fork the existing Career-Ops data model

### Phase 2: Freelance opportunity discovery

Build on deep-dive intelligence to identify contract/fractional/consulting angles such as:

- "this company is hiring full-time but shows consulting-friendly pain points"
- "recent launches suggest short-term AI automation needs"
- "team composition or founder posts suggest demand for advisory work"

Recommended phase-2 outputs:

- freelance lead brief
- outreach angle
- proof-point matching
- optional lead tracker artifact, separate from `data/applications.md` unless the repo intentionally adds a dedicated freelance tracker

## Phase 2 Architecture Direction

Do not overload `deep` with freelance logic directly. Instead introduce a second mode later, for example:

- `freelance`
- `contracts`
- `leads`

That mode should consume:

- deep-dive reports in `reports/deep/`
- profile narrative in `config/profile.yml`
- proof points in `article-digest.md`

Pipeline shape:

```text
Deep-dive brief
  -> freelance signal extractor
  -> opportunity scoring
  -> outreach angle generation
  -> lead artifact
```

This keeps the first rewrite focused and prevents company research from becoming mixed with business-development logic too early.

## Suggested Implementation Order

1. Rewrite `modes/deep.md` as a Codex execution mode.
2. Add a save location and naming convention for deep reports.
3. Teach Codex routing to treat `deep` as an active workflow rather than a passive prompt.
4. Add report cross-linking to prior evaluations when available.
5. Only then design the freelance discovery mode on top of saved deep-dive artifacts.

## Why This Approach Fits Career-Ops

It respects the project's existing strengths:

- modes remain the control plane
- markdown artifacts remain the source of truth
- user customization stays in the user layer
- Codex becomes a runtime adapter, not a new product fork

That gives you a clean path from:

- job evaluation
- to company deep dive
- to interview and outreach preparation
- and later to freelance opportunity discovery

without breaking the current Career-Ops model.
