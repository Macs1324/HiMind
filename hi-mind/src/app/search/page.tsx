"use client"

import { useState } from "react"
import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Search, ExternalLink, User, MessageSquare, Github, Brain, Slack } from "lucide-react"

interface KnowledgeMatch {
  knowledge_point_id: string
  source_id: string
  summary: string
  similarity_score: number
  source_url: string
  source_title?: string | null
  author_name?: string | null
  platform: string
}

interface ExpertMatch {
  personId: string
  displayName: string
  expertiseScore: number
  contributionCount: number
}

interface SearchResults {
  query: string
  knowledgeMatches: KnowledgeMatch[]
  suggestedExperts: ExpertMatch[]
  topicMatches: string[]
}

export default function SearchPage() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)

  const getPlatformIcon = (platform: string) => {
    switch (platform?.toLowerCase()) {
      case 'slack':
        // Nord8 - Frost
        return <Slack className="h-4 w-4 text-[#88c0d0]" />
      case 'github':
        // Nord3 - Muted  
        return <Github className="h-4 w-4 text-[#4c566a]" />
      default:
        // Nord10 - Primary
        return <Brain className="h-4 w-4 text-[#5e81ac]" />
    }
  }

  const getPlatformName = (platform: string) => {
    switch (platform?.toLowerCase()) {
      case 'slack':
        return 'Slack'
      case 'github':
        return 'GitHub'
      default:
        return platform || 'Unknown'
    }
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    setLoading(true)
    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() })
      })

      const data = await response.json()
      if (data.success) {
        setResults(data.results)
      } else {
        console.error('Search failed:', data.error)
      }
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Knowledge Search</h1>
          <p className="text-muted-foreground mt-2">
            Ask a question and get routed to the right source or expert
          </p>
        </div>

        {/* Search Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Search className="h-5 w-5" />
              <span>Ask HiMind</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="flex space-x-2">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="How do I deploy a React app to AWS?"
                  className="flex-1"
                />
                <Button type="submit" disabled={loading || !query.trim()}>
                  {loading ? "Searching..." : "Search"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Results */}
        {results && (
          <div className="space-y-6">
            {/* Knowledge Sources */}
            {results.knowledgeMatches.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span>🎯 Top Knowledge Sources</span>
                    <Badge variant="outline" className="text-xs bg-[#a3be8c]/10 text-[#a3be8c] border-[#a3be8c]/20">
                      AI-Ranked
                    </Badge>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {results.knowledgeMatches.length} most relevant discussions selected by AI • Click any result to open source
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {results.knowledgeMatches.map((match, index) => (
                      <div 
                        key={match.knowledge_point_id}
                        className="group border rounded-lg hover:shadow-md hover:border-[#5e81ac]/50 transition-all duration-200 cursor-pointer bg-card hover:bg-[#88c0d0]/10"
                        onClick={() => match.source_url && window.open(match.source_url, '_blank')}
                        title={`Click to open in ${getPlatformName(match.platform)}`}
                      >
                        <div className="p-4">
                          <div className="flex items-start gap-3">
                            {/* Ranking Badge */}
                            <div className="flex-shrink-0">
                              <div className="w-6 h-6 rounded-full bg-[#5e81ac] text-white text-xs font-bold flex items-center justify-center">
                                {index + 1}
                              </div>
                            </div>
                            
                            {/* Platform Icon */}
                            <div className="flex-shrink-0 mt-1">
                              {getPlatformIcon(match.platform)}
                            </div>
                            
                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium leading-relaxed text-foreground group-hover:text-[#5e81ac] transition-colors mb-3">
                                {match.summary}
                              </h3>
                              
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                {/* Platform Badge */}
                                <Badge variant="secondary" className="text-xs">
                                  <span className="flex items-center gap-1">
                                    {getPlatformIcon(match.platform)}
                                    {getPlatformName(match.platform)}
                                  </span>
                                </Badge>
                                
                                {/* Author */}
                                {match.author_name && (
                                  <span className="flex items-center space-x-1 text-sm text-muted-foreground">
                                    <User className="h-3 w-3" />
                                    <span>{match.author_name}</span>
                                  </span>
                                )}
                                
                                {/* Relevance Score */}
                                <span className="text-sm font-medium text-[#a3be8c]">
                                  {Math.round(match.similarity_score * 100)}% relevant
                                </span>
                              </div>
                            </div>
                            
                            {/* External Link Icon */}
                            <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <ExternalLink className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Expert Suggestions */}
            {results.suggestedExperts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>👥 Ask an Expert</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    People who might be able to help
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {results.suggestedExperts.map((expert) => (
                      <div 
                        key={expert.personId}
                        className="border rounded-lg p-3 text-center hover:bg-accent/50 transition-colors"
                      >
                        <h3 className="font-medium mb-1">{expert.displayName}</h3>
                        <div className="text-xs text-muted-foreground">
                          <div>Expertise: {Math.round(expert.expertiseScore * 100)}%</div>
                          <div>{expert.contributionCount} contributions</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Related Topics */}
            {results.topicMatches.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>🎯 Related Topics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {results.topicMatches.map((topic) => (
                      <span 
                        key={topic}
                        className="px-2 py-1 bg-secondary text-secondary-foreground rounded-md text-sm"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* No Results */}
            {results.knowledgeMatches.length === 0 && results.suggestedExperts.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">
                    No results found for &quot;{results.query}&quot;. Try a different search term.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Example Queries */}
        {!results && (
          <Card>
            <CardHeader>
              <CardTitle>💡 Try asking about...</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  "How to deploy React apps?",
                  "Database migration best practices",
                  "API authentication setup",
                  "Docker configuration issues",
                  "Performance optimization tips",
                  "Testing strategies"
                ].map((example) => (
                  <Button
                    key={example}
                    variant="outline"
                    size="sm"
                    onClick={() => setQuery(example)}
                    className="justify-start text-left h-auto p-3"
                  >
                    {example}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  )
}