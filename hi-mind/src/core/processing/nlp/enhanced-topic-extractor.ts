// Enhanced Topic Extraction Service - Advanced ML/NLP-based topic detection and clustering

import type { 
  ProcessedContent, 
  TopicDetection,
  KnowledgeStatement,
  NLPService 
} from '@/core/types/processing'

export interface TopicCandidate {
  name: string
  confidence: number
  category: 'technology' | 'domain' | 'process' | 'business' | 'problem' | 'emergent'
  keywords: string[]
  reasoning: string
  frequency?: number
  cooccurrence?: string[] // Topics that frequently appear together
  contextClues?: string[]
  semanticVector?: number[] // For clustering
}

export interface TopicCluster {
  id: string
  name: string
  centroid: number[]
  members: TopicCandidate[]
  coherenceScore: number
  emergenceStrength: number
}

export interface EnhancedTopicDetection extends TopicDetection {
  candidateTopics: TopicCandidate[]
  topicClusters: TopicCluster[]
  hierarchicalTopics: {
    parentTopic: string
    childTopics: string[]
    relationshipType: 'specialization' | 'component' | 'prerequisite'
  }[]
  confidenceMetrics: {
    overallConfidence: number
    extractionMethod: string
    agreementScore: number
  }
}

export class EnhancedTopicExtractor {
  private nlpService?: NLPService
  private topicVocabulary: Map<string, TopicCandidate> = new Map()
  private cooccurrenceMatrix: Map<string, Map<string, number>> = new Map()

  constructor(nlpService?: NLPService) {
    this.nlpService = nlpService
    this.initializeTopicVocabulary()
  }

  // Simplified method for content ingestion - doesn't require full NLP pipeline
  async extractTopicsAndStatements(text: string): Promise<{
    topics: Array<{ name: string; confidence: number; keywords: string[]; description?: string }>;
    statements: Array<{ headline: string; content: string; type: string; keywords: string[]; confidence: number }>;
  }> {
    // Use simplified extraction methods that don't require NLP service
    const topics = await this.extractSimplifiedTopics(text);
    const statements = await this.extractSimplifiedStatements(text);
    
    return { topics, statements };
  }

  private async extractSimplifiedTopics(text: string) {
    const topics: Array<{ name: string; confidence: number; keywords: string[]; description?: string }> = [];
    
    // Use keyword-based extraction without requiring embeddings
    const keywordTopics = await this.extractKeywordBasedTopics(
      this.extractTechnicalTerms(text),
      this.extractKeyPhrases(text)
    );
    
    return keywordTopics.map(topic => ({
      name: topic.name,
      confidence: topic.confidence,
      keywords: topic.keywords,
      description: topic.reasoning
    }));
  }

  private async extractSimplifiedStatements(text: string) {
    const statements: Array<{ headline: string; content: string; type: string; keywords: string[]; confidence: number }> = [];
    
    // Split into sentences and analyze
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 30);
    
    for (const sentence of sentences.slice(0, 3)) { // Limit to 3 statements
      const trimmed = sentence.trim();
      const type = this.determineContentType(trimmed);
      const keywords = this.extractTechnicalTerms(trimmed);
      const headline = this.generateHeadline(trimmed);
      const confidence = this.calculateConfidence(trimmed);
      
      statements.push({
        headline,
        content: trimmed,
        type,
        keywords,
        confidence
      });
    }
    
