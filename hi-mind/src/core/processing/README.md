# HiMind Content Processing Pipeline

The Content Processing Pipeline transforms raw content from Slack, GitHub, and other platforms into structured knowledge that enables intelligent expertise discovery and question routing.

## Architecture Overview

```
Raw Content → Content Extractor → NLP Analysis → Knowledge Statements → Expertise Signals
```

### Key Components

1. **NLP Service** - Text analysis and embeddings using OpenAI
2. **Content Extractor** - Platform-agnostic content processing
3. **Platform Extractors** - Slack and GitHub specific extractors
4. **Processing Orchestrator** - Pipeline coordination and batch processing

## Quick Start

### 1. Environment Setup

```bash
# Required environment variables
OPENAI_API_KEY=your_openai_api_key
```

### 2. Create Sample Data

```bash
POST /api/processing/sample-data
{
  "orgName": "My Company",
  "orgSlug": "my-company",
  "adminEmail": "admin@company.com",
  "adminName": "Admin User"
}
```

### 3. Start Processing Pipeline

```bash
POST /api/processing
{
  "action": "start"
}
```

### 4. Process Content

```bash
# Create batch job
POST /api/processing
{
  "action": "create_batch",
  "organizationId": "your_org_id",
  "filter": { "unprocessedOnly": true }
}

# Run batch job
POST /api/processing
{
  "action": "run_batch",
  "jobId": "batch_job_id"
}
```

### 5. Monitor Progress

```bash
# Pipeline status
GET /api/processing

# Batch job status
GET /api/processing/batch/{jobId}
```

## API Reference

### Processing Management

- `POST /api/processing` - Start/stop pipeline, process artifacts, create batch jobs
- `GET /api/processing` - Get pipeline status and health
- `GET /api/processing/batch/{jobId}` - Get batch job status

### Actions

- `start` - Start the processing pipeline
- `stop` - Stop the processing pipeline  
- `process_artifact` - Process a single content artifact
- `create_batch` - Create a batch processing job
- `run_batch` - Execute a batch processing job

## Usage Examples

### Processing Individual Artifacts

```typescript
import { getProcessingOrchestrator } from '@/core/processing'

const orchestrator = await getProcessingOrchestrator()
await orchestrator.startPipeline()

const result = await orchestrator.processArtifact('artifact_id')
console.log('Processing result:', result)
```

### Creating Custom Content Extractors

```typescript
import { HiMindNLPService, ContentExtractor } from '@/core/processing'

const nlpService = new HiMindNLPService({
  openaiApiKey: process.env.OPENAI_API_KEY!
})

const extractor = new ContentExtractor(nlpService, db)
const result = await extractor.processContentArtifact('artifact_id')
```

### Platform-Specific Extraction

```typescript
import { createSlackExtractor, createGitHubExtractor } from '@/core/processing'

// Slack
const slackExtractor = createSlackExtractor()
const slackContent = await slackExtractor.extractContent({
  message: slackMessage,
  channel: slackChannel,
  user: slackUser
})

// GitHub
const githubExtractor = createGitHubExtractor()
const githubContent = await githubExtractor.extractContent({
  type: 'pull_request',
  data: pullRequest,
  repository: repository
})
```

## Configuration

### Processing Config

```typescript
const config: ProcessingConfig = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'text-embedding-3-small',
    dimensions: 1536
  },
  thresholds: {
    minContentLength: 10,
    maxContentLength: 10000,
    minQualityScore: 0.3,
    similarityThreshold: 0.8,
    confidenceThreshold: 0.5
  },
  batch: {
    maxBatchSize: 10,
    processingDelayMs: 1000,
    retryAttempts: 3
  }
}
```

## Processing Flow

### 1. Content Extraction
- Raw platform data → Normalized `RawContent`
- Text cleaning and formatting
- Author resolution and context extraction

### 2. NLP Analysis
- Content analysis (sentiment, type, complexity)
- Technical term extraction
- Entity and key phrase identification
- Quality assessment

### 3. Embedding Generation
- OpenAI embeddings for semantic search
- Vector storage for similarity matching

### 4. Topic Detection
- Technology topics (React, TypeScript, etc.)
- Domain topics (Backend, Frontend, etc.)  
- Process topics (Testing, Deployment, etc.)
- Problem topics (Debugging, Performance, etc.)

### 5. Knowledge Statement Creation
- Structured knowledge statements
- Headline generation
- Content categorization
- Topic linking

### 6. Expertise Signal Recording
- Evidence-based expertise signals
- Signal strength calculation
- Temporal decay modeling
- Context preservation

## Monitoring and Health

### Pipeline Health Check

```bash
GET /api/processing
```

Returns:
- Pipeline running status
- Processing statistics
- Health check results
- Performance metrics

### Batch Job Monitoring

```bash
GET /api/processing/batch/{jobId}
```

Returns:
- Job status and progress
- Processing results
- Error details
- Performance metrics

## Error Handling

The pipeline includes comprehensive error handling:

- **Validation Errors** - Invalid content or configuration
- **NLP Errors** - OpenAI API failures or processing errors
- **Processing Errors** - Pipeline stage failures
- **Recoverable Errors** - Automatic retry with exponential backoff

## Performance Considerations

- **Batch Processing** - Process multiple items efficiently
- **Rate Limiting** - Respect API limits and system resources
- **Parallel Processing** - Concurrent processing with controlled concurrency
- **Caching** - Expensive operations are cached when possible
- **Monitoring** - Real-time metrics and health monitoring

## Testing

### Create Sample Data

```typescript
import { createSampleData } from '@/core/processing'

await createSampleData()
```

### Test Individual Components

```typescript
import { HiMindNLPService } from '@/core/processing'

const nlp = new HiMindNLPService({ openaiApiKey: 'test-key' })
const analysis = await nlp.analyzeContent('Test content')
const embedding = await nlp.generateEmbedding('Test content')
```

## Extending the Pipeline

### Adding New Platform Extractors

1. Implement the `PlatformExtractor` interface
2. Handle platform-specific data formats
3. Add content validation and enrichment
4. Register with the processing orchestrator

### Custom NLP Processing

1. Extend the `NLPService` interface
2. Implement custom analysis methods
3. Add new topic detection strategies
4. Integrate with the content extractor

### Advanced Features

- **Custom Topic Clustering** - Implement domain-specific clustering
- **Enhanced Quality Scoring** - Add custom quality metrics
- **Real-time Processing** - Stream processing for live content
- **Multi-language Support** - Extend NLP for multiple languages