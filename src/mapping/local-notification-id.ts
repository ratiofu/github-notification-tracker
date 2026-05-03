import type { LocalNotificationId } from "../domain/shared.js"
import { randomBytes } from "node:crypto"

const LOCAL_NOTIFICATION_RANDOM_BYTES = 6
const LOCAL_NOTIFICATION_TIMESTAMP_BYTES = 6
const LOCAL_NOTIFICATION_TOTAL_BYTES =
  LOCAL_NOTIFICATION_TIMESTAMP_BYTES + LOCAL_NOTIFICATION_RANDOM_BYTES
const TIMESTAMP_BYTE_OFFSET = 0

/**
 * Creates compact URL-safe IDs with millisecond ordering and random same-ms uniqueness.
 *
 * Source fingerprints handle deduplication; local IDs are only stable row identities for new
 * notifications and stay unread when replacement policies later create fresh records.
 */
export function createLocalNotificationId(): LocalNotificationId {
  const bytes = Buffer.alloc(LOCAL_NOTIFICATION_TOTAL_BYTES)
  bytes.writeUIntBE(Date.now(), TIMESTAMP_BYTE_OFFSET, LOCAL_NOTIFICATION_TIMESTAMP_BYTES)
  randomBytes(LOCAL_NOTIFICATION_RANDOM_BYTES).copy(bytes, LOCAL_NOTIFICATION_TIMESTAMP_BYTES)

  return bytes.toString("base64url")
}
