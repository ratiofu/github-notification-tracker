/** Removes undefined own properties while preserving all other values, including null. */
export function withoutUndefined<ObjectValue extends object>(
  value: ObjectValue,
): Partial<ObjectValue> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  ) as Partial<ObjectValue>
}
