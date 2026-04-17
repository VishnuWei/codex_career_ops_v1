# Codex Career Ops v1 - Quick Start For Friends

This is the easiest way to install and run `codex_career_ops_v1`.

You do not need Claude Code Premium for the normal workflow.
The safest way to use this fork is through the included `npm run friend:*` commands.

## What This Project Does

It helps you manage a job search from one terminal workspace:

- evaluate job posts
- generate tailored CV PDFs
- scan company job portals
- track applications
- do deeper company research before interviews

You stay in control. The system never submits an application for you.

## What You Need

Install these first:

- Node.js 18 or newer
- Playwright Chromium

Optional:

- Go 1.21 or newer if you want the dashboard UI

## Install

If your friend shares this folder directly, open a terminal inside:

`D:\projects\codex_career_ops_v1`

Then run:

```powershell
npm install
npx playwright install chromium
```

Optional local email setup:

1. Copy `.env.example` to `.env`
2. Put your Resend values there

Example:

```powershell
Copy-Item .env.example .env
```

Do not share your real `.env` with anyone.
See [SHARE_SAFE.md](SHARE_SAFE.md) before publishing or zipping this project.

## First-Time Setup

### 1. Create your profile

```powershell
Copy-Item config\profile.example.yml config\profile.yml
```

Open `config/profile.yml` and add:

- your name
- your email
- your location
- your target roles
- your salary range

### 2. Create your scanner config

```powershell
Copy-Item templates\portals.example.yml portals.yml
```

You can edit `portals.yml` later with your preferred companies and search keywords.

### 3. Create your personal mode file

```powershell
Copy-Item modes\_profile.template.md modes\_profile.md
```

This is where your personal targeting and customization should live.

### 4. Add your CV

Create a file named `cv.md` in the project root.

Put your resume there in Markdown format.

Optional:

- add `article-digest.md` for stronger proof points

## Best Way To Use It

Use the packaged PowerShell commands:

```powershell
npm run friend:setup
npm run friend:scan
npm run friend:pipeline
npm run friend:evaluate
npm run friend:deep
npm run friend:digest
```

Optional all-in-one run:

```powershell
npm run friend:all
```

## Main Ways To Use It

### 1. Initial setup

```powershell
npm run friend:setup
```

### 2. Scan for recent jobs

```powershell
npm run friend:scan
```

This now defaults to a strict Flutter-focused scan with a 30-day recency filter when the job source exposes dates.

Other strict scan modes:

```powershell
npm run scan:flutter
npm run scan:android
npm run scan:ios
npm run scan:mobile
```

For the broadest internet-backed pass, use:

```powershell
npm run friend:scan:web
```

This runs the strict 30-day filter and also uses the configured web search queries before keeping only live links.

### 3. Build an apply queue

```powershell
npm run friend:pipeline
```

This creates ranked files in:

- `reports/apply-queue/`
- `reports/leads/`

### 4. Find freelance-only leads

```powershell
npm run friend:freelance
```

### 5. Generate a deep-dive scaffold

```powershell
npm run friend:deep
```

### 6. Run non-LLM heuristic evaluation

```powershell
npm run friend:evaluate
```

This fetches top pending jobs and writes quick heuristic reports in:

- `reports/heuristic/`

### 7. Create an email-ready digest

```powershell
npm run friend:digest
```

If `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are configured, the digest can also be sent automatically.

To send a test email first:

```powershell
npm run friend:email-test
```

## Useful Files

- `cv.md` - your source-of-truth resume
- `config/profile.yml` - your personal settings
- `modes/_profile.md` - your custom targeting rules
- `portals.yml` - your job scan configuration
- `data/applications.md` - your application tracker
- `reports/` - saved evaluation reports
- `output/` - generated PDF files
- `reports/apply-queue/` - ranked shortlist files
- `reports/leads/` - categorized jobs, freelance, and gigs
- `reports/deep/` - company deep-dive scaffolds
- `reports/digests/` - email-ready digests
- `reports/heuristic/` - non-LLM heuristic evaluation reports

## Verify Everything Works

Run:

```powershell
npm run verify
```

If you want a more complete setup check, also run:

```powershell
node cv-sync-check.mjs
```

## Important Rules

- Never use this to spam employers.
- Review everything before applying.
- Keep personal customization in `config/profile.yml`, `modes/_profile.md`, or `article-digest.md`.
- Do not put your personal rules into `modes/_shared.md`.

## If Something Breaks

Try:

```powershell
npm install
npx playwright install chromium
npm run verify
```

Then run:

```powershell
npm run friend:scan
```

## Recommended Starting Folder

```powershell
cd D:\projects\codex_career_ops_v1
npm run friend:all
```
