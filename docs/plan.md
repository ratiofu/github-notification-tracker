# CLI GitHub Notification Tracker `ght` – Implementation Plan

## Summary

- Build `ght`: Ink-based TypeScript CLI for one configured GitHub repo.
- Source model is activity-first, not GitHub notification-thread-first.
- Use `GITHUB_PAT` from environment or `.env`; document classic PAT `repo` scope.
- Store generated local notifications, read state, raw source JSON, teams, and cache state in SQLite under `~/.config/ght/`.
- Keep the plan terse, executable, and task-oriented.

## Interfaces

- Config path: `~/.config/ght/config.yaml`.
- Config precedence: CLI flags > env/`.env` > config file > defaults.
- Required config:
  - `repo: owner/name`
  - `github.patEnv: GITHUB_PAT`
- Default config:
  - `pollIntervalSeconds: 30`
  - `teamSyncIntervalSeconds: 3600`
  - `retentionDays: 90`
  - `summaryMode: true`
  - `unreadOnly: false`
  - `showFooter: true`
  - `participants: []`
- Runtime-persisted config:
  - summary mode
  - unread-only mode
  - footer visibility
  - participant selections
  - polling/team-sync intervals
- Runtime-only state:
  - focus
  - expanded PR summaries
  - summary read-state snapshots
- Logs:
  - JSONL daily files at `~/.config/ght/logs/YYYY-MM-DD.jsonl`.

## Domain Model

- Define the application schema before implementing source fetchers, storage, or rendering.
- Use Zod as the authoritative schema for domain models crossing process, API, config, DB, log, or render boundaries.
- Infer immutable TypeScript types from Zod schemas.
- Use explicit TypeScript interfaces/types for internal pure-state models that do not need runtime validation.
- Treat all domain and state models as immutable.
- Perform in-memory updates by creating copies, not mutating existing objects.
- Do not pass anonymous object shapes across module boundaries.
- Required model groups:
  - config model
  - GitHub source payload wrappers
  - aggregate root model
  - PR aggregate model
  - local notification model
  - participant model
  - team membership cache model
  - read-state model
  - render row/view model
  - API status model
  - debug warning/log event model
- Required identity fields:
  - local notification ID
  - deterministic source fingerprint
  - aggregate root ID
  - GitHub entity IDs/URLs where available
- Required notification fields:
  - type
  - title/text
  - target URL
  - source timestamp
  - actor
  - explicit targets
  - participants
  - parent PR metadata
  - read/unread state
  - source JSON references

## Behavior

- Poll GitHub repo/PR/activity/timeline/check/team APIs.
- Do not use GitHub notification-thread endpoints in v1.
- Poll open PRs plus closed/merged PRs updated in the last 7 days.
- Backfill first run:
  - open PRs
  - 7 calendar days of supported activity
  - current failed checks
  - all imported notifications start unread
- Default visibility:
  - empty participant filter means all supported activity
  - exclude events where authenticated user is actor/originator
- Supported local notification types:
  - PR comments
  - PR review comments
  - PR review submissions
  - review requests
  - mentions from `@login` and `@org/team`
  - failed PR checks for current head SHA
  - PR merged
  - PR closed
- Replacement/ejection:
  - replacement activities get new local notification IDs and start unread
  - failed-check outcome changes eject prior notifications for that workflow/check context
  - merged PRs prune prior non-comment notifications, keep `PR merged`, allow future comments
  - closed-unmerged PRs mirror merged behavior with `PR closed`
- Local identity:
  - 21-character URL-safe random local ID
  - deterministic source fingerprint for dedup/replacement
  - store raw source JSON for reprocessing
- Filtering:
  - `[P]` opens unified participant picker for users and teams
  - picker lists seen participants from stored notifications plus cached teams/members
  - participant match includes explicit targets, actors, authors, team targets, and cached team members
  - team sync caches team membership hourly by default
  - failed team sync keeps cached data active, turns API dot red, writes log entry
- Read state:
  - local only
  - no GitHub mark-read sync
  - stored in SQLite
  - `Space` toggles detailed item read/unread
  - summary `Space` uses snapshot cycle: all read → all unread → restore prior child state
- Rendering:
  - summary item groups one parent PR
  - data model allows future aggregate roots beyond PRs
  - summary mode on shows PR summaries plus runtime-expanded child rows
  - summary mode off shows detailed notification rows only
  - summary and detailed items both render two physical lines
  - newest activity first
  - unread-only summary mode shows PRs with any unread child
  - expanded summaries show unread children only when unread-only is active
  - no line wrapping; recompute truncation on terminal resize
- Keys:
  - arrows navigate
  - `Enter` opens selected item target URL
  - `Space` toggles read state
  - `[S]` toggles persisted summary mode
  - `[O]` expands/collapses selected summary
  - `Ctrl+J` and `Shift+Enter` are attempted aliases for `[O]`
  - `[R]` toggles unread-only
  - `[D]` toggles debug mode
  - `[F]` toggles footer
  - `[P]` opens participant picker
  - `[Q]` and `Ctrl+C` exit
- Footer:
  - unread count
  - command help
  - right-edge API indicator:
    - grey `⦾` idle
    - yellow `⦿` during active API requests
    - red after request failure or any in-flight request older than 15s
    - returns to normal after successful request cycle
