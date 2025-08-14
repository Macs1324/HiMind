import { SlackClient } from './client';
import { normalizeSlackMessage, classifyMessage } from './formatters';
import { IntentDispatcher, PassiveDispatcher } from '@/core/ports/messaging';
import { SlackEvent } from '@slack/bolt';

export class SlackIngestService {
  private client: SlackClient;
  private intentDispatcher: IntentDispatcher;
  private passiveDispatcher: PassiveDispatcher;

  constructor(
    botToken: string,
    intentDispatcher: IntentDispatcher,
    passiveDispatcher: PassiveDispatcher
  ) {
    this.client = new SlackClient(botToken);
    this.intentDispatcher = intentDispatcher;
    this.passiveDispatcher = passiveDispatcher;
  }

  async backfillPublicChannels() {
    try {
      console.log('Starting backfill of public channels...');
      
      // Get all public channels
      const channels = await this.client.listChannels(['public_channel']);
      
      for (const channel of channels) {
        if (!channel.id) continue;
        
        try {
          // Join the channel if not already a member
          await this.client.joinChannel(channel.id);
          
          // Fetch channel history with pagination to get ALL messages
          let allMessages: SlackEvent[] = [];
          let oldestTs: string | undefined;
          let hasMore = true;
          
          while (hasMore) {
            const messages = await this.client.fetchHistory(channel.id, oldestTs, undefined, 1000);
            allMessages.push(...messages);
            
            // Check if there are more messages to fetch
            hasMore = messages.length === 1000;
            if (hasMore && messages.length > 0) {
              // Use the timestamp of the oldest message as the 'oldest' parameter for next fetch
              const lastMessage = messages[messages.length - 1] as any;
              if (lastMessage?.ts) {
                oldestTs = lastMessage.ts;
              }
            }
          }
          
          console.log(`Processing ${allMessages.length} messages from #${channel.name || channel.id}`);
          
          // Debug: Check for truncated messages
          let truncatedCount = 0;
          for (const message of allMessages) {
            const messageAny = message as any;
            if (messageAny.text && messageAny.text.endsWith('...')) {
              truncatedCount++;
              console.warn(`⚠️  Truncated message detected in #${channel.name || channel.id}: "${messageAny.text.substring(0, 100)}..."`);
            }
          }
          if (truncatedCount > 0) {
            console.warn(`⚠️  Found ${truncatedCount} potentially truncated messages in #${channel.name || channel.id}`);
          }
          
          for (const message of allMessages) {
            // Skip bot messages - handle different message types safely
            const messageAny = message as SlackEvent;
            if ((messageAny as any).subtype === 'bot_message') continue;
            
            const normalized = normalizeSlackMessage(messageAny, 'channel');
            const classification = classifyMessage(messageAny, 'channel');
            
            if (classification === 'passive') {
              await this.passiveDispatcher.ingestPassiveMessage(normalized);
            }
          }
          
          // Process threads for messages that have them
          for (const message of allMessages) {
            const messageAny = message as SlackEvent;
            const threadTs = (messageAny as any).thread_ts;
            if (threadTs && threadTs !== (messageAny as any).ts) {
              const threadMessages = await this.client.fetchThread(channel.id, threadTs);
              
              for (const threadMsg of threadMessages) {
                // Skip bot messages in threads
                const threadMsgAny = threadMsg as SlackEvent;
                if ((threadMsgAny as any).subtype === 'bot_message') continue;
                
                const normalized = normalizeSlackMessage(threadMsgAny, 'channel');
                await this.passiveDispatcher.ingestPassiveMessage(normalized);
              }
            }
          }
          
        } catch (error) {
          console.error(`Error processing channel ${channel.name || channel.id}:`, error);
        }
      }
      
      console.log('Backfill completed');
    } catch (error) {
      console.error('Error during backfill:', error);
      throw error;
    }
  }

  async processLiveMessage(event: SlackEvent, conversationType: 'channel' | 'group' | 'im' | 'mpim') {
    try {
      const normalized = normalizeSlackMessage(event, conversationType);
      const classification = classifyMessage(event, conversationType);
      
      if (classification === 'intent') {
        await this.intentDispatcher.handleIntentMessage(normalized);
      } else {
        await this.passiveDispatcher.ingestPassiveMessage(normalized);
      }
    } catch (error) {
      console.error('Error processing live message:', error);
      throw error;
    }
  }

  async processUpdateOrDelete(event: SlackEvent, conversationType: 'channel' | 'group' | 'im' | 'mpim') {
    try {
      const normalized = normalizeSlackMessage(event, conversationType);
      
      if (this.passiveDispatcher.handleUpdateOrDelete) {
        await this.passiveDispatcher.handleUpdateOrDelete(normalized);
      }
    } catch (error) {
      console.error('Error processing update/delete:', error);
      throw error;
    }
  }
}
