import { tryCatchWithLoggingAsync } from "@/utils/try-catch";

export interface GitHubEvent {
  id: string;
  source: "github";
  type: "issue" | "pull_request" | "commit" | "release";
  repository: string;
  timestamp: string;
  title?: string;
  author?: string;
  status?: string;
  metadata: Record<string, unknown>;
}

export interface EventRepository {
  saveGitHubEvent(event: GitHubEvent): Promise<void>;
  getGitHubEvents(repository?: string, type?: string, limit?: number): Promise<GitHubEvent[]>;
}

export class LoggingEventRepository implements EventRepository {
  constructor() {} // No dependencies needed for logging

  async saveGitHubEvent(event: GitHubEvent): Promise<void> {
    const [, error] = await tryCatchWithLoggingAsync(async () => {
      // Log each event in the same style as the original GitHub integration
      console.log(
        JSON.stringify(
          {
            source: "github",
            kind: event.type,
            repository: event.repository,
            id: event.id,
            title: event.title,
            author: event.author,
            status: event.status,
            timestamp: event.timestamp,
            metadata: event.metadata,
          },
          null,
          2,
        ),
      );
      
      console.log(`✅ [EVENT REPOSITORY] Processed GitHub ${event.type}: ${event.id}`);
    }, "event_repository_save_github_event");

    if (error) {
      console.error("❌ [EVENT REPOSITORY] Failed to save GitHub event:", error);
      throw error;
    }
  }

  async getGitHubEvents(repository?: string, type?: string, limit: number = 100): Promise<GitHubEvent[]> {
    const [result, error] = await tryCatchWithLoggingAsync(async () => {
      console.log(`🔍 [EVENT REPOSITORY] Fetching GitHub events (repo: ${repository}, type: ${type}, limit: ${limit})`);
      
      // For now, return empty array
      // TODO: Implement actual Supabase query
      const events: GitHubEvent[] = [];
      
      console.log(`✅ [EVENT REPOSITORY] Retrieved ${events.length} GitHub events`);
      return events;
    }, "event_repository_get_github_events");

    if (error) {
      console.error("❌ [EVENT REPOSITORY] Failed to get GitHub events:", error);
      throw error;
    }

    return result;
  }
}
