import { LocalNotificationIdSchema } from "../domain/shared.js"
import { randomBytes } from "node:crypto"

const LOCAL_NOTIFICATION_RANDOM_BYTES = 16
const LOCAL_NOTIFICATION_ID_LENGTH = 21
const START_INDEX = 0

/**
 * Creates URL-safe local IDs independent of GitHub source identity.
 *
 * Source fingerprints handle deduplication; local IDs are only stable row identities for new
 * notifications and stay unread when replacement policies later create fresh records.
 */
export function createLocalNotificationId(): ReturnType<typeof LocalNotificationIdSchema.parse> {
  const id = randomBytes(LOCAL_NOTIFICATION_RANDOM_BYTES)
    .toString("base64url")
    .slice(START_INDEX, LOCAL_NOTIFICATION_ID_LENGTH)

  return LocalNotificationIdSchema.parse(id)
}
