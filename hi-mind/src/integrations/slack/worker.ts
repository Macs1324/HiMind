import { SlackBoltApp } from './bolt';
import { IntentDispatcher, PassiveDispatcher, NormalizedSlackMessage } from '@/core/ports/messaging';

// Try to load environment variables manually if they're not available
// if (!process.env.SLACK_BOT_TOKEN) {
//   try {
//     const fs = require('fs');
//     const path = require('path');
    
//     // Look for .env.local in project root
//     const envPath = path.join(process.cwd(), '.env.local');
//     console.log('🔍 Looking for .env.local at:', envPath);
    
//     if (fs.existsSync(envPath)) {
//       console.log('✅ .env.local file found');
//       const envContent = fs.readFileSync(envPath, 'utf8');
//       console.log('📄 .env.local content (first 200 chars):', envContent.substring(0, 200));
      
//       // Parse .env.local manually
//       const envVars = envContent.split('\n')
//         .filter((line: string) => line.trim() && !line.startsWith('#'))
//         .map((line: string) => line.split('='))
//         .filter((parts: string[]) => parts.length === 2)
//         .reduce((acc: Record<string, string>, [key, value]: [string, string]) => {
//           acc[key.trim()] = value.trim();
//           return acc;
//         }, {} as Record<string, string>);
      
//       console.log('🔑 Parsed environment variables:', Object.keys(envVars));
      
//       // Set process.env manually
//       Object.entries(envVars).forEach(([key, value]) => {
//         (process.env as any)[key] = value;
//       });
      
//       console.log('✅ Environment variables loaded manually');
//     } else {
//       console.log('❌ .env.local file not found');
//     }
//   } catch (error) {
//     console.log('⚠️ Error loading .env.local manually:', error);
//   }
// }

// Mock implementations for now - these will be replaced with real implementations later
class MockIntentDispatcher implements IntentDispatcher {
  async handleIntentMessage(message: NormalizedSlackMessage): Promise<void> {
    console.log('🔵 Intent message received:', {
      platform: message.platform,
      conversationType: message.conversationType,
      channelId: message.channelId,
      text: message.text?.substring(0, 100) + (message.text && message.text.length > 100 ? '...' : ''),
      userId: message.userId,
      ts: message.ts,
    });
  }
}

class MockPassiveDispatcher implements PassiveDispatcher {
  async ingestPassiveMessage(message: NormalizedSlackMessage): Promise<void> {
    console.log('🟢 Passive message ingested:', {
      platform: message.platform,
      conversationType: message.conversationType,
      channelId: message.channelId,
      text: message.text?.substring(0, 100) + (message.text && message.text.length > 100 ? '...' : ''),
      userId: message.userId,
      ts: message.ts,
    });
  }

  async handleUpdateOrDelete(message: NormalizedSlackMessage): Promise<void> {
    console.log('🟡 Update/Delete handled:', {
      platform: message.platform,
      conversationType: message.conversationType,
      channelId: message.channelId,
      subtype: message.subtype,
      ts: message.ts,
    });
  }
}

async function main() {
  // Load environment variables
  const botToken = process.env.SLACK_BOT_TOKEN;
  const appToken = process.env.SLACK_APP_TOKEN;
  const signingSecret = process.env.SLACK_SIGNING_SECRET;

  // Debug logging
  console.log('🔍 Environment Variable Debug:');
  console.log('================================');
  console.log('Current working directory:', process.cwd());
  console.log('Node environment:', process.env.NODE_ENV);
  console.log('All process.env keys:', Object.keys(process.env).filter(key => key.includes('SLACK')));
  console.log('');
  console.log('SLACK_BOT_TOKEN:', botToken ? `${botToken.substring(0, 10)}...` : 'UNDEFINED');
  console.log('SLACK_APP_TOKEN:', appToken ? `${appToken.substring(0, 10)}...` : 'UNDEFINED');
  console.log('SLACK_SIGNING_SECRET:', signingSecret ? `${signingSecret.substring(0, 10)}...` : 'UNDEFINED');
  console.log('================================');
  console.log('');

  if (!botToken || !appToken || !signingSecret) {
    console.error('❌ Missing required environment variables:');
    if (!botToken) console.error('- SLACK_BOT_TOKEN is missing');
    if (!appToken) console.error('- SLACK_APP_TOKEN is missing');
    if (!signingSecret) console.error('- SLACK_SIGNING_SECRET is missing');
    console.error('');
    console.error('🔧 Troubleshooting:');
    console.error('1. Check if .env.local exists in project root');
    console.error('2. Verify file permissions');
    console.error('3. Check for typos in variable names');
    console.error('4. Ensure no spaces around = signs');
    console.error('5. Restart the process after creating .env.local');
    console.error('');
    console.error('📁 Expected .env.local location:', process.cwd());
    process.exit(1);
  }

  // Create mock dispatchers
  const intentDispatcher = new MockIntentDispatcher();
  const passiveDispatcher = new MockPassiveDispatcher();

  // Create and start the Slack app
  const slackApp = new SlackBoltApp(
    botToken,
    appToken,
    signingSecret,
    intentDispatcher,
    passiveDispatcher
  );

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nReceived SIGINT, shutting down gracefully...');
    await slackApp.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\nReceived SIGTERM, shutting down gracefully...');
    await slackApp.stop();
    process.exit(0);
  });

  try {
    await slackApp.start();
  } catch (error) {
    console.error('Failed to start Slack app:', error);
    process.exit(1);
  }
}

// Run the worker
if (require.main === module) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}
