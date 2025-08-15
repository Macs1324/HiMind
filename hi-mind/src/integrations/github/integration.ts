import { SimpleGitHubClient } from './simple-client';

let githubClient: SimpleGitHubClient | null = null;

export async function startGitHubIntegration(): Promise<void> {
  try {
    if (!process.env.GITHUB_TOKEN) {
      console.log('⚠️ [GITHUB] GITHUB_TOKEN not set, skipping GitHub integration');
      return;
    }

    githubClient = new SimpleGitHubClient();
    await githubClient.start();
  } catch (error) {
    console.error('❌ [GITHUB] Failed to start GitHub integration:', error);
  }
}

export function stopGitHubIntegration(): void {
  if (githubClient) {
    githubClient.stop();
    githubClient = null;
  }
}

export function getGitHubClient(): SimpleGitHubClient | null {
  return githubClient;
}
