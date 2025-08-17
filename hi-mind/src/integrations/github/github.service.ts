import { tryCatchWithLoggingAsync } from "@/utils/try-catch";
import { EventRepository, type GitHubEvent } from "@/integrations/github/github.repository";
import { type KnowledgeSource } from "@/core/knowledge-engine";
import { getKnowledgeEngine } from "@/core/knowledge-engine-singleton";
import { getCurrentOrganization } from "@/lib/organization";
import { GitHubAPIClient } from "./github-api-client";
import { createServiceClient } from "@/utils/supabase/service";
import OpenAI from 'openai';

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
  private openai: OpenAI;
  private githubClient: GitHubAPIClient;
  private supabase: ReturnType<typeof createServiceClient>;

  constructor(private eventRepository: EventRepository) {
    // Initialize OpenAI client for commit analysis
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key required for GitHub commit analysis. Please set OPENAI_API_KEY environment variable.');
    }
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Initialize GitHub API client for detailed commit fetching
    this.githubClient = new GitHubAPIClient();

    // Initialize Supabase client for direct database access
    this.supabase = createServiceClient();
  }

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
      
      // Enhanced commit processing with LLM analysis
      await this.processCommitWithLLM(commit, repository, event);
      
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

  /**
   * Process commit with enhanced LLM analysis to extract meaningful knowledge points
   */
  private async processCommitWithLLM(commit: GitHubCommit, repository: string, _event: ProcessedGitHubEvent): Promise<void> {
    try {
      // Skip trivial commits
      if (this.shouldSkipCommit(commit)) {
        console.log(`⏭️ [GITHUB SERVICE] Skipping trivial commit: ${commit.sha.substring(0, 8)}`);
        return;
      }

      // Fetch detailed commit with file diffs
      const [owner, repo] = repository.split('/');
      const commitDetails = await this.githubClient.fetchCommitDetails(owner, repo, commit.sha);
      
      if (!commitDetails?.files || commitDetails.files.length === 0) {
        console.log(`⏭️ [GITHUB SERVICE] No files in commit: ${commit.sha.substring(0, 8)}`);
        return;
      }

      // Filter out non-meaningful files
      const meaningfulFiles = this.filterMeaningfulFiles(commitDetails.files);
      
      if (meaningfulFiles.length === 0) {
        console.log(`⏭️ [GITHUB SERVICE] No meaningful files in commit: ${commit.sha.substring(0, 8)}`);
        return;
      }

      // Extract knowledge points using LLM
      const knowledgePoints = await this.extractKnowledgePointsFromCommit(
        commit, 
        meaningfulFiles, 
        repository
      );

      // Process each knowledge point
      const org = await getCurrentOrganization();
      if (!org) {
        console.error('❌ [GITHUB SERVICE] No organization found');
        return;
      }

      for (const [index, kp] of knowledgePoints.entries()) {
        // Process GitHub commit knowledge points with custom handling
        // Use title for display (summary) and recap for embeddings
        await this.processGitHubKnowledgePoint(
          commit,
          kp,
          index,
          org.id
        );
        console.log(`📋 [GITHUB SERVICE] Processed knowledge point ${index + 1}/${knowledgePoints.length}: ${kp.title}`);
      }

    } catch (error) {
      console.error(`❌ [GITHUB SERVICE] Failed to process commit with LLM: ${commit.sha.substring(0, 8)}`, error);
      // Don't throw - continue processing other commits
    }
  }

  /**
   * Check if commit should be skipped
   */
  private shouldSkipCommit(commit: GitHubCommit): boolean {
    const message = commit.commit.message.toLowerCase();
    
    const skipPatterns = [
      'merge pull request',
      'merge branch',
      'dependabot',
      'automated',
      'auto-update',
      'lock file',
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml',
      'formatting',
      'lint fix',
      'typo',
      'whitespace'
    ];

    return message.length < 10 || skipPatterns.some(pattern => message.includes(pattern));
  }

  /**
   * Filter out generated/tooling files that shouldn't be processed
   */
  private filterMeaningfulFiles(files: Array<{ filename: string; changes?: number; patch?: string; status: string }>): Array<{ filename: string; changes?: number; patch?: string; status: string }> {
    const skipExtensions = new Set(['.lock', '.min.js', '.min.css', '.map']);
    const skipFiles = new Set([
      'package-lock.json',
      'yarn.lock', 
      'pnpm-lock.yaml',
      'Cargo.lock',
      'composer.lock',
      'Gemfile.lock'
    ]);
    const skipDirectories = new Set(['node_modules', 'vendor', 'build', 'dist', 'target', '.next']);

    return files.filter(file => {
      const filename = file.filename.toLowerCase();
      const basename = filename.split('/').pop() || '';
      const ext = basename.includes('.') ? '.' + basename.split('.').pop() : '';
      const dirs = filename.split('/');

      // Skip lock files and generated files
      if (skipFiles.has(basename) || skipExtensions.has(ext)) {
        return false;
      }

      // Skip files in build/generated directories
      if (dirs.some(dir => skipDirectories.has(dir))) {
        return false;
      }

      // Skip very large files (likely generated)
      if (file.changes && file.changes > 1000) {
        return false;
      }

      // Skip binary files
      if (file.patch === undefined) {
        return false;
      }

      return true;
    });
  }

  /**
   * Process a single GitHub commit knowledge point with custom handling
   */
  private async processGitHubKnowledgePoint(
    commit: GitHubCommit,
    knowledgePoint: { title: string; recap: string },
    index: number,
    organizationId: string
  ): Promise<void> {
    try {
      // 1. Resolve author to person_id (using same logic as knowledge engine)
      const authorExternalId = commit.author?.login || commit.commit.author?.name || 'unknown';
      const authorPersonId = await this.getOrCreateAuthorPerson(commit, organizationId);

      // 2. Store the raw knowledge source
      const { data: knowledgeSource, error: sourceError } = await this.supabase
        .from('knowledge_sources')
        .upsert({
          organization_id: organizationId,
          platform: 'github',
          source_type: 'github_comment',
          external_id: `${commit.sha}-kp-${index}`,
          external_url: `${commit.html_url}#kp-${index}`,
          title: knowledgePoint.title,
          content: knowledgePoint.recap,
          author_external_id: authorExternalId,
          author_person_id: authorPersonId,
          platform_created_at: commit.commit.author?.date || commit.commit.committer?.date || ''
        }, { 
          onConflict: 'organization_id,platform,external_id'
        })
        .select()
        .single();

      if (sourceError) {
        console.error('Failed to store GitHub knowledge source:', sourceError);
        return;
      }

      // 2. Generate embedding from the detailed recap
      const embedding = await this.generateEmbedding(knowledgePoint.recap);

      // 3. Store the processed knowledge point with title as summary
      const { error: pointError } = await this.supabase
        .from('knowledge_points')
        .upsert({
          source_id: knowledgeSource.id,
          summary: knowledgePoint.title, // Use short title for display
          keywords: this.extractSimpleKeywords(knowledgePoint.recap),
          embedding: embedding,
          quality_score: 0.8, // High quality since LLM-extracted
          relevance_score: 0.8
        }, {
          onConflict: 'source_id'
        })
        .select()
        .single();

      if (pointError) {
        console.error('Failed to store GitHub knowledge point:', pointError);
        return;
      }

      console.log(`✅ [GITHUB SERVICE] Processed GitHub knowledge point: ${knowledgePoint.title}`);

    } catch (error) {
      console.error('❌ [GITHUB SERVICE] Failed to process GitHub knowledge point:', error);
    }
  }

  /**
   * Extract knowledge points from commit using LLM analysis
   */
  private async extractKnowledgePointsFromCommit(
    commit: GitHubCommit, 
    files: Array<{ filename: string; changes?: number; patch?: string; status: string }>, 
    repository: string
  ): Promise<Array<{ title: string; recap: string }>> {
    try {
      // Prepare file summaries for LLM analysis
      const fileSummaries = files.map(file => {
        const patch = file.patch || '';
        const truncatedPatch = patch.length > 2000 ? patch.substring(0, 2000) + '...' : patch;
        
        return {
          filename: file.filename,
          status: file.status, // added, modified, deleted
          changes: file.changes,
          patch: truncatedPatch
        };
      });

      const prompt = `Analyze this Git commit and extract meaningful knowledge points. Each knowledge point should represent roughly 100-200 lines of logical changes.

Repository: ${repository}
Commit Message: ${commit.commit.message}
Author: ${commit.commit.author?.name || 'Unknown'}

Files Changed:
${fileSummaries.map(f => `- ${f.filename} (${f.status}, ${f.changes} changes)`).join('\n')}

File Diffs:
${fileSummaries.map(f => `\n=== ${f.filename} ===\n${f.patch}`).join('\n')}

Extract knowledge points as a JSON array. For each knowledge point:
1. Create a concise title (3-8 words) describing what was implemented/changed
2. Write a detailed recap (50-150 words) explaining WHAT was done and WHY, in natural language that would be useful for searching and clustering with non-code discussions

Focus on:
- New features or functionality
- Important bug fixes
- Architecture/design changes
- API changes
- Performance improvements
- Security implementations

Avoid:
- Minor refactoring
- Formatting changes
- Simple variable renames

Respond with JSON only:
{
  "knowledgePoints": [
    {
      "title": "Brief descriptive title",
      "recap": "Detailed natural language description of what was implemented, why it was needed, and how it works. This should read like documentation that a human would write to explain the change to a colleague."
    }
  ]
}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.2,
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{"knowledgePoints": []}');
      const knowledgePoints = result.knowledgePoints || [];

      console.log(`🤖 [GITHUB SERVICE] LLM extracted ${knowledgePoints.length} knowledge points from commit ${commit.sha.substring(0, 8)}`);
      
      return knowledgePoints;

    } catch (error) {
      console.error('❌ [GITHUB SERVICE] Failed to extract knowledge points with LLM:', error);
      return [];
    }
  }

  /**
   * Generate embedding for text (copied from knowledge engine)
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text.substring(0, 8000), // Limit input size
        encoding_format: 'float',
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('Failed to generate embedding:', error);
      // Return a zero vector as fallback
      return new Array(1536).fill(0);
    }
  }

  /**
   * Simple keyword extraction from text
   */
  private extractSimpleKeywords(text: string): string[] {
    const techKeywords = [
      'react', 'javascript', 'typescript', 'node', 'api', 'database', 'sql',
      'docker', 'kubernetes', 'aws', 'authentication', 'security', 'performance',
      'bug', 'fix', 'feature', 'deployment', 'test', 'error', 'issue', 'component',
      'function', 'class', 'interface', 'type', 'hook', 'middleware', 'service',
      'controller', 'model', 'view', 'route', 'endpoint', 'validation', 'logging'
    ];

    const lowerText = text.toLowerCase();
    return techKeywords.filter(keyword => lowerText.includes(keyword));
  }

  /**
   * Get or create person for GitHub commit author
   */
  private async getOrCreateAuthorPerson(commit: GitHubCommit, organizationId: string): Promise<string | null> {
    const authorExternalId = commit.author?.login || commit.commit.author?.name || 'unknown';
    
    if (!authorExternalId || authorExternalId === 'unknown') {
      return null;
    }

    try {
      console.log(`🔍 [GITHUB SERVICE] Resolving author for github:${authorExternalId}`);

      // Check if we already have this external identity linked
      const { data: existingIdentity } = await this.supabase
        .from('external_identities')
        .select('person_id, people(*)')
        .eq('platform', 'github')
        .eq('external_id', authorExternalId)
        .single();

      if (existingIdentity) {
        console.log(`✅ [GITHUB SERVICE] Author already linked to person: ${existingIdentity.people?.display_name}`);
        return existingIdentity.person_id;
      }

      // Try to fetch GitHub user info for email-based matching
      let userEmail: string | null = null;
      let displayName: string | null = null;
      let username: string | null = null;

      try {
        // Use GitHub API to get user details
        const userInfo = await this.fetchGithubUserInfo(authorExternalId);
        userEmail = userInfo?.email || null;
        displayName = userInfo?.displayName || null;
        username = userInfo?.username || null;
      } catch (error) {
        console.log(`⚠️ [GITHUB SERVICE] Could not fetch GitHub user info for ${authorExternalId}:`, error);
      }

      // Import PeopleService dynamically to avoid circular dependencies
      const { PeopleService } = await import('@/lib/database');
      const peopleService = new PeopleService(this.supabase);

      let personId: string;

      if (userEmail) {
        // Try to find existing person by email
        const { data: existingPerson } = await peopleService.getPersonByEmail(userEmail, organizationId);

        if (existingPerson) {
          // Link to existing person
          personId = existingPerson.id;
          console.log(`🔗 [GITHUB SERVICE] Linking GitHub identity to existing person: ${existingPerson.display_name} (${userEmail})`);
        } else {
          // Create new person
          const { data: newPerson } = await peopleService.createPerson(
            organizationId, 
            displayName || username || `GitHub User`,
            userEmail
          );
          
          if (!newPerson) {
            console.error(`❌ [GITHUB SERVICE] Failed to create person for ${userEmail}`);
            return null;
          }

          personId = newPerson.id;
          console.log(`👤 [GITHUB SERVICE] Created new person: ${newPerson.display_name} (${userEmail})`);
        }
      } else {
        // No email - try fuzzy name matching or create new person
        if (displayName) {
          const existingPerson = await this.findPersonByFuzzyNameMatch(displayName, organizationId);
          
          if (existingPerson) {
            console.log(`🔗 [GITHUB SERVICE] Found existing person by name match: "${displayName}" → "${existingPerson.display_name}"`);
            personId = existingPerson.id;
          } else {
            // Create new person without email
            const { data: newPerson } = await peopleService.createPerson(
              organizationId, 
              displayName || username || `GitHub User`,
              undefined // no email
            );
            
            if (!newPerson) {
              console.error(`❌ [GITHUB SERVICE] Failed to create person for ${displayName}`);
              return null;
            }

            personId = newPerson.id;
            console.log(`👤 [GITHUB SERVICE] Created new person: ${newPerson.display_name}`);
          }
        } else {
          console.log(`⚠️ [GITHUB SERVICE] No email or name found for ${authorExternalId}`);
          return null;
        }
      }

      // Create external identity link
      await peopleService.createExternalIdentity(
        personId,
        'github',
        authorExternalId,
        username || undefined
      );

      console.log(`✅ [GITHUB SERVICE] Successfully linked github:${authorExternalId} to person`);
      return personId;

    } catch (error) {
      console.error(`❌ [GITHUB SERVICE] Failed to resolve author by email:`, error);
      return null;
    }
  }

  /**
   * Fetch GitHub user information including email
   */
  private async fetchGithubUserInfo(userId: string): Promise<{ email?: string; displayName?: string; username?: string } | null> {
    try {
      console.log(`🔍 [GITHUB SERVICE] Fetching GitHub user info for: ${userId}`);
      
      if (!process.env.GITHUB_TOKEN) {
        console.log(`⚠️ [GITHUB SERVICE] GITHUB_TOKEN not set, cannot fetch user info`);
        return null;
      }
      
      const { Octokit } = await import('@octokit/rest');
      const octokit = new Octokit({
        auth: process.env.GITHUB_TOKEN,
      });

      const result = await octokit.rest.users.getByUsername({ username: userId });
      
      if (result.data) {
        return {
          email: result.data.email, // May be null if private
          displayName: result.data.name,
          username: result.data.login
        };
      }
    } catch (error) {
      console.error(`❌ [GITHUB SERVICE] Failed to fetch GitHub user info for ${userId}:`, error);
    }
    return null;
  }

  /**
   * Find existing person by fuzzy name matching
   */
  private async findPersonByFuzzyNameMatch(targetName: string, organizationId: string): Promise<{ id: string; display_name: string } | null> {
    try {
      // Get all people in the organization
      const { data: people } = await this.supabase
        .from('people')
        .select('*')
        .eq('organization_id', organizationId);

      if (!people || people.length === 0) {
        return null;
      }

      const normalizedTarget = this.normalizeName(targetName);
      
      // Find exact normalized match first
      const exactMatch = people.find(person => 
        this.normalizeName(person.display_name) === normalizedTarget
      );

      if (exactMatch) {
        return exactMatch;
      }

      // Find fuzzy matches with similarity scoring
      const fuzzyMatches = people.map(person => ({
        person,
        similarity: this.calculateNameSimilarity(normalizedTarget, this.normalizeName(person.display_name))
      }))
      .filter(match => match.similarity > 0.8) // High threshold for confidence
      .sort((a, b) => b.similarity - a.similarity);

      return fuzzyMatches.length > 0 ? fuzzyMatches[0].person : null;

    } catch (error) {
      console.error(`❌ [GITHUB SERVICE] Fuzzy name matching failed:`, error);
      return null;
    }
  }

  /**
   * Normalize name for comparison
   */
  private normalizeName(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' '); // Normalize spaces
  }

  /**
   * Calculate similarity between two normalized names
   */
  private calculateNameSimilarity(name1: string, name2: string): number {
    // Simple Levenshtein distance-based similarity
    const maxLength = Math.max(name1.length, name2.length);
    if (maxLength === 0) return 1; // Both empty
    
    const distance = this.levenshteinDistance(name1, name2);
    return 1 - (distance / maxLength);
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }
}
