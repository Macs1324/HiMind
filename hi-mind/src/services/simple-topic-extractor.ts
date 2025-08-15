// Simplified topic extraction for content ingestion
// This is a lightweight version that doesn't require the full NLP pipeline

export interface SimpleTopic {
  name: string;
  confidence: number;
  keywords: string[];
  category: 'technology' | 'domain' | 'process' | 'problem';
}

export interface SimpleStatement {
  headline: string;
  content: string;
  type: 'explanation' | 'decision' | 'solution' | 'best_practice' | 'warning' | 'tip' | 'example' | 'reference';
  keywords: string[];
  confidence: number;
}

export interface ExtractionResult {
  topics: SimpleTopic[];
  statements: SimpleStatement[];
}

export class SimpleTopicExtractor {
  
  async extractTopicsAndStatements(text: string): Promise<ExtractionResult> {
    // Extract topics using pattern matching
    const topics = this.extractTopics(text);
    
    // Extract knowledge statements 
    const statements = this.extractStatements(text);
    
    return { topics, statements };
  }

  private extractTopics(text: string): SimpleTopic[] {
    const topics: SimpleTopic[] = [];
    const lowerText = text.toLowerCase();

    // Technology patterns
    const techPatterns = {
      'React Development': {
        keywords: ['react', 'jsx', 'component', 'hook', 'usestate', 'useeffect'],
        category: 'technology' as const
      },
      'Backend Development': {
        keywords: ['api', 'server', 'backend', 'endpoint', 'microservice', 'rest'],
        category: 'technology' as const
      },
      'Database': {
        keywords: ['sql', 'database', 'query', 'migration', 'postgresql', 'mongodb'],
        category: 'technology' as const
      },
      'DevOps': {
        keywords: ['docker', 'kubernetes', 'ci/cd', 'deployment', 'infrastructure'],
        category: 'technology' as const
      },
      'Authentication': {
        keywords: ['auth', 'jwt', 'oauth', 'login', 'token', 'security'],
        category: 'technology' as const
      },
      'Frontend Development': {
        keywords: ['frontend', 'ui', 'ux', 'css', 'html', 'javascript', 'typescript'],
        category: 'technology' as const
      },
      'Performance': {
        keywords: ['performance', 'optimization', 'speed', 'memory', 'cache'],
        category: 'process' as const
      },
      'Testing': {
        keywords: ['test', 'testing', 'unit', 'integration', 'e2e', 'jest'],
        category: 'process' as const
      },
      'Troubleshooting': {
        keywords: ['error', 'bug', 'fix', 'problem', 'issue', 'debug'],
        category: 'problem' as const
      },
      'Software Architecture': {
        keywords: ['architecture', 'design', 'pattern', 'scalability', 'design pattern'],
        category: 'domain' as const
      }
    };

    for (const [topicName, pattern] of Object.entries(techPatterns)) {
      const matches = pattern.keywords.filter(keyword => 
        lowerText.includes(keyword)
      );

      if (matches.length > 0) {
        const confidence = Math.min(0.9, matches.length / pattern.keywords.length + 0.3);
        
        topics.push({
          name: topicName,
          confidence,
          keywords: matches,
          category: pattern.category
        });
      }
    }

    // Sort by confidence and return top topics
    return topics
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);
  }

  private extractStatements(text: string): SimpleStatement[] {
    const statements: SimpleStatement[] = [];
    
    // Split text into sentences
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed.length < 30) continue;

      // Determine statement type based on content patterns
      const type = this.determineStatementType(trimmed);
      
      // Extract key terms
      const keywords = this.extractKeywords(trimmed);
      
      // Generate headline (first few words or key phrase)
      const headline = this.generateHeadline(trimmed);
      
      // Calculate confidence based on content characteristics
      const confidence = this.calculateStatementConfidence(trimmed, type);

      statements.push({
        headline,
        content: trimmed,
        type,
        keywords,
        confidence
      });
    }

    // Return top statements
    return statements
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);
  }

  private determineStatementType(text: string): SimpleStatement['type'] {
    const lowerText = text.toLowerCase();

    // Pattern matching for statement types
    if (lowerText.includes('how to') || lowerText.includes('steps') || lowerText.includes('guide')) {
      return 'explanation';
    }
    if (lowerText.includes('decided') || lowerText.includes('chose') || lowerText.includes('will use')) {
      return 'decision';
    }
    if (lowerText.includes('solved') || lowerText.includes('fix') || lowerText.includes('solution')) {
      return 'solution';
    }
    if (lowerText.includes('best practice') || lowerText.includes('should') || lowerText.includes('recommend')) {
      return 'best_practice';
    }
    if (lowerText.includes('warning') || lowerText.includes('careful') || lowerText.includes('avoid')) {
      return 'warning';
    }
    if (lowerText.includes('tip') || lowerText.includes('hint') || lowerText.includes('pro tip')) {
      return 'tip';
    }
    if (lowerText.includes('example') || lowerText.includes('for instance') || lowerText.includes('like this')) {
      return 'example';
    }
    if (lowerText.includes('see') || lowerText.includes('docs') || lowerText.includes('documentation')) {
      return 'reference';
    }

    // Default to explanation
    return 'explanation';
  }

  private extractKeywords(text: string): string[] {
    // Simple keyword extraction based on technical terms
    const techTerms = [
      'react', 'vue', 'angular', 'javascript', 'typescript', 'node', 'express',
      'api', 'rest', 'graphql', 'sql', 'database', 'mongodb', 'postgresql',
      'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'deployment', 'ci/cd',
      'auth', 'jwt', 'oauth', 'security', 'token', 'login', 'session',
      'test', 'testing', 'unit', 'integration', 'e2e', 'jest', 'cypress',
      'performance', 'optimization', 'cache', 'memory', 'speed', 'latency',
      'component', 'hook', 'state', 'props', 'redux', 'context',
      'backend', 'frontend', 'fullstack', 'microservice', 'architecture'
    ];

    const lowerText = text.toLowerCase();
    return techTerms.filter(term => lowerText.includes(term));
  }

  private generateHeadline(text: string): string {
    // Generate a short headline from the text
    const words = text.split(' ').slice(0, 8);
    let headline = words.join(' ');
    
    // Clean up and ensure it's not too long
    if (headline.length > 60) {
      headline = headline.substring(0, 57) + '...';
    }
    
    // Capitalize first letter
    return headline.charAt(0).toUpperCase() + headline.slice(1);
  }

  private calculateStatementConfidence(text: string, type: SimpleStatement['type']): number {
    let confidence = 0.5; // Base confidence

    // Length factor
    if (text.length > 50) confidence += 0.1;
    if (text.length > 100) confidence += 0.1;

    // Technical content factor
    const techTermCount = this.extractKeywords(text).length;
    if (techTermCount > 0) confidence += Math.min(0.2, techTermCount * 0.05);

    // Statement type factor
    if (type === 'solution' || type === 'best_practice') confidence += 0.1;
    if (type === 'warning' || type === 'tip') confidence += 0.05;

    // Structure factor (has clear sentences)
    if (text.includes(':') || text.includes('-') || text.includes('1.')) {
      confidence += 0.1;
    }

    return Math.min(0.95, confidence);
  }
}