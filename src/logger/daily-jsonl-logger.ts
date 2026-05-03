import type { LogFileWriter, LogInput } from "./types.js"
import { LogEventSchema } from "../domain/debug.js"
import { join } from "node:path"

const DATE_PREFIX_END = 10
const DATE_PREFIX_START = 0

export interface DailyJsonlLoggerInput {
  readonly directory: string
  readonly now?: () => Date
  readonly writer: LogFileWriter
}

/** Validates log boundary records and appends them to date-partitioned JSONL files. */
export class DailyJsonlLogger {
  readonly #directory: string
  readonly #now: () => Date
  readonly #writer: LogFileWriter

  constructor(input: DailyJsonlLoggerInput) {
    this.#directory = input.directory
    this.#now = input.now ?? (() => new Date())
    this.#writer = input.writer
  }

  async log(input: LogInput): Promise<ReturnType<typeof LogEventSchema.parse>> {
    const event = LogEventSchema.parse({
      ...input,
      timestamp: input.timestamp ?? this.#now().toISOString(),
    })
    const path = join(
      this.#directory,
      `${event.timestamp.slice(DATE_PREFIX_START, DATE_PREFIX_END)}.jsonl`,
    )

    await this.#writer.appendTextFile(path, `${JSON.stringify(event)}\n`)

    return event
  }
}
