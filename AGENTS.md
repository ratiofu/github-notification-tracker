# Repository Guidelines

## Critical Agent Rules

- CRITICAL: Never guess. Confirm assumptions first.
- CRITICAL: You must update AGENTS.md and docs/plan.md when given instructions to make changes or take a different direction
- CRITICAL: Always record new learnings first; general learnings in AGENTS.md, implementation-specific learning in docs/plan.md. Ensure the learnings do not already exist to avoid duplicate memories. Raise the importance of existing learnings when being reminded.
- CRITICAL: Do not add requirements, expectations, or preferences.
- CRITICAL: Request review after each completed task.
- CRITICAL: Only perform Git operations of any kind when explicitly requested. Do not execute any git commands unless explicitly asked. If asked to commit; use Conventional Commit message format. Do not rebase or force-push.
- CRITICAL: If the implementation for meeting a particular requirement or task becomes to complex, pause and collaborate with the human to find simpler, alternative approaches.

## Project Structure & Module Organization

- Current scaffold is a single-package pnpm workspace rooted at the repository root.
- `docs/plan.md` is the executable product and implementation plan; keep it current before major code changes.
- `README.md` is the user-facing overview and setup guide.
- `scripts/` contains repository utility scripts, including `scripts/pnpm-parallel.sh`.
- Source Layout:
  - `src/` for TypeScript implementation.
  - Organize implementation into logical module directories under `src/` to keep directory size manageable.
  - Colocate Vitest test files with the modules they test; for example, `cli.test.ts` lives beside `cli.ts`.
  - Keep classes in one file per class, with test files matching the class file names.
  - `src/domain/` for boundary Zod schemas plus explicit internal TypeScript model types.
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

## Coding Style & Conventions

- Use terse JSDoc where it clarifies a key responsibility, component relationship, or critical/complex behavior.
- Use TypeScript ESM with explicit module boundaries.
- Prefer functional core, imperative shell.
- Write imperative code modules so they can be easily mocked for testing
- Define system boundary models with Zod; infer immutable TypeScript types from schemas.
- Memory-only internal models do not need Zod validation; use explicit TypeScript interfaces/types or data classes and choose efficient runtime representations.
- Prefer stable GitHub-provided IDs for internal entity identity when available; names and logins can change.
- Keep domain schema modules pure: no filesystem, network, process environment, or rendering side effects.
- Use notification-thread domain language for parent groupings; avoid generic aggregate-root terminology in model names.
- Treat in-memory state as immutable; update by copying, never by mutation.
- Use descriptive names: `notificationRepository`, `githubActivitySource`, `renderRows`.
- Do not pass anonymous object shapes across module boundaries.
- Use SQLite `STRICT` tables consistently for storage schemas so SQLite enforces basic column storage types before repository/domain validation.
- Notification storage deduplicates by deterministic source fingerprint because repeated polling can regenerate local notification IDs for the same source activity.
- Centralize SQLite row parsing helpers so repositories share row-shape checks before schema/domain parsing.
- Logger adapters should append boundary-validated JSONL events to daily files and keep filesystem writes at the adapter edge.

## Testing Guidelines

- Use Vitest with V8 coverage.
- Keep module tests colocated as `*.test.ts` beside the source module they cover.
- Maintain at least 90% line and branch coverage.
- Test pure modules directly: schemas, mappers, replacement/ejection policy, filters, reducers, and repositories.
- Reuse shared domain model fixtures from modules close to the models instead of redefining equivalent test factories in feature tests.
- Use temp SQLite databases for storage tests.
- Prefer storage tests that cover meaningful conflict, validation, and transaction behavior over artificial defensive guard coverage.
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
