'use client'

import * as React from "react"
import { useState, useEffect } from 'react'
import { Target, Sparkles, Network, RefreshCw, Grid3x3, LayoutGrid } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AppShell } from "@/components/layout/app-shell"
import { PageHeader } from "@/components/dashboard/page-header"
import { TopicGraph } from "@/components/topics/topic-graph"
import { cn } from "@/lib/utils"

interface Topic {
  id: string
  name: string
  knowledgePointCount: number
  confidenceScore: number
  isNew?: boolean
  platform?: string
  discoveredAt?: string
}

interface TopicsStats {
  totalKnowledgePoints: number
  clustersFound: number
  newTopics: number
  updatedTopics: number
}

export default function TopicsPage() {
  const [topics, setTopics] = useState<Topic[]>([])
  const [stats, setStats] = useState<TopicsStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [discovering, setDiscovering] = useState(false)
  const [viewMode, setViewMode] = useState<'graph' | 'list'>('graph')

  useEffect(() => {
    fetchTopics()
  }, [])

  const fetchTopics = async () => {
    try {
      setLoading(true)
      
      // Fetch existing topics and stats in parallel
      const [topicsResponse, statsResponse] = await Promise.all([
        fetch('/api/topics/discover'),
        fetch('/api/organization/stats')
      ])
      
      const [topicsData, statsData] = await Promise.all([
        topicsResponse.json(),
        statsResponse.json()
      ])
      
      if (topicsData.success) {
        // Transform the topics to match our interface
        const formattedTopics = (topicsData.topics || []).map((topic: any) => ({
          id: topic.id,
          name: topic.name,
          knowledgePointCount: topic.knowledge_point_count,
          confidenceScore: topic.confidence_score,
          isNew: false, // Existing topics are not new
          platform: topic.platform,
          discoveredAt: topic.created_at
        }))
        
        setTopics(formattedTopics)
        
        // Set stats if available
        if (statsData.success) {
          setStats({
            totalKnowledgePoints: statsData.stats.knowledgePoints || 0,
            newTopics: 0,
            updatedTopics: 0
          })
        }
      }
    } catch (error) {
      console.error('Failed to fetch topics:', error)
    } finally {
      setLoading(false)
    }
  }

  const triggerDiscovery = async () => {
    try {
      setDiscovering(true)
      const response = await fetch('/api/topics/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          minClusterSize: 3,
          maxClusters: 15,
          similarityThreshold: 0.7
        })
      })

      const data = await response.json()
      
      if (data.success) {
        // Use the discovery response which includes isNew flags and stats
        setTopics(data.topics || [])
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Failed to trigger discovery:', error)
    } finally {
      setDiscovering(false)
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex h-full items-center justify-center">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="text-muted-foreground">Loading knowledge universe...</p>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="flex flex-col h-full">
        {/* Page Header */}
        <PageHeader
          title="Knowledge Topics"
          description={stats ? `${topics.length} Topics from ${stats.totalKnowledgePoints} Knowledge Points` : "Discover and explore topic clusters in your knowledge base"}
        >
          <div className="flex flex-col space-y-2 sm:flex-row sm:space-x-2 sm:space-y-0">
            {/* View Mode Toggle */}
            <div className="flex bg-secondary/50 rounded-lg p-1">
              <Button
                variant={viewMode === 'graph' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('graph')}
                className="text-xs sm:text-sm"
              >
                <Network className="h-4 w-4 mr-1" />
                Graph
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="text-xs sm:text-sm"
              >
                <LayoutGrid className="h-4 w-4 mr-1" />
                List
              </Button>
            </div>

            {/* Discover Button */}
            <Button 
              onClick={triggerDiscovery}
              disabled={discovering}
              variant="default"
              className="w-full sm:w-auto"
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", discovering && "animate-spin")} />
              {discovering ? 'Discovering...' : 'Rediscover Topics'}
            </Button>
          </div>
        </PageHeader>

        {/* Main Content */}
        <div className="flex-1 space-y-6 sm:space-y-8">
          {topics.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <Target className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold sm:text-2xl mb-2">No Topics Discovered Yet</h2>
              <p className="text-sm text-muted-foreground sm:text-base mb-6 max-w-md">
                Start by running topic discovery to automatically identify knowledge clusters in your content
              </p>
              <Button 
                onClick={triggerDiscovery}
                disabled={discovering}
                size="lg"
              >
                <Sparkles className={cn("h-4 w-4 mr-2", discovering && "animate-spin")} />
                {discovering ? 'Discovering Topics...' : 'Discover Topics'}
              </Button>
            </div>
          ) : (
            <>
              {viewMode === 'graph' ? (
                <div className="h-full">
                  <TopicGraph topics={topics} />
                </div>
              ) : (
                <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
                  {topics.map((topic) => (
                    <Card key={topic.id} className="transition-all duration-200 hover:shadow-md">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-base sm:text-lg leading-tight line-clamp-2">
                            {topic.name}
                          </CardTitle>
                          {topic.isNew && (
                            <Badge variant="outline" className="shrink-0">
                              New
                            </Badge>
                          )}
                        </div>
                        <CardDescription className="text-sm">
                          {topic.knowledgePointCount} knowledge points
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-3">
                          <div className="flex justify-between text-xs sm:text-sm">
                            <span className="text-muted-foreground">Confidence</span>
                            <span className="font-medium">
                              {Math.round(topic.confidenceScore * 100)}%
                            </span>
                          </div>
                          <div className="w-full bg-secondary rounded-full h-2">
                            <div 
                              className="bg-primary h-2 rounded-full transition-all duration-300"
                              style={{ width: `${topic.confidenceScore * 100}%` }}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppShell>
  )
}
