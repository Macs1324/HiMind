# HiMind Architecture - AI-Powered Knowledge Discovery & Expert Routing

## 🎯 Core Vision

HiMind is an **AI-powered workplace learning system** that discovers knowledge centers organically and routes questions to the most relevant **sources** or **experts** - never generating answers directly.

**Key Principle**: Route to SOURCES (Slack messages, GitHub PRs, etc.) or EXPERTS, never generate answers

## 🏗️ Simplified Architecture (Post-Refactor)

```
Slack/GitHub Content → Knowledge Engine → AI Processing → Vector DB
                                ↓
Question → Semantic Search → Source Matches + Expert Suggestions
```

## 🗄️ Database Schema (Simplified)

### Core Tables (Only 9 tables, down from 15+)

1. **`organizations`** - Workspaces/companies
2. **`people`** - Team members  
3. **`external_identities`** - Links people to Slack/GitHub accounts
4. **`knowledge_sources`** - Raw content from platforms (Slack messages, GitHub PRs)
5. **`knowledge_points`** - AI-processed, embedded knowledge with summaries
6. **`discovered_topics`** - Auto-discovered topic clusters from embedding similarity
7. **`knowledge_topic_memberships`** - Links knowledge to topics
8. **`topic_experts`** - Auto-discovered expertise based on contributions
9. **`search_queries`** - Query logs for system improvement

### Key Features

- **Vector embeddings** (1536-dim) for semantic similarity
- **Automatic topic discovery** using embedding clustering ("centers of mass")
- **Expert scoring** based on contribution patterns
- **Source routing** with direct links to original content

## 🧠 Core Components

### 1. Knowledge Engine (`/src/core/knowledge-engine.ts`)
The heart of HiMind - handles all AI-powered knowledge processing:

- **`ingestKnowledgeSource()`** - Process Slack/GitHub content into knowledge points
- **`searchKnowledge()`** - Find relevant sources and experts for queries  
- **`discoverTopicClusters()`** - Find emerging knowledge clusters

### 2. Slack Integration (`/src/integrations/slack/`)
Simplified to focus on core functionality:

- Real-time message processing using Socket Mode
- Historical backfill
- Direct integration with Knowledge Engine (no complex queuing)

### 3. Search API (`/src/app/api/search/`)
Simple endpoint demonstrating core functionality:

- POST/GET endpoints for knowledge search
- Returns source matches + expert suggestions
- Logs queries for system improvement

### 4. Search UI (`/src/app/search/`)
Demo interface showcasing the WOW factor:

- Knowledge source results with similarity scores
- Expert suggestions with expertise metrics  
- Related topic discovery
- Direct links to original sources

## 🚀 AI/ML Pipeline

### Content Processing Flow:
1. **Raw Content** → Slack message, GitHub PR, etc.
2. **AI Summary** → Extract key knowledge using OpenAI
3. **Embeddings** → Generate 1536-dim vectors using text-embedding-3-small
4. **Quality Scoring** → Rate content relevance and quality
5. **Topic Discovery** → Find clusters using cosine similarity
6. **Expert Scoring** → Update expertise based on contributions

### Search Flow:
1. **Query** → User asks a question
2. **Embed Query** → Convert to 1536-dim vector
3. **Similarity Search** → Find closest knowledge points using cosine similarity
4. **Topic Matching** → Identify relevant topic clusters
5. **Expert Routing** → Suggest experts based on topic expertise
6. **Results** → Return sources + experts, never generated answers

## ⭐ Key Innovations

### 1. **Organic Topic Discovery ("Centers of Mass")**
- Topics emerge automatically from embedding clusters
- No manual categorization needed
- "Knowledge centers" form naturally around similar content

### 2. **Source-First Routing**
- Always route to original sources (Slack threads, GitHub PRs)
- Never generate synthetic answers
- Maintain trust and context

### 3. **Expert Discovery** 
- Expertise scores calculated from contribution patterns
- Automatic identification of who knows what
- Route complex questions to the right people

## 🛠️ Technical Stack

- **Frontend**: Next.js 15, React 19, shadcn/ui
- **Backend**: Next.js API routes
- **Database**: Supabase (PostgreSQL + pgvector)
- **AI**: OpenAI text-embedding-3-small
- **Integrations**: Slack Socket Mode, GitHub API

## 🎪 Demo Flow (For B2B SaaS Executive Presentation)

### Setup (1 minute)
1. Show Slack integration processing messages in real-time
2. Display knowledge points being extracted and embedded

### Search Demo (2 minutes)  
1. Ask: "How do we deploy React apps to production?"
2. Show semantic search finding relevant Slack discussions
3. Display expert suggestions with expertise scores
4. Click through to original source (Slack thread)

### Topic Discovery (1 minute)
1. Show auto-discovered topic clusters
2. Demonstrate "centers of mass" concept with visual clustering
3. Show how experts are associated with topics

### Value Proposition (30 seconds)
- **"No more lost knowledge in Slack"**
- **"Instant expert routing"** 
- **"Organic knowledge discovery"**

## 🗑️ What Was Removed (Scope Reduction)

### Over-Engineering Removed:
- ❌ Complex processing queues and orchestrators
- ❌ Enterprise monitoring and error tracking  
- ❌ Multiple redundant NLP services
- ❌ 15+ database tables with complex relationships
- ❌ Processing jobs, retry logic, batch systems
- ❌ Complex expertise graphs and signals

### Kept Essential:
- ✅ AI-powered content processing
- ✅ Vector embeddings and semantic search
- ✅ Topic discovery from clusters
- ✅ Expert identification and routing
- ✅ Source linking (never generate answers)

## 🚧 Development Roadmap (Post-Hackathon)

### Phase 1: MVP Completion (1-2 weeks)
- [ ] Fix database schema deployment
- [ ] Complete Slack integration testing
- [ ] Add GitHub integration
- [ ] Polish search UI
- [ ] Add topic visualization

### Phase 2: Demo Preparation (1 week)
- [ ] Create compelling demo data
- [ ] Build topic clustering visualization  
- [ ] Add real-time processing demo
- [ ] Prepare executive presentation

### Phase 3: Production Features (Future)
- [ ] Multi-tenant organizations
- [ ] Advanced topic clustering (K-means, HDBSCAN)
- [ ] Confluence/Notion integrations
- [ ] Advanced expertise modeling
- [ ] Question routing optimization

## 🏆 Success Metrics

### For Hackathon Demo:
- Search latency < 2 seconds
- Topic discovery accuracy (manual validation)
- Expert routing precision (based on actual expertise)
- UI responsiveness and polish

### For B2B SaaS Market:
- Knowledge retrieval accuracy 
- Time-to-expert reduction
- User adoption and engagement
- Integration breadth (Slack, GitHub, etc.)

## 🔧 Environment Setup

### Required Environment Variables:
```bash
# OpenAI for embeddings
OPENAI_API_KEY=sk-...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...

# Slack Integration
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...
SLACK_SIGNING_SECRET=...
```

### Key Dependencies:
- `@supabase/supabase-js` - Database and vector operations
- `@slack/socket-mode` - Slack integration with Socket Mode
- `@slack/web-api` - Slack Web API for historical data
- `openai` - Embeddings generation
- `lucide-react` - UI icons
- `tailwindcss` - Styling

This architecture provides a **clean, focused foundation** for building the full MVP while avoiding the complexity trap that was causing scope creep.