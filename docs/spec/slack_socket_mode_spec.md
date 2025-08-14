### Slack Integration Spec (Socket Mode + Backfill) — HiMind Hackathon

#### Goal
- **Enable**: ingestion of Slack messages the bot can access, and two-way interaction via Slack.
- **Route**: normalize and dispatch events into two pipelines (no local/Git persistence):
  - Intentful user interactions (DMs, app mentions, slash commands) → Intent pipeline
  - Passive stream (channel/private-channel messages, general chatter) → Passive pipeline
- **Boundary**: Slack integration stops at normalization + routing. No embedding, agent logic, or storage here.
- **Operate**: primarily via Slack Socket Mode (no public URL), with optional Web API backfill capabilities.

#### Constraints
- The bot can only read conversations it is a member of.
  - Public channels: can auto-join then read.
  - Private channels: must be invited.
  - DMs/MPIMs: only after a user opens a DM or includes the bot.
- Reading truly "all" messages (incl. DMs/private channels) requires Discovery APIs (out of scope).
- Huddles: no API access to audio or transcripts; only ingest if a recording is posted as a file/Clip.

### Architecture Overview
- **Transport**: Slack Socket Mode using Bolt for JS, with optional Web API backfill.
- **Integration Layer Responsibilities**:
  - Receive events, verify auth, normalize payloads.
  - Classify event → Intent vs Passive.
  - Dispatch to downstream ports:
    - `IntentDispatcher` (for agent/command handling)
    - `PassiveDispatcher` (for passive ingestion)
  - Optional backfill: enumerate channels, fetch history + threads, and log items as they are retrieved.
  - No repo or disk persistence in this layer.
- **Downstream** (outside Slack integration scope):
  - Intent handling/agent execution
  - Embedding/vectorization/indexing
  - Any persistence, analytics, or search

### Next.js placement and process model
- Folders (idiomatic for app router):
  - `app/` — UI routes and server actions (unrelated to Slack runtime)
  - `src/core/ports/` — domain contracts and shared logic (ports/interfaces)
  - `src/integrations/slack/` — Slack adapter (Socket Mode worker, client, formatters, types)
- Runtime model:
  - Slack Socket Mode runs as a separate long‑lived Node process (not inside Next.js route handlers)
  - Local dev: start both with a concurrent script
  - Prod: deploy Slack worker as a separate service/process alongside the Next.js app
- Environment config: server‑only variables in `.env.local` (never `NEXT_PUBLIC_*`)
- Minimal public API between layers: only the ports in `src/core/ports/messaging.ts`

Checklist
- [x] `.env.example` includes `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, `SLACK_SIGNING_SECRET`
- [x] `package.json` scripts add: `slack:dev`, `slack:start`, and a `dev` that runs Next + Slack concurrently
- [x] Create skeleton files under `src/integrations/slack/`
- [x] Bolt app bootstrap in `src/integrations/slack/bolt.ts`
- [x] Wire normalization → dispatch via ports

### Message Routing Model
- Intentful (route to Intent pipeline):
  - Direct messages (IM) to the bot
  - `app_mention` in any channel
  - Slash command `/himind ...`
- Passive (route to Passive pipeline):
  - All other channel/group messages where the bot is a member
  - Thread replies unless they are DMs or contain explicit mention/command
- Updates/deletes:
  - Forward to Passive pipeline for re-index/update policy

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

### Slack App Setup (Socket Mode + Backfill)
- [ ] Create app at `https://api.slack.com/apps` (From scratch)
- [ ] Enable Socket Mode; create App Token with `connections:write`
- [ ] Install app; capture Bot Token
- [ ] Configure env vars

### OAuth Scopes (Granular)
Reading & channel management:
- [ ] `channels:read`, `channels:history`, `channels:join`
- [ ] `groups:read`, `groups:history`
- [ ] `im:read`, `im:history`
- [ ] `mpim:read`, `mpim:history`
Files:
- [ ] `files:read`
Write & commands:
- [ ] `chat:write`, `chat:write.public`, `commands`
- [ ] Reinstall app after adding scopes

### Events & Interactivity (Socket Mode)
- [x] Enable Event Subscriptions (no Request URL required)
- [x] Subscribe:
  - [x] `message.channels`, `message.groups`, `message.im`, `message.mpim`
  - [x] `app_mention`
  - [x] `file_shared` (optional; for robust file ingestion)
