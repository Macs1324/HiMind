import { startSlackIntegration } from "@/integrations/slack";

// This runs once when the server starts
let slackInitialized = false;

export async function initializeSlack() {
  if (slackInitialized) return;

  try {
    console.log("🚀 Auto-initializing Slack integration...");
    await startSlackIntegration(true); // Skip backfill on startup
    slackInitialized = true;
    console.log("✅ Slack integration auto-started successfully");
  } catch (error) {
    console.error("❌ Failed to auto-start Slack integration:", error);
    // Don't throw - we want the server to start even if Slack fails
  }
}
