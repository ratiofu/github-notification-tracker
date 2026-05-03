import type { LogEvent } from "../domain/debug.js"

export type LogInput = Omit<LogEvent, "timestamp"> & {
  readonly timestamp?: LogEvent["timestamp"]
}

/** Isolates append-only filesystem writes from logger event validation and routing. */
export interface LogFileWriter {
  readonly appendTextFile: (path: string, content: string) => Promise<void>
}
