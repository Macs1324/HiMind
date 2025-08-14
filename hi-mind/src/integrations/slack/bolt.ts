import { SocketModeClient, LogLevel } from "@slack/socket-mode";
import { WebClient } from "@slack/web-api";
import { tryCatchWithLoggingAsync } from "@/utils/try-catch";
import { getSlackConfig } from "./config";

interface SlackSlashCommandEvent {
  payload?: {
    command: string;
    text?: string;
    response_url?: string;
    channel_id?: string;
    user_id?: string;
    user_name?: string;
  };
  body?: {
    command: string;
    text?: string;
    response_url?: string;
    channel_id?: string;
    user_id?: string;
    user_name?: string;
  };
}

export class SlackBoltApp {
  private socketModeClient: SocketModeClient;
  private webClient: WebClient;
  private appToken: string;
  private botToken: string;

  constructor(botToken: string, appToken: string) {
    this.botToken = botToken;
    this.appToken = appToken;

    // Initialize Web API client
    this.webClient = new WebClient(botToken);

    // Initialize Socket Mode client
    this.socketModeClient = new SocketModeClient({
      appToken: appToken,
      logLevel: LogLevel.INFO,
    });

    this.setupEventHandlers();
  }

  private async sleep(delayMs: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  // Backfill: enumerate channels, fetch history + threads, and log items as they are retrieved
  public async backfillHistory(): Promise<{
    success: boolean;
    details?: unknown;
  }> {
    const config = getSlackConfig();

    const [result, error] = await tryCatchWithLoggingAsync(async () => {
      console.log("📥 [SLACK BACKFILL] Starting backfill...");

      const channelIds: string[] = [];
      let cursor: string | undefined = undefined;

      // List channels the bot can see; join public channels if configured
      do {
        const listResponse = await this.webClient.conversations.list({
          types: "public_channel,private_channel",
          exclude_archived: true,
          limit: 200,
          cursor,
        });

        const channels = listResponse.channels ?? [];
        for (const channel of channels) {
          const id = channel.id;
          const isMember = Boolean(channel.is_member);
          const isPublic = channel.is_channel && !channel.is_private;

          if (!id) continue;

          if (!isMember && isPublic && config.autoJoinChannels) {
            // Best-effort auto-join public channels
            await tryCatchWithLoggingAsync(async () => {
              await this.webClient.conversations.join({ channel: id });
              console.log("🤝 [SLACK BACKFILL] Joined public channel", id);
            }, "slack_backfill_join_channel");
          }

          // Only backfill channels where the bot is a member
          if (isMember) {
            channelIds.push(id);
          }
        }

        cursor = listResponse.response_metadata?.next_cursor;
        if (cursor) {
          await this.sleep(config.rateLimitDelay);
        }
      } while (cursor);

      console.log(
        "📚 [SLACK BACKFILL] Channels to backfill:",
        channelIds.length,
      );

      let totalLogged = 0;

      for (const channelId of channelIds) {
        if (totalLogged >= config.maxBackfillMessages) break;

        let historyCursor: string | undefined = undefined;
        do {
          const history = await this.webClient.conversations.history({
            channel: channelId,
            limit: 200,
            cursor: historyCursor,
          });

          const messages = history.messages ?? [];
          for (const message of messages) {
            // Log the base message
            console.log(
              JSON.stringify(
                {
                  source: "slack",
                  kind: "message",
                  channelId,
                  ts: message.ts,
                  user: message.user,
                  name: message.username,
                  subtype: message.subtype,
                  text: message.text,
                },
                null,
                2,
              ),
            );
            totalLogged += 1;
            if (totalLogged >= config.maxBackfillMessages) break;

            // If message has a thread, fetch and log replies
            if (message.thread_ts) {
              let repliesCursor: string | undefined = undefined;
              do {
                const replies = await this.webClient.conversations.replies({
                  channel: channelId,
                  ts: message.thread_ts,
                  limit: 200,
                  cursor: repliesCursor,
                });

                const threadMessages = replies.messages ?? [];
                for (const reply of threadMessages) {
                  if (reply.ts === message.ts) continue; // skip parent duplicate
                  console.log(
                    JSON.stringify(
                      {
                        source: "slack",
                        kind: "thread_reply",
                        channelId,
                        ts: reply.ts,
                        parentTs: message.thread_ts,
                        user: reply.user,
                        text: reply.text,
                      },
                      null,
                      2,
                    ),
                  );
                  totalLogged += 1;
                  if (totalLogged >= config.maxBackfillMessages) break;
                }

                repliesCursor = replies.response_metadata?.next_cursor;
                if (repliesCursor && totalLogged < config.maxBackfillMessages) {
                  await this.sleep(config.rateLimitDelay);
                }
              } while (
                repliesCursor &&
                totalLogged < config.maxBackfillMessages
              );
            }

            if (totalLogged >= config.maxBackfillMessages) break;
          }

          historyCursor = history.response_metadata?.next_cursor ?? undefined;
          if (historyCursor && totalLogged < config.maxBackfillMessages) {
            await this.sleep(config.rateLimitDelay);
          }
        } while (historyCursor && totalLogged < config.maxBackfillMessages);

        if (totalLogged >= config.maxBackfillMessages) break;
      }

      console.log(
        `✅ [SLACK BACKFILL] Completed. Logged ${totalLogged} message(s)/reply(ies).`,
      );

      return { success: true, totalLogged };
    }, "slack_backfill_history");

    if (error) {
      console.error("❌ [SLACK BACKFILL] Failed:", error);
      return { success: false, details: { error: String(error) } };
    }
    return { success: true, details: result };
  }

  private setupEventHandlers() {
    // Handle slash commands with proper typing
    this.socketModeClient.on("slash_commands", async (event: SlackSlashCommandEvent) => {
      const [result, error] = await tryCatchWithLoggingAsync(async () => {
        // Extract command info with proper typing
        const payload = event.payload || event.body;
        if (!payload) {
          console.log("🔧 [SLASH COMMAND] No payload found");
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

        console.log("🔧 [SLASH COMMAND] Command:", command, "Text:", text);

        // Handle /himind command
        if (command === "/himind") {
          if (!responseUrl) {
            console.log("⚠️ [SLASH COMMAND] No response_url found for /himind");
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

            // Ack
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
              const backfill = await this.backfillHistory();
              const doneMessage = backfill.success
                ? "✅ Slack backfill completed."
                : "❌ Slack backfill failed.";
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

          // Default ack
          const responseMessage = `🎯 **Query received:** "${query || "no query provided"}"\n\n_Requested by <@${userId}>_`;

          // Send response using tryCatch utility
          const [response, fetchError] = await tryCatchWithLoggingAsync(
            async () => {
              const response = await fetch(responseUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  text: responseMessage,
                  response_type: "in_channel",
                  unfurl_links: false,
                  unfurl_media: false,
                }),
              });
              return response;
            },
            "send_slash_command_response",
          );

          if (fetchError) {
            console.log("❌ [SLASH COMMAND] /himind fetch error:", fetchError);
            return {
              success: false,
              type: "slash_command",
              reason: "fetch_error",
              command,
              error: fetchError.message,
            };
          }

          if (response.ok) {
            console.log(
              "✅ [SLASH COMMAND] /himind response sent successfully",
            );
            return {
              success: true,
              type: "slash_command",
              command,
              text: query,
              channelId,
              userId,
              userName,
              responseStatus: response.status,
            };
          } else {
            const [errorText, textError] = await tryCatchWithLoggingAsync(
              async () => response.text(),
              "read_response_error_text",
            );

            const errorMessage = textError
              ? "Failed to read error text"
              : errorText;
            console.log(
              "❌ [SLASH COMMAND] /himind response failed:",
              response.status,
              errorMessage,
            );

            return {
              success: false,
              type: "slash_command",
              reason: "response_failed",
              command,
              status: response.status,
              error: errorMessage,
            };
          }
        }

        // Log other commands for debugging
        console.log("🔧 [SLASH COMMAND] Ignored command:", command);
        return {
          success: true,
          type: "slash_command",
          ignored: true,
          command,
          reason: "not_himind_command",
        };
      }, "slash_command_handler");

      if (error) {
        console.error("❌ [SLASH COMMAND] Fatal error in handler:", error);
      } else {
        console.log("✅ [SLASH COMMAND] Processed:", result);
      }
    });

    this.socketModeClient.on("connecting", () => {
      console.log("🔌 Connecting to Slack...");
    });

    this.socketModeClient.on("connected", () => {
      console.log("✅ Connected to Slack!");
    });

    this.socketModeClient.on("disconnected", () => {
      console.log("❌ Disconnected from Slack");
    });

    this.socketModeClient.on("error", (error) => {
      console.error("❌ Socket Mode error:", error);
    });
  }
  async start() {
    const [result, error] = await tryCatchWithLoggingAsync(async () => {
      console.log("🚀 Starting Slack integration...");
      await this.socketModeClient.start();
      console.log("⚡️ Slack integration is running!");
      console.log("🚀 Bot ready to receive commands and mentions");

      return { success: true, status: "started" };
    }, "start_slack_integration");

    if (error) {
      console.error("❌ Failed to start Slack integration:", error);
      throw error;
    } else {
      console.log("✅ Slack integration started successfully:", result);
    }
  }

  async stop() {
    const [result, error] = await tryCatchWithLoggingAsync(async () => {
      await this.socketModeClient.disconnect();
      console.log("🛑 Slack integration stopped");

      return { success: true, status: "stopped" };
    }, "stop_slack_integration");

    if (error) {
      console.error("❌ Error stopping Slack integration:", error);
    } else {
      console.log("✅ Slack integration stopped successfully:", result);
    }
  }
}
