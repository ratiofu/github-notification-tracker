/** SQLite returns unknown row objects; this module centralizes row-shape checks before schema parsing. */

/** Reads an optional JSON payload row and validates the decoded boundary record. */
export function parseOptionalJsonRow<T>(
  row: unknown,
  schema: { parse(value: unknown): T },
): T | undefined {
  if (row === undefined) {
    return undefined;
  }

  return parseJsonRow(row, schema);
}

/** Decodes the shared payload_json column, then delegates domain validation to the supplied schema. */
export function parseJsonRow<T>(row: unknown, schema: { parse(value: unknown): T }): T {
  const payload = readString(row, "payload_json");

  return schema.parse(JSON.parse(payload));
}

/** Reads required TEXT columns from SQLite rows without duplicating type guards in repositories. */
export function readString(row: unknown, key: string): string {
  const value = readRowValue(row, key);
  if (typeof value !== "string") {
    throw new Error(`SQLite row ${key} is not a string`);
  }

  return value;
}

/** Reads nullable TEXT columns while preserving null as a meaningful persisted value. */
export function readNullableString(row: unknown, key: string): string | null {
  const value = readRowValue(row, key);
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`SQLite row ${key} is not a string`);
  }

  return value;
}

/** Reads INTEGER columns that represent booleans, counters, or migration versions. */
export function readInteger(row: unknown, key: string): number {
  const value = readRowValue(row, key);
  if (typeof value !== "number") {
    throw new Error(`SQLite row ${key} is not a number`);
  }

  return value;
}

function readRowValue(row: unknown, key: string): unknown {
  if (typeof row !== "object" || row === null || !(key in row)) {
    throw new Error(`SQLite row is missing ${key}`);
  }

  return row[key as keyof typeof row];
}
