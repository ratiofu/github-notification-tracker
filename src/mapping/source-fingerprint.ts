import type { GitHubEntityId, SourceFingerprint } from "../domain/shared.js"
import type { GitHubSourceKind } from "../domain/github-source.js"
import type { LocalNotificationType } from "../domain/notification.js"

export interface SourceFingerprintInput {
  readonly entityId: GitHubEntityId
  readonly sourceKind: GitHubSourceKind
  readonly type: LocalNotificationType
}

/**
 * Builds the stable dedup key storage uses when repeated polling sees the same activity.
 *
 * It deliberately excludes the random local notification ID so repository upserts can collapse
 * repeated GitHub activity back onto the same stored notification.
 */
export function createSourceFingerprint(input: SourceFingerprintInput): SourceFingerprint {
  return `${input.sourceKind}:${input.type}:${String(input.entityId)}`
}
