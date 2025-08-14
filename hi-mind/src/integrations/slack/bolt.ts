import { App } from '@slack/bolt';
import { SlackIngestService } from './ingest_service';
import { IntentDispatcher, PassiveDispatcher } from '@/core/ports/messaging';
import { SlackEvent, AppMentionEvent, FileShareMessageEvent, MessageChangedEvent, MessageDeletedEvent } from '@slack/bolt';

export class SlackBoltApp {
  private app: App;
  private ingestService: SlackIngestService;

  constructor(
    botToken: string,
    appToken: string,
    signingSecret: string,
    intentDispatcher: IntentDispatcher,
    passiveDispatcher: PassiveDispatcher
  ) {
    this.app = new App({
      token: botToken,
      appToken: appToken,
      signingSecret: signingSecret,
      socketMode: true,
    });

    this.ingestService = new SlackIngestService(botToken, intentDispatcher, passiveDispatcher);
    
    this.setupEventHandlers();
    this.setupCommandHandlers();
    this.setupActionHandlers();
  }

  private setupEventHandlers() {
    // Handle channel messages (including all subtypes)
    this.app.message(async ({ message, client }) => {
      try {
        const channelInfo = await client.conversations.info({ channel: message.channel! });
        const conversationType = this.getConversationType(channelInfo.channel!);
        
        // Handle different message subtypes
        const messageAny = message as any;
        
        if (messageAny.subtype === 'message_changed') {
          // Handle message edits
          await this.ingestService.processUpdateOrDelete(messageAny, conversationType);
        } else if (messageAny.subtype === 'message_deleted') {
          // Handle message deletions
          await this.ingestService.processUpdateOrDelete(messageAny, conversationType);
        } else {
          // Handle regular messages
          await this.ingestService.processLiveMessage(messageAny, conversationType);
        }
      } catch (error) {
        console.error('Error handling message event:', error);
      }
    });

    // Handle app mentions
    this.app.event('app_mention', async ({ event, say }) => {
      try {
        const channelInfo = await this.app.client.conversations.info({ channel: event.channel });
        const conversationType = this.getConversationType(channelInfo.channel!);
        
        await this.ingestService.processLiveMessage(event as unknown as SlackEvent, conversationType);
        
        // Respond to mention
        await say({
          text: 'Hello! I received your mention. Processing your request...',
          thread_ts: event.thread_ts || event.ts,
        });
      } catch (error) {
        console.error('Error handling app mention:', error);
      }
    });

    // Handle file shared events
    this.app.event('file_shared', async ({ event }) => {
      try {
        const channelInfo = await this.app.client.conversations.info({ channel: event.channel_id });
        const conversationType = this.getConversationType(channelInfo.channel!);
        
        await this.ingestService.processLiveMessage(event as unknown as SlackEvent, conversationType);
      } catch (error) {
        console.error('Error handling file shared event:', error);
      }
    });
  }

  private setupCommandHandlers() {
    // Handle /himind commands
    this.app.command('/himind', async ({ command, ack, say }) => {
      await ack();
      
      try {
        const args = command.text?.trim().split(' ') || [];
        const subcommand = args[0];
        
        switch (subcommand) {
          case 'sync':
            await say('Starting channel sync...');
            await this.ingestService.backfillPublicChannels();
            await say('Channel sync completed!');
            break;
            
          case 'search':
            const query = args.slice(1).join(' ');
            if (!query) {
              await say('Usage: /himind search <query>');
              return;
            }
            await say(`Searching for: "${query}"...`);
            // This will be handled by the intent dispatcher
            break;
            
          case 'help':
          default:
            await say(`Available commands:
• \`/himind sync\` - Sync all public channels
• \`/himind search <query>\` - Search for content
• \`/himind help\` - Show this help message`);
            break;
        }
        
        // Process the command through intent dispatcher
        const event = {
          ...command,
          type: 'command',
          command: '/himind',
        };
        await this.ingestService.processLiveMessage(event as unknown as SlackEvent, 'im');
        
      } catch (error) {
        console.error('Error handling /himind command:', error);
        await say('Sorry, there was an error processing your command.');
      }
    });
  }

  private setupActionHandlers() {
    // Handle interactive components
    this.app.action(/.*/, async ({ ack, body, client }) => {
      await ack();
      
      try {
        // Determine conversation type from the action
        let conversationType: 'channel' | 'group' | 'im' | 'mpim' = 'channel';
        
        if (body.channel?.id) {
          const channelInfo = await client.conversations.info({ channel: body.channel.id });
          conversationType = this.getConversationType(channelInfo.channel!);
        }
        
        await this.ingestService.processLiveMessage(body as unknown as SlackEvent, conversationType);
      } catch (error) {
        console.error('Error handling action:', error);
      }
    });

    // Handle shortcuts
    this.app.shortcut(/.*/, async ({ ack, body }) => {
      await ack();
      
      try {
        await this.ingestService.processLiveMessage(body as unknown as SlackEvent, 'im');
      } catch (error) {
        console.error('Error handling shortcut:', error);
      }
    });
  }

  private getConversationType(channel: any): 'channel' | 'group' | 'im' | 'mpim' {
    if (channel.is_im) return 'im';
    if (channel.is_mpim) return 'mpim';
    if (channel.is_private) return 'group';
    return 'channel';
  }

  async start() {
    try {
      await this.app.start();
      console.log('⚡️ Slack Bolt app is running!');
      
      // Start backfill after app is running
      setTimeout(async () => {
        try {
          await this.ingestService.backfillPublicChannels();
        } catch (error) {
          console.error('Error during initial backfill:', error);
        }
      }, 5000); // Wait 5 seconds after startup
      
    } catch (error) {
      console.error('Error starting Slack app:', error);
      throw error;
    }
  }

  async stop() {
    try {
      await this.app.stop();
      console.log('Slack Bolt app stopped');
    } catch (error) {
      console.error('Error stopping Slack app:', error);
    }
  }
}
