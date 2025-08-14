### Slack Integration Spec (Backfill-focused via Web API + Optional Socket Mode) — HiMind Hackathon

#### Goal
- **Enable**: one-off and scheduled backfills of Slack messages/files the bot can access, and (optionally) two-way interaction.
- **Output (MVP)**: simply log each item as it is fetched; no downstream routing or storage.
- **Boundary**: Slack integration stops at logging for MVP. No embedding, agent logic, or storage here.
- **Operate**: primarily via Slack Web API for backfill. Socket Mode is optional (not required for MVP).

#### Constraints
- The bot can only read conversations it is a member of.
  - Public channels: can auto-join then read.
  - Private channels: must be invited.
  - DMs/MPIMs: only after a user opens a DM or includes the bot.
- Reading truly "all" messages (incl. DMs/private channels) requires Discovery APIs (out of scope).
- Huddles: no API access to audio or transcripts; only ingest if a recording is posted as a file/Clip.

### Architecture Overview
- **Transport**: Batch API ingestion using Slack Web API (`conversations.*`, `users.*`, `files.*`).
- **Integration Layer Responsibilities**:
  - Authenticate with bot token; enumerate channels where the bot is a member; join public channels if needed.
  - Fetch history and threads with pagination and retries; fetch file metadata as needed.
  - Log fetched items (structured logs). No disk persistence.
- **Downstream** (outside Slack integration scope):
  - Optional future consumers (indexing, storage) — not part of MVP

### Process model
- Backfill runs as a job/service that authenticates and pulls data in batches, then streams to the Passive pipeline.
- Can be invoked manually (CLI) or scheduled.
- Server‑only configuration values are loaded from environment variables.

Checklist
- [x] `.env.example` includes `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, `SLACK_SIGNING_SECRET`
- [x] `package.json` scripts add: `slack:dev`, `slack:start`, and a `dev` that runs Next + Slack concurrently
- [x] Create skeleton files under `src/integrations/slack/`
- [x] Bolt app bootstrap in `src/integrations/slack/bolt.ts`
- [x] Wire normalization → dispatch via ports

### Backfill Targets
- Public channels (where the bot can auto-join)
- Private channels (only if the bot is invited)
- Direct messages/MPIMs (only after the user opens a DM or includes the bot)
- Threads for messages with `thread_ts`
- Files metadata referenced in messages (if needed)

### Prerequisites & Secrets
- [x] `SLACK_BOT_TOKEN` (`xoxb-...`)
- [x] `SLACK_APP_TOKEN` (`xapp-...`, with `connections:write`)
- [x] `SLACK_SIGNING_SECRET`

### Slack App Setup
- [ ] Create app at `https://api.slack.com/apps` (From scratch)
- [ ] Install app; capture Bot Token
- [ ] Configure env vars

### OAuth Scopes (Granular)
Reading & channel management (backfill minimum):
- [ ] `channels:read`, `channels:history`, `channels:join`
- [ ] `groups:read`, `groups:history`
- [ ] `im:read`, `im:history`
- [ ] `mpim:read`, `mpim:history`
Files (optional):
- [ ] `files:read`
Write & commands (optional; not required for backfill-only):
- [ ] `chat:write`, `chat:write.public`, `commands`
- [ ] Reinstall app after adding scopes

### Events & Interactivity
Not required for backfill-only MVP. If slash commands are desired, enable Commands and Interactivity in the Slack App, and configure the `/himind` command.

### Ports/Interfaces (to decouple Slack integration)
Define ports in `src/core/ports/messaging.ts`. The Slack integration depends on these interfaces and receives concrete implementations via DI.

```ts
export type NormalizedSlackMessage = {
  platform: 'slack';
  conversationType: 'channel' | 'group' | 'im' | 'mpim';
  channelId: string;
  channelName?: string;
  ts: string;
  userId?: string;
  text?: string;
  blocks?: unknown;
  files?: Array<{
    id: string;
    name?: string;
    mimetype?: string;
    filetype?: string;
    size?: number;
    permalink?: string;
    urlPrivate?: string;
    urlPrivateDownload?: string;
  }>;
  threadTs?: string;
  parentTs?: string;
  permalink?: string;
  subtype?: string;
  eventId?: string;
  raw: unknown;
};

export interface IntentDispatcher {
  handleIntentMessage(message: NormalizedSlackMessage): Promise<void>;
}

export interface PassiveDispatcher {
  ingestPassiveMessage(message: NormalizedSlackMessage): Promise<void>;
  handleUpdateOrDelete?(message: NormalizedSlackMessage): Promise<void>;
}
```

