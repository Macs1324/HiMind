// Content Processing Pipeline - Main exports

// Types
export type * from './types/processing'

// NLP Service
export { HiMindNLPService } from './nlp/nlp-service'
export type { NLPService } from '../types/processing'

// Content Extractors
export { ContentExtractor, createContentExtractor } from './extractor/content-extractor'
export { SlackExtractor, createSlackExtractor } from './extractor/platform-extractors/slack-extractor'
export { GitHubExtractor, createGitHubExtractor } from './extractor/platform-extractors/github-extractor'

// Processing Orchestrator
export { 
  HiMindProcessingOrchestrator, 
  createProcessingOrchestrator, 
  getProcessingOrchestrator 
} from './orchestrator/processing-orchestrator'

// Test Utilities
export { SampleDataCreator, createSampleData } from './test/sample-data-creator'

// Error Classes
export { ProcessingError, NLPError } from '../types/processing'