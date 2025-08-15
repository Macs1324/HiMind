// GitHub-specific content extractor

import type { PlatformExtractor, RawContent } from '@/core/types/processing'

export interface GitHubPullRequest {
  number: number
  title: string
  body: string | null
  state: 'open' | 'closed' | 'merged'
  user: GitHubUser
  created_at: string
  updated_at: string
  merged_at: string | null
  html_url: string
  head: {
    ref: string
    repo: GitHubRepository
  }
  base: {
    ref: string
    repo: GitHubRepository
  }
  additions: number
  deletions: number
  changed_files: number
  commits: number
  review_comments: number
  comments: number
}

export interface GitHubIssue {
  number: number
  title: string
  body: string | null
  state: 'open' | 'closed'
  user: GitHubUser
  assignees: GitHubUser[]
  labels: Array<{ name: string; color: string; description?: string }>
  created_at: string
  updated_at: string
  closed_at: string | null
  html_url: string
  comments: number
  reactions: {
    total_count: number
    '+1': number
    '-1': number
    laugh: number
    hooray: number
    confused: number
    heart: number
    rocket: number
    eyes: number
  }
}

export interface GitHubComment {
  id: number
  body: string
  user: GitHubUser
  created_at: string
  updated_at: string
  html_url: string
  reactions: GitHubIssue['reactions']
}

export interface GitHubCommit {
  sha: string
  commit: {
    message: string
    author: {
      name: string
      email: string
      date: string
    }
  }
  author: GitHubUser | null
  html_url: string
  stats: {
    additions: number
    deletions: number
    total: number
  }
  files: Array<{
    filename: string
    status: 'added' | 'removed' | 'modified' | 'renamed'
    additions: number
    deletions: number
    changes: number
  }>
}

export interface GitHubRepository {
  id: number
  name: string
  full_name: string
  description: string | null
  language: string | null
  topics: string[]
  html_url: string
}

export interface GitHubUser {
  login: string
  id: number
  type: 'User' | 'Bot'
  site_admin: boolean
}

export class GitHubExtractor implements PlatformExtractor {
  platform = 'github'

  async extractContent(rawData: {
    type: 'pull_request' | 'issue' | 'comment' | 'commit'
    data: GitHubPullRequest | GitHubIssue | GitHubComment | GitHubCommit
    repository: GitHubRepository
    parentData?: any // For comments, this would be the parent issue/PR
  }): Promise<RawContent> {
    const { type, data, repository, parentData } = rawData

    switch (type) {
      case 'pull_request':
        return this.extractPullRequest(data as GitHubPullRequest, repository)
      case 'issue':
        return this.extractIssue(data as GitHubIssue, repository)
      case 'comment':
        return this.extractComment(data as GitHubComment, repository, parentData)
      case 'commit':
        return this.extractCommit(data as GitHubCommit, repository)
      default:
        throw new Error(`Unsupported GitHub content type: ${type}`)
    }
  }

  validateContent(content: RawContent): boolean {
    // Skip empty content
    if (content.content.length < 10) return false
    
    // Skip bot-generated content (unless it's substantive)
    if (this.isBotContent(content) && !this.isSubstantiveBotContent(content)) return false
    
    // Skip automated commits with generic messages
    if (content.type === 'commit' && this.isGenericCommit(content.content)) return false
    
    // Skip duplicate content (same title/body)
    if (this.isDuplicateContent(content)) return false
    
    return true
  }

  async enrichContext(content: RawContent): Promise<RawContent> {
    const enrichedMetadata = { ...content.metadata }
    
    // Add repository context
    enrichedMetadata.repositoryContext = this.inferRepositoryContext(
      content.metadata.repository as string,
      content.metadata.repositoryTopics as string[]
    )
    
    // Add file context for commits and PRs
    if (content.type === 'commit' || content.type === 'pr') {
      enrichedMetadata.fileContext = this.extractFileContext(content.metadata.files || [])
    }
    
    // Add label context for issues and PRs
    if (content.metadata.labels) {
      enrichedMetadata.labelContext = this.processLabels(content.metadata.labels as any[])
    }
    
    // Add technical context from diff/files
    if (content.metadata.additions || content.metadata.deletions) {
      enrichedMetadata.changeContext = this.analyzeChanges(content.metadata)
    }
    
    return {
      ...content,
      metadata: enrichedMetadata
    }
  }

  // ===========================
  // Content Type Extractors
  // ===========================

