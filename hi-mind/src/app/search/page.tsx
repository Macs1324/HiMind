"use client"

import { useState } from "react"
import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Search, ExternalLink, User } from "lucide-react"

interface KnowledgeMatch {
  knowledgePointId: string
  summary: string
  similarityScore: number
  sourceUrl: string
  sourceTitle?: string
  authorName?: string
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
                  <CardTitle>💡 Knowledge Sources</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Found {results.knowledgeMatches.length} relevant discussions
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {results.knowledgeMatches.map((match) => (
                      <div 
                        key={match.knowledgePointId}
                        className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-medium mb-2">{match.summary}</h3>
                            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                              <span className="capitalize">{match.platform}</span>
                              {match.authorName && (
                                <span className="flex items-center space-x-1">
                                  <User className="h-3 w-3" />
                                  <span>{match.authorName}</span>
                                </span>
                              )}
                              <span>
                                {Math.round(match.similarityScore * 100)}% relevant
                              </span>
                            </div>
                          </div>
                          {match.sourceUrl && (
                            <Button variant="outline" size="sm" asChild>
                              <a 
                                href={match.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center space-x-1"
                              >
                                <ExternalLink className="h-3 w-3" />
                                <span>View Source</span>
                              </a>
                            </Button>
                          )}
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