# Slack Integration

This module provides a complete Slack integration using Socket Mode for HiMind. It handles both live message ingestion and historical backfill, routing messages to appropriate pipelines based on their classification.

## Features

- **Socket Mode**: No public URL required, runs entirely via Slack's Socket Mode
- **Message Classification**: Automatically routes messages to Intent or Passive pipelines
- **Auto-join Channels**: Automatically joins public channels and processes messages
- **Historical Backfill**: Can backfill existing channel messages
- **File Support**: Handles file shared events
- **Slash Commands**: Supports `/himind` commands for manual operations
- **Graceful Shutdown**: Handles SIGINT/SIGTERM signals properly

## Setup

### 1. Environment Variables

Create a `.env.local` file with the following variables:

```bash
# Required
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_APP_TOKEN=xapp-your-app-token-here
SLACK_SIGNING_SECRET=your-signing-secret-here

# Optional (with defaults)
SLACK_AUTO_JOIN_CHANNELS=true
SLACK_BACKFILL_ENABLED=true
SLACK_BACKFILL_DELAY=5000
SLACK_MAX_BACKFILL_MESSAGES=100
SLACK_RATE_LIMIT_DELAY=1000
```

### 2. Slack App Setup (Recommended: App Manifest)

The fastest and most reliable way to set up your Slack app is using the provided app manifest:

