// Topic Clustering Service - Dynamic topic discovery, merging, and relationship mapping

import type { Database } from '@/types/database'
import type { EnhancedTopicDetection, TopicCandidate, TopicCluster } from '../nlp/enhanced-topic-extractor'
import { DatabaseManager } from '@/lib/database'

export interface TopicMergeCandidate {
  topic1: string
  topic2: string
  similarity: number
  mergingStrategy: 'synonym' | 'subset' | 'related' | 'hierarchical'
  confidence: number
  evidence: string[]
}

export interface TopicRelationship {
  parentTopicId: string
  childTopicId: string
  relationshipType: 'specialization' | 'component' | 'prerequisite' | 'related'
  strength: number
  evidence: string[]
}

export interface EmergentTopic {
  name: string
  keywords: string[]
  emergenceStrength: number
  frequency: number
  firstSeen: Date
  lastSeen: Date
  contentArtifactIds: string[]
  similarTopics: string[]
}

export class TopicClusteringService {
  private db: DatabaseManager
  private organizationId: string
  
  // Topic similarity thresholds
  private readonly MERGE_THRESHOLD = 0.85
  private readonly SIMILARITY_THRESHOLD = 0.7
  private readonly EMERGENCE_THRESHOLD = 0.6

  constructor(db: DatabaseManager, organizationId: string) {
    this.db = db
    this.organizationId = organizationId
  }

  // ===========================
  // Main Topic Processing Pipeline
  // ===========================

  async processTopicDetectionResults(
    artifactId: string,
    topicDetection: EnhancedTopicDetection
  ): Promise<{
    processedTopics: string[]
    newTopics: string[]
    mergedTopics: TopicMergeCandidate[]
    relationships: TopicRelationship[]
  }> {
    
    const processedTopics: string[] = []
    const newTopics: string[] = []
    const relationships: TopicRelationship[] = []

    // 1. Process each detected topic
    for (const topic of topicDetection.candidateTopics) {
      const result = await this.processTopicCandidate(topic, artifactId)
      
      if (result.isNew) {
        newTopics.push(result.topicId)
      }
      processedTopics.push(result.topicId)
    }

    // 2. Find potential merging candidates
    const mergedTopics = await this.findMergingCandidates(topicDetection.candidateTopics)

    // 3. Detect topic relationships
    if (topicDetection.hierarchicalTopics.length > 0) {
      for (const hierarchy of topicDetection.hierarchicalTopics) {
        const hierarchyRelationships = await this.processTopicHierarchy(hierarchy)
        relationships.push(...hierarchyRelationships)
      }
    }

    // 4. Update topic statistics and emergence metrics
    await this.updateTopicMetrics(processedTopics, artifactId)

    return {
      processedTopics,
      newTopics,
      mergedTopics,
      relationships
    }
  }

  // ===========================
  // Topic Candidate Processing
  // ===========================

  private async processTopicCandidate(
    candidate: TopicCandidate, 
    artifactId: string
  ): Promise<{ topicId: string; isNew: boolean }> {
    
    // 1. Find existing similar topics
    const existingTopics = await this.findSimilarTopics(candidate)
    
    if (existingTopics.length > 0) {
      // Use most similar existing topic
      const bestMatch = existingTopics[0]
      await this.updateTopicActivity(bestMatch.id, candidate, artifactId)
      return { topicId: bestMatch.id, isNew: false }
    }

    // 2. Check if it should be an emergent topic first
    if (candidate.confidence < this.EMERGENCE_THRESHOLD) {
      const emergentTopic = await this.trackEmergentTopic(candidate, artifactId)
      if (emergentTopic) {
        return { topicId: emergentTopic.id, isNew: true }
      }
    }

    // 3. Create new topic
    const newTopic = await this.createNewTopic(candidate)
    return { topicId: newTopic.id, isNew: true }
  }

