import { Octokit } from "@octokit/rest";
import { tryCatchWithLoggingAsync } from "@/utils/try-catch";
import type { RestEndpointMethodTypes } from "@octokit/rest";

// GitHub API types
type IssuesListForRepoResponse = RestEndpointMethodTypes["issues"]["listForRepo"]["response"]["data"];
type ReposListCommitsResponse = RestEndpointMethodTypes["repos"]["listCommits"]["response"]["data"];
type ReposListReleasesResponse = RestEndpointMethodTypes["repos"]["listReleases"]["response"]["data"];

export interface GitHubResource {
  type: "issue" | "pull_request" | "commit" | "release";
  id: string;
  repository: string;
  data: IssuesListForRepoResponse[0] | ReposListCommitsResponse[0] | ReposListReleasesResponse[0];
  timestamp: string;
}

export class GitHubAPIClient {
  private octokit: Octokit;
  private config = {
    rateLimitDelay: parseInt(process.env.GITHUB_RATE_LIMIT_DELAY || "1000"),
  };

  constructor(token?: string) {
    const authToken = token ?? process.env.GITHUB_TOKEN;
    if (!authToken) {
      throw new Error("GitHub token required. Set GITHUB_TOKEN env var or pass to constructor.");
    }

    this.octokit = new Octokit({
      auth: authToken,
    });
  }

  /**
   * Fetch issues and pull requests for a repository
   */
  async fetchIssues(owner: string, repo: string): Promise<GitHubResource[]> {
    const [result, error] = await tryCatchWithLoggingAsync(async () => {
      console.log(`🔍 [GITHUB API] Fetching issues/PRs for ${owner}/${repo}...`);
      
      const resources: GitHubResource[] = [];
      let page = 1;
      const perPage = 100;

      while (true) {
        const response = await this.octokit.rest.issues.listForRepo({
          owner,
          repo,
          state: "all",
          per_page: perPage,
          page,
        });

        const issues = response.data;
        if (issues.length === 0) break;

        for (const issue of issues) {
          const resourceType = issue.pull_request ? "pull_request" : "issue";
          const resource: GitHubResource = {
            type: resourceType,
            id: issue.id.toString(),
            repository: `${owner}/${repo}`,
            data: issue,
            timestamp: issue.created_at,
          };

          resources.push(resource);
        }

        page++;
        
        // Rate limiting
        await this.sleep(this.config.rateLimitDelay);
      }

      console.log(`✅ [GITHUB API] Fetched ${resources.length} issues/PRs for ${owner}/${repo}`);
      return resources;
    }, "github_api_fetch_issues");

    if (error) {
      console.error("❌ [GITHUB API] Failed to fetch issues:", error);
      throw error;
    }

    return result;
  }

  /**
   * Fetch commits for a repository
   */
  async fetchCommits(owner: string, repo: string): Promise<GitHubResource[]> {
    const [result, error] = await tryCatchWithLoggingAsync(async () => {
      console.log(`🔍 [GITHUB API] Fetching commits for ${owner}/${repo}...`);
      
      const resources: GitHubResource[] = [];
      let page = 1;
      const perPage = 100;

      while (true) {
        const response = await this.octokit.rest.repos.listCommits({
          owner,
          repo,
          per_page: perPage,
          page,
        });

        const commits = response.data;
        if (commits.length === 0) break;

        for (const commit of commits) {
          const resource: GitHubResource = {
            type: "commit",
            id: commit.sha,
            repository: `${owner}/${repo}`,
            data: commit,
            timestamp: commit.commit.author?.date || commit.commit.committer?.date || "",
          };

          resources.push(resource);
        }

        page++;
        
        // Rate limiting
        await this.sleep(this.config.rateLimitDelay);
      }

      console.log(`✅ [GITHUB API] Fetched ${resources.length} commits for ${owner}/${repo}`);
      return resources;
    }, "github_api_fetch_commits");

    if (error) {
      console.error("❌ [GITHUB API] Failed to fetch commits:", error);
      throw error;
    }

    return result;
  }

  /**
   * Fetch releases for a repository
   */
  async fetchReleases(owner: string, repo: string): Promise<GitHubResource[]> {
    const [result, error] = await tryCatchWithLoggingAsync(async () => {
      console.log(`🔍 [GITHUB API] Fetching releases for ${owner}/${repo}...`);
      
      const resources: GitHubResource[] = [];
      let page = 1;
      const perPage = 100;

      while (true) {
        const response = await this.octokit.rest.repos.listReleases({
          owner,
          repo,
          per_page: perPage,
          page,
        });

        const releases = response.data;
        if (releases.length === 0) break;

        for (const release of releases) {
          const resource: GitHubResource = {
            type: "release",
            id: release.id.toString(),
            repository: `${owner}/${repo}`,
            data: release,
            timestamp: release.created_at,
          };

          resources.push(resource);
        }

        page++;
        
        // Rate limiting
        await this.sleep(this.config.rateLimitDelay);
      }

      console.log(`✅ [GITHUB API] Fetched ${resources.length} releases for ${owner}/${repo}`);
      return resources;
    }, "github_api_fetch_releases");

    if (error) {
      console.error("❌ [GITHUB API] Failed to fetch releases:", error);
      throw error;
    }

    return result;
  }


  private async sleep(delayMs: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}
