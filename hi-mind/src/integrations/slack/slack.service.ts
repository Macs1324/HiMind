import type { SlackRepository } from "./slack.repository";
import { KnowledgeEngine, type KnowledgeSource } from "@/core/knowledge-engine";
import { getCurrentOrganization } from "@/lib/organization";

export interface SlackService {
  handleMessage(channelId: string, userId: string, text: string, timestamp: string): Promise<void>;
  handleReaction(channelId: string, userId: string, reaction: string, timestamp: string): Promise<void>;
  handleMemberJoined(channelId: string, userId: string, timestamp: string): Promise<void>;
  handleMemberLeft(channelId: string, userId: string, timestamp: string): Promise<void>;
  handleSlashCommand(command: string, text: string, channelId: string, userId: string, userName: string): Promise<{
    success: boolean;
    action?: string;
    responseMessage?: string;
  }>;
  handleBackfillMessage(channelId: string, userId: string, text: string, timestamp: string): Promise<void>;
  handleBackfillThreadReply(channelId: string, userId: string, text: string, timestamp: string): Promise<void>;
  handleGenericEvent(eventType: string, channelId: string, userId: string, timestamp: string, data?: unknown): Promise<void>;
}

export class SlackServiceImpl implements SlackService {
  private knowledgeEngine = new KnowledgeEngine();

  constructor(private readonly repository: SlackRepository) {}

  async handleMessage(channelId: string, userId: string, text: string, timestamp: string): Promise<void> {
    // Log the message
    await this.repository.logMessage(channelId, userId, text, timestamp);
    
    // Process content through knowledge engine
    await this.processSlackContent({
      platform: 'slack',
      sourceType: 'slack_message',
      externalId: `${channelId}_${timestamp}`,
      externalUrl: `https://slack.com/channels/${channelId}`,
      content: text,
      authorExternalId: userId,
      platformCreatedAt: new Date(parseFloat(timestamp) * 1000).toISOString()
    });
  }

  async handleReaction(channelId: string, userId: string, reaction: string, timestamp: string): Promise<void> {
    // Log the reaction
    await this.repository.logReaction(channelId, userId, reaction, timestamp);
    
    // TODO: Add business logic here (e.g., analytics, notifications, etc.)
    // For now, just logging
  }

  async handleMemberJoined(channelId: string, userId: string, timestamp: string): Promise<void> {
    // Log the member join
    await this.repository.logMemberJoined(channelId, userId, timestamp);
    
    // TODO: Add business logic here (e.g., welcome messages, onboarding, etc.)
    // For now, just logging
  }

  async handleMemberLeft(channelId: string, userId: string, timestamp: string): Promise<void> {
    // Log the member leave
    await this.repository.logMemberLeft(channelId, userId, timestamp);
    
    // TODO: Add business logic here (e.g., cleanup, notifications, etc.)
    // For now, just logging
  }

  async handleSlashCommand(command: string, text: string, channelId: string, userId: string, userName: string): Promise<{
    success: boolean;
    action?: string;
    responseMessage?: string;
  }> {
    // Log the slash command
    await this.repository.logSlashCommand(command, text, channelId, userId, userName);

    // Handle /himind command
    if (command === "/himind") {
      const query = text?.trim() || "";

      // /himind sync → trigger backfill
      if (query.toLowerCase().startsWith("sync")) {
        const startMessage = `🔄 Starting Slack backfill...\n_Requested by <@${userId}>_`;
        
        return {
          success: true,
          action: "backfill_started",
          responseMessage: startMessage,
        };
      }

      // Default response for other queries
      const responseMessage = `🎯 **Query received:** "${query || "no query provided"}"\n\n_Requested by <@${userId}>_`;
      
      return {
        success: true,
        action: "query_processed",
        responseMessage,
      };
    }

    // Log other commands for debugging
    return {
      success: true,
      action: "ignored",
    };
  }

  async handleBackfillMessage(channelId: string, userId: string, text: string, timestamp: string): Promise<void> {
    // Log the backfill message
    await this.repository.logBackfillMessage(channelId, userId, text, timestamp);
    
    // Process backfilled content
    await this.processSlackContent({
      platform: 'slack',
      sourceType: 'slack_message',
      externalId: `${channelId}_${timestamp}_backfill`,
      externalUrl: `https://slack.com/channels/${channelId}`,
      content: text,
      authorExternalId: userId,
      platformCreatedAt: new Date(parseFloat(timestamp) * 1000).toISOString()
    });
  }

  async handleBackfillThreadReply(channelId: string, userId: string, text: string, timestamp: string): Promise<void> {
    // Log the backfill thread reply
    await this.repository.logBackfillThreadReply(channelId, userId, text, timestamp);
    
    // Process thread reply
    await this.processSlackContent({
      platform: 'slack',
      sourceType: 'slack_thread',
      externalId: `${channelId}_${timestamp}_thread`,
      externalUrl: `https://slack.com/channels/${channelId}`,
      content: text,
      authorExternalId: userId,
      platformCreatedAt: new Date(parseFloat(timestamp) * 1000).toISOString()
    });
  }

  async handleGenericEvent(eventType: string, channelId: string, userId: string, timestamp: string, data?: unknown): Promise<void> {
    // Log the generic event
    await this.repository.logEvent(eventType, channelId, userId, timestamp, data);
    
    // TODO: Add business logic here (e.g., event processing, analytics, etc.)
    // For now, just logging
  }

  private async processSlackContent(source: KnowledgeSource): Promise<void> {
    try {
      // Skip processing very short messages or bot messages
      if (source.content.length < 20 || source.content.includes('<@U') || source.content.startsWith('!')) {
        console.log(`⏭️ [SLACK SERVICE] Skipping short/bot message: ${source.externalId}`);
        return;
      }

      // Get current organization
      const org = await getCurrentOrganization();
      if (!org) {
        console.error('❌ [SLACK SERVICE] No organization found. Please create one first.');
        return;
      }

      await this.knowledgeEngine.ingestKnowledgeSource(source, org.id);
      console.log(`✅ [SLACK SERVICE] Processed ${source.sourceType}: ${source.externalId}`);
      
    } catch (error) {
      console.error(`❌ [SLACK SERVICE] Failed to process content ${source.externalId}:`, error);
      // Don't throw - we want Slack events to continue processing even if knowledge processing fails
    }
  }
}
