import { SocketModeClient, LogLevel } from "@slack/socket-mode";
import { WebClient } from "@slack/web-api";
import type { 
  SlackEvent
} from "@slack/types";
import { tryCatchWithLoggingAsync } from "@/utils/try-catch";
import type { SlackConfig } from "./config";
import type { SlackService } from "./slack.service";

// Define proper types for Slack Socket Mode events
interface SlackSlashCommandEvent {
  ack: (response?: unknown) => Promise<void>;
  envelope_id: string;
  body: {
    command: string;
    text?: string;
    response_url?: string;
    channel_id?: string;
    user_id?: string;
    user_name?: string;
  };
  accepts_response_payload?: boolean;
}

interface SlackEventsApiEvent {
  ack: (response?: unknown) => Promise<void>;
  envelope_id: string;
  body: {
    event: SlackEvent;
  };
  event: SlackEvent;
  retry_num?: number;
  retry_reason?: string;
  accepts_response_payload?: boolean;
}

interface SlackGenericEvent {
  ack: (response?: unknown) => Promise<void>;
  envelope_id: string;
  type: string;
  body: unknown;
  retry_num?: number;
  retry_reason?: string;
  accepts_response_payload?: boolean;
}

export interface SlackResource {
  type: "message" | "thread_reply" | "slash_command" | "event";
  id: string;
  channelId: string;
  data: unknown;
  timestamp: string;
}

export class SlackClient {
  private socketModeClient: SocketModeClient;
  private webClient: WebClient;
  private config: SlackConfig;
  private isRunning = false;
  private service: SlackService;

  constructor(config: SlackConfig, service: SlackService) {
    this.config = config;
    this.service = service;
    this.socketModeClient = new SocketModeClient({
      appToken: config.appToken,
      logLevel: LogLevel.INFO,
    });

    this.webClient = new WebClient(config.botToken, {
      logLevel: LogLevel.INFO,
    });

    this.setupEventHandlers();
  }

  /**
   * Start the Slack integration
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      console.log("🔄 [SLACK] Integration already running");
      return;
    }

    console.log("🚀 [SLACK] Starting Slack integration...");

    this.isRunning = true;
    console.log("✅ [SLACK] Integration started");

    // Start Socket Mode client
    await this.socketModeClient.start();
    console.log("⚡️ [SLACK] Socket Mode client connected");
  }

  /**
   * Stop the Slack integration
   */
  public stop(): void {
    if (!this.isRunning) {
      console.log("🔄 [SLACK] Integration not running");
      return;
    }

    this.isRunning = false;
    this.socketModeClient.disconnect();
    console.log("🛑 [SLACK] Integration stopped");
  }

  /**
   * Run backfill for all accessible channels
   */
  public async runBackfill(): Promise<void> {
    if (!this.isRunning) {
      console.log("⚠️ [SLACK] Integration not running");
      return;
    }

    console.log("📥 [SLACK] Starting backfill process...");

    try {
      const result = await this.backfillAllChannels();
      if (result.success) {
        console.log(
          `✅ [SLACK] Backfill completed: ${result.count} resources processed`,
        );
      }
    } catch (error) {
      console.error(`❌ [SLACK] Failed to run backfill:`, error);
    }

    console.log("✅ [SLACK] Backfill process completed");
  }

