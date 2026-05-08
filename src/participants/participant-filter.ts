import type {
  GitHubLogin,
  Participant,
  ParticipantFilterIndex,
  ParticipantSelection,
} from "../domain/participant.js"
import type { GitHubEntityId } from "../domain/shared.js"
import type { LocalNotification } from "../domain/notification.js"
import type { TeamMembershipCache } from "../domain/team-cache.js"

const EMPTY_SET_SIZE = 0
const TEAM_SORT_PREFIX = "1"
const USER_SORT_PREFIX = "0"

export interface ParticipantCatalog {
  readonly participants: readonly Participant[]
}

export interface ParticipantCatalogInput {
  readonly notifications: readonly LocalNotification[]
  readonly teamCache: TeamMembershipCache
}

export interface ParticipantFilterMatchInput {
  readonly filter: ParticipantFilterIndex
  readonly notification: LocalNotification
  readonly teamCache: TeamMembershipCache
}

/** Builds the participant picker catalog from stored notifications and cached teams. */
export function createParticipantCatalog(input: ParticipantCatalogInput): ParticipantCatalog {
  const participantsByKey = new Map<string, Participant>()

  for (const notification of input.notifications) {
    for (const participant of notification.participants) {
      participantsByKey.set(createParticipantKey(participant), participant)
    }
  }

  for (const entry of input.teamCache.entries) {
    participantsByKey.set(createParticipantKey(entry.team), entry.team)

    for (const member of entry.members) {
      const participant = { kind: "user" as const, login: member }
      const key = createParticipantKey(participant)

      if (!participantsByKey.has(key)) {
        participantsByKey.set(key, participant)
      }
    }
  }

  return {
    participants: [...participantsByKey.values()].toSorted(compareParticipants),
  }
}

/** Builds set-based filter indexes so repeated notification checks stay simple and fast. */
export function createParticipantFilterIndex(
  selections: readonly ParticipantSelection[],
): ParticipantFilterIndex {
  return {
    teamIds: new Set(),
    teamSlugs: new Set(
      selections
        .filter((selection) => isTeamSelection(selection))
        .map((selection) => createTeamKey(selection)),
    ),
    userIds: new Set(),
    userLogins: new Set(
      selections
        .filter((selection) => isUserSelection(selection))
        .map((selection) => selection.login),
    ),
  }
}

/** Checks one notification against configured participant selections and cached team members. */
export function notificationMatchesParticipantFilter(input: ParticipantFilterMatchInput): boolean {
  if (isEmptyFilter(input.filter)) {
    return true
  }

  const notificationIndex = createNotificationParticipantIndex(input.notification, input.teamCache)
  const expandedFilter = expandTeamSelections(input.filter, input.teamCache)

  return (
    intersects(expandedFilter.userIds, notificationIndex.userIds) ||
    intersects(expandedFilter.userLogins, notificationIndex.userLogins) ||
    intersects(expandedFilter.teamIds, notificationIndex.teamIds) ||
    intersects(expandedFilter.teamSlugs, notificationIndex.teamSlugs)
  )
}

/** Expands selected teams into cached member logins while preserving direct team matching. */
function expandTeamSelections(
  filter: ParticipantFilterIndex,
  teamCache: TeamMembershipCache,
): ParticipantFilterIndex {
  const expandedFilter: MutableParticipantFilterIndex = {
    teamIds: new Set(filter.teamIds),
    teamSlugs: new Set(filter.teamSlugs),
    userIds: new Set(filter.userIds),
    userLogins: new Set(filter.userLogins),
  }

  const selectedTeamEntries = teamCache.entries.filter((entry) =>
    filter.teamSlugs.has(createTeamKey(entry.team)),
  )

  for (const entry of selectedTeamEntries) {
    addOptionalEntityId(expandedFilter.teamIds, entry.team.teamId)

    for (const member of entry.members) {
      expandedFilter.userLogins.add(member)
    }
  }

  return expandedFilter
}

