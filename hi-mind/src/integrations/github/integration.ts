/* eslint-disable @typescript-eslint/no-unused-vars */
import { GitHubController } from "./github.controller";
import { GitHubService } from "./github.service";
import { LoggingEventRepository } from "@/integrations/github/github.repository";

let githubController: GitHubController | null = null;

import { tryCatchWithLoggingAsync } from "@/utils/try-catch";

export async function startGitHubIntegration(skipBackfill: boolean = false): Promise<void> {
  const [result, error] = await tryCatchWithLoggingAsync(async () => {
    if (!process.env.GITHUB_TOKEN) {
      console.log('⚠️ [GITHUB] GITHUB_TOKEN not set, skipping GitHub integration');
      return;
    }

		// Initialize the dependency chain
		const eventRepository = new LoggingEventRepository();
		const githubService = new GitHubService(eventRepository);
		githubController = new GitHubController(
			githubService,
			process.env.GITHUB_TOKEN,
		);

		console.log(
			"✅ [GITHUB] GitHub integration initialized with new architecture",
		);

    // Only auto-trigger backfill if not skipped and target repository is configured
    if (!skipBackfill) {
      const targetRepo = process.env.GITHUB_REPOSITORY;
      if (targetRepo) {
        console.log(`🚀 [GITHUB] Auto-triggering backfill for ${targetRepo}`);
        
        const [owner, repo] = targetRepo.split("/");
        if (owner && repo) {
          const [backfillResult, backfillError] = await tryCatchWithLoggingAsync(
            async () => {
              if (!githubController) {
                throw new Error('GitHub controller not initialized');
              }
              const result = await githubController.triggerBackfill({
                owner,
                repo,
              });
              console.log(`✅ [GITHUB] Auto-backfill completed: ${result.totalProcessed} resources`);
              return result;
            },
            "github_auto_backfill"
          );

          if (backfillError) {
            console.error('❌ [GITHUB] Auto-backfill failed:', backfillError);
          }
        } else {
          console.warn(`⚠️ [GITHUB] Invalid GITHUB_REPOSITORY format: ${targetRepo}. Expected: owner/repo`);
        }
      } else {
        console.log('ℹ️ [GITHUB] No GITHUB_REPOSITORY configured, skipping auto-backfill');
      }
    } else {
      console.log('ℹ️ [GITHUB] Backfill skipped on startup - use UI button to trigger manually');
    }
  }, "github_start_integration");

	if (error) {
		console.error("❌ [GITHUB] Failed to start GitHub integration:", error);
	}
}

export function stopGitHubIntegration(): void {
	if (githubController) {
		// Clean up any resources if needed
		githubController = null;
		console.log("🛑 [GITHUB] GitHub integration stopped");
	}
}

export function getGitHubController(): GitHubController | null {
	return githubController;
}

// Convenience function for triggering backfill
export async function triggerGitHubBackfill(
	owner: string,
	repo: string,
): Promise<unknown> {
	if (!githubController) {
		throw new Error("GitHub integration not initialized");
	}

	return await githubController.triggerBackfill({ owner, repo });
}
