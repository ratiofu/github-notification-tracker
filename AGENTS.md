# Repository Guidelines

## Critical Agent Rules

- CRITICAL: Never guess. Confirm assumptions first.
- CRITICAL: You must update AGENTS.md and docs/plan.md when given instructions to make changes or take a different direction
- CRITICAL: Always record new learnings first; general learnings in AGENTS.md, implementation-specific learning in docs/plan.md. Ensure the learnings do not already exist to avoid duplicate memories. Raise the importance of existing learnings when being reminded.
- CRITICAL: Do not add requirements, expectations, or preferences.
- CRITICAL: Request review after each completed task.
- CRITICAL: Only perform Git operations of any kind when explicitly requested. Do not execute any git commands unless explicitly asked. If asked to commit; use Conventional Commit message format. Do not rebase or force-push.

## Project Structure & Module Organization

- Current scaffold is a single-package pnpm workspace rooted at the repository root.
- `docs/plan.md` is the executable product and implementation plan; keep it current before major code changes.
- `README.md` is the user-facing overview and setup guide.
- `scripts/` contains repository utility scripts, including `scripts/pnpm-parallel.sh`.
- Source Layout:
  - `src/` for TypeScript implementation.
  - Organize implementation into logical module directories under `src/` to keep directory size manageable.
  - Colocate Vitest test files with the modules they test; for example, `cli.test.ts` lives beside `cli.ts`.
  - `src/domain/` for Zod schemas and inferred immutable model types.
  - `src/github/`, `src/storage/`, `src/tui/`, and `src/config/` for adapters and feature modules.
  - Use top-level `test/` only for cross-module integration fixtures or tests that do not belong to one module.

## Build, Test, and Development Commands

- Use `.nvmrc` to select Node 25 for project commands; Node 25 is installed through NVM.
- Use `pnpm`; dependencies must be pinned through `pnpm-workspace.yaml` catalogs once scaffolding exists.
- New dependencies must be installed via `pnpm add -E`.
- When scaffolding dependency catalogs, create `pnpm-workspace.yaml` catalog support first, then run `pnpm add -E <dependency>` so pnpm resolves current exact versions.
- When pnpm reports ignored build scripts and requests `pnpm approve-builds`, run `pnpm approve-builds` so workspace build-script policy is recorded.
- Use the TypeScript 7 release candidate toolchain package named `tsgo` for TypeScript commands.
- Commands:
  - `pnpm dev` runs the CLI locally.
  - `pnpm build` builds the ESM `ght` binary.
  - `pnpm test` runs Vitest with coverage.
  - `pnpm quality` runs typecheck, lint, format, and tests via `scripts/pnpm-parallel.sh`.

## Coding Style & Naming Conventions

- Use TypeScript ESM with explicit module boundaries.
- Prefer functional core, imperative shell.
- Write imperative code modules so they can be easily mocked for testing
- Define domain models with Zod; infer immutable TypeScript types from schemas.
- Treat in-memory state as immutable; update by copying, never by mutation.
- Use descriptive names: `notificationRepository`, `githubActivitySource`, `renderRows`.
- Do not pass anonymous object shapes across module boundaries.

## Testing Guidelines

- Use Vitest with V8 coverage.
- Keep module tests colocated as `*.test.ts` beside the source module they cover.
- Maintain at least 90% line and branch coverage.
- Test pure modules directly: schemas, mappers, replacement/ejection policy, filters, reducers, and repositories.
- Use temp SQLite databases for storage tests.
- Mock Octokit responses with fixtures for integration tests.

## Commit & Pull Request Guidelines

- Existing history uses Conventional Commit style, e.g. `docs: initial plan`.
- Use concise commit subjects: `feat: add notification mapper`, `test: cover participant filters`.
- PRs should include purpose, key implementation notes, test results, and linked issues when applicable.
- UI changes should include terminal screenshots or concise before/after notes.

## Security & Configuration Tips

- Never commit real tokens or `.env` secrets.
- `GITHUB_PAT` is required for local operation; document required scopes in `README.md`.
- Keep runtime state under `~/.config/ght/`; avoid writing user data into the repo.
