# Remote Schema Sources

Manual validation performed on 2026-05-02.

## GitHub Pull Request Payload

Source: <https://docs.github.com/en/rest/pulls/pulls#get-a-pull-request>

- `PullRequestApiPayloadSchema` matches the documented response subset used by the fetcher: numeric `id`, numeric PR `number`, `state` limited to `open`/`closed`, API `url`, browser `html_url`, `updated_at`, and `head.sha`.
- The schema is intentionally `looseObject` because GitHub returns many additional fields that are preserved in raw JSON but not needed by the fetcher.

## GitHub User/Actor Fields

Source: <https://docs.github.com/en/rest/users/users#get-the-authenticated-user>

- `GitHubActorSchema` and `UserParticipantSchema` are normalized local shapes derived from GitHub user fields.
- The external user response provides `login`, numeric `id`, `avatar_url`, and `url`; the local schemas keep those as `login`, `id`, `avatarUrl`, and `url`.

## GitHub Team Fields

Source: <https://docs.github.com/en/rest/teams/teams#list-teams>

- `TeamParticipantSchema` is a normalized local shape derived from GitHub team responses.
- The external team response provides numeric `id`, `name`, `slug`, and URL fields; the local schema keeps those as `teamId`, `name`, `slug`, and `url`.

## GitHub Entity IDs

Sources:

- <https://docs.github.com/en/rest/users/users#get-the-authenticated-user>
- <https://docs.github.com/en/rest/activity/events#list-repository-events>

- `GitHubEntityIdSchema` allows numeric IDs for normal REST resources and string IDs for activity events, matching the documented examples used by the fetcher layer.
