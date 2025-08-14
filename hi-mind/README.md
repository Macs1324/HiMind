# HiMind

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Features

- **Slack Integration**: Real-time message ingestion and processing via Socket Mode
- **Message Classification**: Automatic routing of messages to Intent or Passive pipelines
- **Historical Backfill**: Process existing channel messages
- **Modern UI**: Built with Next.js 15 and React 19

## Getting Started

### Prerequisites

1. **Slack App Setup**: You'll need to create a Slack app with Socket Mode enabled
2. **Environment Variables**: Configure your Slack tokens and secrets

### Environment Setup

1. Copy the environment template:
   ```bash
   cp .env.example .env.local
   ```

2. Fill in your Slack credentials:
   ```bash
   SLACK_BOT_TOKEN=xoxb-your-bot-token-here
   SLACK_APP_TOKEN=xapp-your-app-token-here
   SLACK_SIGNING_SECRET=your-signing-secret-here
   ```

### Running the Application

Start both the Next.js app and Slack service:

```bash
npm run dev
```

This will run:
- Next.js development server on [http://localhost:3000](http://localhost:3000)
- Slack integration service in Socket Mode

### Slack Service Only

If you only want to run the Slack service:

```bash
npm run slack:dev
```

## Slack App Setup

### Initial Setup (Recommended: App Manifest)

The fastest way to set up your Slack app is using the provided app manifest:

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

### Manual Setup (Alternative)

If you prefer to configure manually:

1. **Create app at [https://api.slack.com/apps](https://api.slack.com/apps)**
2. **Enable Socket Mode**
3. **Create App Token with `connections:write` scope**
4. **Configure OAuth scopes**:
   - `channels:read`, `channels:history`, `channels:join`
   - `groups:read`, `groups:history`
   - `im:read`, `im:history`
   - `mpim:read`, `mpim:history`
   - `files:read`
   - `chat:write`, `chat:write.public`, `commands`
5. **Enable Event Subscriptions** (no Request URL needed)
6. **Subscribe to events**:
   - `message.channels`, `message.groups`, `message.im`, `message.mpim`
   - `app_mention`
   - `file_shared`
7. **Enable Interactivity & Shortcuts**
8. **Create slash command** `/himind`

### Required Tokens

After creating the app, you need these three values:

1. **Bot User OAuth Token** (starts with `xoxb-`)
   - Go to "OAuth & Permissions" → Copy "Bot User OAuth Token"

2. **App-Level Token** (starts with `xapp-`)
   - Go to "Basic Information" → "App-Level Tokens" → Copy the token

3. **Signing Secret**
   - Go to "Basic Information" → "App Credentials" → Copy "Signing Secret"

### Install and Test

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

### Updating App Permissions and Configuration

**Yes, you can update the manifest and have the app update automatically!**

#### Method 1: Update Manifest and Redeploy

1. **Modify `slack-app-manifest.yml`** with your changes
2. **Go to your app in [https://api.slack.com/apps](https://api.slack.com/apps)**
3. **Click "App Manifest" in the left sidebar**
4. **Click "Update"**
5. **Paste the updated manifest content**
6. **Click "Update"**

**Important**: After updating the manifest, you may need to:
- **Reinstall the app** if you added new OAuth scopes
- **Reauthorize** if you changed bot permissions

#### Method 2: Manual Updates

You can also update individual settings manually:

- **OAuth Scopes**: Go to "OAuth & Permissions" → Add/remove scopes → Reinstall app
- **Event Subscriptions**: Go to "Event Subscriptions" → Add/remove events
- **Slash Commands**: Go to "Slash Commands" → Modify existing or add new
- **Interactivity**: Go to "Interactivity & Shortcuts" → Enable/disable features

#### Common Permission Updates

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

### Troubleshooting

**"Missing required environment variables"**
- Check your `.env.local` file exists
- Verify all three required variables are set

**"Invalid token format"**
- Bot token must start with `xoxb-`
- App token must start with `xapp-`

**"Connection failed"**
- Verify Socket Mode is enabled
- Check App Token has `connections:write` scope

**"Permission denied"**
- Reinstall the app after adding scopes
- Check all required OAuth scopes are added

## Slack Integration

The Slack integration provides:

- **Real-time message processing** from channels, DMs, and mentions
- **Automatic message classification** into Intent or Passive pipelines
- **Historical backfill** of existing channel messages
- **Slash commands** like `/himind sync` and `/himind search`
- **File handling** for shared documents and media
- **Official Slack types** for complete type safety and IntelliSense

### Message Classification

- **Intent Messages**: Direct interactions, mentions, commands → Intent pipeline
- **Passive Messages**: Channel chatter, files, updates → Passive pipeline

### Available Commands

- `/himind sync` - Trigger channel backfill
- `/himind search <query>` - Search for content
- `/himind help` - Show help message

For detailed setup instructions, see [Slack Integration README](src/integrations/slack/README.md).

## Development

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family from Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Architecture

```
Slack Events → Socket Mode → Message Classification → Intent/Passive Pipelines
     ↓
Next.js App (UI & Server Actions)
     ↓
Supabase (Database & Auth)
```

The application follows a clean architecture pattern with:
- **Integration Layer**: Slack adapter with Socket Mode
- **Core Layer**: Message processing and routing logic
- **UI Layer**: Next.js app with React components
- **Data Layer**: Supabase for persistence and authentication