  private extractPullRequest(pr: GitHubPullRequest, repository: GitHubRepository): RawContent {
    const content = this.combineContent(
      pr.title,
      pr.body,
      `Pull request: ${pr.head.ref} → ${pr.base.ref}`
    )

    return {
      id: `pr-${pr.number}`,
      platform: 'github',
      type: 'pr',
      content,
      title: pr.title,
      author: {
        id: pr.user.login,
        username: pr.user.login,
        displayName: pr.user.login
      },
      metadata: {
        timestamp: pr.created_at,
        url: pr.html_url,
        repository: repository.full_name,
        repositoryTopics: repository.topics,
        language: repository.language,
        number: pr.number,
        state: pr.state,
        isMerged: pr.state === 'closed' && Boolean(pr.merged_at),
        mergedAt: pr.merged_at,
        sourceBranch: pr.head.ref,
        targetBranch: pr.base.ref,
        additions: pr.additions,
        deletions: pr.deletions,
        changedFiles: pr.changed_files,
        commits: pr.commits,
        reviewComments: pr.review_comments,
        comments: pr.comments,
        type: 'pull_request'
      },
      raw: { pr, repository }
    }
  }

  private extractIssue(issue: GitHubIssue, repository: GitHubRepository): RawContent {
    const content = this.combineContent(
      issue.title,
      issue.body,
      `Issue in ${repository.full_name}`
    )

    return {
      id: `issue-${issue.number}`,
      platform: 'github',
      type: 'issue',
      content,
      title: issue.title,
      author: {
        id: issue.user.login,
        username: issue.user.login,
        displayName: issue.user.login
      },
      metadata: {
        timestamp: issue.created_at,
        url: issue.html_url,
        repository: repository.full_name,
        repositoryTopics: repository.topics,
        language: repository.language,
        number: issue.number,
        state: issue.state,
        labels: issue.labels,
        assignees: issue.assignees.map(a => a.login),
        comments: issue.comments,
        reactions: this.processReactions(issue.reactions),
        closedAt: issue.closed_at,
        type: 'issue'
      },
      raw: { issue, repository }
    }
  }

  private extractComment(
    comment: GitHubComment, 
    repository: GitHubRepository, 
    parentData?: any
  ): RawContent {
    const parentContext = parentData ? `Comment on ${parentData.title || parentData.number}` : 'Comment'
    const content = this.combineContent(
      comment.body,
      null,
      parentContext
    )

    return {
      id: `comment-${comment.id}`,
      platform: 'github',
      type: 'comment',
      content,
      author: {
        id: comment.user.login,
        username: comment.user.login,
        displayName: comment.user.login
      },
      metadata: {
        timestamp: comment.created_at,
        url: comment.html_url,
        repository: repository.full_name,
        repositoryTopics: repository.topics,
        language: repository.language,
        parentId: parentData?.number ? `${parentData.type}-${parentData.number}` : undefined,
        parentTitle: parentData?.title,
        parentType: parentData?.type || 'unknown',
        reactions: this.processReactions(comment.reactions),
        updatedAt: comment.updated_at,
        type: 'comment'
      },
      raw: { comment, repository, parent: parentData }
    }
  }

  private extractCommit(commit: GitHubCommit, repository: GitHubRepository): RawContent {
    const content = this.combineContent(
      commit.commit.message,
      null,
      `Commit in ${repository.full_name}`
    )

    // Extract file information
    const fileInfo = commit.files?.map(file => ({
      name: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      language: this.inferFileLanguage(file.filename)
    })) || []

    return {
      id: `commit-${commit.sha}`,
      platform: 'github',
      type: 'commit',
      content,
      title: commit.commit.message.split('\n')[0], // First line as title
      author: {
        id: commit.author?.login || commit.commit.author.email,
        username: commit.author?.login,
        displayName: commit.author?.login || commit.commit.author.name
      },
      metadata: {
        timestamp: commit.commit.author.date,
        url: commit.html_url,
        repository: repository.full_name,
        repositoryTopics: repository.topics,
        language: repository.language,
        sha: commit.sha,
        shortSha: commit.sha.substring(0, 7),
        additions: commit.stats?.additions || 0,
        deletions: commit.stats?.deletions || 0,
        totalChanges: commit.stats?.total || 0,
        files: fileInfo,
        changedFiles: commit.files?.length || 0,
        authorEmail: commit.commit.author.email,
        type: 'commit'
      },
      raw: { commit, repository }
    }
  }

  // ===========================
  // Helper Methods
  // ===========================

  private combineContent(title: string, body: string | null, context?: string): string {
    const parts: string[] = []
    
    if (title) parts.push(title)
    if (body && body.trim()) parts.push(body.trim())
    if (context) parts.push(`[${context}]`)
    
    return parts.join('\n\n')
  }

