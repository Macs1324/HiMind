import { tryCatchWithLoggingAsync } from "@/utils/try-catch";
import { EventRepository, type GitHubEvent } from "@/integrations/github/github.repository";
import { type KnowledgeSource } from "@/core/knowledge-engine";
import { getKnowledgeEngine } from "@/core/knowledge-engine-singleton";
import { getCurrentOrganization } from "@/lib/organization";

// GitHub API types - using the actual Octokit response types
import type { RestEndpointMethodTypes } from "@octokit/rest";

// Extract the actual response types from Octokit
type IssuesListForRepoResponse = RestEndpointMethodTypes["issues"]["listForRepo"]["response"]["data"];
type GitHubIssue = IssuesListForRepoResponse[0];

type ReposListCommitsResponse = RestEndpointMethodTypes["repos"]["listCommits"]["response"]["data"];
type GitHubCommit = ReposListCommitsResponse[0];

type ReposListReleasesResponse = RestEndpointMethodTypes["repos"]["listReleases"]["response"]["data"];
type GitHubRelease = ReposListReleasesResponse[0];

export interface GitHubResource {
  type: "issue" | "pull_request" | "commit" | "release";
  id: string;
  repository: string;
  data: unknown;
  timestamp: string;
}

export type ProcessedGitHubEvent = GitHubEvent;

export class GitHubService {
  constructor(private eventRepository: EventRepository) {}

  /**
   * Process a GitHub issue and convert it to a common event format
   */
  async processIssue(issue: GitHubIssue, repository: string): Promise<ProcessedGitHubEvent> {
    const [result, error] = await tryCatchWithLoggingAsync(async () => {
      const event: ProcessedGitHubEvent = {
        id: issue.id.toString(),
        source: "github",
        type: issue.pull_request ? "pull_request" : "issue",
        repository,
        timestamp: issue.created_at,
        title: issue.title,
        author: issue.user?.login,
        status: issue.state,
        metadata: {
          number: issue.number,
          labels: issue.labels?.map((l) => typeof l === 'string' ? l : l.name).filter(Boolean) || [],
          assignees: issue.assignees?.map((a) => a.login) || [],
          milestone: issue.milestone?.title,
          comments: issue.comments,
          isPullRequest: !!issue.pull_request,
          // Note: base, head, mergeable fields are only available on pull requests, not issues
        },
      };

      // Save to repository
      await this.eventRepository.saveGitHubEvent(event);
      
      // Process content through knowledge engine
      await this.processGitHubContent({
        platform: 'github',
        sourceType: issue.pull_request ? 'github_pr' : 'github_issue',
        externalId: issue.id.toString(),
        externalUrl: issue.html_url,
        title: issue.title,
        content: issue.body || '',
        authorExternalId: issue.user?.login || 'unknown',
        platformCreatedAt: issue.created_at
      });
      
      console.log(`📝 [GITHUB SERVICE] Processed ${event.type}: #${issue.number} - ${issue.title}`);
      
      return event;
    }, "github_service_process_issue");

    if (error) {
      console.error("❌ [GITHUB SERVICE] Failed to process issue:", error);
      throw error;
    }

    return result;
  }

  /**
   * Process a GitHub commit and convert it to a common event format
   */
  async processCommit(commit: GitHubCommit, repository: string): Promise<ProcessedGitHubEvent> {
    const [result, error] = await tryCatchWithLoggingAsync(async () => {
      const event: ProcessedGitHubEvent = {
        id: commit.sha,
        source: "github",
        type: "commit",
        repository,
        timestamp: commit.commit.author?.date || commit.commit.committer?.date || "",
        title: commit.commit.message.split("\n")[0],
        author: commit.commit.author?.name || commit.author?.login,
        status: "committed",
        metadata: {
          sha: commit.sha,
          shortSha: commit.sha.substring(0, 8),
          message: commit.commit.message,
          authorEmail: commit.commit.author?.email,
          committerEmail: commit.commit.committer?.email,
          stats: commit.stats,
          url: commit.html_url,
        },
      };

      // Save to repository
      await this.eventRepository.saveGitHubEvent(event);
      
      // Process meaningful commit content
      if (commit.commit.message.length > 20) {
        await this.processGitHubContent({
          platform: 'github',
          sourceType: 'github_comment', // Use comment type for commits
          externalId: commit.sha,
          externalUrl: commit.html_url,
          title: event.title,
          content: commit.commit.message,
          authorExternalId: commit.author?.login || commit.commit.author?.name || 'unknown',
          platformCreatedAt: commit.commit.author?.date || commit.commit.committer?.date || ''
        });
      }
      
      console.log(`📝 [GITHUB SERVICE] Processed commit: ${(commit.sha as string).substring(0, 8)} - ${event.title}`);
      
      return event;
    }, "github_service_process_commit");

    if (error) {
      console.error("❌ [GITHUB SERVICE] Failed to process commit:", error);
      throw error;
    }

    return result;
  }

