# Architecture

## Domain Model

```mermaid
flowchart TD
  Config[AppConfig] --> Source[GitHubSourcePayloadWrapper]
  Source --> Mapper[Source mappers]
  Mapper --> Notification[LocalNotification]
  Mapper --> Raw[RawGitHubPayload]
  Notification --> PR[PullRequestMetadata]
  PR --> PRThread[PullRequestThread]
  PRThread --> Thread[NotificationThread]
  Notification --> Participants[Participants]
  TeamCache[TeamMembershipCache] --> Participants
  Participants --> FilterIndex[ParticipantFilterIndex]
  Notification --> ReadState[ReadState]
  PRThread --> SummarySnapshot[SummaryReadStateSnapshot]
  ReadState --> SummarySnapshot
  PRThread --> Render[RenderView]
  Notification --> Render
  ApiStatus[ApiStatus] --> Render
  Notification --> Debug[DebugNotificationView]
  Raw --> Debug
  Warnings[DebugWarning] --> Debug
  LogEvent[LogEvent] --> Logs[JSONL logs]
```

The domain layer separates boundary records from memory-only runtime models. Zod schemas validate config, GitHub payload wrappers, persistence records, and log/debug records. Internal render, API status, and filtering models use explicit TypeScript types so they can choose efficient runtime representations.
