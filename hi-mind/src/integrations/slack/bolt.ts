import { SocketModeClient, LogLevel } from "@slack/socket-mode";
import { WebClient } from "@slack/web-api";
import { tryCatchWithLoggingAsync } from "@/utils/try-catch";

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

  private setupEventHandlers() {
    // Handle slash commands with proper typing
    this.socketModeClient.on("slash_commands", async (event) => {
      const [result, error] = await tryCatchWithLoggingAsync(async () => {
        console.log(
          "🔧 [SLASH COMMAND] Raw event:",
          JSON.stringify(event, null, 2),
        );

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

        console.log("🔧 [SLASH COMMAND] Parsed:", {
          command,
          text,
          responseUrl,
          channelId,
          userId,
          userName,
        });

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

          // Create a nice response message
          const query = text?.trim() || "no query provided";
          const responseMessage = `🎯 **Query received:** "${query}"\n\n🚧 **Under construction!** 🔨⚡️\n\nThis is your HiMind bot - more features coming soon! 🚀\n\n_Requested by <@${userId}>_`;

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
