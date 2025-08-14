### GitHub Integration Spec (Backfill via Personal Access Token) — HiMind Hackathon

#### Goal
- **Enable**: one-off and scheduled backfills of GitHub repository activity using Personal Access Token authentication.
- **Route**: dispatch backfilled items to the Passive pipeline (no local/Git persistence in this layer).
- **Boundary**: GitHub integration stops at routing. No embedding, agent logic, or storage here.
- **Operate**: exclusively via REST APIs with Personal Access Token. No webhooks, real-time ingestion, or complex app setup in MVP.

#### Constraints
- Access is limited to repositories the Personal Access Token has access to.
- Private repos require the token to have `repo` scope, public repos only need `public_repo` scope.
- Use resource-specific endpoints for full coverage (issues/PRs/commits). The Events API alone is insufficient for historical import.
- Rate limits apply (REST API); implement pagination and simple backoff.

### Architecture Overview
- **Transport**: Batch API ingestion using Personal Access Token authentication.
- **Integration Layer Responsibilities**:
  - Authenticate using Personal Access Token with appropriate repository scopes.
  - Fetch historical resources from specified repositories with pagination and simple backoff.
  - Dispatch fetched items to the Passive pipeline.
  - No repo or disk persistence in this layer.
- **Downstream** (outside GitHub integration scope):
  - Embedding/vectorization/indexing
  - Any persistence, analytics, or search

### Process model
- Backfill runs as a job/service that authenticates using Personal Access Token and pulls data in batches, then streams to the Passive pipeline.
- Can be invoked manually (CLI) or scheduled.
- Configuration values are loaded from environment variables with minimal setup required.

### Backfill Targets
- Issues (with comments)
- Pull requests (with reviews and review comments)
- Commits (with commit comments)
- Releases
- Optional: Discussions (with comments)

### Prerequisites & Secrets
- [ ] `GITHUB_TOKEN` (Personal Access Token with appropriate repository scopes)
- [ ] Target repository selection (owner/repo format)

### Personal Access Token Setup
- [ ] Create a Personal Access Token: [GitHub Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens)
- [ ] Choose appropriate scopes: `repo` (private repos) or `public_repo` (public repos only)
- [ ] Copy the generated token for use in environment variables

### Token Scopes
Reading (minimum viable):
- [ ] **Repository access**: `repo` (private repos) or `public_repo` (public repos only)
- [ ] **Issues**: Read (included in repo scope)
- [ ] **Pull requests**: Read (included in repo scope)
- [ ] **Contents**: Read (included in repo scope)
- [ ] **Commit history**: Read (included in repo scope)

### Events & Subscriptions
Not required for backfill-only MVP. Personal Access Token provides direct API access without webhook setup.

### Integration interfaces
This layer forwards fetched items to the Passive pipeline for ingestion.

### Components (conceptual)
- Simple GitHub client (Personal Access Token + Octokit for backfill).
- Backfill importer (resource-wise pagination and simple backoff).
- Routing logic (streams items to Passive pipeline).

### Implementation Plan

#### 1) Simple GitHub Client
- [ ] Use Personal Access Token authentication via Octokit.
- [ ] Provide helpers to list resources with pagination and simple backoff.

#### 2) Backfill Importer
- [ ] Use configured target repositories (owner/repo format).
- [ ] Backfill by resource families (paged, incremental): issues, pull requests, commits.
- [ ] Handle rate limits with simple backoff; implement pagination for full history.

#### 3) Logging, Security, Reliability
- [ ] Secure token storage in environment variables.
- [ ] Implement simple backoff for GitHub API rate limits; keep integration-layer logging minimal.

#### 4) Testing Plan
- [ ] Backfill at least one repository and observe Passive pipeline dispatches.

### Local Development
- [ ] Create Personal Access Token with appropriate repository scopes
- [ ] Set `GITHUB_TOKEN` environment variable
- [ ] Run the backfill job locally against test repositories

### Configuration
- [ ] `.env.example` must include:
  - [ ] `GITHUB_TOKEN=ghp_your_personal_access_token`
  - [ ] Target repository variables (e.g., `GITHUB_TARGET_REPOSITORIES="owner/repo"`)

### Definition of Done (Hackathon)
- [ ] Backfill job authenticates successfully using Personal Access Token.
- [ ] Imports historical issues, PRs, and commits for at least one repository.
- [ ] Streams imported items to the Passive pipeline.
- [ ] Respects rate limits and paginates through full history.

### References
- Personal Access Token auth: [docs.github.com — Creating a personal access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)
- REST API resources: [docs.github.com — REST API](https://docs.github.com/en/rest)
- Octokit.js: [github.com/octokit/octokit.js](https://github.com/octokit/octokit.js)


