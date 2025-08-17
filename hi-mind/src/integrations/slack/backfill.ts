/**
 * Slack Historical Message Backfill
 * Automatically syncs missed messages when the app starts
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { WebClient } from "@slack/web-api";
import { getCurrentOrganization } from "@/lib/organization";
import { getSupabaseClient } from "@/lib/database";
import { getKnowledgeEngine } from "@/core/knowledge-engine-singleton";

export class SlackBackfill {
  private client: WebClient;

  constructor(botToken: string) {
    this.client = new WebClient(botToken);
  }

  /**
   * Run backfill for all channels
   */
  async runBackfill(): Promise<void> {
    console.log("🔄 [SLACK BACKFILL] Starting historical message sync...");
    
    const org = await getCurrentOrganization();
    if (!org) {
      console.log("⏭️ [SLACK BACKFILL] No organization found, skipping backfill");
      return;
    }

    try {
      // Get all channels
      const channels = await this.getChannels();
      console.log(`📋 [SLACK BACKFILL] Found ${channels.length} channels to sync`);

      for (const channel of channels) {
        await this.backfillChannel(channel.id, channel.name, org.id);
      }

      console.log("✅ [SLACK BACKFILL] Historical sync completed");
    } catch (error) {
      console.error("❌ [SLACK BACKFILL] Failed:", error);
    }
  }

  /**
   * Backfill messages for a specific channel
   */
  private async backfillChannel(channelId: string, channelName: string, organizationId: string): Promise<void> {
    try {
      // Find the latest message timestamp we have for this channel
      const latestTimestamp = await this.getLatestMessageTimestamp(channelId, organizationId);
      
      console.log(`📡 [SLACK BACKFILL] Syncing channel #${channelName} since ${latestTimestamp ? new Date(parseFloat(latestTimestamp) * 1000).toISOString() : 'beginning'}`);

      // Fetch messages from Slack
      const messages = await this.fetchMessagesAfter(channelId, latestTimestamp);
      
      if (messages.length === 0) {
        console.log(`✅ [SLACK BACKFILL] Channel #${channelName} is up to date`);
        return;
      }

      console.log(`📥 [SLACK BACKFILL] Processing ${messages.length} messages from #${channelName}`);

      // Process each message
      let processed = 0;
      for (const message of messages) {
        if (message.text && message.user && message.ts) {
          await this.processMessage(message, channelId, organizationId);
          processed++;
        }
      }

      console.log(`✅ [SLACK BACKFILL] Processed ${processed} messages from #${channelName}`);
    } catch (error) {
      console.error(`❌ [SLACK BACKFILL] Failed to backfill channel #${channelName}:`, error);
    }
  }

  /**
   * Get the timestamp of the latest message we have stored for a channel
   */
  private async getLatestMessageTimestamp(channelId: string, organizationId: string): Promise<string | null> {
    const supabase = getSupabaseClient(true);
    
    const { data } = await supabase
      .from('knowledge_sources')
      .select('external_id')
      .eq('organization_id', organizationId)
      .eq('platform', 'slack')
      .like('external_id', `${channelId}_%`)
      .order('platform_created_at', { ascending: false })
      .limit(1)
      .single();

    if (!data) return null;

    // Extract timestamp from external_id format: "C123456_1234567890.123456"
    const timestamp = data.external_id.split('_')[1];
    return timestamp;
  }

  /**
   * Fetch messages from Slack after a given timestamp
   */
  private async fetchMessagesAfter(channelId: string, afterTimestamp: string | null): Promise<Record<string, unknown>[]> {
    const messages: Record<string, unknown>[] = [];
    let cursor: string | undefined;
    const limit = 100; // Slack's max per request

    do {
      const result = await this.client.conversations.history({
        channel: channelId,
        limit,
        cursor,
        oldest: afterTimestamp || '0', // If no timestamp, get all messages
        inclusive: false, // Don't include the exact timestamp (we already have it)
      });

      if (result.messages) {
        // Filter out bot messages and system messages
        const userMessages = result.messages.filter(msg => 
          msg.type === 'message' && 
          msg.user && 
          !msg.bot_id &&
          msg.text &&
          msg.text.length > 10 // Only meaningful messages
        );
        
        messages.push(...(userMessages as any));
      }

      cursor = result.response_metadata?.next_cursor;
    } while (cursor);

    // Sort by timestamp (oldest first) for proper processing order
    return messages.sort((a: any, b: any) => parseFloat(a.ts) - parseFloat(b.ts));
  }

  /**
   * Get all channels the bot has access to
   */
  private async getChannels(): Promise<Array<{ id: string; name: string }>> {
    const channels: Array<{ id: string; name: string }> = [];
    let cursor: string | undefined;

    do {
      const result = await this.client.conversations.list({
        types: 'public_channel,private_channel',
        exclude_archived: true,
        cursor,
      });

      if (result.channels) {
        const accessibleChannels = result.channels
          .filter(channel => channel.is_member || channel.is_private)
          .map(channel => ({
            id: channel.id!,
            name: channel.name || 'unknown'
          }));
        
        channels.push(...accessibleChannels);
      }

      cursor = result.response_metadata?.next_cursor;
    } while (cursor);

    return channels;
  }

  /**
   * Process a single message through our knowledge engine
   */
  private async processMessage(message: Record<string, unknown>, channelId: string, organizationId: string): Promise<void> {
    try {
      // Create message-specific Slack URL with timestamp
      const messageUrl = `https://himindworkspace.slack.com/archives/${channelId}/p${(message as any).ts.replace('.', '')}`;
      
      await getKnowledgeEngine().ingestKnowledgeSource({
        platform: 'slack',
        sourceType: 'slack_message',
        externalId: `${channelId}_${(message as any).ts}`,
        externalUrl: messageUrl,
        content: (message as any).text,
        authorExternalId: (message as any).user,
        platformCreatedAt: new Date(parseFloat((message as any).ts) * 1000).toISOString()
      }, organizationId);
    } catch (error) {
      // Log but don't throw - continue processing other messages
      console.error(`⚠️ [SLACK BACKFILL] Failed to process message ${(message as any).ts}:`, error);
    }
  }
}