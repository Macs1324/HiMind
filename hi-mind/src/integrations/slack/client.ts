import { WebClient } from '@slack/web-api';
import { SlackEvent } from '@slack/bolt';

export class SlackClient {
  private client: WebClient;
  private rateLimitDelay = 1000; // 1 second default delay

  constructor(token: string) {
    this.client = new WebClient(token, {
      retryConfig: {
        retries: 3,
        factor: 2,
        minTimeout: 1000,
        maxTimeout: 10000,
      },
    });
  }

  async listChannels(types: string[] = ['public_channel']): Promise<any[]> {
    try {
      const result = await this.client.conversations.list({
        types: types.join(','),
        limit: 1000,
      });
      return (result.channels || []) as any[];
    } catch (error) {
      console.error('Error listing channels:', error);
      throw error;
    }
  }

  async joinChannel(channelId: string): Promise<boolean> {
    try {
      await this.client.conversations.join({ channel: channelId });
      return true;
    } catch (error: unknown) {
      // Already a member
      if ((error as any).code === 'already_in_channel') {
        return true;
      }
      console.error('Error joining channel:', error);
      throw error;
    }
  }

  async fetchHistory(
    channelId: string,
    oldest?: string,
    latest?: string,
    limit: number = 1000
  ): Promise<SlackEvent[]> {
    try {
      const result = await this.client.conversations.history({
        channel: channelId,
        oldest,
        latest,
        limit,
        inclusive: true, // Include the message at the oldest timestamp
      });
      return (result.messages || []) as SlackEvent[];
    } catch (error) {
      console.error('Error fetching channel history:', error);
      throw error;
    }
  }

  async fetchThread(channelId: string, threadTs: string): Promise<SlackEvent[]> {
    try {
      const result = await this.client.conversations.replies({
        channel: channelId,
        ts: threadTs,
        limit: 1000,
        inclusive: true, // Include the parent message
      });
      return (result.messages || []) as SlackEvent[];
    } catch (error) {
      console.error('Error fetching thread:', error);
      throw error;
    }
  }

  async postMessage(
    channel: string,
    text: string,
    blocks?: unknown[],
    threadTs?: string
  ) {
    try {
      const result = await this.client.chat.postMessage({
        channel,
        text,
        blocks: blocks as any, // Type assertion for Slack API compatibility
        thread_ts: threadTs,
      });
      return result;
    } catch (error) {
      console.error('Error posting message:', error);
      throw error;
    }
  }

  async getChannelInfo(channelId: string): Promise<any | null> {
    try {
      const result = await this.client.conversations.info({
        channel: channelId,
      });
      return result.channel as any;
    } catch (error) {
      console.error('Error getting channel info:', error);
      throw error;
    }
  }

  async getUserInfo(userId: string) {
    try {
      const result = await this.client.users.info({
        user: userId,
      });
      return result.user;
    } catch (error) {
      console.error('Error getting user info:', error);
      throw error;
    }
  }

  // Helper method to verify message completeness
  async verifyMessageCompleteness(channelId: string, messageTs: string): Promise<boolean> {
    try {
      // Fetch the specific message to ensure we have the complete version
      const result = await this.client.conversations.history({
        channel: channelId,
        latest: messageTs,
        limit: 1,
        inclusive: true,
      });
      
      const message = result.messages?.[0] as any;
      if (!message) return false;
      
      // Check if the message text is complete (not truncated)
      const isComplete = message.text && !message.text.endsWith('...');
      
      if (!isComplete) {
        console.warn(`⚠️  Message ${messageTs} in channel ${channelId} appears to be truncated`);
      }
      
      return isComplete;
    } catch (error) {
      console.error('Error verifying message completeness:', error);
      return false;
    }
  }
}