  private async sleep(delayMs: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  /**
   * Backfill all accessible channels
   */
  private async backfillAllChannels(): Promise<{
    success: boolean;
    resources: SlackResource[];
    count: number;
  }> {
    console.log("🔍 [SLACK] Starting comprehensive channel backfill...");

    const resources: SlackResource[] = [];

    try {
      const channelIds: string[] = [];
      let cursor: string | undefined = undefined;

      // List channels the bot can see
      do {
        const [listResponse, listError] = await tryCatchWithLoggingAsync(async () => {
          return await this.webClient.conversations.list({
            types: "public_channel,private_channel",
            exclude_archived: true,
            limit: 200,
            cursor,
          });
        }, "slack_backfill_list_channels");

        if (listError || !listResponse) {
          console.error("❌ [SLACK] Failed to list channels:", listError);
          break;
        }

        const channels = listResponse.channels ?? [];
        for (const channel of channels) {
          const id = channel.id;
          const isMember = Boolean(channel.is_member);

          if (!id) continue;

          // Only backfill channels where the bot is a member
          if (isMember) {
            channelIds.push(id);
          }
        }

        cursor = listResponse.response_metadata?.next_cursor;
        if (cursor) {
          await this.sleep(this.config.rateLimitDelay);
        }
      } while (cursor);

      console.log(
        "📚 [SLACK] Channels to backfill:",
        channelIds.length,
      );

      // Backfill each channel
      for (const channelId of channelIds) {
        const channelResources = await this.backfillChannel(channelId);
        resources.push(...channelResources);
      }

      console.log(
        `✅ [SLACK] Backfill completed: ${resources.length} total resources`,
      );

      return {
        success: true,
        resources,
        count: resources.length,
      };
    } catch (error) {
      console.error("❌ [SLACK] Backfill failed:", error);
      return {
        success: false,
        resources: [],
        count: 0,
      };
    }
  }

  /**
   * Backfill a single channel
   */
  private async backfillChannel(channelId: string): Promise<SlackResource[]> {
    const resources: SlackResource[] = [];
    let historyCursor: string | undefined = undefined;

    do {
      const [history, historyError] = await tryCatchWithLoggingAsync(async () => {
        return await this.webClient.conversations.history({
          channel: channelId,
          limit: 200,
          cursor: historyCursor,
        });
      }, "slack_backfill_channel_history");

      if (historyError || !history) {
        console.error(`❌ [SLACK] Failed to fetch history for channel ${channelId}:`, historyError);
        break;
      }

      const messages = history.messages ?? [];
      for (const message of messages) {
        // Create resource for base message
        const resource: SlackResource = {
          type: "message",
          id: message.ts || `msg_${Date.now()}`,
          channelId,
          data: message,
          timestamp: message.ts || new Date().toISOString(),
        };

        console.log(
          `📝 [SLACK] MESSAGE: ${message.text?.substring(0, 50)}...`,
        );
        console.log(
          `    Channel: ${channelId}, TS: ${message.ts}, User: ${message.user}`,
        );

        resources.push(resource);

        // If message has a thread, fetch and log replies
        if (message.thread_ts) {
          const threadResources = await this.backfillThread(channelId, message.thread_ts);
          resources.push(...threadResources);
        }
      }

      historyCursor = history.response_metadata?.next_cursor;
      if (historyCursor) {
        await this.sleep(this.config.rateLimitDelay);
      }
    } while (historyCursor);

    return resources;
  }

  /**
   * Backfill thread replies
   */
  private async backfillThread(channelId: string, threadTs: string): Promise<SlackResource[]> {
    const resources: SlackResource[] = [];
    let repliesCursor: string | undefined = undefined;

    do {
      const [replies, repliesError] = await tryCatchWithLoggingAsync(async () => {
        return await this.webClient.conversations.replies({
          channel: channelId,
          ts: threadTs,
          limit: 200,
          cursor: repliesCursor,
        });
      }, "slack_backfill_thread_replies");

      if (repliesError || !replies) {
        console.error(`❌ [SLACK] Failed to fetch thread replies for ${threadTs}:`, repliesError);
        break;
      }

      const threadMessages = replies.messages ?? [];
      for (const reply of threadMessages) {
        if (reply.ts === threadTs) continue; // skip parent duplicate

        const resource: SlackResource = {
          type: "thread_reply",
          id: reply.ts || `reply_${Date.now()}`,
          channelId,
          data: reply,
          timestamp: reply.ts || new Date().toISOString(),
        };

        console.log(
          `💬 [SLACK] THREAD REPLY: ${reply.text?.substring(0, 50)}...`,
        );
        console.log(
          `    Channel: ${channelId}, TS: ${reply.ts}, Parent: ${threadTs}`,
        );

        resources.push(resource);
      }

      repliesCursor = replies.response_metadata?.next_cursor;
      if (repliesCursor) {
        await this.sleep(this.config.rateLimitDelay);
      }
    } while (repliesCursor);

    return resources;
  }

  /**
   * Setup event handlers for Socket Mode
   */
  private setupEventHandlers() {
    // Handle slash commands - SocketModeClient emits the command type as the event name
    this.socketModeClient.on("slash_commands", async (event: SlackSlashCommandEvent) => {
      const [result, error] = await tryCatchWithLoggingAsync(async () => {
        return await this.handleSlashCommand(event);
      }, "slack_slash_command_handler");

      if (error) {
        console.error("❌ [SLACK] Slash command handler error:", error);
      } else {
        console.log("✅ [SLACK] Slash command processed:", result);
      }
    });

    // Catch all events via the generic 'slack_event' that SocketModeClient always emits
    // This prevents duplicate event processing
    this.socketModeClient.on("slack_event", async (event: SlackGenericEvent) => {
      if (event.type === "events_api") {
        // For events_api, the body contains the event data
        const eventData = event.body as { event: SlackEvent };
        await tryCatchWithLoggingAsync(async () => {
          // Create a compatible event structure for handleEvent
          const compatibleEvent: SlackEventsApiEvent = {
            ack: event.ack,
            envelope_id: event.envelope_id,
            body: eventData,
            event: eventData.event,
            retry_num: event.retry_num,
            retry_reason: event.retry_reason,
            accepts_response_payload: event.accepts_response_payload,
          };
          return await this.handleEvent(compatibleEvent);
        }, "slack_generic_event_handler");
      }
    });

    // Connection event handlers
    this.socketModeClient.on("connecting", () => {
      console.log("🔌 [SLACK] Connecting to Slack...");
    });

    this.socketModeClient.on("connected", () => {
      console.log("✅ [SLACK] Connected to Slack!");
    });

    this.socketModeClient.on("disconnected", () => {
      console.log("❌ [SLACK] Disconnected from Slack");
    });

    this.socketModeClient.on("error", (error) => {
      console.error("❌ [SLACK] Socket Mode error:", error);
    });
  }

  /**
   * Handle slash commands
   */
  private async handleSlashCommand(event: SlackSlashCommandEvent): Promise<{
    success: boolean;
    type: string;
    command?: string;
    text?: string;
    channelId?: string;
    userId?: string;
    userName?: string;
    action?: string;
    reason?: string;
    ignored?: boolean;
  }> {
    const payload = event.body;
    if (!payload) {
      console.log("🔧 [SLACK] No slash command payload found");
      return {
        success: false,
        type: "slash_command",
        reason: "no_payload",
      };
    }

    const command = payload.command;
    const text = payload.text;
    const responseUrl = payload.response_url;
    const channelId = payload.channel_id;
    const userId = payload.user_id;
    const userName = payload.user_name;

    console.log("🔧 [SLACK] Command:", command, "Text:", text);

    // Handle /himind command
    if (command === "/himind") {
      if (!responseUrl) {
        console.log("⚠️ [SLACK] No response_url found for /himind");
        return {
          success: false,
          type: "slash_command",
          reason: "no_response_url",
          command,
        };
      }

      const query = text?.trim() || "";

      // /himind sync → trigger backfill
      if (query.toLowerCase().startsWith("sync")) {
        const startMessage = `🔄 Starting Slack backfill...\n_Requested by <@${userId}>_`;

        // Send immediate acknowledgment
        await tryCatchWithLoggingAsync(async () => {
          await fetch(responseUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: startMessage,
              response_type: "in_channel",
              unfurl_links: false,
              unfurl_media: false,
            }),
          });
        }, "send_slash_command_sync_ack");

        // Kick off backfill async
        void (async () => {
          await this.runBackfill();
          const doneMessage = "✅ Slack backfill completed.";
          await tryCatchWithLoggingAsync(async () => {
            await fetch(responseUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                text: doneMessage,
                response_type: "in_channel",
                unfurl_links: false,
                unfurl_media: false,
              }),
            });
          }, "send_slash_command_sync_done");
        })();

        return {
          success: true,
          type: "slash_command",
          command,
          text: query,
          channelId,
          userId,
          userName,
          action: "backfill_started",
        };
      }

      // Default response for other queries
      const responseMessage = `🎯 **Query received:** "${query || "no query provided"}"\n\n_Requested by <@${userId}>_`;

      await tryCatchWithLoggingAsync(async () => {
        await fetch(responseUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: responseMessage,
            response_type: "in_channel",
            unfurl_links: false,
            unfurl_media: false,
          }),
        });
      }, "send_slash_command_response");

      return {
        success: true,
        type: "slash_command",
        command,
        text: query,
        channelId,
        userId,
        userName,
        action: "query_processed",
      };
    }

    // Log other commands for debugging
    console.log("🔧 [SLACK] Ignored command:", command);
    return {
      success: true,
      type: "slash_command",
      ignored: true,
      command,
      reason: "not_himind_command",
    };
  }

  /**
   * Handle all other events (messages, reactions, etc.)
   */
  private async handleEvent(event: SlackEventsApiEvent): Promise<{
    success: boolean;
    type: string;
    eventType?: string;
    channelId?: string;
    userId?: string;
    timestamp?: string;
    reason?: string;
  }> {
    const slackEvent = event.event;
    if (!slackEvent) {
      console.log("📡 [SLACK] No event found");
      return {
        success: false,
        type: "event",
        reason: "no_event",
      };
    }

    const eventType = slackEvent.type;
    let channelId: string | undefined;
    let userId: string | undefined;
    let timestamp: string | undefined;

    // Extract common properties based on event type
    switch (eventType) {
      case "message":
        // Check if this is a generic message event (not a special subtype)
        if ('subtype' in slackEvent && slackEvent.subtype) {
          // Handle special message subtypes (bot_message, channel_join, etc.)
          const channel = 'channel' in slackEvent ? String(slackEvent.channel || '') : 'unknown';
          const user = 'user' in slackEvent ? String(slackEvent.user || '') : 'unknown';
          const ts = 'ts' in slackEvent ? String(slackEvent.ts || '') : 'unknown';
          
          await this.service.handleGenericEvent(slackEvent.subtype, channel, user, ts);
        } else {
          // Handle generic message events - use type guard to ensure it's a GenericMessageEvent
          if ('channel' in slackEvent && 'user' in slackEvent && 'ts' in slackEvent) {
            channelId = slackEvent.channel;
            userId = slackEvent.user;
            timestamp = slackEvent.ts;
            
            await this.service.handleMessage(channelId, userId, slackEvent.text || '', timestamp);
          }
        }
        break;
      
      case "reaction_added":
        if ('item' in slackEvent && 'user' in slackEvent && 'event_ts' in slackEvent && 'reaction' in slackEvent) {
          channelId = slackEvent.item.channel;
          userId = slackEvent.user;
          timestamp = slackEvent.event_ts;
          
          await this.service.handleReaction(channelId, userId, slackEvent.reaction, timestamp);
        }
        break;
      
      case "reaction_removed":
        if ('item' in slackEvent && 'user' in slackEvent && 'event_ts' in slackEvent && 'reaction' in slackEvent) {
          channelId = slackEvent.item.channel;
          userId = slackEvent.user;
          timestamp = slackEvent.event_ts;
          
          await this.service.handleReaction(channelId, userId, slackEvent.reaction, timestamp);
        }
        break;
      
      case "member_joined_channel":
        if ('channel' in slackEvent && 'user' in slackEvent && 'event_ts' in slackEvent) {
          channelId = slackEvent.channel;
          userId = slackEvent.user;
          timestamp = slackEvent.event_ts;
          
          await this.service.handleMemberJoined(channelId, userId, timestamp);
        }
        break;
      
      case "member_left_channel":
        if ('channel' in slackEvent && 'user' in slackEvent && 'event_ts' in slackEvent) {
          channelId = slackEvent.channel;
          userId = slackEvent.user;
          timestamp = slackEvent.event_ts;
          
          await this.service.handleMemberLeft(channelId, userId, timestamp);
        }
        break;
      
      default:
        // Handle all other events
        const channel = 'channel' in slackEvent ? String(slackEvent.channel || '') : 'unknown';
        const user = 'user' in slackEvent ? String(slackEvent.user || '') : 'unknown';
        const ts = 'ts' in slackEvent ? String(slackEvent.ts || '') : 
                  'event_ts' in slackEvent ? String((slackEvent as unknown as Record<string, unknown>).event_ts || '') : 'unknown';
        
        await this.service.handleGenericEvent(eventType, channel, user, ts, slackEvent);
        break;
    }

    return {
      success: true,
      type: "event",
      eventType,
      channelId,
      userId,
      timestamp,
    };
  }
}
