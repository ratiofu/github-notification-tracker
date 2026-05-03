# Repository Guidelines

## Critical Agent Rules

- CRITICAL: Never guess. Confirm assumptions first
- CRITICAL: You must update AGENTS.md and docs/plan.md when given instructions to make changes or take a different direction
- CRITICAL: Always record new learnings first
- CRITICAL: General, project-wide learnings not specific to a single feature or file go in AGENTS.md
- CRITICAL: Implementation-specific learning go in docs/plan.md
- CRITICAL: Do not duplicate learnings within and across files. When reminded of existing learnings, raise their importance
- CRITICAL: Do not add requirements, expectations, or preferences
- CRITICAL: Request review after each completed task
- CRITICAL: Do not execute any git commands unless explicitly asked
- CRITICAL: If asked to commit, use Conventional Commit message format
- CRITICAL: Do not rebase or force-push
- CRITICAL: If the implementation for meeting a particular requirement or task becomes to complex, pause and collaborate with the human to find simpler, alternative approaches

## Project Structure & Module Organization

- Current scaffold is a single-package pnpm workspace rooted at the repository root.
- `docs/plan.md` is the executable product and implementation plan; keep it current before major code changes.
- `README.md` is the user-facing overview and setup guide.
- Source Layout:
  - `src/` for TypeScript implementation.
  - Organize implementation into logical module directories under `src/` to keep directory size manageable.
  - Colocate Vitest test files with the modules they test; for example, `cli.test.ts` lives beside `cli.ts`.
  - `src/domain/` for boundary Zod schemas plus explicit internal TypeScript model types.
  - `src/github/`, `src/storage/`, `src/tui/`, and `src/config/` for adapters and feature modules.
  - `src/util/` for reusable, feature-neutral utilities with colocated tests.
  - Use top-level `test/` only for cross-module integration fixtures or tests that do not belong to one module.

## Build, Test, and Development Commands

- Use `.nvmrc` to select Node 25 for project commands; Node 25 is installed through NVM.
- Use `pnpm`; dependencies must be pinned through `pnpm-workspace.yaml` catalogs once scaffolding exists.
- Do not pass an explicit `--store-dir` to pnpm commands; use the project/session pnpm configuration as-is.
- New dependencies must be installed via `pnpm add -E`.
- When scaffolding dependency catalogs, create `pnpm-workspace.yaml` catalog support first, then run `pnpm add -E <dependency>` so pnpm resolves current exact versions.
- When pnpm reports ignored build scripts and requests `pnpm approve-builds`, run `pnpm approve-builds` so workspace build-script policy is recorded.
- Use oxlint's TypeScript 7-powered type-aware/type-check mode for TypeScript diagnostics; do not keep a separate typecheck command.
- `pnpm lint` runs oxlint in type-aware, type-checking fix mode.
- Commands:
  - `pnpm dev` runs the CLI locally.
  - `pnpm build` builds the ESM `ght` binary.
  - `pnpm test` runs Vitest with coverage.
  - `pnpm quality` runs lint, format, and tests sequentially to avoid write races.

## Coding Style & Conventions

- Use terse JSDoc where it clarifies a key responsibility, component relationship, or critical/complex behavior.
- Use TypeScript ESM with explicit module boundaries.
- Use explicit `.js` extensions on relative TypeScript ESM imports for Node-targeted code.
- Prefer named exports and do not use default exports, except CommonJS TypeScript config files may use default exports when required by their tools.
- Prefer individually listed exports over grouped export blocks, but do not enforce this mechanically.
- Use kebab-case filenames.
- Prefer TypeScript return type inference over explicit function return annotations unless a boundary contract needs the annotation.
- Prefer functional core, imperative shell.
- Prefer `async`/`await` for asynchronous control flow.
- Let errors bubble naturally; avoid pass-through catches or `return await` unless adding meaningful context or cleanup.
- Prefer ternaries for simple quick returns and concise branching; avoid nested or hard-to-read ternaries.
- Write imperative code modules so they can be easily mocked for testing
- Define system boundary models with Zod; infer immutable TypeScript types from schemas.
- Link remote-model schemas to the external source of truth and manually validate copied fields against that source when adding or changing them.
- Do not assume GitHub REST list endpoints all return top-level arrays; validate each endpoint response shape from the GitHub docs before mapping payloads.
- Use Zod v4 top-level string format schemas such as `z.url()` and `z.iso.datetime()` instead of deprecated chained string validators.
- Memory-only internal models do not need Zod validation; use explicit TypeScript interfaces/types or data classes and choose efficient runtime representations.
- Prefer stable GitHub-provided IDs for internal entity identity when available; names and logins can change.
- Keep domain schema modules pure: no filesystem, network, process environment, or rendering side effects.
- Use notification-thread domain language for parent groupings; avoid generic aggregate-root terminology in model names.
- Treat in-memory state as immutable; update by copying, never by mutation.
- Declare array function parameters as readonly by default and prefer readonly array return types.
- Use descriptive names: `notificationRepository`, `githubActivitySource`, `renderRows`.
- Put repeated hard-coded primitive constants in `src/constants.ts`; keep one-off test fixtures near the test or fixture module that owns them.
- Put reusable, feature-neutral helpers in `src/util/` with focused colocated tests; keep adapter-specific utilities in their adapter module.
- Avoid magic numbers, including in tests; prefer named constants and use narrow lint suppressions only for justified exceptions.
- Do not pass anonymous object shapes across module boundaries.
- Prefer simple over complex implementations. Go with the minimum that could possibly work correctly.
- Keep oxlint strict but reasonable: enable broad relevant categories and native plugins, then fix violations or explicitly relax rules when they conflict with project conventions.
- Use SQLite `STRICT` tables consistently for storage schemas so SQLite enforces basic column storage types before repository/domain validation.
- Document non-obvious behavior, such as lifecycle events, cache-validation semantics, and other complexities.
- Use `Options` naming for constructor configuration objects.

## Testing Guidelines

- Use Vitest with V8 coverage.
- Keep module tests colocated as `*.test.ts` beside the source module they cover.
- Maintain at least 90% line and branch coverage.
- Test pure modules directly: schemas, mappers, replacement/ejection policy, filters, reducers, and repositories.
- Reuse shared domain model fixtures from modules close to the models instead of redefining equivalent test factories in feature tests.
- Use temp SQLite databases for storage tests.
- Prefer storage tests that cover meaningful conflict, validation, and transaction behavior over artificial defensive guard coverage.
- Mock Octokit responses with fixtures for integration tests.
- Refactor long sequences of `expect` calls on object properties into reusable assertion helpers or prefer deep comparison.
- Test and test case names must not contain the word "should"; use concise expected-behavior phrasing such as "returns initials of a name".
- When addressing lint debt, fix one file in its entirety and run the related tests before moving to another file.

## Commit & Pull Request Guidelines

- Existing history uses Conventional Commit style, e.g. `docs: initial plan`.
- Use concise commit subjects: `feat: add notification mapper`, `test: cover participant filters`.
- PRs should include purpose, key implementation notes, test results, and linked issues when applicable.
- UI changes should include terminal screenshots or concise before/after notes.

## Security & Configuration Tips

- Never commit real tokens or `.env` secrets.
- `GITHUB_PAT` is required for local operation; document required scopes in `README.md`.
- Keep runtime state under `~/.config/ght/`; avoid writing user data into the repo.
