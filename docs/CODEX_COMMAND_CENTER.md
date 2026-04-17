# Codex Command Center

This repo is meant to behave like `career-ops`, but with Codex as the agent runtime.

## How To Use It In Codex

Open Codex in this workspace and use plain-language prompts that map to the same Career-Ops modes:

- `/career-ops`
  Show the command center menu or ask Codex what modes are available.
- Paste a JD or job URL
  Runs the full auto-pipeline: analyze the role, save the report, generate the tailored CV/PDF, and update the tracker flow.
- `/career-ops pipeline`
  Process pending URLs from `data/pipeline.md`.
- `/career-ops oferta`
  Evaluation only.
- `/career-ops ofertas`
  Compare multiple offers.
- `/career-ops contacto`
  Draft outreach and contact strategy.
- `/career-ops deep`
  Deep company research.
- `/career-ops pdf`
  Generate a tailored CV/PDF only.
- `/career-ops training`
  Evaluate a course or certification.
- `/career-ops project`
  Evaluate a portfolio project idea.
- `/career-ops tracker`
  Review application status and pipeline health.
- `/career-ops apply`
  Live application assistance, but never final submission.
- `/career-ops scan`
  Discover new roles and add only live, relevant, geo-eligible jobs to the pipeline.
- `/career-ops batch`
  Batch process multiple jobs.
- `/career-ops patterns`
  Analyze rejection patterns and targeting gaps.
- `/career-ops followup`
  Review follow-up cadence and generate drafts.

## Routing Rules

Codex should reuse the existing `modes/*` files, templates, tracker flow, and scripts from Career-Ops.

- JD text or job URL:
  Read `modes/_shared.md`, `modes/_profile.md`, and `modes/auto-pipeline.md`.
- Single evaluation:
  Read `modes/_shared.md`, `modes/_profile.md`, and `modes/oferta.md`.
- Portal scan:
  Read `modes/_shared.md`, `modes/_profile.md`, `modes/scan.md`, `config/profile.yml`, and `portals.yml`.
- PDF generation:
  Read `modes/_shared.md`, `modes/_profile.md`, and `modes/pdf.md`.
- Tracker and follow-up work:
  Read the relevant mode plus the files in `data/`.

## Codex-Compatible Helper Scripts

These helpers do not replace the main Codex workflow. They support it.

- `npm run career-ops:setup`
- `npm run career-ops:scan`
- `npm run career-ops:scan:flutter`
- `npm run career-ops:pipeline`
- `npm run career-ops:deep`
- `npm run career-ops:digest`
- `npm run career-ops:all`

The `friend:*` scripts remain available as optional wrappers, but the main product should be described and used as Career-Ops for Codex.
