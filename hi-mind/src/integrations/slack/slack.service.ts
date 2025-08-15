import type { SlackRepository } from "./slack.repository";
import { ProcessingOrchestrator } from "@/services/processing-orchestrator";
import type { ContentSource } from "@/services/content-ingestion.service";

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
  private orchestrator = new ProcessingOrchestrator();

  constructor(private readonly repository: SlackRepository) {}

  async handleMessage(channelId: string, userId: string, text: string, timestamp: string): Promise<void> {
    // Log the message
    await this.repository.logMessage(channelId, userId, text, timestamp);
    
    // Queue content for processing
    await this.queueSlackContent({
      type: 'slack_message',
      externalId: `${channelId}_${timestamp}`,
      externalUrl: `https://slack.com/channels/${channelId}`,
      body: text,
      authorExternalId: userId,
      authorPlatform: 'slack',
      platformCreatedAt: new Date(parseFloat(timestamp) * 1000).toISOString(),
      rawContent: {
        channel_id: channelId,
        user_id: userId,
        timestamp,
        message_type: 'message'
      }
    }, 'normal');
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
    
    // Queue backfilled content for processing
    await this.queueSlackContent({
      type: 'slack_message',
      externalId: `${channelId}_${timestamp}_backfill`,
      externalUrl: `https://slack.com/channels/${channelId}`,
      body: text,
      authorExternalId: userId,
      authorPlatform: 'slack',
      platformCreatedAt: new Date(parseFloat(timestamp) * 1000).toISOString(),
      rawContent: {
        channel_id: channelId,
        user_id: userId,
        timestamp,
        message_type: 'backfill'
      }
    }, 'low');
  }

  async handleBackfillThreadReply(channelId: string, userId: string, text: string, timestamp: string): Promise<void> {
    // Log the backfill thread reply
    await this.repository.logBackfillThreadReply(channelId, userId, text, timestamp);
    
    // Queue thread reply for processing
    await this.queueSlackContent({
      type: 'slack_thread',
      externalId: `${channelId}_${timestamp}_thread`,
      externalUrl: `https://slack.com/channels/${channelId}`,
      body: text,
      authorExternalId: userId,
      authorPlatform: 'slack',
      platformCreatedAt: new Date(parseFloat(timestamp) * 1000).toISOString(),
      rawContent: {
        channel_id: channelId,
        user_id: userId,
        timestamp,
        message_type: 'thread_reply'
      }
    }, 'normal');
  }

  async handleGenericEvent(eventType: string, channelId: string, userId: string, timestamp: string, data?: unknown): Promise<void> {
    // Log the generic event
    await this.repository.logEvent(eventType, channelId, userId, timestamp, data);
    
    // TODO: Add business logic here (e.g., event processing, analytics, etc.)
    // For now, just logging
  }

  private async queueSlackContent(source: ContentSource, priority: 'high' | 'normal' | 'low'): Promise<void> {
    try {
      // Skip processing very short messages or bot messages
      if (source.body.length < 10 || source.body.includes('<@U') || source.body.startsWith('!')) {
        console.log(`⏭️ [SLACK SERVICE] Skipping short/bot message: ${source.externalId}`);
        return;
      }

      const jobId = await this.orchestrator.queueContent(source, priority);
      console.log(`📋 [SLACK SERVICE] Queued ${source.type} for processing: ${jobId}`);
      
    } catch (error) {
      console.error(`❌ [SLACK SERVICE] Failed to queue content ${source.externalId}:`, error);
      // Don't throw - we want Slack events to continue processing even if queueing fails
    }
  }
}
