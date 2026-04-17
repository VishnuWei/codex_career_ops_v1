# Codex Setup

This is the quickest way to install the latest Codex and use `codex_career_ops_v1` like Career-Ops.

## 1. Install Prerequisites

- Node.js 18+
- Git
- Playwright Chromium
- Optional: Go 1.21+ for the dashboard

Project setup:

```powershell
cd D:\projects\codex_career_ops_v1
npm install
npx playwright install chromium
```

## 2. Install Or Update Codex

Install or update Codex using the official OpenAI instructions for your environment.

If Codex is already installed, update it first before using this workspace so the routing and AGENTS behavior match the latest client behavior.

After installation, confirm it is available:

```powershell
codex --version
```

## 3. Open This Workspace In Codex

From the project root:

```powershell
cd D:\projects\codex_career_ops_v1
codex
```

Codex should read:

- `AGENTS.md`
- `CODEX.md`
- `docs/CODEX.md`
- `docs/CODEX_COMMAND_CENTER.md`
- `CLAUDE.md` for inherited Career-Ops rules

## 4. First-Time Career-Ops Setup

If you have not already configured the workspace:

```powershell
npm run career-ops:setup
```

Then make sure these files are real and personalized:

- `config/profile.yml`
- `modes/_profile.md`
- `portals.yml`
- `cv.md`

## 5. Recommended Codex Prompts

Use Codex like the original Career-Ops command center:

- `/career-ops`
- `Evaluate this job URL with Career-Ops and run the full pipeline.`
- `/career-ops scan`
- `/career-ops pipeline`
- `/career-ops deep`
- `/career-ops tracker`

## 6. Useful Helper Commands

```powershell
npm run career-ops:scan
npm run career-ops:scan:flutter
npm run career-ops:pipeline
npm run career-ops:deep
npm run career-ops:digest
npm run verify
```

## 7. Expected Workflow

1. Scan for roles.
2. Keep only live, relevant, geo-eligible jobs in `data/pipeline.md`.
3. Ask Codex to process the pipeline or evaluate a specific URL.
4. Let Codex produce the report and tailored CV/PDF.
5. Review everything before applying.

## Notes

- This repo is intended to stay close to `career-ops`, not become a separate product.
- Personal targeting belongs in `config/profile.yml`, `modes/_profile.md`, and `portals.yml`.
- Codex should never submit an application on your behalf.
