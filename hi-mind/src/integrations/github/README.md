# GitHub Integration - Controller/Service Architecture

This directory contains the refactored GitHub integration following a clean separation of concerns pattern.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    CONTROLLER LAYER                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              GitHubController                        │   │
│  │  • Entry points for all GitHub operations           │   │
│  │  • Request routing and validation                   │   │
│  │  • Orchestrates service calls                       │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    SERVICE LAYER                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              GitHubService                           │   │
│  │  • Business logic for GitHub resources              │   │
│  │  • Data transformation and normalization            │   │
│  │  • Event processing and validation                  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   REPOSITORY LAYER                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              EventRepository                         │   │
│  │  • Data persistence operations                      │   │
│  │  • Supabase integration                             │   │
│  │  • Event storage and retrieval                      │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## File Structure

- **`github.controller.ts`** - Entry points for all GitHub operations
- **`github.service.ts`** - Business logic and data processing
- **`github-api-client.ts`** - GitHub API client for data fetching
- **`integration.ts`** - Main integration setup and dependency injection
- **`index.ts`** - Public exports and types

## Key Benefits

1. **Clear Separation of Concerns**
   - Controllers handle entry points and routing
   - Services contain business logic
   - Repositories handle data persistence

2. **Simplified Configuration**
   - No complex options or parameters
   - Always fetches everything from configured repository
   - Simple environment variable setup

3. **Testability**
   - Each layer can be tested independently
   - Easy to mock dependencies
   - Clear interfaces between layers

4. **Maintainability**
   - Single responsibility per class
   - Easy to add new features
   - Clear dependency flow

5. **Next.js Integration**
   - Follows Next.js API route patterns
   - Easy to expose as REST endpoints
   - Server actions integration ready

## Usage Examples

### From Page Components

```typescript
// app/page.tsx
import { startGitHubIntegration } from '@/integrations/github';

// Initialize on startup
startGitHubIntegration().catch(console.error);
```

### From Direct Integration

```typescript
// app/actions/github.ts
'use server'

import { triggerGitHubBackfill } from '@/integrations/github';

export async function runGitHubBackfill(owner: string, repo: string) {
  return await triggerGitHubBackfill(owner, repo);
}
```

### Direct Integration

```typescript
import { getGitHubController } from '@/integrations/github';

const controller = getGitHubController();
if (controller) {
  await controller.triggerBackfill({ owner: 'johndoe', repo: 'my-repo' });
}
```

const controller = getGitHubController();
if (controller) {
  const result = await controller.triggerBackfill({
    owner: 'username',
    repo: 'repository',
    includeIssues: true,
    includeCommits: true
  });
}
```

## Next Steps

1. **Refactor Slack Integration** - Apply the same pattern
2. **Implement Real Data Fetching** - Replace placeholder methods in controller
3. **Add Error Handling** - Implement proper error boundaries
4. **Add Validation** - Input validation and sanitization
5. **Add Logging** - Structured logging for debugging
6. **Add Tests** - Unit tests for each layer

## Dependencies

- `@/utils/try-catch` - Error handling utility
- `@/services/event.repository` - Data persistence interface
- `@/utils/supabase/server` - Supabase client creation

## Environment Variables

- `GITHUB_TOKEN` - GitHub personal access token
- `GITHUB_TARGET_REPOSITORY` - Default repository for backfill (optional)
