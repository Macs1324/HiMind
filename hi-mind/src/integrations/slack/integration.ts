import { getSlackConfig } from "./config";
import { SlackClient } from "./slack.client";
import { SlackServiceImpl } from "./slack.service";
import { SlackRepositoryImpl } from "./slack.repository";
import { SlackBackfill } from "./backfill";

let slackClient: SlackClient | null = null;

export async function startSlackIntegration(skipBackfill: boolean = false): Promise<void> {
  // Don't create multiple clients
  if (slackClient) {
    console.log("🔄 [SLACK] Integration already running, skipping");
    return;
  }

  try {
    const config = getSlackConfig();
    
    // Create repository and service
    const repository = new SlackRepositoryImpl();
    const service = new SlackServiceImpl(repository);
    
    // Create client with service
    slackClient = new SlackClient(config, service);
    
    // Start the client
    await slackClient.start();
    
    // Only run historical message backfill if not skipped
    if (!skipBackfill) {
      const backfill = new SlackBackfill(config.botToken);
      // Run backfill in background, don't block startup
      backfill.runBackfill().catch(error => 
        console.error("⚠️ Backfill failed but continuing with real-time messages:", error)
      );
      console.log("✅ Slack integration started successfully with backfill");
    } else {
      console.log("✅ Slack integration started successfully - backfill skipped, use UI button to trigger manually");
    }
  } catch (error) {
    console.error("❌ Failed to start Slack integration:", error);
    throw error;
  }
}

export function stopSlackIntegration(): void {
  if (slackClient) {
    slackClient.stop();
    slackClient = null;
    console.log("🛑 Slack integration stopped");
  }
}

export function getSlackClient(): SlackClient | null {
  return slackClient;
}
