// NLP Service for content analysis and embeddings

import type { 
  NLPService, 
  ProcessedContent, 
  TopicDetection, 
  RawContent,
  NLPError 
} from '@/core/types/processing'
import { EnhancedTopicExtractor, type EnhancedTopicDetection } from './enhanced-topic-extractor'

interface OpenAIEmbeddingResponse {
  data: Array<{
    embedding: number[]
    index: number
  }>
  model: string
  usage: {
    prompt_tokens: number
    total_tokens: number
  }
}

export class HiMindNLPService implements NLPService {
  private openaiApiKey: string
  private embeddingModel: string
  private embeddingDimensions: number
  private enhancedTopicExtractor: EnhancedTopicExtractor

  constructor(config: {
    openaiApiKey: string
    embeddingModel?: string
    embeddingDimensions?: number
  }) {
    this.openaiApiKey = config.openaiApiKey
    this.embeddingModel = config.embeddingModel || 'text-embedding-3-small'
    this.embeddingDimensions = config.embeddingDimensions || 1536
    this.enhancedTopicExtractor = new EnhancedTopicExtractor(this)
  }

  // ===========================
  // Text Processing
  // ===========================

  cleanText(text: string): string {
    return text
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      // Remove Slack/Discord formatting
      .replace(/<[@#!][^>]+>/g, '') // Remove mentions, channels, special formatting
      .replace(/```[\s\S]*?```/g, (match) => {
        // Preserve code blocks but clean them
        return match.replace(/```(\w+)?\n?/, '```\n').replace(/\n```/, '\n```')
      })
      // Clean up URLs but preserve them
      .replace(/https?:\/\/[^\s]+/g, (url) => {
        // Extract meaningful parts from URLs
        try {
          const urlObj = new URL(url)
          if (urlObj.hostname.includes('github.com')) {
            const pathParts = urlObj.pathname.split('/').filter(Boolean)
            if (pathParts.length >= 2) {
              return `[GitHub: ${pathParts[0]}/${pathParts[1]}]`
            }
          }
          return `[${urlObj.hostname}]`
        } catch {
          return '[URL]'
        }
      })
      // Remove empty lines and trim
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n')
      .trim()
  }

  async extractHeadline(text: string): Promise<string> {
    const cleanedText = this.cleanText(text)
    
    // If text is short, use the first sentence
    if (cleanedText.length < 100) {
      const firstSentence = cleanedText.split(/[.!?]/)[0].trim()
      return firstSentence.length > 10 ? firstSentence : cleanedText.substring(0, 50) + '...'
    }

    try {
      // Use OpenAI to generate a concise headline
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'Generate a concise, informative headline (max 60 chars) that captures the main point of the given text. Focus on technical topics, problems solved, or knowledge shared.'
            },
            {
              role: 'user',
              content: cleanedText.substring(0, 1000) // Limit input length
            }
          ],
          max_tokens: 20,
          temperature: 0.3
        })
      })

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`)
      }

      const data = await response.json()
      const headline = data.choices[0]?.message?.content?.trim()
      
      if (headline && headline.length > 5) {
        return headline.length > 60 ? headline.substring(0, 57) + '...' : headline
      }
    } catch (error) {
      console.warn('Failed to generate AI headline, falling back to extraction:', error)
    }

    // Fallback: extract first meaningful sentence
    const sentences = cleanedText.split(/[.!?]/)
    for (const sentence of sentences) {
      const trimmed = sentence.trim()
      if (trimmed.length > 10 && trimmed.length < 80) {
        return trimmed
      }
    }

    return cleanedText.substring(0, 60) + '...'
  }

  async analyzeContent(text: string): Promise<ProcessedContent['analysis']> {
    const cleanedText = this.cleanText(text)
    
    // Extract technical terms using pattern matching
    const technicalTerms = this.extractTechnicalTerms(cleanedText)
    
    // Classify content type based on patterns
    const contentType = this.classifyContentType(cleanedText)
    
    // Assess complexity
    const complexity = this.assessComplexity(cleanedText, technicalTerms)
    
    // Simple sentiment analysis
    const sentiment = this.analyzeSentiment(cleanedText)
    
    // Extract entities and key phrases
    const entities = await this.extractEntities(cleanedText)
    const keyPhrases = await this.extractKeyPhrases(cleanedText)

    return {
      language: 'en', // TODO: Detect language
      sentiment,
      contentType,
      complexity,
      technicalTerms,
      entities,
      keyPhrases
    }
  }

  assessQuality(content: RawContent, analysis: ProcessedContent['analysis']): ProcessedContent['quality'] {
    const text = this.cleanText(content.content)
    
    // Length factor (sweet spot around 100-500 chars)
    const lengthScore = this.calculateLengthScore(text.length)
    
    // Structure factor (paragraphs, code blocks, lists)
    const structureScore = this.calculateStructureScore(text)
    
    // Clarity factor (readability, technical depth)
    const clarityScore = this.calculateClarityScore(text, analysis.technicalTerms)
    
    // Engagement factor (reactions, responses from metadata)
    const engagementScore = this.calculateEngagementScore(content)
    
    // Technical depth factor
    const technicalDepthScore = this.calculateTechnicalDepthScore(analysis.technicalTerms, analysis.entities)
    
    const factors = {
      length: lengthScore,
      structure: structureScore,
      clarity: clarityScore,
      engagement: engagementScore,
      technical_depth: technicalDepthScore
    }

    // Weighted average
    const score = (
      lengthScore * 0.15 +
      structureScore * 0.20 +
      clarityScore * 0.25 +
      engagementScore * 0.20 +
      technicalDepthScore * 0.20
    )

    // Confidence based on content length and technical indicators
    const confidence = Math.min(1.0, (text.length / 200) * (1 + analysis.technicalTerms.length * 0.1))

    return {
      score: Math.round(score * 100) / 100,
      factors,
      confidence: Math.round(confidence * 100) / 100
    }
  }

  // ===========================
  // Embeddings
  // ===========================

  async generateEmbedding(text: string): Promise<number[]> {
    const cleanedText = this.cleanText(text)
    
    // Truncate if too long (OpenAI has token limits)
    const truncatedText = cleanedText.length > 8000 ? cleanedText.substring(0, 8000) + '...' : cleanedText
    
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.embeddingModel,
          input: truncatedText,
          dimensions: this.embeddingDimensions
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new NLPError(
          `OpenAI embedding API error: ${response.status} ${errorData.error?.message || ''}`,
          'generate_embedding',
          truncatedText.substring(0, 100)
        )
      }

      const data: OpenAIEmbeddingResponse = await response.json()
      
      if (!data.data?.[0]?.embedding) {
        throw new NLPError('Invalid response from OpenAI embeddings API', 'generate_embedding')
      }

      return data.data[0].embedding
    } catch (error) {
      if (error instanceof NLPError) {
        throw error
      }
      throw new NLPError(
        `Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'generate_embedding',
        truncatedText.substring(0, 100)
      )
    }
  }

  calculateSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same dimension')
    }

    // Cosine similarity
    let dotProduct = 0
    let norm1 = 0
    let norm2 = 0

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i]
      norm1 += embedding1[i] * embedding1[i]
      norm2 += embedding2[i] * embedding2[i]
    }

    const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2))
    return Math.round(similarity * 10000) / 10000 // Round to 4 decimal places
  }

  // ===========================
  // Topic Detection
  // ===========================

  async detectTopics(content: ProcessedContent): Promise<TopicDetection> {
    const { cleanText, analysis, context } = content
    
    // Technology topics from technical terms and entities
    const technologyTopics = this.extractTechnologyTopics(analysis.technicalTerms, analysis.entities)
    
    // Domain topics from context and content
    const domainTopics = this.extractDomainTopics(cleanText, context)
    
    // Process topics from key phrases
    const processTopics = this.extractProcessTopics(analysis.keyPhrases)
    
    // Problem topics from content classification
    const problemTopics = this.extractProblemTopics(cleanText, analysis.contentType)

    const topics = [
      ...technologyTopics,
      ...domainTopics,
      ...processTopics,
      ...problemTopics
    ].filter(topic => topic.confidence > 0.3) // Filter low-confidence topics

    // Detect emerging topics (new combinations or patterns)
    const emergingTopics = this.detectEmergingTopics(topics, analysis.keyPhrases)

    // Context-based topics (from repository, channel, etc.)
    const contextTopics = this.extractContextTopics(context)

    return {
      topics,
      emergingTopics,
      contextTopics
    }
  }

  // Enhanced topic detection using multiple strategies
  async detectTopicsEnhanced(content: ProcessedContent): Promise<EnhancedTopicDetection> {
    return await this.enhancedTopicExtractor.detectTopicsEnhanced(content)
  }

  // ===========================
  // Entity and Phrase Extraction
  // ===========================

  async extractEntities(text: string): Promise<Array<{ text: string; label: string; confidence: number }>> {
    // For now, implement pattern-based entity extraction
    // In the future, this could use a proper NER model
    
    const entities: Array<{ text: string; label: string; confidence: number }> = []
    
    // Programming languages
    const languages = ['javascript', 'typescript', 'python', 'java', 'go', 'rust', 'c++', 'c#', 'ruby', 'php', 'swift', 'kotlin']
    languages.forEach(lang => {
      if (text.toLowerCase().includes(lang)) {
        entities.push({ text: lang, label: 'PROGRAMMING_LANGUAGE', confidence: 0.9 })
      }
    })

    // Frameworks and libraries
    const frameworks = ['react', 'vue', 'angular', 'svelte', 'next.js', 'nuxt', 'express', 'fastapi', 'django', 'rails', 'spring', 'laravel']
    frameworks.forEach(framework => {
      if (text.toLowerCase().includes(framework)) {
        entities.push({ text: framework, label: 'FRAMEWORK', confidence: 0.8 })
      }
    })

    // Tools and platforms
    const tools = ['docker', 'kubernetes', 'aws', 'azure', 'gcp', 'vercel', 'netlify', 'github', 'gitlab', 'jenkins', 'terraform']
    tools.forEach(tool => {
      if (text.toLowerCase().includes(tool)) {
        entities.push({ text: tool, label: 'TOOL', confidence: 0.8 })
      }
    })

    // Databases
    const databases = ['postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'sqlite', 'supabase', 'firebase']
    databases.forEach(db => {
      if (text.toLowerCase().includes(db)) {
        entities.push({ text: db, label: 'DATABASE', confidence: 0.9 })
      }
    })

    return entities
  }

  async extractKeyPhrases(text: string): Promise<Array<{ text: string; score: number }>> {
    // Simple key phrase extraction based on frequency and position
    const cleanedText = this.cleanText(text).toLowerCase()
    const words = cleanedText.split(/\s+/).filter(word => word.length > 3)
    
    // Count word frequencies
    const wordFreq: Record<string, number> = {}
    words.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1
    })

    // Extract 2-3 word phrases
    const phrases: Record<string, number> = {}
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i]} ${words[i + 1]}`
      phrases[bigram] = (phrases[bigram] || 0) + 1
      
      if (i < words.length - 2) {
        const trigram = `${words[i]} ${words[i + 1]} ${words[i + 2]}`
        phrases[trigram] = (phrases[trigram] || 0) + 1
      }
    }

    // Score and rank phrases
    const keyPhrases = Object.entries(phrases)
      .filter(([phrase, freq]) => freq > 1 && !this.isStopPhrase(phrase))
      .map(([phrase, freq]) => ({
        text: phrase,
        score: Math.min(1.0, freq / words.length * 10) // Normalize score
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10) // Top 10 phrases

    return keyPhrases
  }

  // ===========================
  // Helper Methods
  // ===========================

  private extractTechnicalTerms(text: string): string[] {
    const terms: string[] = []
    const lowerText = text.toLowerCase()
    
    // Common technical patterns
    const patterns = [
      /\b[a-z]+\.js\b/g, // JavaScript libraries
      /\b[a-z]+\.py\b/g, // Python files
      /\b[A-Z][a-zA-Z]*API\b/g, // APIs
      /\b[a-z]+\-[a-z]+\b/g, // Hyphenated terms
      /\b[A-Z]+\b/g, // Acronyms
    ]

    patterns.forEach(pattern => {
      const matches = text.match(pattern) || []
      terms.push(...matches)
    })

    // Remove duplicates and filter
    return [...new Set(terms)]
      .filter(term => term.length > 2 && term.length < 20)
      .slice(0, 20) // Limit to 20 terms
  }

  private classifyContentType(text: string): ProcessedContent['analysis']['contentType'] {
    const lowerText = text.toLowerCase()
    
    if (lowerText.includes('?') || lowerText.includes('how') || lowerText.includes('why')) {
      return 'question'
    }
    
    if (lowerText.includes('fix') || lowerText.includes('solve') || lowerText.includes('solution')) {
      return 'solution'
    }
    
    if (lowerText.includes('explain') || lowerText.includes('because') || lowerText.includes('works by')) {
      return 'explanation'
    }
    
    if (lowerText.includes('announce') || lowerText.includes('release') || lowerText.includes('new')) {
      return 'announcement'
    }
    
    return 'discussion'
  }

  private assessComplexity(text: string, technicalTerms: string[]): ProcessedContent['analysis']['complexity'] {
    let complexity = 0
    
    // Length factor
    complexity += Math.min(0.3, text.length / 1000)
    
    // Technical terms factor
    complexity += Math.min(0.4, technicalTerms.length / 10)
    
    // Code blocks factor
    const codeBlocks = (text.match(/```/g) || []).length / 2
    complexity += Math.min(0.3, codeBlocks / 3)
    
    if (complexity < 0.3) return 'simple'
    if (complexity < 0.7) return 'moderate'
    return 'complex'
  }

  private analyzeSentiment(text: string): ProcessedContent['analysis']['sentiment'] {
    const lowerText = text.toLowerCase()
    
    const positiveWords = ['great', 'good', 'excellent', 'awesome', 'perfect', 'works', 'solved', 'fixed', 'thanks']
    const negativeWords = ['bad', 'terrible', 'broken', 'error', 'bug', 'issue', 'problem', 'fail', 'wrong']
    
    const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length
    const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length
    
    if (positiveCount > negativeCount) return 'positive'
    if (negativeCount > positiveCount) return 'negative'
    return 'neutral'
  }

  private calculateLengthScore(length: number): number {
    // Sweet spot around 100-500 characters
    if (length < 50) return 0.3
    if (length < 100) return 0.6
    if (length < 500) return 1.0
    if (length < 1000) return 0.8
    return 0.6
  }

  private calculateStructureScore(text: string): number {
    let score = 0.5 // Base score
    
    // Paragraphs
    const paragraphs = text.split('\n\n').length
    score += Math.min(0.2, paragraphs * 0.1)
    
    // Code blocks
    const codeBlocks = (text.match(/```/g) || []).length / 2
    score += Math.min(0.2, codeBlocks * 0.1)
    
    // Lists
    const listItems = (text.match(/^[\s]*[-*+]\s/gm) || []).length
    score += Math.min(0.1, listItems * 0.02)
    
    return Math.min(1.0, score)
  }

  private calculateClarityScore(text: string, technicalTerms: string[]): number {
    let score = 0.5
    
    // Technical depth (more technical terms = higher clarity for technical content)
    score += Math.min(0.3, technicalTerms.length * 0.05)
    
    // Sentence structure
    const sentences = text.split(/[.!?]/).filter(s => s.trim().length > 10)
    const avgSentenceLength = text.length / sentences.length
    
    // Prefer moderate sentence length
    if (avgSentenceLength > 20 && avgSentenceLength < 100) {
      score += 0.2
    }
    
    return Math.min(1.0, score)
  }

  private calculateEngagementScore(content: RawContent): number {
    let score = 0.3 // Base score
    
    const reactions = content.metadata.reactions || []
    const totalReactions = reactions.reduce((sum, r) => sum + r.count, 0)
    
    score += Math.min(0.4, totalReactions * 0.1)
    
    // Mentions indicate engagement
    const mentions = content.metadata.mentions || []
    score += Math.min(0.2, mentions.length * 0.1)
    
    // Responses/thread activity (if it's a parent message)
    if (content.type === 'message' && content.metadata.replies) {
      score += Math.min(0.1, content.metadata.replies * 0.05)
    }
    
    return Math.min(1.0, score)
  }

  private calculateTechnicalDepthScore(technicalTerms: string[], entities: Array<{ text: string; label: string; confidence: number }>): number {
    let score = 0
    
    // Technical terms contribute to depth
    score += Math.min(0.5, technicalTerms.length * 0.05)
    
    // Technical entities contribute more
    const techEntities = entities.filter(e => 
      ['PROGRAMMING_LANGUAGE', 'FRAMEWORK', 'TOOL', 'DATABASE'].includes(e.label)
    )
    score += Math.min(0.5, techEntities.length * 0.1)
    
    return Math.min(1.0, score)
  }

  private extractTechnologyTopics(technicalTerms: string[], entities: Array<{ text: string; label: string; confidence: number }>): TopicDetection['topics'] {
    const topics: TopicDetection['topics'] = []
    
    // From entities
    entities.forEach(entity => {
      if (['PROGRAMMING_LANGUAGE', 'FRAMEWORK', 'TOOL', 'DATABASE'].includes(entity.label)) {
        topics.push({
          name: entity.text,
          confidence: entity.confidence,
          category: 'technology',
          keywords: [entity.text],
          reasoning: `Detected ${entity.label.toLowerCase()}: ${entity.text}`
        })
      }
    })
    
    return topics
  }

  private extractDomainTopics(text: string, context: ProcessedContent['context']): TopicDetection['topics'] {
    const topics: TopicDetection['topics'] = []
    
    // From context (repository name, channel name)
    if (context.source) {
      const sourceLower = context.source.toLowerCase()
      
      // Common domain patterns
      if (sourceLower.includes('api') || sourceLower.includes('backend')) {
        topics.push({
          name: 'Backend Development',
          confidence: 0.7,
          category: 'domain',
          keywords: ['api', 'backend'],
          reasoning: 'Inferred from context source'
        })
      }
      
      if (sourceLower.includes('frontend') || sourceLower.includes('ui')) {
        topics.push({
          name: 'Frontend Development',
          confidence: 0.7,
          category: 'domain',
          keywords: ['frontend', 'ui'],
          reasoning: 'Inferred from context source'
        })
      }
    }
    
    return topics
  }

  private extractProcessTopics(keyPhrases: Array<{ text: string; score: number }>): TopicDetection['topics'] {
    const topics: TopicDetection['topics'] = []
    
    // Look for process-related phrases
    keyPhrases.forEach(phrase => {
      if (phrase.text.includes('deploy') || phrase.text.includes('deployment')) {
        topics.push({
          name: 'Deployment',
          confidence: phrase.score,
          category: 'process',
          keywords: [phrase.text],
          reasoning: `Key phrase: ${phrase.text}`
        })
      }
      
      if (phrase.text.includes('test') || phrase.text.includes('testing')) {
        topics.push({
          name: 'Testing',
          confidence: phrase.score,
          category: 'process',
          keywords: [phrase.text],
          reasoning: `Key phrase: ${phrase.text}`
        })
      }
    })
    
    return topics
  }

  private extractProblemTopics(text: string, contentType: string): TopicDetection['topics'] {
    const topics: TopicDetection['topics'] = []
    
    if (contentType === 'solution' || text.toLowerCase().includes('error')) {
      topics.push({
        name: 'Debugging',
        confidence: 0.8,
        category: 'problem',
        keywords: ['error', 'debug', 'fix'],
        reasoning: 'Content appears to be solution-oriented'
      })
    }
    
    return topics
  }

  private detectEmergingTopics(topics: TopicDetection['topics'], keyPhrases: Array<{ text: string; score: number }>): TopicDetection['emergingTopics'] {
    // For now, return empty - this would require cross-content analysis
    return []
  }

  private extractContextTopics(context: ProcessedContent['context']): TopicDetection['contextTopics'] {
    const contextTopics: TopicDetection['contextTopics'] = []
    
    if (context.source) {
      contextTopics.push({
        source: context.source,
        topics: [context.source], // Use source name as topic
        confidence: 0.6
      })
    }
    
    return contextTopics
  }

  private isStopPhrase(phrase: string): boolean {
    const stopWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']
    return stopWords.some(stop => phrase.includes(stop))
  }
}