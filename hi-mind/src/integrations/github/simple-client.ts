import { Octokit } from "@octokit/rest";
import { tryCatchWithLoggingAsync } from "@/utils/try-catch";

export interface GitHubResource {
  type: "issue" | "pull_request" | "commit" | "release";
  id: string;
  repository: string;
  data: unknown;
  timestamp: string;
}

export class SimpleGitHubClient {
  private octokit: Octokit;
  private isRunning: boolean = false;
  private config = {
    backfillDelay: parseInt(process.env.GITHUB_BACKFILL_DELAY || "5000"),
    rateLimitDelay: parseInt(process.env.GITHUB_RATE_LIMIT_DELAY || "1000"),
    targetRepository: process.env.GITHUB_TARGET_REPOSITORY ?? "",
    autoStart: process.env.GITHUB_AUTO_START !== "false",
  };

  constructor(token?: string) {
    // Use provided token or get from env var
    const authToken = token ?? process.env.GITHUB_TOKEN;

    if (!authToken) {
      throw new Error(
        "GitHub token required. Set GITHUB_TOKEN env var or pass to constructor.",
      );
    }

    this.octokit = new Octokit({
      auth: authToken,
    });
  }

  /**
   * Start the GitHub integration
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      console.log("🔄 [GITHUB] Integration already running");
      return;
    }

    console.log("🚀 [GITHUB] Starting GitHub integration...");

    if (!this.config.targetRepository) {
      console.log(
        "⚠️ [GITHUB] No target repository configured. Set GITHUB_REPOSITORY env var.",
      );
      return;
    }

    this.isRunning = true;
    console.log(
      `✅ [GITHUB] Integration started with target repository: ${this.config.targetRepository}`,
    );

    // Start initial backfill
    if (this.config.autoStart) {
      await this.runBackfill();
    }
  }

  /**
   * Stop the GitHub integration
   */
  public stop(): void {
    if (!this.isRunning) {
      console.log("🔄 [GITHUB] Integration not running");
      return;
    }

    this.isRunning = false;
    console.log("🛑 [GITHUB] Integration stopped");
  }

  /**
   * Run backfill for the configured repository
   */
  public async runBackfill(): Promise<void> {
    if (!this.isRunning) {
      console.log("⚠️ [GITHUB] Integration not running");
      return;
    }

    console.log("📥 [GITHUB] Starting backfill process...");

    const [owner, repo] = this.config.targetRepository.split("/");
    if (!owner || !repo) {
      console.error(
        "❌ [GITHUB] Invalid repository format. Expected: owner/repo",
      );
      return;
    }

    try {
      const result = await this.backfillRepository(owner, repo);
      if (result.success) {
        console.log(
          `✅ [GITHUB] ${owner}/${repo}: ${result.count} resources processed`,
        );
      }
    } catch (error) {
      console.error(`❌ [GITHUB] Failed to process ${owner}/${repo}:`, error);
    }

    console.log("✅ [GITHUB] Backfill process completed");
  }

