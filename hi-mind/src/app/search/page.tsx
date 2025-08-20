"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, User, Github, Brain, Slack } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface KnowledgeMatch {
  knowledge_point_id: string;
  source_id: string;
  summary: string;
  similarity_score: number;
  source_url: string;
  source_title?: string | null;
  author_name?: string | null;
  platform: string;
}

interface ExpertMatch {
  personId: string;
  name: string;
  email?: string;
  expertiseScore: number;
  totalContributions: number;
  relevantContributions: number;
  topContributions: Array<{
    summary: string;
    platform: string;
    sourceUrl?: string;
    similarity: number;
  }>;
}

interface KnowledgeAnswer {
  summary: string;
  authorName: string;
  platform: string;
  sourceUrl?: string;
  relevanceScore: number;
}

interface ExpertSearchResults {
  query: string;
  primaryExperts: ExpertMatch[];
  potentialAnswers: KnowledgeAnswer[];
  hasDirectAnswers: boolean;
}

// interface SearchResults {
// 	query: string;
// 	knowledgeMatches: KnowledgeMatch[];
// 	suggestedExperts: ExpertMatch[];
// 	topicMatches: string[];
// }

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [expertResults, setExpertResults] =
    useState<ExpertSearchResults | null>(null);
  const [loading, setLoading] = useState(false);

  const getPlatformIcon = (platform: string) => {
    switch (platform?.toLowerCase()) {
      case "slack":
        // Nord8 - Frost
        return <Slack className="h-4 w-4 text-[#88c0d0]" />;
      case "github":
        // Nord3 - Muted
        return <Github className="h-4 w-4 text-[#4c566a]" />;
      default:
        // Nord10 - Primary
        return <Brain className="h-4 w-4 text-[#5e81ac]" />;
    }
  };

  const getPlatformName = (platform: string) => {
    switch (platform?.toLowerCase()) {
      case "slack":
        return "Slack";
      case "github":
        return "GitHub";
      default:
        return platform || "Unknown";
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      const response = await fetch("/api/search/experts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });

      const data = await response.json();
      if (data.success) {
        setExpertResults(data.results);
      } else {
        console.error("Knowledge search failed:", data.error);
      }
    } catch (error) {
      console.error("Knowledge search error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Knowledge Search
          </h1>
          <p className="text-muted-foreground mt-2">
            Ask a question and connect with the right people who have the
            knowledge
          </p>
        </div>

        {/* Search Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="h-5 w-5" />
              <span>Ask a question</span>
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
        {expertResults && (
          <div className="space-y-6">
            {/* Primary Experts */}
            {expertResults.primaryExperts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    <span>Recommended Experts</span>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    People with expertise in this area - consider reaching out
                    to them
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {expertResults.primaryExperts.map((expert, index) => (
                      <div
                        key={expert.personId}
                        className="group border rounded-lg hover:shadow-md hover:border-[#bf616a]/50 transition-all duration-200 bg-card hover:bg-[#bf616a]/5"
                      >
                        <div className="p-4">
                          <div className="flex items-start gap-4">
                            {/* Ranking Badge */}
                            <div className="flex-shrink-0">
                              <div className="w-8 h-8 rounded-full bg-[#bf616a] text-white text-sm font-bold flex items-center justify-center">
                                {index + 1}
                              </div>
                            </div>

                            {/* Expert Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="font-semibold text-lg text-foreground">
                                  {expert.name}
                                </h3>
                                {expert.email && (
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {expert.email}
                                  </Badge>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-3">
                                <span className="text-sm font-medium text-[#61bf6a]">
                                  {Math.round(expert.expertiseScore * 100)}%
                                  expertise match
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  {expert.relevantContributions} relevant •{" "}
                                  {expert.totalContributions} total
                                  contributions
                                </span>
                              </div>

                              {/* Top Contributions */}
                              {expert.topContributions.length > 0 && (
                                <div className="space-y-2">
                                  <h4 className="text-sm font-medium text-muted-foreground">
                                    Recent relevant work:
                                  </h4>
                                  {expert.topContributions
                                    .slice(0, 2)
                                    .map((contribution, idx) => (
                                      <div
                                        key={idx}
                                        className="flex items-start gap-2 p-2 bg-muted/50 rounded text-sm cursor-pointer hover:bg-muted"
                                        onClick={() =>
                                          contribution.sourceUrl &&
                                          window.open(
                                            contribution.sourceUrl,
                                            "_blank",
                                          )
                                        }
                                      >
                                        <div className="flex-shrink-0 mt-0.5">
                                          {getPlatformIcon(
                                            contribution.platform,
                                          )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-foreground line-clamp-2">
                                            {contribution.summary}
                                          </p>
                                          <div className="flex items-center gap-2 mt-1">
                                            <span className="text-xs text-muted-foreground">
                                              {Math.round(
                                                contribution.similarity * 100,
                                              )}
                                              % match
                                            </span>
                                            {contribution.sourceUrl && (
                                              <ExternalLink className="h-3 w-3 text-muted-foreground" />
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Potential Direct Answers */}
            {expertResults.potentialAnswers.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    <span>📚 Potential Answers</span>
                    {expertResults.hasDirectAnswers && (
                      <Badge
                        variant="outline"
                        className="text-xs bg-[#a3be8c]/10 text-[#a3be8c] border-[#a3be8c]/20"
                      >
                        Direct Match
                      </Badge>
                    )}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {expertResults.hasDirectAnswers
                      ? "Found discussions that might directly answer your question"
                      : "Related discussions that might be helpful"}
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {expertResults.potentialAnswers.map((answer, index) => (
                      <div
                        key={index}
                        className="group border rounded-lg hover:shadow-md hover:border-[#a3be8c]/50 transition-all duration-200 cursor-pointer bg-card hover:bg-[#a3be8c]/5"
                        onClick={() =>
                          answer.sourceUrl &&
                          window.open(answer.sourceUrl, "_blank")
                        }
                      >
                        <div className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-1">
                              {getPlatformIcon(answer.platform)}
                            </div>

                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium leading-relaxed text-foreground group-hover:text-[#a3be8c] transition-colors mb-2">
                                {answer.summary}
                              </h3>

                              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                <Badge variant="secondary" className="text-xs">
                                  <span className="flex items-center gap-1">
                                    {getPlatformIcon(answer.platform)}
                                    {getPlatformName(answer.platform)}
                                  </span>
                                </Badge>

                                <span className="flex items-center space-x-1 text-sm text-muted-foreground">
                                  <User className="h-3 w-3" />
                                  <span>{answer.authorName}</span>
                                </span>

                                <span className="text-sm font-medium text-[#a3be8c]">
                                  {Math.round(answer.relevanceScore * 100)}%
                                  relevant
                                </span>
                              </div>
                            </div>

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

            {/* No Results */}
            {expertResults.primaryExperts.length === 0 &&
              expertResults.potentialAnswers.length === 0 && (
                <Card>
                  <CardContent className="py-8 text-center">
                    <User className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-2">
                      No experts or answers found for &quot;
                      {expertResults.query}&quot;
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Try a different search term or check if the knowledge
                      points have been added to the system
                    </p>
                  </CardContent>
                </Card>
              )}
          </div>
        )}

        {/* Example Queries */}
        {!expertResults && (
          <Card>
            <CardHeader>
              <CardTitle>💡 Try asking about...</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  "Who knows about React deployment?",
                  "Database migration experts",
                  "API authentication specialists",
                  "Docker configuration help",
                  "Performance optimization experts",
                  "Testing strategy knowledge",
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
  );
}
