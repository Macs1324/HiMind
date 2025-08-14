# HiMind Core Architecture & Data Flow Specification

## Table of Contents
1. [Overview](#overview)
2. [Core Components](#core-components)
3. [Data Flow Architecture](#data-flow-architecture)
4. [Expertise Graph Engine](#expertise-graph-engine)
5. [Knowledge Processing Pipeline](#knowledge-processing-pipeline)
6. [Question Routing System](#question-routing-system)
7. [Topic Clustering Algorithm](#topic-clustering-algorithm)
8. [Database Design](#database-design)
9. [API Design](#api-design)
10. [Implementation Phases](#implementation-phases)

## Overview

HiMind is an intelligent expertise discovery and knowledge routing system that automatically maps organizational knowledge by analyzing actual work patterns. The system creates a living expertise graph that routes questions to the right experts or surfaces relevant past explanations.

### Core Principles

1. **Evidence-Based Expertise**: Never self-reported, always derived from actual work outputs
2. **Emergent Knowledge Clusters**: Topics emerge from data analysis, not predefined categories
3. **Contextual Intelligence**: Preserves the context and attribution of all knowledge
4. **Availability-Aware Routing**: Respects expert availability and workload distribution
5. **Quality-Driven**: Continuous feedback loops improve routing and knowledge quality

## Core Components

### 1. Data Ingestion Layer
**Purpose**: Collect and normalize data from various platforms

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Slack API     │    │   GitHub API    │    │   Linear API    │
│                 │    │                 │    │                 │
│ • Messages      │    │ • Pull Requests │    │ • Issues        │
│ • Reactions     │    │ • Code Reviews  │    │ • Comments      │
│ • Threads       │    │ • Issues        │    │ • Assignments   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │ Content Artifact│
                    │   Processor     │
                    │                 │
                    │ • Normalization │
                    │ • Author Match  │
                    │ • Deduplication │
                    └─────────────────┘
```

**Data Sources & Signals**:
- **Slack**: Messages, thread responses, reactions, helpful responses
- **GitHub**: PR reviews, issue discussions, commits, documentation edits
- **Linear/Jira**: Issue resolution, detailed explanations, problem-solving
- **Confluence/Notion**: Documentation contributions, knowledge sharing

### 2. Knowledge Processing Engine
**Purpose**: Transform raw content into structured knowledge statements

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Content         │    │ NLP Processing  │    │ Knowledge       │
│ Artifacts       ├───►│                 ├───►│ Statements      │
│                 │    │ • Topic Extract │    │                 │
│ • Raw text      │    │ • Entity NER    │    │ • Structured    │
│ • Metadata      │    │ • Sentiment     │    │ • Categorized   │
│ • Context       │    │ • Quality Score │    │ • Searchable    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 3. Expertise Graph Engine
**Purpose**: Build and maintain the who-knows-what mapping

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Expertise       │    │ Score           │    │ Expertise       │
│ Signals         ├───►│ Computation     ├───►│ Graph           │
│                 │    │                 │    │                 │
│ • Authored      │    │ • Temporal      │    │ • Person-Topic  │
│ • Helpful       │    │ • Quality       │    │ • Confidence    │
│ • Fast Response │    │ • Validation    │    │ • Availability  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 4. Question Routing Intelligence
**Purpose**: Route questions optimally based on expertise and availability

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Incoming        │    │ Routing         │    │ Response        │
│ Question        ├───►│ Engine          ├───►│ Strategy        │
│                 │    │                 │    │                 │
│ • Content       │    │ • Similarity    │    │ • Auto Answer   │
│ • Context       │    │ • Expertise     │    │ • Expert Route  │
│ • Urgency       │    │ • Availability  │    │ • Escalation    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Data Flow Architecture

### High-Level Data Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Source    │────►│  Ingestion  │────►│ Processing  │────►│   Storage   │
│  Platforms  │     │   Layer     │     │   Engine    │     │  (Supabase) │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                                                   │
┌─────────────┐     ┌─────────────┐     ┌─────────────┐            │
│  Response   │◄────│   Routing   │◄────│  Expertise  │◄───────────┘
│  Delivery   │     │   Engine    │     │   Graph     │
└─────────────┘     └─────────────┘     └─────────────┘
```

### Detailed Component Interactions

```
                    ┌─────────────────────────────────────────┐
                    │            Supabase Database            │
                    │                                         │
┌──────────────┐    │  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│ Slack        ├────┼─►│ Content  │  │Knowledge │  │ People │ │
│ Integration  │    │  │Artifacts │  │Statement │  │        │ │
└──────────────┘    │  └──────────┘  └──────────┘  └────────┘ │
                    │       │              │           │      │
┌──────────────┐    │       │              │           │      │
│ GitHub       ├────┼───────┘              │           │      │
│ Integration  │    │                      │           │      │
└──────────────┘    │  ┌──────────┐       │      ┌────────┐  │
                    │  │ Topics   │◄──────┼──────┤Signals │  │
┌──────────────┐    │  │          │       │      │        │  │
│ Linear       ├────┼──┤          │       │      └────────┘  │
│ Integration  │    │  └──────────┘       │           │      │
└──────────────┘    │       │             │           │      │
                    │       │        ┌────▼──────┐    │      │
                    │       │        │ Expertise │    │      │
                    │       │        │  Scores   │◄───┘      │
                    │       │        └───────────┘           │
                    └─────────────────────────────────────────┘
                            │                   │
                            ▼                   ▼
                    ┌──────────────┐    ┌──────────────┐
                    │ Question     │    │ Routing      │
                    │ Processor    │    │ Engine       │
                    └──────────────┘    └──────────────┘
                            │                   │
                            └───────┬───────────┘
                                    ▼
                            ┌──────────────┐
                            │ Response     │
                            │ Generator    │
                            └──────────────┘
```

## Expertise Graph Engine

### Signal Types and Weights

```typescript
enum ExpertiseSignalType {
  AUTHORED_STATEMENT = 'authored_statement',      // Weight: 1.0
  HELPFUL_RESPONSE = 'helpful_response',          // Weight: 0.8
  CODE_REVIEW = 'code_review',                    // Weight: 0.9
  PR_ACCEPTED = 'pr_accepted',                    // Weight: 0.7
  BUG_FIX = 'bug_fix',                           // Weight: 0.8
  DOCUMENTATION = 'documentation',                // Weight: 0.6
  ANSWERED_QUESTION = 'answered_question',        // Weight: 0.9
  POSITIVE_REACTION = 'positive_reaction',        // Weight: 0.3
  FAST_RESPONSE = 'fast_response',               // Weight: 0.4
  DETAILED_EXPLANATION = 'detailed_explanation',  // Weight: 1.2
  PROBLEM_RESOLUTION = 'problem_resolution'       // Weight: 1.1
}
```

### Expertise Score Computation

```
Expertise Score = Σ(Signal Strength × Signal Weight × Temporal Decay × Quality Multiplier)

Where:
- Signal Strength: Base strength of the signal (0.1 - 2.0)
- Signal Weight: Type-specific weight from enum above
- Temporal Decay: Time-based decay factor (e^(-λt))
- Quality Multiplier: Based on peer validation and feedback (0.5 - 2.0)

Normalization:
- Raw scores are normalized within organization (0-1 scale)
- Confidence level based on signal count and variance
- Availability factor for routing decisions
```

### Temporal Decay Model

```
Decay Factor = e^(-λ × days_ago)

Where λ (decay rate) varies by signal type:
- Code reviews, PRs: λ = 0.01 (slow decay, ~100 day half-life)
- Chat responses: λ = 0.02 (medium decay, ~50 day half-life)  
- Reactions: λ = 0.05 (fast decay, ~20 day half-life)
```

## Knowledge Processing Pipeline

### Content Artifact Processing

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Raw       │    │  Author     │    │   Topic     │    │ Knowledge   │
│ Content     ├───►│ Resolution  ├───►│ Extraction  ├───►│ Statement   │
│             │    │             │    │             │    │ Creation    │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

**Step 1: Author Resolution**
- Match external IDs to internal person records
- Create new person records if needed
- Link external identities across platforms

**Step 2: Topic Extraction**
```python
def extract_topics(content: str, context: dict) -> List[TopicMatch]:
    """
    Extract topics using multiple methods:
    1. Keyword matching against existing topics
    2. NLP entity recognition for technologies
    3. Context-based inference (repository, channel, etc.)
    4. Semantic similarity to topic vectors
    """
    topics = []
    
    # Keyword matching
    for topic in existing_topics:
        if keyword_match(content, topic.keywords):
            topics.append(TopicMatch(topic, method='keyword'))
    
    # Technology entity recognition
    entities = extract_tech_entities(content)
    for entity in entities:
        topic = find_or_create_topic(entity)
        topics.append(TopicMatch(topic, method='entity'))
    
    # Semantic similarity
    content_vector = embed_text(content)
    similar_topics = find_similar_topics(content_vector)
    topics.extend(similar_topics)
    
    return deduplicate_and_rank(topics)
```

**Step 3: Knowledge Statement Creation**
```python
def create_knowledge_statement(
    content: str, 
    author: Person, 
    topics: List[Topic],
    source: ContentArtifact
) -> KnowledgeStatement:
    """
    Create structured knowledge statement with:
    - Headline extraction (first sentence or summary)
    - Content cleaning and formatting
    - Quality scoring based on length, clarity, examples
    - Confidence scoring based on author expertise
    """
    headline = extract_headline(content)
    cleaned_content = clean_and_format(content)
    
    statement = KnowledgeStatement(
        headline=headline,
        content=cleaned_content,
        author=author,
        source_artifact=source,
        statement_type=classify_statement_type(content),
        quality_score=calculate_quality_score(content, author),
        confidence_score=calculate_confidence(author, topics)
    )
    
    # Link to topics with relevance scores
    for topic in topics:
        link_statement_to_topic(statement, topic, relevance_score)
    
    return statement
```

## Question Routing System

### Routing Decision Tree

```
┌─────────────┐
│  Question   │
│   Arrives   │
└──────┬──────┘
       │
       ▼
┌─────────────┐     Yes    ┌─────────────┐
│ Similar     ├────────────►│ Auto-Answer │
│ Question    │            │ with Source │
│ Exists?     │            │ Attribution │
└──────┬──────┘            └─────────────┘
       │ No
       ▼
┌─────────────┐     No     ┌─────────────┐
│ Expert      ├────────────►│ Escalation  │
│ Available   │            │ or Schedule │
│ for Topic?  │            │ for Later   │
└──────┬──────┘            └─────────────┘
       │ Yes
       ▼
┌─────────────┐     High   ┌─────────────┐
│ Confidence  ├────────────►│ Route to    │
│ in Match?   │            │ Top Expert  │
└──────┬──────┘            └─────────────┘
       │ Low
       ▼
┌─────────────┐
│ Route with  │
│ Multiple    │
│ Options     │
└─────────────┘
```

### Similarity Matching Algorithm

```python
def find_similar_questions(
    new_question: str,
    organization_id: str,
    threshold: float = 0.8
) -> List[SimilarQuestionMatch]:
    """
    Find similar previously answered questions using:
    1. Vector similarity search
    2. Keyword overlap analysis
    3. Topic intersection
    4. Context similarity
    """
    # Embed the new question
    question_vector = embed_text(new_question)
    
    # Vector similarity search
    similar_by_vector = vector_search(
        question_vector, 
        organization_id, 
        threshold=threshold
    )
    
    # Keyword analysis
    question_keywords = extract_keywords(new_question)
    similar_by_keywords = keyword_search(
        question_keywords,
        organization_id,
        min_overlap=0.5
    )
    
    # Combine and rank
    combined_results = combine_similarity_scores(
        similar_by_vector,
        similar_by_keywords
    )
    
    return rank_by_composite_score(combined_results)
```

### Expert Selection Algorithm

```python
def select_expert(
    question: Question,
    detected_topics: List[Topic]
) -> ExpertRouting:
    """
    Select the best expert based on:
    1. Expertise score in relevant topics
    2. Current availability
    3. Recent workload
    4. Response time patterns
    5. Preference settings
    """
    candidates = []
    
    for topic in detected_topics:
        experts = get_topic_experts(
            topic_id=topic.id,
            min_score=0.2,
            available_only=True
        )
        
        for expert in experts:
            availability = check_availability(expert, question.urgency)
            workload = get_recent_workload(expert)
            
            score = calculate_routing_score(
                expertise_score=expert.normalized_score,
                availability_factor=availability.factor,
                workload_penalty=workload.penalty,
                response_time_bonus=expert.avg_response_time_bonus
            )
            
            candidates.append(ExpertCandidate(
                person=expert.person,
                score=score,
                confidence=expert.confidence_level,
                estimated_response_time=estimate_response_time(expert)
            ))
    
    # Select best candidate with fallbacks
    primary_expert = max(candidates, key=lambda x: x.score)
    alternative_experts = sorted(
        [c for c in candidates if c != primary_expert],
        key=lambda x: x.score,
        reverse=True
    )[:3]
    
    return ExpertRouting(
        primary=primary_expert,
        alternatives=alternative_experts,
        confidence=primary_expert.confidence,
        routing_reason=generate_routing_explanation(primary_expert)
    )
```

## Topic Clustering Algorithm

### Emergent Topic Discovery

```python
def discover_emerging_topics(
    organization_id: str,
    min_statements: int = 5,
    min_emergence_strength: float = 0.6
) -> List[EmergingTopic]:
    """
    Discover new topics by clustering knowledge statements:
    1. Collect untagged or low-confidence statements
    2. Generate embeddings for semantic clustering
    3. Apply clustering algorithm (HDBSCAN or similar)
    4. Validate clusters and extract topic signatures
    """
    
    # Get statements that need topic classification
    statements = get_statements_for_clustering(
        organization_id,
        include_low_confidence=True,
        min_created_days_ago=7
    )
    
    # Generate embeddings
    embeddings = [embed_text(s.content) for s in statements]
    
    # Cluster using HDBSCAN for density-based clustering
    clusters = perform_clustering(
        embeddings,
        min_cluster_size=min_statements,
        min_samples=3
    )
    
    emerging_topics = []
    for cluster_id, cluster_statements in clusters.items():
        if cluster_id == -1:  # Noise cluster
            continue
            
        # Extract topic signature
        topic_signature = extract_topic_signature(cluster_statements)
        emergence_strength = calculate_emergence_strength(cluster_statements)
        
        if emergence_strength >= min_emergence_strength:
            topic = EmergingTopic(
                name=topic_signature.name,
                canonical_name=normalize_topic_name(topic_signature.name),
                description=topic_signature.description,
                keyword_signatures=topic_signature.keywords,
                emergence_strength=emergence_strength,
                statement_count=len(cluster_statements),
                supporting_statements=cluster_statements
            )
            emerging_topics.append(topic)
    
    return emerging_topics

def extract_topic_signature(statements: List[KnowledgeStatement]) -> TopicSignature:
    """
    Extract topic signature from a cluster of statements:
    1. Find most common keywords and entities
    2. Generate topic name from frequent terms
    3. Create description from statement patterns
    """
    all_text = " ".join([s.content for s in statements])
    
    # Extract keywords with TF-IDF
    keywords = extract_tfidf_keywords(all_text, top_k=10)
    
    # Extract named entities (technologies, frameworks, etc.)
    entities = extract_named_entities(all_text)
    
    # Generate topic name (most frequent tech term or keyword bigram)
    topic_name = generate_topic_name(keywords, entities)
    
    # Create description
    description = generate_topic_description(statements, keywords, entities)
    
    return TopicSignature(
        name=topic_name,
        description=description,
        keywords=keywords,
        entities=entities
    )
```

### Topic Hierarchy and Clustering

```python
def organize_topic_hierarchy(topics: List[Topic]) -> TopicHierarchy:
    """
    Organize topics into hierarchical clusters:
    1. Calculate topic similarity matrix
    2. Apply hierarchical clustering
    3. Create parent-child relationships
    4. Generate topic clusters for navigation
    """
    
    # Calculate similarity between all topic pairs
    similarity_matrix = calculate_topic_similarity_matrix(topics)
    
    # Hierarchical clustering
    hierarchy = perform_hierarchical_clustering(
        similarity_matrix,
        linkage_method='ward',
        distance_threshold=0.7
    )
    
    # Create clusters and relationships
    topic_clusters = create_topic_clusters(hierarchy, topics)
    parent_child_relationships = extract_parent_child_relations(hierarchy)
    
    return TopicHierarchy(
        clusters=topic_clusters,
        relationships=parent_child_relationships,
        cluster_tree=hierarchy
    )
```

## Database Design

### Core Entity Relationships

```
Organizations (Multi-tenant root)
    ├── People (Team members)
    │   ├── ExternalIdentities (Platform links)
    │   ├── PersonAvailability (Schedule/preferences)
    │   └── ExpertiseScores (Per-topic expertise)
    │
    ├── ContentArtifacts (Raw platform data)
    │   └── KnowledgeStatements (Processed knowledge)
    │       └── StatementTopics (Many-to-many topic links)
    │
    ├── Topics (Knowledge domains)
    │   ├── TopicClusters (Hierarchical grouping)
    │   └── ExpertiseSignals (Evidence of knowledge)
    │
    ├── Questions (Incoming queries)
    │   └── QuestionRoutes (Routing decisions)
    │
    └── KnowledgeFeedback (Quality improvement)
```

### Data Consistency Rules

1. **Organization Isolation**: All data strictly partitioned by organization
2. **Referential Integrity**: Cascade deletes preserve data consistency
3. **Temporal Consistency**: All timestamps in UTC with timezone info
4. **Score Consistency**: Expertise scores recomputed on signal changes
5. **Privacy Enforcement**: RLS policies enforce data access controls

### Performance Optimization

```sql
-- Critical indexes for HiMind query patterns
CREATE INDEX CONCURRENTLY idx_expertise_routing 
ON expertise_scores (topic_id, is_available_for_questions, normalized_score DESC);

CREATE INDEX CONCURRENTLY idx_knowledge_search 
ON knowledge_statements USING gin(search_tokens);

CREATE INDEX CONCURRENTLY idx_vector_similarity 
ON knowledge_statements USING ivfflat (content_vector vector_cosine_ops);

CREATE INDEX CONCURRENTLY idx_signal_computation 
ON expertise_signals (person_id, topic_id, occurred_at DESC);
```

## API Design

### Core API Endpoints

```typescript
// Organization Management
POST   /api/organizations                    // Create organization
GET    /api/organizations/:id               // Get organization details
PUT    /api/organizations/:id               // Update organization

// People & Identity
POST   /api/people                         // Create person
GET    /api/people/:id                      // Get person with identities
POST   /api/people/:id/identities          // Link external identity
PUT    /api/people/:id/availability         // Update availability

// Knowledge Management
POST   /api/knowledge/statements            // Create statement
GET    /api/knowledge/search               // Search knowledge
POST   /api/knowledge/feedback             // Submit feedback
GET    /api/knowledge/statements/:id       // Get statement details

// Topic Management
GET    /api/topics                         // List topics
POST   /api/topics                         // Create topic
GET    /api/topics/:id/experts             // Get topic experts
POST   /api/topics/clusters                // Create topic cluster
GET    /api/topics/emerging                // Get emerging topics

// Expertise & Signals
POST   /api/expertise/signals              // Record expertise signal
GET    /api/expertise/scores/:personId     // Get person's expertise
PUT    /api/expertise/availability         // Update expert availability
POST   /api/expertise/recompute           // Trigger score recomputation

// Question Routing
POST   /api/questions                      // Submit question
GET    /api/questions/:id                  // Get question details
POST   /api/questions/:id/route           // Route question to expert
GET    /api/questions/similar             // Find similar questions

// Analytics
GET    /api/analytics/coverage            // Knowledge coverage metrics
GET    /api/analytics/routing             // Routing success metrics
GET    /api/analytics/expertise           // Expertise distribution
```

### Webhook Events

```typescript
interface WebhookEvent {
  type: string;
  organization_id: string;
  timestamp: string;
  data: any;
}

// Expertise Events
'expertise.signal.created'     // New expertise signal recorded
'expertise.score.updated'      // Expertise score recalculated
'expertise.topic.emerged'      // New topic discovered

// Knowledge Events  
'knowledge.statement.created'  // New knowledge statement
'knowledge.statement.updated'  // Statement quality updated
'knowledge.feedback.received'  // User feedback received

// Routing Events
'question.received'            // New question submitted
'question.routed'             // Question routed to expert
'question.answered'           // Question received answer
'question.escalated'          // Question escalated
```

## Implementation Phases

### Phase 1: Foundation (Weeks 1-2)
- ✅ Database schema and migrations
- ✅ Core API endpoints
- ✅ Authentication and RLS setup
- 🔄 Basic web interface for testing
- 🔄 Slack integration (basic message ingestion)

### Phase 2: Knowledge Processing (Weeks 3-4)
- 📝 Content artifact processing pipeline
- 📝 Knowledge statement extraction
- 📝 Basic topic extraction (keyword-based)
- 📝 Simple expertise signal recording
- 📝 Basic search functionality

### Phase 3: Intelligence Layer (Weeks 5-6)
- 📝 Expertise score computation engine
- 📝 Question similarity matching
- 📝 Basic question routing
- 📝 Topic clustering algorithm
- 📝 Feedback collection system

### Phase 4: Advanced Features (Weeks 7-8)
- 📝 Vector embeddings and semantic search
- 📝 Advanced routing with availability
- 📝 Emerging topic discovery
- 📝 Quality scoring and validation
- 📝 Analytics dashboard

### Phase 5: Production Readiness (Weeks 9-10)
- 📝 Performance optimization
- 📝 Monitoring and observability
- 📝 Error handling and recovery
- 📝 Documentation and training
- 📝 Security audit and hardening

## Key Design Decisions

### 1. **Evidence-Based Expertise Only**
- Never allow self-reported expertise
- All expertise derived from observable actions
- Temporal decay ensures freshness
- Multiple signal types prevent gaming

### 2. **Emerging Topics vs. Predefined Categories**
- Topics discovered from actual content
- Clustering algorithms identify knowledge domains
- Human validation for topic approval
- Hierarchical organization emerges naturally

### 3. **Multi-Modal Routing Strategy**
- Auto-answer when high confidence match exists
- Expert routing with availability awareness
- Escalation paths for complex questions
- Load balancing across experts

### 4. **Quality-Driven Feedback Loops**
- Continuous feedback collection
- Quality scores influence routing
- Expert preferences respected
- System learns from outcomes

### 5. **Privacy-First Architecture**
- Organization-level data isolation
- Granular privacy controls
- Transparent attribution
- GDPR compliance built-in

This specification provides the foundation for building HiMind as a production-ready expertise discovery and knowledge routing system that scales from startup teams to large organizations.