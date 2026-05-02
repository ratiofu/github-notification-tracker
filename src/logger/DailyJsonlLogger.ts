import { join } from "node:path";

import { LogEventSchema, type LogEvent } from "../domain/index.js";
import type { LogFileWriter, LogInput } from "./types.js";

export interface DailyJsonlLoggerInput {
  readonly directory: string;
  readonly now?: () => Date;
  readonly writer: LogFileWriter;
}

/** Validates log boundary records and appends them to date-partitioned JSONL files. */
export class DailyJsonlLogger {
  readonly #directory: string;
  readonly #now: () => Date;
  readonly #writer: LogFileWriter;

  constructor(input: DailyJsonlLoggerInput) {
    this.#directory = input.directory;
    this.#now = input.now ?? (() => new Date());
    this.#writer = input.writer;
  }

  async log(input: LogInput): Promise<LogEvent> {
    const event = LogEventSchema.parse({
      ...input,
      timestamp: input.timestamp ?? this.#now().toISOString(),
    });
    const path = join(this.#directory, `${event.timestamp.slice(0, 10)}.jsonl`);

    await this.#writer.appendTextFile(path, `${JSON.stringify(event)}\n`);

    return event;
  }
}
