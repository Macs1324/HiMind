### Slack Integration Spec (Socket Mode) — HiMind Hackathon

#### Goal
- **Enable**: ingestion of Slack messages the bot can access, and two-way interaction via Slack.
- **Route**: normalize and dispatch events into two pipelines (no local/Git persistence):
  - Intentful user interactions (DMs, app mentions, slash commands) → Intent pipeline
  - Passive stream (channel/private-channel messages, general chatter) → Passive pipeline
- **Boundary**: Slack integration stops at normalization + routing. No embedding, agent logic, or storage here.
- **Operate**: entirely via Slack Socket Mode (no public URL).

#### Constraints
- The bot can only read conversations it is a member of.
  - Public channels: can auto-join then read.
  - Private channels: must be invited.
  - DMs/MPIMs: only after a user opens a DM or includes the bot.
- Reading truly “all” messages (incl. DMs/private channels) requires Discovery APIs (out of scope).
- Huddles: no API access to audio or transcripts; only ingest if a recording is posted as a file/Clip.

### Architecture Overview
- **Transport**: Slack Socket Mode using Bolt for JS.
- **Integration Layer Responsibilities**:
  - Receive events, verify auth, normalize payloads.
  - Classify event → Intent vs Passive.
  - Dispatch to downstream ports:
    - `IntentDispatcher` (for agent/command handling)
    - `PassiveDispatcher` (for passive ingestion)
  - No repo or disk persistence in this layer.
- **Downstream** (outside Slack integration scope):
  - Intent handling/agent execution
  - Embedding/vectorization/indexing
  - Any persistence, analytics, or search

### Next.js placement and process model
- Folders (idiomatic for app router):
  - `app/` — UI routes and server actions (unrelated to Slack runtime)
  - `src/core/` — domain contracts and shared logic
  - `src/integrations/slack/` — Slack adapter (Socket Mode worker, client, formatters)
- Runtime model:
  - Slack Socket Mode runs as a separate long‑lived Node process (not inside Next.js route handlers)
  - Local dev: start both with a concurrent script
  - Prod: deploy Slack worker as a separate service/process alongside the Next.js app
- Environment config: server‑only variables in `.env.local` (never `NEXT_PUBLIC_*`)
- Minimal public API between layers: only the ports in `src/core/contracts.ts`

Checklist
- [ ] `.env.example` includes `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, `SLACK_SIGNING_SECRET`
- [ ] `package.json` scripts add: `slack:dev`, `slack:start`, and a `dev` that runs Next + Slack concurrently
- [ ] Create skeleton files under `src/integrations/slack/`
- [ ] Bolt app bootstrap in `src/integrations/slack/bolt.ts`
- [ ] Wire normalization → dispatch via ports

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

### Prerequisites & Secrets
- [ ] `SLACK_BOT_TOKEN` (`xoxb-...`)
- [ ] `SLACK_APP_TOKEN` (`xapp-...`, with `connections:write`)
- [ ] `SLACK_SIGNING_SECRET`

### Slack App Setup (Socket Mode)
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
- [ ] Enable Event Subscriptions (no Request URL required)
- [ ] Subscribe:
  - [ ] `message.channels`, `message.groups`, `message.im`, `message.mpim`
  - [ ] `app_mention`
  - [ ] `file_shared` (optional; for robust file ingestion)
- [ ] Interactivity & Shortcuts enabled
- [ ] Handle subtypes for edits/deletes

### Ports/Interfaces (to decouple Slack integration)
Define ports in `src/core/contracts.ts` (or `src/core/ports/messaging.ts`). The Slack integration depends on these interfaces and receives concrete implementations via DI.

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

### Project Structure (Proposed)
- [ ] `src/infra/integrations/slack/bolt.ts` — Socket Mode bootstrap
- [ ] `src/infra/integrations/slack/client.ts` — Web API wrapper
- [ ] `src/core/slack/ingest_service.ts` — backfill + normalization + routing (uses dispatchers)
- [ ] `src/core/slack/formatters.ts` — normalize Slack payloads
- [ ] `src/core/contracts.ts` — ports: `IntentDispatcher`, `PassiveDispatcher`

### Implementation Plan (Checklist)

#### 1) Bootstrap Bolt App (`src/infra/integrations/slack/bolt.ts`)
- [ ] Initialize `App` with `{ token, appToken, socketMode: true }`
- [ ] Register handlers:
  - [ ] `message` — normalize → classify → dispatch
  - [ ] `app_mention` — normalize → Intent dispatcher
  - [ ] `command('/himind')` — normalize → Intent dispatcher (command payload normalized)
  - [ ] `action(...)`, `shortcut(...)` — normalize → Intent dispatcher
- [ ] On app start:
  - [ ] Kick off optional backfill for public channels (Passive only)

#### 2) Slack Client Wrapper (`src/infra/integrations/slack/client.ts`)
- [ ] `listChannels(types)`, `joinChannel(id)` (idempotent)
- [ ] `fetchHistory(id, oldest?, latest?)`, `fetchThread(id, thread_ts)`
- [ ] `postMessage(channel, text, blocks?)`
- [ ] Rate limit handling + retries

#### 3) Backfill Service (`src/core/slack/ingest_service.ts`)
- [ ] Enumerate public channels; join; page `conversations.history`
- [ ] For messages with `thread_ts`, fetch `conversations.replies`
- [ ] Normalize each item
- [ ] Route: Passive only → call `PassiveDispatcher.ingestPassiveMessage(...)`
- [ ] Upserts/deletes: call `PassiveDispatcher.handleUpdateOrDelete`
- [ ] Include only conversations where bot is member

#### 4) Live Ingestion (Event Handlers)
- [ ] Normalize incoming event
- [ ] Classify:
  - [ ] IM, `app_mention`, `/himind` → Intent dispatcher
  - [ ] All other channel/group messages → Passive dispatcher
- [ ] Graceful shutdown flush (if any internal batching is used)

#### 5) Two‑Way Slack Controls
Slash command `/himind`:
- [ ] `/himind sync` — trigger backfill via Intent dispatcher
- [ ] `/himind search <query>` — forward intent to downstream search/agent
- [ ] `/himind help` — reply with usage (Slack integration can respond via `chat.postMessage`)
App mentions/DMs:
- [ ] Normalize and forward to Intent dispatcher (Slack layer does not solve the intent)

#### 6) Logging, Security, Reliability
- [ ] Redact secrets; env-only config
- [ ] Idempotent handling with Slack `event_id`
- [ ] Retries/backoff for Slack
- [ ] Minimal logging in Slack layer; business logs live downstream

#### 7) Testing Plan
- [ ] Backfill one public channel → Passive dispatcher calls observed
- [ ] Live: channel message → Passive; DM/app_mention → Intent
- [ ] Edits/deletes propagate via `handleUpdateOrDelete`
- [ ] Slash command `/himind sync` triggers backfill via Intent dispatcher

### Definition of Done (Hackathon)
- [ ] Socket Mode app runs without public URL
- [ ] Auto-joins public channels; optional backfill dispatches to Passive
- [ ] Streams new messages; channels → Passive; DMs/mentions/commands → Intent
- [ ] Handles edits/deletes via Passive update callback
- [ ] `/himind` and mentions flow through Intent dispatcher; responses posted to Slack

### Future Enhancements (Optional)
- [ ] Add a downstream persistence adapter (e.g., Git repo writer) as a separate consumer if needed
- [ ] Build/search index powering `/himind search` (downstream)
- [ ] App Home tab for quick actions and ingest status (downstream)

 
