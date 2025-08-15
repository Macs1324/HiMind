import { getSlackConfig } from "./config";
import { SlackClient } from "./slack.client";
import { SlackServiceImpl } from "./slack.service";
import { SlackRepositoryImpl } from "./slack.repository";

let slackClient: SlackClient | null = null;

export async function startSlackIntegration(): Promise<void> {
  try {
    const config = getSlackConfig();
    
    // Create repository and service
    const repository = new SlackRepositoryImpl();
    const service = new SlackServiceImpl(repository);
    
    // Create client with service
    slackClient = new SlackClient(config, service);
    
    // Start the client
    await slackClient.start();
    
    console.log("✅ Slack integration started successfully");
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
