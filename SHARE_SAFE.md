# Share-Safe Checklist

Use this checklist before sharing `codex_career_ops_v1` with friends or publishing it.

## Never Share These

- `.env`
- `.env.local`
- `config/profile.yml`
- `portals.yml`
- `modes/_profile.md`
- `cv.md`
- `data/`
- `reports/`
- `output/`

These files can contain:

- API keys
- personal email addresses
- phone numbers
- resume content
- private job history

## Safe Files To Share

- `.env.example`
- `README.md`
- `README_FRIENDS.md`
- `AGENTS.md`
- `CODEX.md`
- `docs/`
- `modes/` except your private `_profile.md`
- scripts such as `scan.mjs`, `friend-*.mjs`, and utility modules

## Before Sharing

1. Delete local secret files:

```powershell
Remove-Item .env -ErrorAction SilentlyContinue
Remove-Item .env.local -ErrorAction SilentlyContinue
```

2. Make sure the receiver only gets `.env.example`, not your real `.env`.

3. If a real API key was ever pasted into chat, screenshots, or files, rotate it.

4. Ask friends to create their own `.env`:

```powershell
Copy-Item .env.example .env
```

5. Tell them to use their own values for:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

## Recommended Reset Before Publishing

- rotate your Resend API key
- update your local `.env` with the new key
- keep the rotated key private

## Optional Verification

Run this before sharing:

```powershell
npm run verify
```

And manually confirm:

- `.env` is absent
- your CV is not included
- `config/profile.yml` is not included
