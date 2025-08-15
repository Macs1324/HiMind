// Export new architecture
export { GitHubController } from "./github.controller";
export { GitHubService } from "./github.service";
export { GitHubAPIClient } from "./github-api-client";
export type { ProcessedGitHubEvent, GitHubResource } from "./github.service";

// Export integration functions
export { 
  startGitHubIntegration, 
  stopGitHubIntegration, 
  getGitHubController,
  triggerGitHubBackfill
} from "./integration";