- Debug mode:
  - show generated notification fields plus associated raw GitHub payload summaries/JSON
  - preserve navigation and read toggles
  - show unmapped/partial mapping warnings

## Technical Stack

- Node 25+.
- pnpm single-package workspace.
- pnpm catalogs with pinned versions only; no ranges.
- Package as tsup-built ESM CLI with `bin.ght`.
- Use:
  - Ink for persistent TUI
  - `@clack/prompts` only for optional non-persistent setup prompts
  - Octokit REST for GitHub API
  - Zod for domain/config/persistence/runtime-boundary schemas
  - `node:sqlite` sync API behind async-shaped repository interfaces
  - `dotenv` or equivalent for `.env`
  - citty for CLI parsing
  - picocolors for simple color constants if useful
  - oxlint
  - oxfmt
  - TypeScript
  - Vitest with V8 coverage on by default (all tests run with coverage unless explicitly excluded)
  - use `vitest-mock-extended` for mock utilities (not `ts-mockito`)
- Scripts:
  - `pnpm build`
  - `pnpm dev`
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm format`
  - `pnpm test`
  - `pnpm audit`
  - `pnpm deps:upgrade`
  - `pnpm quality` runs lint, format, test with coverage, typecheck via `scripts/pnpm-parallel.sh`
- Coverage gate:
  - 90% lines
  - 90% branches

## Architecture

- Functional core, imperative shell.
- Core modules:
  - domain schema
  - config loading/merging/persistence
  - GitHub client interfaces
  - activity source fetchers
  - source-to-notification mappers
  - replacement/ejection policy
  - participant extraction/matching
  - SQLite repositories
  - TUI state reducer
  - render model builder
  - debug model builder
  - logger
- Imperative shells:
  - CLI entry
  - Octokit adapter
  - SQLite adapter
  - browser opener
  - filesystem config/log adapter
  - Ink app
- Theme:
  - one semantic theme object
  - rendering receives theme explicitly
  - focused item uses brighter semantic colors
  - unfocused item uses duller semantic colors

## Test Plan

- Unit-test Zod schemas with valid/invalid fixtures for config, source wrappers, notifications, participants, render rows, and log events.
- Unit-test config precedence and persisted runtime config writes.
- Unit-test source fingerprinting, random ID shape, dedup, and replacement/ejection rules.
- Unit-test mappers for comments, review comments, reviews, review requests, mentions, failed checks, merged, closed.
- Unit-test authenticated-user actor exclusion.
- Unit-test participant extraction and participant filter matching.
- Unit-test team cache behavior when sync succeeds/fails.
- Unit-test summary grouping, ordering, unread-only filtering, expansion, and `Space` snapshot cycle.
- Unit-test SQLite repositories with temp DBs.
- Unit-test API status state transitions: idle, active, failed, stalled, recovered.
- Unit-test debug view model includes raw source JSON and mapping warnings.
- TUI reducer tests cover keybindings without snapshot-heavy UI tests.
- Integration tests mock Octokit responses with fixtures.
- `pnpm quality` must pass.

## Assumptions

- Classic PAT `repo` scope is acceptable for v1.
- GitHub notification-thread endpoints stay out of v1.
- Ink is required for the main persistent UI; `@clack/prompts` is insufficient for resize-aware always-on rendering, focus navigation, and live status updates.
- GitHub REST rate-limit/backoff behavior follows current docs: <https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api>.
- `node:sqlite` is synchronous in current Node docs; v1 hides this behind async-shaped repository interfaces: <https://nodejs.org/api/sqlite.html>.
- GitHub activity/timeline APIs may have limited history; v1 compensates with 7-day PR polling and local persistence, not GitHub notification threads.

## Tasks

- [ ] Scaffold pnpm workspace, pinned catalogs, package metadata, TypeScript, tsup, oxlint, oxfmt, Vitest coverage, and quality scripts.
- [ ] Define Zod-backed domain schemas and inferred TypeScript model types before implementing feature modules.
- [ ] Add config loader/persister with CLI/env/`.env`/YAML precedence.
- [ ] Add SQLite schema, repositories, migrations/version table, and retention pruning.
- [ ] Add JSONL daily logger.
- [ ] Add Octokit REST adapter with PAT auth, pagination, conditional requests where useful, concurrency limit 4, backoff, and API status events.
- [ ] Add GitHub source fetchers for PRs, activity/timeline data, reviews/comments, checks, and teams.
- [ ] Add source mappers, local notification model, fingerprints, raw JSON storage, warnings, and actor-exclusion policy.
- [ ] Add replacement/ejection policies for checks, merged PRs, and closed PRs.
- [ ] Add participant extraction, team cache sync, and participant filter matching.
- [ ] Add TUI reducer for view state, keybindings, read/unread state, summary expansion, and persisted setting updates.
- [ ] Add Ink renderers for normal mode, summary/detail rows, debug mode, footer, API indicator, participant picker, focus colors, and resize truncation.
- [ ] Add browser-open behavior for summary PR URLs and detailed notification target URLs.
- [ ] Add README with setup, `GITHUB_PAT`, classic `repo` scope, config, commands, storage paths, and troubleshooting.
- [ ] Add unit/integration tests to satisfy 90% line and branch coverage.
- [ ] Run `pnpm quality`.