    return statements;
  }

  private extractTechnicalTerms(text: string): string[] {
    const techTerms = [
      'react', 'vue', 'angular', 'javascript', 'typescript', 'node', 'express',
      'api', 'rest', 'graphql', 'sql', 'database', 'mongodb', 'postgresql',
      'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'deployment', 'ci/cd',
      'auth', 'jwt', 'oauth', 'security', 'token', 'login', 'session'
    ];
    
    const lowerText = text.toLowerCase();
    return techTerms.filter(term => lowerText.includes(term));
  }

  private extractKeyPhrases(text: string): Array<{ text: string; score: number }> {
    // Simple key phrase extraction
    const phrases = text.split(/[,;]/).map(p => p.trim()).filter(p => p.length > 10);
    return phrases.slice(0, 5).map(phrase => ({ text: phrase, score: 0.5 }));
  }

  private determineContentType(text: string): string {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('how to') || lowerText.includes('guide')) return 'explanation';
    if (lowerText.includes('decided') || lowerText.includes('chose')) return 'decision';
    if (lowerText.includes('fixed') || lowerText.includes('solution')) return 'solution';
    if (lowerText.includes('should') || lowerText.includes('recommend')) return 'best_practice';
    return 'explanation';
  }

  private generateHeadline(text: string): string {
    const words = text.split(' ').slice(0, 8).join(' ');
    return words.length > 60 ? words.substring(0, 57) + '...' : words;
  }

  private calculateConfidence(text: string): number {
    let confidence = 0.5;
    if (text.length > 50) confidence += 0.2;
    if (this.extractTechnicalTerms(text).length > 0) confidence += 0.2;
    return Math.min(0.9, confidence);
  }

  // ===========================
  // Main Topic Detection Pipeline
  // ===========================

  async detectTopicsEnhanced(content: ProcessedContent): Promise<EnhancedTopicDetection> {
    const { cleanText, analysis, context, embedding } = content

    // Multi-strategy topic extraction
    const strategies = await Promise.all([
      this.extractSemanticTopics(cleanText, embedding),
      this.extractKeywordBasedTopics(analysis.technicalTerms, analysis.keyPhrases),
      this.extractContextualTopics(context),
      this.extractPatternBasedTopics(cleanText, analysis),
      this.extractDomainSpecificTopics(cleanText, context)
    ])

    // Merge and rank candidates
    const candidateTopics = this.mergeTopicCandidates(strategies.flat())
    
    // Apply clustering to find topic groups
    const topicClusters = await this.clusterTopics(candidateTopics)
    
    // Detect hierarchical relationships
    const hierarchicalTopics = this.detectTopicHierarchy(candidateTopics)
    
    // Build confidence metrics
    const confidenceMetrics = this.calculateConfidenceMetrics(candidateTopics, strategies)

    // Convert to legacy format for compatibility
    const topics = candidateTopics
      .filter(t => t.confidence > 0.4)
      .map(this.convertToLegacyTopic)

    return {
      topics,
      emergingTopics: candidateTopics.filter(t => t.category === 'emergent'),
      contextTopics: candidateTopics.filter(t => t.category === 'domain'),
      candidateTopics,
      topicClusters,
      hierarchicalTopics,
      confidenceMetrics
    }
  }

  // ===========================
  // Semantic Topic Extraction (Using Embeddings)
  // ===========================

  private async extractSemanticTopics(text: string, embedding: number[]): Promise<TopicCandidate[]> {
    const topics: TopicCandidate[] = []

    // Find similar existing topics using cosine similarity
    for (const [topicName, topicData] of this.topicVocabulary) {
      if (topicData.semanticVector) {
        const similarity = this.cosineSimilarity(embedding, topicData.semanticVector)
        
        if (similarity > 0.7) { // High semantic similarity
          topics.push({
            name: topicName,
            confidence: similarity,
            category: topicData.category,
            keywords: [...topicData.keywords],
            reasoning: `Semantic similarity: ${(similarity * 100).toFixed(1)}%`,
            semanticVector: topicData.semanticVector
          })
        }
      }
    }

    // Use OpenAI to extract semantic topics from text
    const semanticTopics = await this.extractTopicsWithLLM(text)
    topics.push(...semanticTopics)

    return topics
  }

  private async extractTopicsWithLLM(text: string): Promise<TopicCandidate[]> {
    try {
      const prompt = `Analyze the following technical content and extract the main topics. For each topic, provide:
1. Topic name (concise, 1-3 words)
2. Confidence score (0-1)
3. Category (technology/domain/process/business/problem)
4. Key terms that indicate this topic

Content: "${text.substring(0, 1000)}"

Respond in JSON format:
{
  "topics": [
    {
      "name": "Topic Name",
      "confidence": 0.8,
      "category": "technology",
      "keywords": ["keyword1", "keyword2"],
      "reasoning": "why this topic was identified"
    }
  ]
}`

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 1000
        })
      })

      if (!response.ok) {
        console.warn('OpenAI API request failed for topic extraction')
        return []
      }

      const data = await response.json()
      const content = data.choices[0]?.message?.content

      if (!content) return []

      try {
        // Try to clean the content in case it has markdown or extra text
        const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        const parsed = JSON.parse(cleanContent)
        
        if (parsed.topics && Array.isArray(parsed.topics)) {
          return parsed.topics.map((topic: any) => ({
            name: topic.name || 'Unknown Topic',
            confidence: topic.confidence || 0.5,
            category: (topic.category as TopicCandidate['category']) || 'technology',
            keywords: Array.isArray(topic.keywords) ? topic.keywords : [topic.name || 'unknown'],
            reasoning: topic.reasoning || 'LLM extraction'
          }))
        }
        return []
      } catch (parseError) {
        console.warn('Failed to parse LLM topic extraction response:', parseError)
        // Fallback: extract topics from content using simple patterns
        return this.extractTopicsFromTextFallback(text)
      }

    } catch (error) {
      console.error('Error in LLM topic extraction:', error)
      return []
    }
  }

  // ===========================
  // Advanced Keyword-Based Extraction
  // ===========================

  private async extractKeywordBasedTopics(
    technicalTerms: string[], 
    keyPhrases: Array<{ text: string; score: number }>
  ): Promise<TopicCandidate[]> {
    const topics: TopicCandidate[] = []

    // Enhanced technology detection
    const techPatterns = {
      'Frontend Development': {
        keywords: ['react', 'vue', 'angular', 'javascript', 'typescript', 'html', 'css', 'ui', 'ux', 'component'],
        weight: 1.0
      },
      'Backend Development': {
        keywords: ['api', 'server', 'backend', 'database', 'microservice', 'endpoint', 'rest', 'graphql'],
        weight: 1.0
      },
      'DevOps': {
        keywords: ['docker', 'kubernetes', 'ci/cd', 'deployment', 'infrastructure', 'aws', 'gcp', 'azure'],
        weight: 1.0
      },
      'Database': {
        keywords: ['sql', 'postgresql', 'mongodb', 'redis', 'query', 'index', 'migration', 'orm'],
        weight: 1.0
      },
      'Authentication': {
        keywords: ['auth', 'jwt', 'oauth', 'security', 'token', 'login', 'session', 'permission'],
        weight: 1.0
      },
      'Performance': {
        keywords: ['performance', 'optimization', 'cache', 'speed', 'memory', 'latency', 'benchmark'],
        weight: 1.0
      },
      'Testing': {
        keywords: ['test', 'testing', 'unit', 'integration', 'e2e', 'mock', 'jest', 'cypress'],
        weight: 1.0
      }
    }

    const allTerms = [...technicalTerms, ...keyPhrases.map(p => p.text)].map(t => t.toLowerCase())

    for (const [topicName, pattern] of Object.entries(techPatterns)) {
      const matches = pattern.keywords.filter(keyword => 
        allTerms.some(term => term.includes(keyword))
      )

      if (matches.length > 0) {
        const confidence = Math.min(1.0, (matches.length / pattern.keywords.length) * pattern.weight)
        
        topics.push({
          name: topicName,
          confidence,
          category: 'technology',
          keywords: matches,
          reasoning: `Keyword matches: ${matches.join(', ')}`,
          frequency: matches.length
        })
      }
    }

    return topics
  }

  // ===========================
  // Contextual Topic Extraction
  // ===========================

  private async extractContextualTopics(context: ProcessedContent['context']): Promise<TopicCandidate[]> {
    const topics: TopicCandidate[] = []

    // Repository/Channel context
    if (context.source) {
      const sourceTopics = this.extractTopicsFromSource(context.source)
      topics.push(...sourceTopics)
    }

    // URL context analysis
    if (context.urls.length > 0) {
      const urlTopics = this.extractTopicsFromUrls(context.urls)
      topics.push(...urlTopics)
    }

    // Code block analysis
    if (context.codeBlocks.length > 0) {
      const codeTopics = this.extractTopicsFromCode(context.codeBlocks)
      topics.push(...codeTopics)
    }

    return topics
  }

  private extractTopicsFromSource(source: string): TopicCandidate[] {
    const topics: TopicCandidate[] = []
    const sourceLower = source.toLowerCase()

    const sourcePatterns = {
      'Mobile Development': ['mobile', 'ios', 'android', 'flutter', 'react-native'],
      'Web Development': ['web', 'frontend', 'backend', 'fullstack'],
      'Data Engineering': ['data', 'analytics', 'etl', 'pipeline', 'warehouse'],
      'Machine Learning': ['ml', 'ai', 'machine-learning', 'data-science'],
      'Infrastructure': ['infra', 'infrastructure', 'ops', 'platform'],
      'Product Management': ['product', 'pm', 'roadmap', 'feature'],
      'Design': ['design', 'ui', 'ux', 'figma', 'prototype']
    }

    for (const [topic, patterns] of Object.entries(sourcePatterns)) {
      if (patterns.some(pattern => sourceLower.includes(pattern))) {
        topics.push({
          name: topic,
          confidence: 0.8,
          category: 'domain',
          keywords: patterns.filter(p => sourceLower.includes(p)),
          reasoning: 'Inferred from source context',
          contextClues: [source]
        })
      }
    }

    return topics
  }

  private extractTopicsFromUrls(urls: string[]): TopicCandidate[] {
    const topics: TopicCandidate[] = []

    // Analyze domains and paths for technology indicators
    urls.forEach(url => {
      try {
        const urlObj = new URL(url)
        const domain = urlObj.hostname.toLowerCase()
        const path = urlObj.pathname.toLowerCase()

        // Documentation sites
        if (domain.includes('docs.') || path.includes('/docs/')) {
          topics.push({
            name: 'Documentation',
            confidence: 0.7,
            category: 'process',
            keywords: ['documentation', 'docs'],
            reasoning: 'Documentation URL reference',
            contextClues: [url]
          })
        }

        // GitHub/GitLab repositories
        if (domain.includes('github.com') || domain.includes('gitlab.com')) {
          const pathParts = path.split('/')
          if (pathParts.length > 2) {
            const repoName = pathParts[2].toLowerCase()
            const techTopics = this.inferTopicsFromRepoName(repoName)
            topics.push(...techTopics)
          }
        }
      } catch (error) {
        // Invalid URL, skip
      }
    })

    return topics
  }

  private extractTopicsFromCode(codeBlocks: Array<{ language?: string; code: string }>): TopicCandidate[] {
    const topics: TopicCandidate[] = []

    codeBlocks.forEach(block => {
      if (block.language) {
        topics.push({
          name: this.normalizeLanguageName(block.language),
          confidence: 0.9,
          category: 'technology',
          keywords: [block.language],
          reasoning: 'Code block language detection',
          contextClues: [`${block.language} code`]
        })
      }

      // Analyze code content for patterns
      const codeTopics = this.analyzeCodePatterns(block.code)
      topics.push(...codeTopics)
    })

    return topics
  }

  // ===========================
  // Pattern-Based Topic Detection
  // ===========================

  private async extractPatternBasedTopics(
    text: string, 
    analysis: ProcessedContent['analysis']
  ): Promise<TopicCandidate[]> {
    const topics: TopicCandidate[] = []

    // Error/Problem pattern detection
    if (analysis.contentType === 'solution' || text.toLowerCase().includes('error')) {
      topics.push({
        name: 'Troubleshooting',
        confidence: 0.8,
        category: 'problem',
        keywords: ['error', 'bug', 'fix', 'solution', 'problem'],
        reasoning: 'Problem-solving content detected'
      })
    }

    // Performance pattern detection
    const performanceKeywords = ['slow', 'performance', 'optimization', 'speed', 'memory', 'cpu']
    if (performanceKeywords.some(keyword => text.toLowerCase().includes(keyword))) {
      topics.push({
        name: 'Performance Optimization',
        confidence: 0.7,
        category: 'process',
        keywords: performanceKeywords.filter(k => text.toLowerCase().includes(k)),
        reasoning: 'Performance-related content detected'
      })
    }

    // Security pattern detection
    const securityKeywords = ['security', 'vulnerability', 'auth', 'encryption', 'ssl', 'https']
    if (securityKeywords.some(keyword => text.toLowerCase().includes(keyword))) {
      topics.push({
        name: 'Security',
        confidence: 0.8,
        category: 'domain',
        keywords: securityKeywords.filter(k => text.toLowerCase().includes(k)),
        reasoning: 'Security-related content detected'
      })
    }

    return topics
  }

  // ===========================
  // Domain-Specific Topic Extraction
  // ===========================

  private async extractDomainSpecificTopics(
    text: string, 
    context: ProcessedContent['context']
  ): Promise<TopicCandidate[]> {
    const topics: TopicCandidate[] = []

    // Business/Product patterns
    const businessKeywords = ['user', 'customer', 'business', 'product', 'feature', 'requirement']
    if (businessKeywords.some(keyword => text.toLowerCase().includes(keyword))) {
      topics.push({
        name: 'Product Management',
        confidence: 0.6,
        category: 'business',
        keywords: businessKeywords.filter(k => text.toLowerCase().includes(k)),
        reasoning: 'Business/product content detected'
      })
    }

    // Architecture patterns
    const archKeywords = ['architecture', 'design', 'pattern', 'microservice', 'monolith', 'scalability']
    if (archKeywords.some(keyword => text.toLowerCase().includes(keyword))) {
      topics.push({
        name: 'Software Architecture',
        confidence: 0.7,
        category: 'domain',
        keywords: archKeywords.filter(k => text.toLowerCase().includes(k)),
        reasoning: 'Architecture-related content detected'
      })
    }

    return topics
  }

  // ===========================
  // Topic Clustering and Merging
  // ===========================

  private mergeTopicCandidates(candidateLists: TopicCandidate[][]): TopicCandidate[] {
    const mergedMap = new Map<string, TopicCandidate>()

    candidateLists.flat().forEach(candidate => {
      const existing = mergedMap.get(candidate.name.toLowerCase())
      
      if (existing) {
        // Merge with existing - take highest confidence and combine keywords
        existing.confidence = Math.max(existing.confidence, candidate.confidence)
        existing.keywords = [...new Set([...existing.keywords, ...candidate.keywords])]
        existing.reasoning += `; ${candidate.reasoning}`
        if (candidate.frequency) {
          existing.frequency = (existing.frequency || 0) + candidate.frequency
        }
      } else {
        mergedMap.set(candidate.name.toLowerCase(), { ...candidate })
      }
    })

    // Sort by confidence and return top candidates
    return Array.from(mergedMap.values())
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 15) // Limit to top 15 topics
  }

  private async clusterTopics(candidates: TopicCandidate[]): Promise<TopicCluster[]> {
    // Simple clustering based on category and keyword overlap
    const clusters = new Map<string, TopicCandidate[]>()

    candidates.forEach(candidate => {
      const clusterKey = candidate.category
      if (!clusters.has(clusterKey)) {
        clusters.set(clusterKey, [])
      }
      clusters.get(clusterKey)!.push(candidate)
    })

    return Array.from(clusters.entries()).map(([category, members]) => ({
      id: `cluster-${category}`,
      name: this.capitalizeWords(category),
      centroid: [], // Would compute actual centroid in production
      members,
      coherenceScore: this.calculateClusterCoherence(members),
      emergenceStrength: members.reduce((sum, m) => sum + m.confidence, 0) / members.length
    }))
  }

  private detectTopicHierarchy(candidates: TopicCandidate[]) {
    const hierarchies: EnhancedTopicDetection['hierarchicalTopics'] = []

    // Simple hierarchical relationships based on specificity
    const generalToSpecific = {
      'Development': ['Frontend Development', 'Backend Development', 'Mobile Development'],
      'Technology': ['JavaScript', 'TypeScript', 'React', 'Node.js'],
      'Operations': ['DevOps', 'Infrastructure', 'Deployment']
    }

    for (const [parent, children] of Object.entries(generalToSpecific)) {
      const childrenInCandidates = children.filter(child => 
        candidates.some(c => c.name === child)
      )

      if (childrenInCandidates.length > 0) {
        hierarchies.push({
          parentTopic: parent,
          childTopics: childrenInCandidates,
          relationshipType: 'specialization'
        })
      }
    }

    return hierarchies
  }

  // ===========================
  // Helper Methods
  // ===========================

  private initializeTopicVocabulary() {
    // Initialize with common technology topics and their semantic vectors
    // In production, this would be loaded from a database or ML model
    const commonTopics = [
      'React Development', 'Backend API', 'Database Design', 'DevOps', 
      'Authentication', 'Performance', 'Testing', 'Security'
    ]

    commonTopics.forEach(topic => {
      this.topicVocabulary.set(topic.toLowerCase(), {
        name: topic,
        confidence: 0.8,
        category: 'technology',
        keywords: topic.toLowerCase().split(' '),
        reasoning: 'Pre-defined topic',
        semanticVector: this.generateMockVector() // Would use real embeddings
      })
    })
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0
    
    let dotProduct = 0
    let normA = 0
    let normB = 0
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  }

  private calculateConfidenceMetrics(candidates: TopicCandidate[], strategies: TopicCandidate[][]): EnhancedTopicDetection['confidenceMetrics'] {
    const overallConfidence = candidates.reduce((sum, c) => sum + c.confidence, 0) / candidates.length
    const agreementScore = this.calculateStrategyAgreement(strategies)
    
    return {
      overallConfidence,
      extractionMethod: 'multi-strategy-nlp',
      agreementScore
    }
  }

  private calculateStrategyAgreement(strategies: TopicCandidate[][]): number {
    // Calculate how much the different strategies agree
    const topicCounts = new Map<string, number>()
    
    strategies.forEach(strategy => {
      strategy.forEach(topic => {
        topicCounts.set(topic.name, (topicCounts.get(topic.name) || 0) + 1)
      })
    })

    const totalTopics = Array.from(topicCounts.values()).reduce((sum, count) => sum + count, 0)
    const agreedTopics = Array.from(topicCounts.values()).filter(count => count > 1).length
    
    return totalTopics > 0 ? agreedTopics / totalTopics : 0
  }

  private calculateClusterCoherence(members: TopicCandidate[]): number {
    // Simple coherence based on keyword overlap
    if (members.length < 2) return 1.0

    let totalOverlap = 0
    let comparisons = 0

    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const overlap = this.calculateKeywordOverlap(members[i].keywords, members[j].keywords)
        totalOverlap += overlap
        comparisons++
      }
    }

    return comparisons > 0 ? totalOverlap / comparisons : 0
  }

  private calculateKeywordOverlap(keywords1: string[], keywords2: string[]): number {
    const set1 = new Set(keywords1.map(k => k.toLowerCase()))
    const set2 = new Set(keywords2.map(k => k.toLowerCase()))
    const intersection = new Set([...set1].filter(x => set2.has(x)))
    
    return intersection.size / Math.max(set1.size, set2.size)
  }

  private convertToLegacyTopic(candidate: TopicCandidate): TopicDetection['topics'][0] {
    return {
      name: candidate.name,
      confidence: candidate.confidence,
      category: candidate.category,
      keywords: candidate.keywords,
      reasoning: candidate.reasoning
    }
  }

  private inferTopicsFromRepoName(repoName: string): TopicCandidate[] {
    const topics: TopicCandidate[] = []
    
    if (repoName.includes('api') || repoName.includes('backend')) {
      topics.push({
        name: 'Backend Development',
        confidence: 0.7,
        category: 'technology',
        keywords: ['api', 'backend'],
        reasoning: 'Repository name inference'
      })
    }

    return topics
  }

  private normalizeLanguageName(language: string): string {
    const languageMap: Record<string, string> = {
      'js': 'JavaScript',
      'ts': 'TypeScript',
      'py': 'Python',
      'rb': 'Ruby',
      'go': 'Go',
      'rs': 'Rust',
      'cpp': 'C++',
      'cs': 'C#'
    }

    return languageMap[language.toLowerCase()] || 
           language.charAt(0).toUpperCase() + language.slice(1)
  }

  private analyzeCodePatterns(code: string): TopicCandidate[] {
    const topics: TopicCandidate[] = []
    const lowerCode = code.toLowerCase()

    // Framework detection
    if (lowerCode.includes('usestate') || lowerCode.includes('useeffect')) {
      topics.push({
        name: 'React Hooks',
        confidence: 0.9,
        category: 'technology',
        keywords: ['react', 'hooks'],
        reasoning: 'React hooks patterns detected in code'
      })
    }

    if (lowerCode.includes('async') && lowerCode.includes('await')) {
      topics.push({
        name: 'Async Programming',
        confidence: 0.8,
        category: 'technology',
        keywords: ['async', 'await', 'promises'],
        reasoning: 'Async/await patterns detected'
      })
    }

    return topics
  }

  private capitalizeWords(str: string): string {
    return str.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
  }

  private generateMockVector(): number[] {
    // Generate a mock 1536-dimensional vector (placeholder)
    return Array(1536).fill(0).map(() => Math.random() * 2 - 1)
  }

  private extractTopicsFromTextFallback(text: string): TopicCandidate[] {
    const topics: TopicCandidate[] = []
    const lowerText = text.toLowerCase()

    // Simple fallback patterns
    const patterns = {
      'React Development': ['react', 'jsx', 'component', 'hook'],
      'Backend Development': ['api', 'server', 'backend', 'endpoint'],
      'Database': ['sql', 'database', 'query', 'migration'],
      'Authentication': ['auth', 'login', 'token', 'security'],
      'Performance': ['performance', 'optimization', 'speed', 'memory'],
      'TypeScript': ['typescript', 'types', 'interface'],
      'Testing': ['test', 'testing', 'unit', 'integration']
    }

    for (const [topicName, keywords] of Object.entries(patterns)) {
      const matches = keywords.filter(keyword => lowerText.includes(keyword))
      if (matches.length > 0) {
        topics.push({
          name: topicName,
          confidence: Math.min(0.8, matches.length / keywords.length),
          category: 'technology',
          keywords: matches,
          reasoning: 'Fallback pattern matching'
        })
      }
    }

    return topics
  }
}