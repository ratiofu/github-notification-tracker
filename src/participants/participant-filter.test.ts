import { createNotificationFixture, createTeamEntryFixture } from "../domain/fixtures.js"
import {
  createParticipantCatalog,
  createParticipantFilterIndex,
  notificationMatchesParticipantFilter,
} from "./participant-filter.js"
import { describe, expect, it } from "vitest"
import type { LocalNotification } from "../domain/notification.js"
import type { TeamMembershipCache } from "../domain/team-cache.js"

const OCTOCAT_USER_ID = 1001
const REPO = "acme/widgets"

describe("participant filter", () => {
  it("matches every notification when no participants are selected", matchesEmptyFilter)
  it("matches actor and author users", matchesNotificationUsers)
  it("matches explicit team targets", matchesTeamTargets)
  it("matches team participants and their listed members", matchesTeamParticipants)
  it("matches users through cached team members", matchesCachedTeamMembers)
  it("matches selected teams through cached member activity", matchesSelectedTeamsByMember)
  it("builds picker catalog from notifications and cached teams", buildsParticipantCatalog)
})

function matchesEmptyFilter() {
  expect(
    notificationMatchesParticipantFilter({
      filter: createParticipantFilterIndex([]),
      notification: createNotificationFixture(),
      teamCache: createTeamCache(),
    }),
  ).toBe(true)
}

function matchesNotificationUsers() {
  const filter = createParticipantFilterIndex([{ kind: "user", login: "mona" }])

  expect(
    notificationMatchesParticipantFilter({
      filter,
      notification: createNotificationFixture(),
      teamCache: createTeamCache(),
    }),
  ).toBe(true)
}

function matchesTeamTargets() {
  const filter = createParticipantFilterIndex([{ kind: "team", org: "acme", slug: "platform" }])
  const notification = createNotificationWith({
    explicitTargets: [{ kind: "team", org: "acme", slug: "platform" }],
  })

  expect(
    notificationMatchesParticipantFilter({
      filter,
      notification,
      teamCache: createTeamCache(),
    }),
  ).toBe(true)
}

function matchesTeamParticipants() {
  const filter = createParticipantFilterIndex([{ kind: "user", login: "tj" }])
  const notification = createNotificationWith({
    explicitTargets: [],
    participants: [createTeamEntryFixture().team],
  })

  expect(
    notificationMatchesParticipantFilter({
      filter,
      notification,
      teamCache: createTeamCache(),
    }),
  ).toBe(true)
}

function matchesCachedTeamMembers() {
  const filter = createParticipantFilterIndex([{ kind: "user", login: "tj" }])
  const notification = createNotificationWith({
    explicitTargets: [{ kind: "team", org: "acme", slug: "platform" }],
  })

  expect(
    notificationMatchesParticipantFilter({
      filter,
      notification,
      teamCache: createTeamCache(),
    }),
  ).toBe(true)
}

function matchesSelectedTeamsByMember() {
  const filter = createParticipantFilterIndex([{ kind: "team", org: "acme", slug: "platform" }])
  const notification = createNotificationWith({
    explicitTargets: [{ kind: "user", login: "tj" }],
  })

  expect(
    notificationMatchesParticipantFilter({
      filter,
      notification,
      teamCache: createTeamCache(),
    }),
  ).toBe(true)
}

function buildsParticipantCatalog() {
  expect(
    createParticipantCatalog({
      notifications: [createNotificationFixture()],
      teamCache: createTeamCache(),
    }).participants,
  ).toStrictEqual([
    {
      id: OCTOCAT_USER_ID,
      kind: "user",
      login: "octocat",
    },
    { kind: "user", login: "tj" },
    createTeamEntryFixture().team,
  ])
}

function createNotificationWith(
  fields: Pick<LocalNotification, "explicitTargets"> &
    Partial<Pick<LocalNotification, "participants">>,
): LocalNotification {
  return {
    ...createNotificationFixture(),
    explicitTargets: fields.explicitTargets,
    ...(fields.participants === undefined ? {} : { participants: fields.participants }),
  }
}

function createTeamCache(): TeamMembershipCache {
  return {
    entries: [createTeamEntryFixture()],
    repo: REPO,
  }
}
