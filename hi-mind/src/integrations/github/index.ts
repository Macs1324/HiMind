export { SimpleGitHubClient } from "./simple-client";
export type { GitHubResource } from "./simple-client";

// Export integration functions
export { 
  startGitHubIntegration, 
  stopGitHubIntegration, 
  getGitHubClient 
} from "./integration";