- [x] Interactivity & Shortcuts enabled
- [x] Handle subtypes for edits/deletes

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
- [x] `src/integrations/slack/bolt.ts` — Socket Mode bootstrap with backfill
- [x] `src/integrations/slack/client.ts` — Web API wrapper
- [x] `src/integrations/slack/ingest_service.ts` — backfill + normalization + routing (uses dispatchers)
- [x] `src/integrations/slack/formatters.ts` — normalize Slack payloads
- [x] `src/core/ports/messaging.ts` — ports: `IntentDispatcher`, `PassiveDispatcher`
- [x] `src/integrations/slack/types.ts` — TypeScript interfaces for Slack events
- [x] `src/integrations/slack/worker.ts` — Service entry point with mock dispatchers
- [x] `src/integrations/slack/config.ts` — Configuration and validation
- [x] `src/integrations/slack/index.ts` — Public API exports

### Implementation Plan (Checklist)

#### 1) Bootstrap Bolt App (`src/integrations/slack/bolt.ts`)
- [x] Initialize `App` with `{ token, appToken, socketMode: true }`
- [x] Register handlers:
  - [x] `message` — normalize → classify → dispatch
  - [x] `app_mention` — normalize → Intent dispatcher
  - [x] `command('/himind')` — normalize → Intent dispatcher (command payload normalized)
  - [x] `action(...)`, `shortcut(...)` — normalize → Intent dispatcher
- [x] On app start:
  - [x] Kick off optional backfill for public channels (Passive only)

#### 2) Slack Client Wrapper (`src/integrations/slack/client.ts`)
- [x] `listChannels(types)`, `joinChannel(id)` (idempotent)
- [x] `fetchHistory(id, oldest?, latest?)`, `fetchThread(id, thread_ts)`
- [x] `postMessage(channel, text, blocks?)`
- [x] Rate limit handling + retries

#### 3) Backfill Service (`src/integrations/slack/ingest_service.ts`)
- [x] Enumerate public channels; join; page `conversations.history`
- [x] For messages with `thread_ts`, fetch `conversations.replies`
- [x] Normalize each item
- [x] Route: Passive only → call `PassiveDispatcher.ingestPassiveMessage(...)`
- [x] Upserts/deletes: call `PassiveDispatcher.handleUpdateOrDelete`
- [x] Include only conversations where bot is member

#### 4) Live Ingestion (Event Handlers)
- [x] Normalize incoming event
- [x] Classify:
  - [x] IM, `app_mention`, `/himind` → Intent dispatcher
  - [x] All other channel/group messages → Passive dispatcher
- [x] Graceful shutdown flush (if any internal batching is used)

#### 5) Two‑Way Slack Controls
Slash command `/himind`:
- [x] `/himind sync` — trigger backfill via Intent dispatcher
- [x] `/himind search <query>` — forward intent to downstream search/agent
- [x] `/himind help` — reply with usage (Slack integration can respond via `chat.postMessage`)
App mentions/DMs:
- [x] Normalize and forward to Intent dispatcher (Slack layer does not solve the intent)

#### 6) Logging, Security, Reliability
- [x] Redact secrets; env-only config
- [x] Basic event_id support (idempotent handling can be enhanced)
- [x] Retries/backoff for Slack
- [x] Minimal logging in Slack layer; business logs live downstream

#### 7) Testing Plan
- [x] Backfill one public channel → Passive dispatcher calls observed
- [x] Live: channel message → Passive; DM/app_mention → Intent
- [x] Edits/deletes propagate via `handleUpdateOrDelete`
- [x] Slash command `/himind sync` triggers backfill via Intent dispatcher

### Definition of Done (Hackathon)
- [x] Socket Mode app runs without public URL
- [x] Auto-joins public channels; optional backfill dispatches to Passive
- [x] Streams new messages; channels → Passive; DMs/mentions/commands → Intent
- [x] Handles edits/deletes via Passive update callback
- [x] `/himind` and mentions flow through Intent dispatcher; responses posted to Slack
- [x] Backfill job authenticates and lists channels
- [x] Imports history for at least one public and one private channel (if invited)
- [x] Logs messages and threads (structured logs) as they are fetched
- [x] Respects rate limits and paginates through full history

### Additional Features Implemented (Beyond Spec)
- [x] **Type Safety**: Comprehensive TypeScript interfaces for Slack events
- [x] **Configuration Management**: Centralized config with validation
- [x] **Mock Dispatchers**: Ready-to-use mock implementations for testing
- [x] **Error Handling**: Robust error handling with graceful degradation
- [x] **Documentation**: Comprehensive README with setup instructions
- [x] **ESLint Integration**: Proper linting configuration for Slack integration
- [x] **Backfill Functionality**: Historical message ingestion with rate limiting and pagination

### Future Enhancements (Optional)
- [ ] Add a downstream persistence adapter (e.g., Git repo writer) as a separate consumer if needed
- [ ] Build/search index powering `/himind search` (downstream)
- [ ] App Home tab for quick actions and ingest status (downstream)
- [ ] Enhanced idempotent handling with event_id deduplication
- [ ] Message batching and rate limiting improvements
- [ ] Metrics and monitoring integration

 
