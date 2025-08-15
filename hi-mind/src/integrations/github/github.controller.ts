import { tryCatchWithLoggingAsync } from "@/utils/try-catch";
import { GitHubService, type GitHubResource } from "./github.service";
import { GitHubAPIClient } from "./github-api-client";

export interface GitHubBackfillOptions {
  owner: string;
  repo: string;
}

export interface GitHubBackfillResult {
  success: boolean;
  totalProcessed: number;
  errors: string[];
}

export class GitHubController {
  private apiClient: GitHubAPIClient;

  constructor(private githubService: GitHubService, token?: string) {
    this.apiClient = new GitHubAPIClient(token);
  }

  /**
   * Entry point for triggering a GitHub backfill
   */
  async triggerBackfill(options: GitHubBackfillOptions): Promise<GitHubBackfillResult> {
    const [result, error] = await tryCatchWithLoggingAsync(async () => {
      console.log(`🚀 [GITHUB CONTROLLER] Starting backfill for ${options.owner}/${options.repo}`);
      
      const { owner, repo } = options;
      const repository = `${owner}/${repo}`;
      const errors: string[] = [];
      let totalProcessed = 0;

      // Always fetch everything - no configuration needed
      const [issues, issuesError] = await tryCatchWithLoggingAsync(
        async () => {
          console.log(`📥 [GITHUB CONTROLLER] Fetching all issues and PRs...`);
          const issues = await this.fetchIssues(owner, repo);
          const processedIssues = await this.githubService.processResources(issues);
          totalProcessed += processedIssues.length;
          console.log(`✅ [GITHUB CONTROLLER] Processed ${processedIssues.length} issues/PRs`);
          return processedIssues;
        },
        "github_controller_fetch_issues"
      );

      if (issuesError) {
        const errorMsg = `Failed to process issues: ${issuesError}`;
        errors.push(errorMsg);
        console.error(`❌ [GITHUB CONTROLLER] ${errorMsg}`);
      }

      const [commits, commitsError] = await tryCatchWithLoggingAsync(
        async () => {
          console.log(`📥 [GITHUB CONTROLLER] Fetching all commits...`);
          const commits = await this.fetchCommits(owner, repo);
          const processedCommits = await this.githubService.processResources(commits);
          totalProcessed += processedCommits.length;
          console.log(`✅ [GITHUB CONTROLLER] Processed ${processedCommits.length} commits`);
          return processedCommits;
        },
        "github_controller_fetch_commits"
      );

      if (commitsError) {
        const errorMsg = `Failed to process commits: ${commitsError}`;
        errors.push(errorMsg);
        console.error(`❌ [GITHUB CONTROLLER] ${errorMsg}`);
      }

      const [releases, releasesError] = await tryCatchWithLoggingAsync(
        async () => {
          console.log(`📥 [GITHUB CONTROLLER] Fetching all releases...`);
          const releases = await this.fetchReleases(owner, repo);
          const processedReleases = await this.githubService.processResources(releases);
          totalProcessed += processedReleases.length;
          console.log(`✅ [GITHUB CONTROLLER] Processed ${processedReleases.length} releases`);
          return processedReleases;
        },
        "github_controller_fetch_releases"
      );

      if (releasesError) {
        const errorMsg = `Failed to process releases: ${releasesError}`;
        errors.push(errorMsg);
        console.error(`❌ [GITHUB CONTROLLER] ${errorMsg}`);
      }

      const result: GitHubBackfillResult = {
        success: errors.length === 0,
        totalProcessed,
        errors,
      };

      console.log(`✅ [GITHUB CONTROLLER] Backfill completed for ${repository}: ${totalProcessed} total resources`);
      return result;
    }, "github_controller_trigger_backfill");

    if (error) {
      console.error("❌ [GITHUB CONTROLLER] Fatal error in backfill:", error);
      return {
        success: false,
        totalProcessed: 0,
        errors: [`Fatal error: ${error}`],
      };
    }

    return result;
  }

  /**
   * Entry point for processing a single GitHub resource
   */
  async processSingleResource(resource: GitHubResource): Promise<boolean> {
    const [result, error] = await tryCatchWithLoggingAsync(async () => {
      console.log(`🔄 [GITHUB CONTROLLER] Processing single resource: ${resource.type} ${resource.id}`);
      
      const processedEvents = await this.githubService.processResources([resource]);
      const success = processedEvents.length === 1;
      
      if (success) {
        console.log(`✅ [GITHUB CONTROLLER] Successfully processed resource ${resource.id}`);
      } else {
        console.warn(`⚠️ [GITHUB CONTROLLER] Failed to process resource ${resource.id}`);
      }
      
      return success;
    }, "github_controller_process_single_resource");

    if (error) {
      console.error("❌ [GITHUB CONTROLLER] Failed to process single resource:", error);
      return false;
    }

    return result;
  }

  /**
   * Entry point for health check
   */
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    const [result, error] = await tryCatchWithLoggingAsync(async () => {
      return {
        status: "healthy",
        timestamp: new Date().toISOString(),
      };
    }, "github_controller_health_check");

    if (error) {
      console.error("❌ [GITHUB CONTROLLER] Health check failed:", error);
      return {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
      };
    }

    return result;
  }

  // Private methods for fetching data using the real GitHub API client
  private async fetchIssues(owner: string, repo: string): Promise<GitHubResource[]> {
    return await this.apiClient.fetchIssues(owner, repo);
  }

  private async fetchCommits(owner: string, repo: string): Promise<GitHubResource[]> {
    return await this.apiClient.fetchCommits(owner, repo);
  }

  private async fetchReleases(owner: string, repo: string): Promise<GitHubResource[]> {
    return await this.apiClient.fetchReleases(owner, repo);
  }
}