  private processReactions(reactions: GitHubIssue['reactions']): Array<{ emoji: string; count: number; users: string[] }> {
    const reactionMap = {
      '+1': '👍',
      '-1': '👎',
      'laugh': '😄',
      'hooray': '🎉',
      'confused': '😕',
      'heart': '❤️',
      'rocket': '🚀',
      'eyes': '👀'
    }

    return Object.entries(reactions)
      .filter(([key, count]) => key !== 'total_count' && count > 0)
      .map(([key, count]) => ({
        emoji: reactionMap[key as keyof typeof reactionMap] || key,
        count: count as number,
        users: [] // GitHub API doesn't provide user list in this format
      }))
  }

  private isBotContent(content: RawContent): boolean {
    const author = content.author.username?.toLowerCase() || ''
    
    // Common bot patterns
    if (author.includes('bot') || author.includes('automated')) return true
    if (author.includes('dependabot') || author.includes('renovate')) return true
    if (author.includes('github-actions')) return true
    
    // Check content for bot patterns
    const text = content.content.toLowerCase()
    if (text.includes('automatically generated') || text.includes('auto-generated')) return true
    
    return false
  }

  private isSubstantiveBotContent(content: RawContent): boolean {
    // Some bot content is valuable (e.g., detailed security reports, comprehensive changelogs)
    const text = content.content.toLowerCase()
    
    if (text.includes('security') && text.includes('vulnerability')) return true
    if (text.includes('changelog') && content.content.length > 200) return true
    if (text.includes('breaking change') || text.includes('migration')) return true
    
    return false
  }

  private isGenericCommit(content: string): boolean {
    const message = content.toLowerCase().trim()
    
    const genericPatterns = [
      'merge branch',
      'merge pull request',
      'update',
      'fix',
      'wip',
      'tmp',
      'temp',
      'initial commit',
      'first commit',
      '.',
      'minor',
      'update readme'
    ]
    
    return genericPatterns.some(pattern => 
      message === pattern || 
      message.startsWith(pattern + ' ') ||
      message.length < 10
    )
  }

  private isDuplicateContent(content: RawContent): boolean {
    // This would need to check against existing content in the database
    // For now, just check for extremely short or empty content
    return content.content.trim().length < 5
  }

  private inferRepositoryContext(repoName: string, topics: string[]): {
    type: 'frontend' | 'backend' | 'fullstack' | 'mobile' | 'devops' | 'data' | 'library' | 'tool' | 'other'
    domain: string[]
    technologies: string[]
  } {
    const name = repoName.toLowerCase()
    const allTopics = topics.map(t => t.toLowerCase())
    
    // Infer type from name and topics
    let type: ReturnType<typeof this.inferRepositoryContext>['type'] = 'other'
    
    if (name.includes('frontend') || name.includes('ui') || name.includes('web') || 
        allTopics.some(t => ['react', 'vue', 'angular', 'frontend'].includes(t))) {
      type = 'frontend'
    } else if (name.includes('backend') || name.includes('api') || name.includes('server') ||
               allTopics.some(t => ['api', 'backend', 'server'].includes(t))) {
      type = 'backend'
    } else if (name.includes('mobile') || name.includes('ios') || name.includes('android') ||
               allTopics.some(t => ['mobile', 'ios', 'android', 'flutter', 'react-native'].includes(t))) {
      type = 'mobile'
    } else if (name.includes('devops') || name.includes('infra') || name.includes('deploy') ||
               allTopics.some(t => ['devops', 'infrastructure', 'kubernetes', 'docker'].includes(t))) {
      type = 'devops'
    } else if (name.includes('data') || name.includes('ml') || name.includes('ai') ||
               allTopics.some(t => ['data', 'machine-learning', 'ai', 'analytics'].includes(t))) {
      type = 'data'
    } else if (name.includes('lib') || name.includes('sdk') || name.includes('package') ||
               allTopics.some(t => ['library', 'sdk', 'package'].includes(t))) {
      type = 'library'
    } else if (name.includes('tool') || name.includes('cli') || name.includes('util') ||
               allTopics.some(t => ['tool', 'cli', 'utility'].includes(t))) {
      type = 'tool'
    }
    
    // Extract domain information
    const domain = topics.filter(topic => 
      !['javascript', 'typescript', 'python', 'java', 'go', 'rust'].includes(topic.toLowerCase())
    )
    
    // Extract technology information
    const technologies = topics.filter(topic => {
      const t = topic.toLowerCase()
      return ['javascript', 'typescript', 'python', 'java', 'go', 'rust', 'c++', 'c#',
              'react', 'vue', 'angular', 'node', 'django', 'flask', 'spring', 'express'].includes(t)
    })
    
    return { type, domain, technologies }
  }

