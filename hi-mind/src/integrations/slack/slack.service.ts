import type { SlackRepository } from "./slack.repository";
import { type KnowledgeSource } from "@/core/knowledge-engine";
import { getKnowledgeEngine } from "@/core/knowledge-engine-singleton";
import { getCurrentOrganization } from "@/lib/organization";

export interface SlackService {
  handleMessage(channelId: string, userId: string, text: string, timestamp: string, threadTs?: string): Promise<void>;
  handleReaction(channelId: string, userId: string, reaction: string, timestamp: string): Promise<void>;
  handleMemberJoined(channelId: string, userId: string, timestamp: string): Promise<void>;
  handleMemberLeft(channelId: string, userId: string, timestamp: string): Promise<void>;
  handleSlashCommand(command: string, text: string, channelId: string, userId: string, userName: string): Promise<{
    success: boolean;
    action?: string;
    responseMessage?: string;
  }>;
  handleBackfillMessage(channelId: string, userId: string, text: string, timestamp: string, threadTs?: string): Promise<void>;
  handleBackfillThreadReply(channelId: string, userId: string, text: string, timestamp: string, threadTs?: string): Promise<void>;
  handleGenericEvent(eventType: string, channelId: string, userId: string, timestamp: string, data?: unknown): Promise<void>;
}

export class SlackServiceImpl implements SlackService {
  constructor(private readonly repository: SlackRepository) {}