  private async sleep(delayMs: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  /**
   * Backfill issues and PRs for a repository
   */
  private async backfillIssues(
    owner: string,
    repo: string,
  ): Promise<GitHubResource[]> {
    console.log(
      `🔍 [GITHUB] Starting issues/PRs backfill for ${owner}/${repo}...`,
    );
    const resources: GitHubResource[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const [issues, error] = await tryCatchWithLoggingAsync(async () => {
        const response = await this.octokit.rest.issues.listForRepo({
          owner,
          repo,
          state: "all",
          per_page: perPage,
          page,
        });
        return response.data;
      }, "github_backfill_issues");

      if (error || !issues) {
        console.error(
          `Failed to fetch issues page ${page} for ${owner}/${repo}:`,
          error?.message,
        );
        break;
      }

      if (issues.length === 0) break;

      for (const issue of issues) {
        const resourceType = issue.pull_request
          ? ("pull_request" as const)
          : ("issue" as const);
        const resource = {
          type: resourceType,
          id: issue.id.toString(),
          repository: `${owner}/${repo}`,
          data: issue,
          timestamp: issue.created_at,
        };

        // Log each resource as it's processed
        console.log(
          `📝 [GITHUB] ${resourceType.toUpperCase()}: #${issue.number} - ${issue.title}`,
        );
        console.log(
          `    ID: ${resource.id}, Created: ${resource.timestamp}, State: ${issue.state}`,
        );
        if (issue.pull_request && "base" in issue && "head" in issue) {
          console.log(`    PR: ${issue?.base} ← ${issue.head}`);
        }

        resources.push(resource);
      }

      console.log(
        `📄 [GITHUB] Processed page ${page - 1} for issues/PRs (${issues.length} items)`,
      );
      page++;
      // Simple rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log(
      `✅ [GITHUB] Issues/PRs backfill completed for ${owner}/${repo}: ${resources.length} total resources`,
    );
    return resources;
  }

  /**
   * Backfill commits for a repository
   */
  private async backfillCommits(
    owner: string,
    repo: string,
  ): Promise<GitHubResource[]> {
    console.log(
      `🔍 [GITHUB] Starting commits backfill for ${owner}/${repo}...`,
    );
    const resources: GitHubResource[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const [commits, error] = await tryCatchWithLoggingAsync(async () => {
        const response = await this.octokit.rest.repos.listCommits({
          owner,
          repo,
          per_page: perPage,
          page,
        });
        return response.data;
      }, "github_backfill_commits");

      if (error || !commits) {
        console.error(
          `Failed to fetch commits page ${page} for ${owner}/${repo}:`,
          error?.message,
        );
        break;
      }

      if (commits.length === 0) break;

      for (const commit of commits) {
        const resource = {
          type: "commit" as const,
          id: commit.sha,
          repository: `${owner}/${repo}`,
          data: commit,
          timestamp:
            commit.commit.author?.date || commit.commit.committer?.date || "",
        };

        // Log each commit as it's processed
        console.log(
          `📝 [GITHUB] COMMIT: ${commit.sha.substring(0, 8)} - ${commit.commit.message.split("\n")[0]}`,
        );
        console.log(
          `    ID: ${resource.id}, Author: ${commit.commit.author?.name || "Unknown"}, Date: ${resource.timestamp}`,
        );

        // Log commit details including files changed
        if (commit.stats) {
          console.log(
            `    Stats: +${commit.stats.additions} -${commit.stats.deletions} ${commit.stats.total} files`,
          );
        }

        // Log commit URL for easy access
        console.log(
          `    URL: https://github.com/${owner}/${repo}/commit/${commit.sha}`,
        );

        // Fetch and log actual code changes
        const [commitDetail, commitError] = await tryCatchWithLoggingAsync(
          async () => {
            const response = await this.octokit.rest.repos.getCommit({
              owner,
              repo,
              ref: commit.sha,
            });
            return response.data;
          },
          "github_get_commit_detail",
        );

        if (commitDetail && !commitError) {
          console.log(`    Files changed:`);
          commitDetail.files?.forEach((file) => {
            console.log(`      ${file.filename} (${file.status})`);
            if (file.patch) {
              // Show first few lines of the diff
              const patchLines = file.patch.split("\n").slice(0, 5);
              patchLines.forEach((line: string) => {
                if (line.startsWith("+")) {
                  console.log(`        + ${line.substring(1)}`);
                } else if (line.startsWith("-")) {
                  console.log(`        - ${line.substring(1)}`);
                }
              });
              if (file.patch.split("\n").length > 5) {
                console.log(
                  `        ... (${file.patch.split("\n").length - 5} more lines)`,
                );
              }
            }
          });
        }

        resources.push(resource);
      }

      console.log(
        `📄 [GITHUB] Processed page ${page - 1} for commits (${commits.length} items)`,
      );
      page++;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log(
      `✅ [GITHUB] Commits backfill completed for ${owner}/${repo}: ${resources.length} total resources`,
    );
    return resources;
  }

  /**
   * Main backfill method
   */
  public async backfillRepository(
    owner: string,
    repo: string,
  ): Promise<{
    success: boolean;
    resources: GitHubResource[];
    count: number;
  }> {
    try {
      console.log(`🔍 [GITHUB] Processing ${owner}/${repo}...`);
      console.log(`📊 [GITHUB] Starting comprehensive backfill...`);

      const issues = await this.backfillIssues(owner, repo);
      const commits = await this.backfillCommits(owner, repo);

      const allResources = [...issues, ...commits];

      console.log(`📈 [GITHUB] ${owner}/${repo} Summary:`);
      console.log(`    Issues: ${issues.length}`);
      console.log(
        `    Pull Requests: ${issues.filter((r) => r.type === "pull_request").length}`,
      );
      console.log(`    Commits: ${commits.length}`);
      console.log(`    Total: ${allResources.length}`);

      return {
        success: true,
        resources: allResources,
        count: allResources.length,
      };
    } catch (error) {
      console.error(`❌ [GITHUB] Failed to process ${owner}/${repo}:`, error);
      return {
        success: false,
        resources: [],
        count: 0,
      };
    }
  }
}
