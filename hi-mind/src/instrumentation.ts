/**
 * Next.js Instrumentation Hook
 * This runs ONLY on server startup, never in browser
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

import { initializeSlack } from "@/lib/init-slack";
import { startGitHubIntegration } from "@/integrations/github";

export async function register() {
  // This only runs on server startup
  console.log("🚀 [INSTRUMENTATION] Server starting - initializing HiMind services...");
  
  try {
    // Initialize Slack integration
    await initializeSlack();
    
    // Initialize GitHub integration (skip backfill on startup)
    await startGitHubIntegration(true);
    
    console.log("✅ [INSTRUMENTATION] All services initialized successfully");
  } catch (error) {
    console.error("❌ [INSTRUMENTATION] Service initialization failed:", error);
    // Don't throw - we want the server to start even if integrations fail
  }
}