  async handleMessage(channelId: string, userId: string, text: string, timestamp: string, threadTs?: string): Promise<void> {
    // Log the message
    await this.repository.logMessage(channelId, userId, text, timestamp);
    
    // Create message-specific Slack URL with timestamp
    const messageUrl = `https://himindworkspace.slack.com/archives/${channelId}/p${timestamp.replace('.', '')}`;
    
    // Process content through enhanced knowledge engine with context
    await this.processSlackContentWithContext({
      platform: 'slack',
      sourceType: threadTs ? 'slack_thread' : 'slack_message',
      externalId: `${channelId}_${timestamp}`,
      externalUrl: messageUrl,
      content: text,
      authorExternalId: userId,
      platformCreatedAt: new Date(parseFloat(timestamp) * 1000).toISOString(),
      channelId,
      threadTs
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

  async handleBackfillMessage(channelId: string, userId: string, text: string, timestamp: string, threadTs?: string): Promise<void> {
    // Log the backfill message
    await this.repository.logBackfillMessage(channelId, userId, text, timestamp);
    
    // Process backfilled content with context
    await this.processSlackContentWithContext({
      platform: 'slack',
      sourceType: threadTs ? 'slack_thread' : 'slack_message',
      externalId: `${channelId}_${timestamp}_backfill`,
      externalUrl: `https://slack.com/channels/${channelId}`,
      content: text,
      authorExternalId: userId,
      platformCreatedAt: new Date(parseFloat(timestamp) * 1000).toISOString(),
      channelId,
      threadTs
    });
  }

  async handleBackfillThreadReply(channelId: string, userId: string, text: string, timestamp: string, threadTs?: string): Promise<void> {
    // Log the backfill thread reply
    await this.repository.logBackfillThreadReply(channelId, userId, text, timestamp);
    
    // Process thread reply with context
    await this.processSlackContentWithContext({
      platform: 'slack',
      sourceType: 'slack_thread',
      externalId: `${channelId}_${timestamp}_thread`,
      externalUrl: `https://slack.com/channels/${channelId}`,
      content: text,
      authorExternalId: userId,
      platformCreatedAt: new Date(parseFloat(timestamp) * 1000).toISOString(),
      channelId,
      threadTs
    });
  }

  async handleGenericEvent(eventType: string, channelId: string, userId: string, timestamp: string, data?: unknown): Promise<void> {
    // Log the generic event
    await this.repository.logEvent(eventType, channelId, userId, timestamp, data);
    
    // TODO: Add business logic here (e.g., event processing, analytics, etc.)
    // For now, just logging
  }

  private async processSlackContentWithContext(source: KnowledgeSource & {
    channelId?: string;
    threadTs?: string;
  }): Promise<void> {
    try {
      // Get current organization
      const org = await getCurrentOrganization();
      if (!org) {
        console.error('❌ [SLACK SERVICE] No organization found. Please create one first.');
        return;
      }

      // Use enhanced contextual ingestion
      const knowledgePointId = await getKnowledgeEngine().ingestSlackMessageWithContext(source, org.id);
      
      if (knowledgePointId) {
        console.log(`✅ [SLACK SERVICE] Processed contextual ${source.sourceType}: ${source.externalId} → ${knowledgePointId}`);
      } else {
        console.log(`⏭️ [SLACK SERVICE] Skipped non-substantial message: ${source.externalId}`);
      }
      
    } catch (error) {
      console.error(`❌ [SLACK SERVICE] Failed to process contextual content ${source.externalId}:`, error);
      // Don't throw - we want Slack events to continue processing even if knowledge processing fails
    }
  }

  private async processSlackContent(source: KnowledgeSource): Promise<void> {
    try {
      // Enhanced content quality filtering
      if (!this.isHighQualitySlackContent(source.content)) {
        console.log(`⏭️ [SLACK SERVICE] Skipping low-quality message: ${source.externalId}`);
        return;
      }

      // Get current organization
      const org = await getCurrentOrganization();
      if (!org) {
        console.error('❌ [SLACK SERVICE] No organization found. Please create one first.');
        return;
      }

      await getKnowledgeEngine().ingestKnowledgeSource(source, org.id);
      console.log(`✅ [SLACK SERVICE] Processed ${source.sourceType}: ${source.externalId}`);
      
    } catch (error) {
      console.error(`❌ [SLACK SERVICE] Failed to process content ${source.externalId}:`, error);
      // Don't throw - we want Slack events to continue processing even if knowledge processing fails
    }
  }

  /**
   * Determine if Slack content is high-quality enough for knowledge extraction
   */
  private isHighQualitySlackContent(content: string): boolean {
    // Clean the content for analysis
    const cleanContent = content.trim().toLowerCase();
    
    // Minimum length requirement
    if (cleanContent.length < 15) {
      return false;
    }

    // Skip bot messages and system messages
    if (content.includes('<@U') || content.includes('has joined') || content.includes('has left')) {
      return false;
    }

    // Skip emoji-only or reaction messages
    const emojiOnlyPattern = /^[\s\p{Emoji}\p{Emoji_Modifier}\p{Emoji_Component}\p{Emoji_Modifier_Base}\p{Emoji_Presentation}]+$/u;
    if (emojiOnlyPattern.test(cleanContent)) {
      return false;
    }

    // Skip very short acknowledgments and social messages
    const lowValuePatterns = [
      /^(thanks?|thx|ty|thank you)!*$/,
      /^(ok|okay|sure|yep|yes|no)!*$/,
      /^(lol|haha|😂|👍|👌|🔥|💯)+$/,
      /^(good|nice|cool|awesome|great)!*$/,
      /^(morning|afternoon|evening|night|hello|hi|hey|bye)!*$/,
      /^(agreed|exactly|this|same|ditto|\+1)!*$/
    ];

    if (lowValuePatterns.some(pattern => pattern.test(cleanContent))) {
      return false;
    }

    // Require substantive content (questions, statements, explanations)
    const hasSubstantiveContent = 
      cleanContent.includes('?') || // Questions
      cleanContent.includes('because') || // Explanations  
      cleanContent.includes('should') || // Suggestions
      cleanContent.includes('will') || // Plans
      cleanContent.includes('can') || // Capabilities
      cleanContent.includes('issue') || // Problems
      cleanContent.includes('problem') || // Problems
      cleanContent.includes('solution') || // Solutions
      cleanContent.includes('idea') || // Ideas
      cleanContent.split(' ').length >= 5; // Minimum word count

    // Must have multiple words and substantive content
    const wordCount = cleanContent.split(/\s+/).length;
    return wordCount >= 3 && hasSubstantiveContent;
  }
}