  private extractFileContext(files: any[]): {
    languages: string[]
    directories: string[]
    fileTypes: string[]
    isDocumentation: boolean
    isTest: boolean
    isConfig: boolean
  } {
    const languages = new Set<string>()
    const directories = new Set<string>()
    const fileTypes = new Set<string>()
    let isDocumentation = false
    let isTest = false
    let isConfig = false
    
    files.forEach(file => {
      const filename = file.filename || file.name || ''
      
      // Extract language
      const language = this.inferFileLanguage(filename)
      if (language) languages.add(language)
      
      // Extract directory
      const dir = filename.split('/')[0]
      if (dir && dir !== filename) directories.add(dir)
      
      // Extract file type
      const ext = filename.split('.').pop()
      if (ext) fileTypes.add(ext)
      
      // Check for special file types
      if (filename.includes('README') || filename.includes('doc') || ext === 'md') {
        isDocumentation = true
      }
      if (filename.includes('test') || filename.includes('spec') || dir === 'tests') {
        isTest = true
      }
      if (filename.includes('config') || ['json', 'yml', 'yaml', 'toml', 'ini'].includes(ext || '')) {
        isConfig = true
      }
    })
    
    return {
      languages: Array.from(languages),
      directories: Array.from(directories),
      fileTypes: Array.from(fileTypes),
      isDocumentation,
      isTest,
      isConfig
    }
  }

  private processLabels(labels: any[]): {
    categories: string[]
    priorities: string[]
    types: string[]
    other: string[]
  } {
    const categories: string[] = []
    const priorities: string[] = []
    const types: string[] = []
    const other: string[] = []
    
    labels.forEach(label => {
      const name = label.name.toLowerCase()
      
      if (name.includes('priority') || name.includes('urgent') || name.includes('critical')) {
        priorities.push(label.name)
      } else if (name.includes('bug') || name.includes('feature') || name.includes('enhancement')) {
        types.push(label.name)
      } else if (name.includes('frontend') || name.includes('backend') || name.includes('api')) {
        categories.push(label.name)
      } else {
        other.push(label.name)
      }
    })
    
    return { categories, priorities, types, other }
  }

  private analyzeChanges(metadata: any): {
    scale: 'small' | 'medium' | 'large'
    type: 'feature' | 'bugfix' | 'refactor' | 'docs' | 'test' | 'config' | 'mixed'
    complexity: number
  } {
    const additions = metadata.additions || 0
    const deletions = metadata.deletions || 0
    const changedFiles = metadata.changedFiles || 0
    const totalChanges = additions + deletions
    
    // Determine scale
    let scale: 'small' | 'medium' | 'large' = 'small'
    if (totalChanges > 100 || changedFiles > 5) scale = 'medium'
    if (totalChanges > 500 || changedFiles > 15) scale = 'large'
    
    // Determine type (simplified)
    let type: 'feature' | 'bugfix' | 'refactor' | 'docs' | 'test' | 'config' | 'mixed' = 'mixed'
    
    // Calculate complexity score
    const complexity = Math.min(1.0, (totalChanges / 1000) + (changedFiles / 20))
    
    return { scale, type, complexity }
  }

  private inferFileLanguage(filename: string): string | null {
    const ext = filename.split('.').pop()?.toLowerCase()
    
    const languageMap: Record<string, string> = {
      'js': 'JavaScript',
      'jsx': 'JavaScript',
      'ts': 'TypeScript',
      'tsx': 'TypeScript',
      'py': 'Python',
      'java': 'Java',
      'go': 'Go',
      'rs': 'Rust',
      'cpp': 'C++',
      'c': 'C',
      'cs': 'C#',
      'rb': 'Ruby',
      'php': 'PHP',
      'swift': 'Swift',
      'kt': 'Kotlin',
      'scala': 'Scala',
      'html': 'HTML',
      'css': 'CSS',
      'scss': 'SCSS',
      'sass': 'Sass',
      'sql': 'SQL',
      'sh': 'Shell',
      'bash': 'Shell',
      'yml': 'YAML',
      'yaml': 'YAML',
      'json': 'JSON',
      'xml': 'XML',
      'md': 'Markdown'
    }
    
    return ext ? languageMap[ext] || null : null
  }
}

// Helper function to create and configure GitHub extractor
export function createGitHubExtractor(): GitHubExtractor {
  return new GitHubExtractor()
}