  /**
   * Process a GitHub release and convert it to a common event format
   */
  async processRelease(release: GitHubRelease, repository: string): Promise<ProcessedGitHubEvent> {
    const [result, error] = await tryCatchWithLoggingAsync(async () => {
      const event: ProcessedGitHubEvent = {
        id: release.id.toString(),
        source: "github",
        type: "release",
        repository,
        timestamp: release.created_at,
        title: release.name || release.tag_name,
        author: release.author?.login,
        status: release.draft ? "draft" : "published",
        metadata: {
          tagName: release.tag_name,
          name: release.name,
          body: release.body,
          draft: release.draft,
          prerelease: release.prerelease,
          assets: release.assets?.length || 0,
          url: release.html_url,
        },
      };

      // Save to repository
      await this.eventRepository.saveGitHubEvent(event);
      
      console.log(`📝 [GITHUB SERVICE] Processed release: ${release.tag_name} - ${event.title}`);
      
      return event;
    }, "github_service_process_release");

    if (error) {
      console.error("❌ [GITHUB SERVICE] Failed to process release:", error);
      throw error;
    }

    return result;
  }

  /**
   * Process a collection of GitHub resources
   */
  async processResources(resources: GitHubResource[]): Promise<ProcessedGitHubEvent[]> {
    const [result, error] = await tryCatchWithLoggingAsync(async () => {
      const processedEvents: ProcessedGitHubEvent[] = [];
      
      for (const resource of resources) {
        const [event, resourceError] = await tryCatchWithLoggingAsync(async () => {
          let event: ProcessedGitHubEvent;
          
          switch (resource.type) {
            case "issue":
            case "pull_request":
              event = await this.processIssue(resource.data as GitHubIssue, resource.repository);
              break;
            case "commit":
              event = await this.processCommit(resource.data as GitHubCommit, resource.repository);
              break;
            case "release":
              event = await this.processRelease(resource.data as GitHubRelease, resource.repository);
              break;
            default:
              throw new Error(`Unknown resource type: ${resource.type}`);
          }
          
          return event;
        }, `github_service_process_resource_${resource.type}`);

        if (resourceError) {
          console.error(`❌ [GITHUB SERVICE] Failed to process resource ${resource.id}:`, resourceError);
          // Continue processing other resources
        } else if (event) {
          processedEvents.push(event);
        }
      }
      
      console.log(`✅ [GITHUB SERVICE] Processed ${processedEvents.length}/${resources.length} resources`);
      return processedEvents;
    }, "github_service_process_resources");

    if (error) {
      console.error("❌ [GITHUB SERVICE] Failed to process resources:", error);
      throw error;
    }

    return result;
  }

  private async processGitHubContent(source: KnowledgeSource): Promise<void> {
    try {
      // Skip processing very short content or automated commits
      if (source.content.length < 15 || 
          source.content.includes('Merge pull request') ||
          source.content.includes('dependabot') ||
          source.content.startsWith('chore:') ||
          source.content.startsWith('ci:')) {
        console.log(`⏭️ [GITHUB SERVICE] Skipping short/automated content: ${source.externalId}`);
        return;
      }

      // Get current organization
      const org = await getCurrentOrganization();
      if (!org) {
        console.error('❌ [GITHUB SERVICE] No organization found. Please create one first.');
        return;
      }

      await getKnowledgeEngine().ingestKnowledgeSource(source, org.id);
      console.log(`📋 [GITHUB SERVICE] Processed ${source.sourceType} content: ${source.externalId}`);
      
    } catch (error) {
      console.error(`❌ [GITHUB SERVICE] Failed to process content ${source.externalId}:`, error);
      // Don't throw - we want GitHub events to continue processing even if processing fails
    }
  }
}
