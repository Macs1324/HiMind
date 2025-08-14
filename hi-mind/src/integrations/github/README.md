# GitHub Integration

This integration enables one-off and scheduled backfills of GitHub repository activity using Personal Access Token authentication.

## Features

- **Simple Authentication**: Uses Personal Access Token for direct API access
- **Historical Backfill**: Imports issues, PRs, and commits with pagination
- **Rate Limit Handling**: Implements simple backoff to respect GitHub API limits
- **Minimal Configuration**: Just one token and target repository needed

## Setup

### 1. Create a Personal Access Token

1. Go to [GitHub Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Give it a name like "HiMind Integration"
4. Choose scopes:
   - **`repo`** (for private repositories)
   - **`public_repo`** (for public repositories only)
5. Copy the generated token

### 2. Environment Variables

Add these to your `.env` file:

```bash
# Required
GITHUB_TOKEN=ghp_your_personal_access_token_here

# Configuration (optional)
GITHUB_BACKFILL_DELAY=5000
GITHUB_RATE_LIMIT_DELAY=1000

# Target repository (format: "owner/repo")
GITHUB_REPOSITORY="johndoe/my-repo"
```

### 3. Install Dependencies

```bash
npm install @octokit/rest
```

## Usage

### Automatic Integration (Recommended)

```typescript
import { startGitHubIntegration } from '@/integrations/github';

// Start the GitHub integration (will auto-backfill configured repositories)
await startGitHubIntegration();
```

### Manual Control

```typescript
import { SimpleGitHubClient } from '@/integrations/github';

const client = new SimpleGitHubClient();

// Start the integration
await client.start();

// Run backfill manually
await client.runBackfill();

// Stop the integration
client.stop();
```

## Architecture

- **Transport**: Batch API ingestion using Personal Access Token authentication
- **Integration Layer**: Authenticates, fetches historical resources, and prepares for Passive pipeline
- **No Persistence**: This layer only routes data, no local storage

## Rate Limits

The integration respects GitHub's API rate limits by:
- Implementing simple backoff between requests
- Using pagination to fetch all resources
- Simple token-based authentication

## Next Steps

- [ ] Add support for comments and reviews
- [ ] Integrate with Passive pipeline for data dispatch
- [ ] Add incremental sync capabilities
- [ ] Implement webhook support for real-time updates
- [ ] Add organization-level backfill support