1. **Go to [https://api.slack.com/apps](https://api.slack.com/apps)**
2. **Click "Create New App"**
3. **Choose "From an app manifest"**
4. **Select your workspace**
5. **Copy and paste the contents of `slack-app-manifest.yml`**
6. **Click "Create"**

The manifest automatically configures:
- ✅ All required OAuth scopes
- ✅ Socket Mode enabled
- ✅ Event subscriptions (message.channels, app_mention, etc.)
- ✅ Slash command `/himind`
- ✅ Interactivity enabled
- ✅ Bot user with proper permissions

### 3. Manual Setup (Alternative)

If you prefer to configure manually or need to modify specific settings:

1. **Create a new Slack app** at [https://api.slack.com/apps](https://api.slack.com/apps)
2. **Enable Socket Mode**
3. **Create an App Token** with `connections:write` scope
4. **Install the app** to your workspace
5. **Configure OAuth scopes**:
   - **Reading & Channel Management**:
     - `channels:read`, `channels:history`, `channels:join`
     - `groups:read`, `groups:history`
     - `im:read`, `im:history`
     - `mpim:read`, `mpim:history`
   - **Files**:
     - `files:read`
   - **Write & Commands**:
     - `chat:write`, `chat:write.public`, `commands`
   - **App Mentions** (if not using manifest):
     - `app_mentions:read`
     - `users:read`
6. **Enable Event Subscriptions** (no Request URL needed for Socket Mode)
7. **Subscribe to events**:
   - `message.channels`, `message.groups`, `message.im`, `message.mpim`
   - `app_mention`
   - `file_shared`
8. **Enable Interactivity & Shortcuts**
9. **Create slash command** `/himind`

**Important**: Reinstall the app after adding scopes

## Required Tokens

After creating the app (either via manifest or manually), you need these three values:

1. **Bot User OAuth Token** (starts with `xoxb-`)
   - Go to "OAuth & Permissions" → Copy "Bot User OAuth Token"

2. **App-Level Token** (starts with `xapp-`)
   - Go to "Basic Information" → "App-Level Tokens" → Copy the token

3. **Signing Secret**
   - Go to "Basic Information" → "App Credentials" → Copy "Signing Secret"

## Install and Test

1. **Install the app to your workspace**
   - Go to "Install App" → "Install to Workspace" → Authorize

2. **Create `.env.local` with your tokens**
   ```bash
   SLACK_BOT_TOKEN=xoxb-your-bot-token-here
   SLACK_APP_TOKEN=xapp-your-app-token-here
   SLACK_SIGNING_SECRET=your-signing-secret-here
   ```

3. **Test the bot**
   ```bash
   npm run slack:dev
   ```

4. **Try slash commands**
   - `/himind help`
   - `/himind sync`
   - `/himind search hello`

## Updating App Permissions and Configuration

### Method 1: Update Manifest and Redeploy (Recommended)

1. **Modify `slack-app-manifest.yml`** with your changes
2. **Go to your app** in [https://api.slack.com/apps](https://api.slack.com/apps)
3. **Click "App Manifest"** in the left sidebar
4. **Click "Update"**
5. **Paste the updated manifest content**
6. **Click "Update"**

**Important**: After updating the manifest, you may need to:
- **Reinstall the app** if you added new OAuth scopes
- **Reauthorize** if you changed bot permissions

### Method 2: Manual Updates

You can also update individual settings manually:

- **OAuth Scopes**: Go to "OAuth & Permissions" → Add/remove scopes → Reinstall app
- **Event Subscriptions**: Go to "Event Subscriptions" → Add/remove events
- **Slash Commands**: Go to "Slash Commands" → Modify existing or add new
- **Interactivity**: Go to "Interactivity & Shortcuts" → Enable/disable features

### Common Permission Updates

**Adding new OAuth scopes:**
1. Update manifest or add manually
2. **Reinstall app** (required for new scopes)
3. Reauthorize in workspace

**Adding new event subscriptions:**
1. Update manifest or add manually
2. No reinstall needed
3. App starts receiving new events immediately

**Adding new slash commands:**
1. Update manifest or add manually
2. No reinstall needed
3. Commands available immediately

## Usage

### Running the Service

```bash
# Development (with Next.js)
npm run dev

# Slack service only
npm run slack:dev

# Production
npm run slack:start
```

### Available Commands

- `/himind sync` - Trigger channel backfill
- `/himind search <query>` - Search for content
- `/himind help` - Show help message

### Message Classification

**Intent Messages** (routed to Intent pipeline):
- Direct messages to the bot
- App mentions (`@himind`)
- Slash commands (`/himind`)
- Interactive components and shortcuts

**Passive Messages** (routed to Passive pipeline):
- Channel messages where the bot is a member
- Thread replies
- File shared events
- Message updates and deletes

## Architecture

```
Slack Events → Bolt App → Message Classification → Dispatchers
                                                    ↓
                                            Intent/Passive Pipelines
```

### Components

- **`SlackBoltApp`**: Main Bolt application with event handlers
- **`SlackIngestService`**: Handles message processing and routing
- **`SlackClient`**: Wrapper for Slack Web API calls
- **`formatters.ts`**: Message normalization and classification
- **`worker.ts`**: Service entry point with mock dispatchers

### Type Safety

This integration uses **official Slack TypeScript types** from the `@slack/bolt` package:
- **`SlackEvent`** - Union type for all Slack events
- **`AppMentionEvent`** - App mention events
- **`FileShareMessageEvent`** - File sharing events
- **`MessageChangedEvent`** - Message edit events
- **`MessageDeletedEvent`** - Message deletion events

No custom type definitions are needed - we leverage the comprehensive types provided by Slack's official SDK.

### Integration Points

The service integrates with downstream components through two interfaces:

- **`IntentDispatcher`**: Handles user-initiated interactions
- **`PassiveDispatcher`**: Handles passive message ingestion

## Development

### Adding New Event Types

1. Add the event handler in `SlackBoltApp.setupEventHandlers()`
2. Update the classification logic in `formatters.ts` if needed
3. Test with the mock dispatchers

### Customizing Message Processing

Override the mock dispatchers in `worker.ts` with your actual implementations:

```typescript
class MyIntentDispatcher implements IntentDispatcher {
  async handleIntentMessage(message: NormalizedSlackMessage): Promise<void> {
    // Your intent handling logic
  }
}
```

## Testing

The service includes mock dispatchers that log all processed messages. Check the console output to verify:

- 🔵 Intent messages
- 🟢 Passive messages  
- 🟡 Update/delete events

## Troubleshooting

### Common Issues

1. **"Missing required environment variables"**: Check your `.env.local` file
2. **"Invalid token format"**: Ensure tokens start with `xoxb-` and `xapp-`
3. **"Connection failed"**: Verify your Slack app has Socket Mode enabled
4. **"Permission denied"**: Check OAuth scopes and app installation

### Logs

The service provides detailed logging for debugging:
- Message processing events
- Channel join attempts
- Backfill progress
- Error details with context

## Future Enhancements

- Persistent message storage
- Advanced search capabilities
- Analytics and metrics
- Multi-workspace support
- Message filtering and rules
