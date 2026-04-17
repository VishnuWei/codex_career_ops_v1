# Codex Career Ops v1

## Purpose

This fork keeps the Career-Ops user experience intact while making Codex Terminal the primary runtime.

The user-facing workflow should remain the same:

- paste a JD or URL to run the pipeline
- use the same `modes/*` files
- keep the same tracker, report, PDF, and portal flow
- preserve the same data contract and ethical rules

What changes in this fork is the agent runtime and instruction surface:

- Codex is the default terminal agent
- `AGENTS.md` and this file are the primary project entry points
- Codex-specific architecture lives in `docs/CODEX.md` and `docs/CODEX_DEEP_ARCHITECTURE.md`

## Instruction Order

When operating in this repository, follow guidance in this order:

1. `AGENTS.md`
2. `CODEX.md`
3. `docs/CODEX_COMMAND_CENTER.md`
4. `DATA_CONTRACT.md`
5. `docs/CODEX.md`
6. `docs/CODEX_DEEP_ARCHITECTURE.md`
7. `CLAUDE.md` for inherited shared Career-Ops rules that have not yet been rewritten here

## Rules

- Reuse the existing modes, scripts, templates, and tracker flow instead of creating parallel logic.
- Keep user-specific customization in `config/profile.yml`, `modes/_profile.md`, `article-digest.md`, or `portals.yml`.
- Never put user-specific customization into `modes/_shared.md`.
- Never submit an application on the user's behalf.
- Treat Codex support as a runtime adaptation of Career-Ops, not as a separate product.

## Codex-First Scope

This fork is intended to evolve these areas first:

- Codex-native routing and setup
- Codex-native deep-dive research flow
- Codex-friendly documentation and onboarding
- Codex parity with the Career-Ops command-center experience

## Product Goal

This repository should behave like `career-ops`, but with Codex as the primary agent runtime.

- Keep the same modes, reports, tracker flow, and CV generation behavior
- Route Codex into the checked-in `modes/*` files instead of inventing a second workflow
- Treat `friend-*` scripts as optional helpers, not as the core product surface

Legacy Claude-specific files may still exist for compatibility during migration, but Codex should prefer the docs listed above whenever both versions are available.