/** Expands notification participants, explicit targets, and cached team members into one index. */
function createNotificationParticipantIndex(
  notification: LocalNotification,
  teamCache: TeamMembershipCache,
): ParticipantFilterIndex {
  const index: MutableParticipantFilterIndex = {
    teamIds: new Set(),
    teamSlugs: new Set(),
    userIds: new Set(),
    userLogins: new Set(),
  }

  addActor(index, notification.actor)
  addActor(index, notification.parentPr.author)

  for (const participant of notification.participants) {
    addParticipant(index, participant)
  }

  for (const target of notification.explicitTargets) {
    if (target.kind === "user") {
      index.userLogins.add(target.login)
    } else {
      index.teamSlugs.add(createTeamKey(target))
      addCachedTeamMembers(index, teamCache, target)
    }
  }

  return index
}

function addParticipant(index: MutableParticipantFilterIndex, participant: Participant) {
  if (participant.kind === "user") {
    index.userLogins.add(participant.login)
    addOptionalEntityId(index.userIds, participant.id)
    return
  }

  index.teamSlugs.add(createTeamKey(participant))
  addOptionalEntityId(index.teamIds, participant.teamId)

  for (const member of participant.members) {
    index.userLogins.add(member)
  }
}

function addActor(index: MutableParticipantFilterIndex, actor: LocalNotification["actor"]) {
  index.userLogins.add(actor.login)
  addOptionalEntityId(index.userIds, actor.id)
}

function addCachedTeamMembers(
  index: MutableParticipantFilterIndex,
  teamCache: TeamMembershipCache,
  team: { readonly org: GitHubLogin; readonly slug: string },
) {
  const matchingEntries = teamCache.entries.filter(
    (cacheEntry) => createTeamKey(cacheEntry.team) === createTeamKey(team),
  )

  for (const entry of matchingEntries) {
    addOptionalEntityId(index.teamIds, entry.team.teamId)

    for (const member of entry.members) {
      index.userLogins.add(member)
    }
  }
}

function addOptionalEntityId(target: Set<GitHubEntityId>, value: GitHubEntityId | undefined) {
  if (value !== undefined) {
    target.add(value)
  }
}

function isEmptyFilter(filter: ParticipantFilterIndex) {
  return (
    filter.teamIds.size === EMPTY_SET_SIZE &&
    filter.teamSlugs.size === EMPTY_SET_SIZE &&
    filter.userIds.size === EMPTY_SET_SIZE &&
    filter.userLogins.size === EMPTY_SET_SIZE
  )
}

function intersects<TValue>(left: ReadonlySet<TValue>, right: ReadonlySet<TValue>) {
  for (const value of left) {
    if (right.has(value)) {
      return true
    }
  }

  return false
}

function compareParticipants(left: Participant, right: Participant) {
  return createParticipantSortValue(left).localeCompare(createParticipantSortValue(right))
}

function createParticipantSortValue(participant: Participant) {
  return participant.kind === "user"
    ? `${USER_SORT_PREFIX}:${participant.login}`
    : `${TEAM_SORT_PREFIX}:${participant.org}/${participant.slug}`
}

function createParticipantKey(participant: Participant) {
  return participant.kind === "user"
    ? `user:${participant.login}`
    : `team:${createTeamKey(participant)}`
}

function createTeamKey(team: { readonly org: GitHubLogin; readonly slug: string }) {
  return `${team.org}/${team.slug}`
}

function isUserSelection(
  selection: ParticipantSelection,
): selection is Extract<ParticipantSelection, { readonly kind: "user" }> {
  return selection.kind === "user"
}

function isTeamSelection(
  selection: ParticipantSelection,
): selection is Extract<ParticipantSelection, { readonly kind: "team" }> {
  return selection.kind === "team"
}

interface MutableParticipantFilterIndex {
  readonly teamIds: Set<GitHubEntityId>
  readonly teamSlugs: Set<string>
  readonly userIds: Set<GitHubEntityId>
  readonly userLogins: Set<GitHubLogin>
}