### Project Structure (Implemented)
- [x] `src/integrations/slack/bolt.ts` — Socket Mode bootstrap
- [x] `src/integrations/slack/client.ts` — Web API wrapper
- [x] `src/integrations/slack/ingest_service.ts` — backfill + normalization + routing (uses dispatchers)
- [x] `src/integrations/slack/formatters.ts` — normalize Slack payloads
- [x] `src/core/ports/messaging.ts` — ports: `IntentDispatcher`, `PassiveDispatcher`
- [x] `src/integrations/slack/types.ts` — TypeScript interfaces for Slack events
- [x] `src/integrations/slack/worker.ts` — Service entry point with mock dispatchers
- [x] `src/integrations/slack/config.ts` — Configuration and validation
- [x] `src/integrations/slack/index.ts` — Public API exports

### Implementation Plan (Checklist)

#### 1) Backfill Job
- [ ] Enumerate public channels; join if needed; page `conversations.history`
- [ ] For messages with `thread_ts`, fetch `conversations.replies`
- [ ] Include only conversations where bot is a member (private channels require invite)
- [ ] Optionally fetch file metadata referenced in messages

#### 2) Slack Client Wrapper
- [ ] `listChannels(types)`, `joinChannel(id)` (idempotent)
- [ ] `fetchHistory(id, oldest?, latest?)`, `fetchThread(id, thread_ts)`
- [ ] Rate limit handling + retries

#### 3) Logging (MVP)
- [ ] Log each fetched message/thread (and optional file metadata) as it is retrieved
- [ ] Use structured logging (e.g., JSON) including channel, ts, user, and text

#### 4) Scheduling & Ops
- [ ] Support manual run (CLI) and scheduled runs
- [ ] Graceful shutdown flush (if any internal batching is used)

#### 5) Two‑Way Slack Controls
- [ ] Slash command `/himind`:
  - [ ] `/himind sync` — trigger backfill
  - [ ] `/himind search <query>` — forward intent to downstream search/agent
  - [ ] `/himind help` — reply with usage

#### 6) Logging, Security, Reliability
- [ ] Redact secrets; env-only config
- [ ] Retries/backoff for Slack Web API
- [ ] Minimal logging in Slack layer; business logs live downstream

#### 7) Testing Plan
- [ ] Backfill one public channel → Passive pipeline calls observed
- [ ] Backfill a private channel (after invite) → Passive pipeline calls observed
- [ ] Threads are included for messages with `thread_ts`

### Definition of Done (Hackathon)
- [ ] Backfill job authenticates and lists channels
- [ ] Imports history for at least one public and one private channel (if invited)
- [ ] Logs messages and threads (structured logs) as they are fetched
- [ ] Respects rate limits and paginates through full history

### Additional Features Implemented (Beyond Spec)
- [x] **Type Safety**: Comprehensive TypeScript interfaces for Slack events
- [x] **Configuration Management**: Centralized config with validation
- [x] **Mock Dispatchers**: Ready-to-use mock implementations for testing
- [x] **Error Handling**: Robust error handling with graceful degradation
- [x] **Documentation**: Comprehensive README with setup instructions
- [x] **ESLint Integration**: Proper linting configuration for Slack integration

### Future Enhancements (Optional)
- [ ] Add a downstream persistence adapter (e.g., Git repo writer) as a separate consumer if needed
- [ ] Build/search index powering `/himind search` (downstream)
- [ ] App Home tab for quick actions and ingest status (downstream)
- [ ] Enhanced idempotent handling with event_id deduplication
- [ ] Message batching and rate limiting improvements
- [ ] Metrics and monitoring integration

 
