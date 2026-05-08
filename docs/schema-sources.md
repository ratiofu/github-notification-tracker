# Remote Schema Sources

Manual validation performed on 2026-05-02.

## GitHub Pull Request Payload

Source: <https://docs.github.com/en/rest/pulls/pulls#get-a-pull-request>

- `PullRequestApiPayloadSchema` matches the documented response subset used by the fetcher: numeric `id`, numeric PR `number`, `state` limited to `open`/`closed`, API `url`, browser `html_url`, `updated_at`, and `head.sha`.
- `PullRequestMapperPayloadSchema` matches the documented response subset used by notification mapping: `id`, `number`, `title`, `state`, `merged_at`, `html_url`, `user`, `base.ref`, and `head` metadata.
- The schema is intentionally `looseObject` because GitHub returns many additional fields that are preserved in raw JSON but not needed by the fetcher.

## GitHub PR Activity Payloads

Sources:

- <https://docs.github.com/en/rest/issues/comments#list-issue-comments-for-a-repository>
- <https://docs.github.com/en/rest/pulls/comments#list-review-comments-on-a-pull-request>
- <https://docs.github.com/en/rest/pulls/reviews#list-reviews-for-a-pull-request>
- <https://docs.github.com/en/rest/issues/timeline#list-timeline-events-for-an-issue>
- <https://docs.github.com/en/rest/checks/runs#list-check-runs-for-a-git-reference>

- `SourceActivityPayloadSchema` matches the documented subsets used by source mapping: stable `id`, actor/user objects, body/title/name text, browser/API URLs, event/state/conclusion fields, and source timestamps.
- The schema is intentionally `looseObject` because GitHub activity payloads vary by event kind and raw JSON is retained for later reprocessing.

## GitHub User/Actor Fields

Source: <https://docs.github.com/en/rest/users/users#get-the-authenticated-user>

- `GitHubActorSchema` and `UserParticipantSchema` are normalized local shapes derived from GitHub user fields.
- The external user response provides `login`, numeric `id`, `avatar_url`, and `url`; the local schemas keep those as `login`, `id`, `avatarUrl`, and `url`.

## GitHub Team Fields

Sources:

- <https://docs.github.com/en/rest/teams/teams#list-teams>
- <https://docs.github.com/en/rest/teams/members#list-team-members>

- `TeamParticipantSchema` is a normalized local shape derived from GitHub team responses.
- The external team response provides numeric `id`, `name`, `slug`, and URL fields; the local schema keeps those as `teamId`, `name`, `slug`, and `url`.
- `GitHubTeamPayloadSchema` matches the documented team subset needed by cache sync: numeric `id`, `name`, `slug`, and browser `html_url`.
- `GitHubTeamMemberPayloadSchema` matches the documented member subset needed by cache sync: member `login`.

## GitHub Entity IDs

Sources:

- <https://docs.github.com/en/rest/users/users#get-the-authenticated-user>
- <https://docs.github.com/en/rest/activity/events#list-repository-events>

- `GitHubEntityIdSchema` allows numeric IDs for normal REST resources and string IDs for activity events, matching the documented examples used by the fetcher layer.
