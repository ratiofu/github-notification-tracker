import { SourceFingerprintSchema } from "../domain/shared.js"

export interface SourceFingerprintInput {
  readonly entityId: number | string
  readonly sourceKind: string
  readonly type: string
}

/**
 * Builds the stable dedup key storage uses when repeated polling sees the same activity.
 *
 * It deliberately excludes the random local notification ID so repository upserts can collapse
 * repeated GitHub activity back onto the same stored notification.
 */
export function createSourceFingerprint(
  input: SourceFingerprintInput,
): ReturnType<typeof SourceFingerprintSchema.parse> {
  return SourceFingerprintSchema.parse(
    `${input.sourceKind}:${input.type}:${String(input.entityId)}`,
  )
}
