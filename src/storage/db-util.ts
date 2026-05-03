/**
 * Keeps sync SQLite adapters async-shaped without pretending the statement itself is async.
 *
 * Repository APIs are Promise-based so they can evolve toward async storage without changing
 * callers; this helper gives each synchronous operation a real await point for lint consistency.
 */
export async function settleSynchronousStatement(): Promise<void> {
  await Promise.resolve()
}