  private async findSimilarTopics(candidate: TopicCandidate): Promise<Database['public']['Tables']['topics']['Row'][]> {
    // Get existing topics for the organization
    const { data: existingTopics } = await this.db.topics.getTopicsWithExpertise(this.organizationId)
    
    if (!existingTopics) return []

    const similarTopics: Array<{ topic: Database['public']['Tables']['topics']['Row'], similarity: number }> = []

    for (const topicData of existingTopics) {
      const topic = topicData
      const similarity = this.calculateTopicSimilarity(candidate, {
        name: topic.name,
        keywords: topic.keyword_signatures || [],
        description: topic.description || ''
      })

      if (similarity > this.SIMILARITY_THRESHOLD) {
        similarTopics.push({ topic, similarity })
      }
    }

    // Sort by similarity and return top matches
    return similarTopics
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3)
      .map(item => item.topic)
  }

  private calculateTopicSimilarity(
    candidate: TopicCandidate, 
    existing: { name: string; keywords: string[]; description: string }
  ): number {
    let similarity = 0
    
    // Name similarity (fuzzy match)
    const nameMatchScore = this.fuzzyMatch(candidate.name.toLowerCase(), existing.name.toLowerCase())
    similarity += nameMatchScore * 0.4

    // Keyword overlap
    const keywordOverlap = this.calculateKeywordOverlap(candidate.keywords, existing.keywords)
    similarity += keywordOverlap * 0.4

    // Category bonus (if both are same category)
    if (existing.description?.toLowerCase().includes(candidate.category)) {
      similarity += 0.2
    }

    return Math.min(1.0, similarity)
  }

  private fuzzyMatch(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2
    const shorter = str1.length > str2.length ? str2 : str1
    
    if (longer.length === 0) return 1.0
    
    const editDistance = this.levenshteinDistance(longer, shorter)
    return (longer.length - editDistance) / longer.length
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null))
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        )
      }
    }
    
    return matrix[str2.length][str1.length]
  }

  private calculateKeywordOverlap(keywords1: string[], keywords2: string[]): number {
    const set1 = new Set(keywords1.map(k => k.toLowerCase()))
    const set2 = new Set(keywords2.map(k => k.toLowerCase()))
    const intersection = new Set([...set1].filter(x => set2.has(x)))
    
    const union = new Set([...set1, ...set2])
    return union.size > 0 ? intersection.size / union.size : 0
  }

  // ===========================
  // Topic Creation and Updates
  // ===========================

  private async createNewTopic(candidate: TopicCandidate): Promise<Database['public']['Tables']['topics']['Row']> {
    try {
      const result = await this.db.topics.createTopic({
        organization_id: this.organizationId,
        name: candidate.name,
        description: `Topic detected from content analysis: ${candidate.reasoning}`,
        keyword_signatures: candidate.keywords,
        emergence_strength: candidate.confidence,
        is_cluster_root: false
      })

      if (!result.success || !result.data) {
        // If it's a duplicate, try to find the existing topic
        if (result.error?.includes('duplicate key') || result.error?.includes('unique constraint')) {
          const existingTopic = await this.findTopicByName(candidate.name)
          if (existingTopic) {
            console.log(`Using existing topic: ${candidate.name}`)
            return existingTopic
          }
        }
        throw new Error(`Failed to create topic: ${result.error}`)
      }

      return result.data
    } catch (error) {
      // Fallback: try to find existing topic
      const existingTopic = await this.findTopicByName(candidate.name)
      if (existingTopic) {
        console.log(`Fallback to existing topic: ${candidate.name}`)
        return existingTopic
      }
      throw error
    }
  }

  private async findTopicByName(name: string): Promise<Database['public']['Tables']['topics']['Row'] | null> {
    try {
      const { getSupabaseClient } = await import('@/lib/database')
      const supabase = getSupabaseClient(true)
      const { data, error } = await supabase
        .from('topics')
        .select('*')
        .eq('organization_id', this.organizationId)
        .ilike('name', name)
        .single()

      return error ? null : data
    } catch {
      return null
    }
  }

  private async updateTopicActivity(
    topicId: string, 
    candidate: TopicCandidate, 
    artifactId: string
  ): Promise<void> {
    // Update topic statistics
    const { data: topic } = await this.db.supabase
      .from('topics')
      .select('*')
      .eq('id', topicId)
      .single()

    if (topic) {
      // Increase activity score and update keywords if needed
      const newKeywords = [...new Set([...(topic.keyword_signatures || []), ...candidate.keywords])]
      const newActivityScore = (topic.activity_score || 0) + candidate.confidence

      await this.db.supabase
        .from('topics')
        .update({
          keyword_signatures: newKeywords,
          activity_score: newActivityScore,
          updated_at: new Date().toISOString()
        })
        .eq('id', topicId)
    }
  }

  // ===========================
  // Emergent Topic Tracking
  // ===========================

  private async trackEmergentTopic(
    candidate: TopicCandidate, 
    artifactId: string
  ): Promise<Database['public']['Tables']['topics']['Row'] | null> {
    
    // Check if this emergent topic has been seen before
    const existingEmergent = await this.findExistingEmergentTopic(candidate)
    
    if (existingEmergent) {
      // Update frequency and check if it should graduate to full topic
      const updatedEmergent = await this.updateEmergentTopic(existingEmergent, candidate, artifactId)
      
      if (this.shouldGraduateEmergentTopic(updatedEmergent)) {
        return await this.graduateEmergentTopic(updatedEmergent)
      }
      
      return null
    }

    // Create new emergent topic tracking
    await this.createEmergentTopic(candidate, artifactId)
    return null
  }

  private async findExistingEmergentTopic(candidate: TopicCandidate): Promise<EmergentTopic | null> {
    // In a real implementation, this would query a separate emergent_topics table
    // For now, we'll check for unapproved topics with low emergence strength
    const { getSupabaseClient } = await import('@/lib/database')
    const supabase = getSupabaseClient(true)
    const { data: emergentTopics } = await supabase
      .from('topics')
      .select('*')
      .eq('organization_id', this.organizationId)
      .eq('is_approved', false)
      .lt('emergence_strength', this.EMERGENCE_THRESHOLD)

    if (!emergentTopics) return null

    // Find similar emergent topic
    for (const topic of emergentTopics) {
      const similarity = this.calculateTopicSimilarity(candidate, {
        name: topic.name,
        keywords: topic.keyword_signatures || [],
        description: topic.description || ''
      })

      if (similarity > this.SIMILARITY_THRESHOLD) {
        return {
          name: topic.name,
          keywords: topic.keyword_signatures || [],
          emergenceStrength: topic.emergence_strength || 0,
          frequency: topic.statement_count || 0,
          firstSeen: new Date(topic.created_at),
          lastSeen: new Date(topic.updated_at),
          contentArtifactIds: [], // Would be tracked separately
          similarTopics: []
        }
      }
    }

    return null
  }

  private async updateEmergentTopic(
    emergent: EmergentTopic, 
    candidate: TopicCandidate, 
    artifactId: string
  ): Promise<EmergentTopic> {
    
    // Update emergence metrics
    emergent.frequency += 1
    emergent.emergenceStrength = Math.min(1.0, emergent.emergenceStrength + (candidate.confidence * 0.1))
    emergent.lastSeen = new Date()
    emergent.contentArtifactIds.push(artifactId)
    
    // Merge keywords
    emergent.keywords = [...new Set([...emergent.keywords, ...candidate.keywords])]

    return emergent
  }

  private shouldGraduateEmergentTopic(emergent: EmergentTopic): boolean {
    return emergent.frequency >= 3 && emergent.emergenceStrength >= this.EMERGENCE_THRESHOLD
  }

  private async graduateEmergentTopic(emergent: EmergentTopic): Promise<Database['public']['Tables']['topics']['Row']> {
    return await this.createNewTopic({
      name: emergent.name,
      confidence: emergent.emergenceStrength,
      category: 'emergent',
      keywords: emergent.keywords,
      reasoning: `Graduated from emergent topic (${emergent.frequency} occurrences)`
    })
  }

  private async createEmergentTopic(candidate: TopicCandidate, artifactId: string): Promise<void> {
    // Create as unapproved topic with low emergence strength
    await this.db.topics.createTopic({
      organization_id: this.organizationId,
      name: candidate.name,
      description: `Emergent topic candidate: ${candidate.reasoning}`,
      keyword_signatures: candidate.keywords,
      emergence_strength: candidate.confidence,
      is_approved: false,
      is_cluster_root: false
    })
  }

  // ===========================
  // Topic Merging Detection
  // ===========================

  private async findMergingCandidates(candidates: TopicCandidate[]): Promise<TopicMergeCandidate[]> {
    const mergeCandidates: TopicMergeCandidate[] = []

    // Check for potential merges between detected topics
    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const topic1 = candidates[i]
        const topic2 = candidates[j]
        
        const mergeAnalysis = this.analyzePotentialMerge(topic1, topic2)
        
        if (mergeAnalysis.shouldMerge) {
          mergeCandidates.push({
            topic1: topic1.name,
            topic2: topic2.name,
            similarity: mergeAnalysis.similarity,
            mergingStrategy: mergeAnalysis.strategy,
            confidence: mergeAnalysis.confidence,
            evidence: mergeAnalysis.evidence
          })
        }
      }
    }

    return mergeCandidates
  }

  private analyzePotentialMerge(
    topic1: TopicCandidate, 
    topic2: TopicCandidate
  ): {
    shouldMerge: boolean
    similarity: number
    strategy: TopicMergeCandidate['mergingStrategy']
    confidence: number
    evidence: string[]
  } {
    
    const evidence: string[] = []
    let similarity = 0
    let strategy: TopicMergeCandidate['mergingStrategy'] = 'related'

    // Name similarity
    const nameSimilarity = this.fuzzyMatch(topic1.name.toLowerCase(), topic2.name.toLowerCase())
    if (nameSimilarity > 0.8) {
      similarity += nameSimilarity * 0.5
      strategy = 'synonym'
      evidence.push(`Similar names: ${topic1.name} ≈ ${topic2.name}`)
    }

    // Keyword overlap
    const keywordOverlap = this.calculateKeywordOverlap(topic1.keywords, topic2.keywords)
    if (keywordOverlap > 0.6) {
      similarity += keywordOverlap * 0.3
      evidence.push(`High keyword overlap: ${(keywordOverlap * 100).toFixed(1)}%`)
    }

    // Category matching
    if (topic1.category === topic2.category) {
      similarity += 0.2
      evidence.push(`Same category: ${topic1.category}`)
    }

    // Subset detection
    if (this.isTopicSubset(topic1, topic2)) {
      strategy = 'subset'
      similarity += 0.3
      evidence.push(`${topic1.name} is subset of ${topic2.name}`)
    } else if (this.isTopicSubset(topic2, topic1)) {
      strategy = 'subset'
      similarity += 0.3
      evidence.push(`${topic2.name} is subset of ${topic1.name}`)
    }

    const shouldMerge = similarity >= this.MERGE_THRESHOLD
    const confidence = Math.min(1.0, similarity)

    return {
      shouldMerge,
      similarity,
      strategy,
      confidence,
      evidence
    }
  }

  private isTopicSubset(topic1: TopicCandidate, topic2: TopicCandidate): boolean {
    // Check if topic1 is a subset/specialization of topic2
    const topic1Keywords = new Set(topic1.keywords.map(k => k.toLowerCase()))
    const topic2Keywords = new Set(topic2.keywords.map(k => k.toLowerCase()))
    
    // If topic1's keywords are mostly contained in topic2's keywords
    const containedKeywords = [...topic1Keywords].filter(k => topic2Keywords.has(k))
    return containedKeywords.length / topic1Keywords.size > 0.7
  }

  // ===========================
  // Topic Hierarchy Processing
  // ===========================

  private async processTopicHierarchy(
    hierarchy: EnhancedTopicDetection['hierarchicalTopics'][0]
  ): Promise<TopicRelationship[]> {
    
    const relationships: TopicRelationship[] = []

    // Find or create parent topic
    const parentTopicId = await this.findOrCreateTopic(hierarchy.parentTopic)
    
    // Process each child topic
    for (const childTopic of hierarchy.childTopics) {
      const childTopicId = await this.findOrCreateTopic(childTopic)
      
      relationships.push({
        parentTopicId,
        childTopicId,
        relationshipType: hierarchy.relationshipType,
        strength: 0.8, // Default strength for detected hierarchies
        evidence: ['Detected topic hierarchy relationship']
      })
    }

    return relationships
  }

  private async findOrCreateTopic(topicName: string): Promise<string> {
    // Try to find existing topic
    const { data: existingTopics } = await this.db.supabase
      .from('topics')
      .select('id')
      .eq('organization_id', this.organizationId)
      .ilike('name', topicName)
      .limit(1)

    if (existingTopics && existingTopics.length > 0) {
      return existingTopics[0].id
    }

    // Create new topic
    const result = await this.db.topics.createTopic({
      organization_id: this.organizationId,
      name: topicName,
      description: `Topic created from hierarchy detection`,
      is_approved: false
    })

    if (!result.success || !result.data) {
      throw new Error(`Failed to create topic: ${result.error}`)
    }

    return result.data.id
  }

  // ===========================
  // Topic Metrics and Analytics
  // ===========================

  private async updateTopicMetrics(topicIds: string[], artifactId: string): Promise<void> {
    for (const topicId of topicIds) {
      // Update statement count and activity metrics
      const { getSupabaseClient } = await import('@/lib/database')
      const supabase = getSupabaseClient(true)
      await supabase
        .from('topics')
        .update({
          statement_count: supabase.raw('statement_count + 1'),
          activity_score: supabase.raw('activity_score + 0.1'),
          updated_at: new Date().toISOString()
        })
        .eq('id', topicId)
    }
  }

  // ===========================
  // Topic Analytics
  // ===========================

  async getTopicAnalytics(timeframe: 'day' | 'week' | 'month' = 'week'): Promise<{
    topTopics: Array<{ name: string; activityScore: number; statementCount: number }>
    emergingTopics: Array<{ name: string; emergenceStrength: number; frequency: number }>
    topicGrowth: Array<{ date: string; newTopics: number; totalTopics: number }>
  }> {
    
    // Get top active topics
    const { data: topTopics } = await this.db.supabase
      .from('topics')
      .select('name, activity_score, statement_count')
      .eq('organization_id', this.organizationId)
      .eq('is_approved', true)
      .order('activity_score', { ascending: false })
      .limit(10)

    // Get emerging topics
    const { data: emergingTopics } = await this.db.supabase
      .from('topics')
      .select('name, emergence_strength, statement_count')
      .eq('organization_id', this.organizationId)
      .eq('is_approved', false)
      .gte('emergence_strength', 0.3)
      .order('emergence_strength', { ascending: false })
      .limit(10)

    return {
      topTopics: topTopics?.map(t => ({
        name: t.name,
        activityScore: t.activity_score || 0,
        statementCount: t.statement_count || 0
      })) || [],
      emergingTopics: emergingTopics?.map(t => ({
        name: t.name,
        emergenceStrength: t.emergence_strength || 0,
        frequency: t.statement_count || 0
      })) || [],
      topicGrowth: [] // Would implement based on time series data
    }
  }
}