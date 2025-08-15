"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  BarChart3,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  Zap,
  Activity
} from "lucide-react"
import { cn } from "@/lib/utils"

interface ProcessingStats {
  totalJobs: number
  pendingJobs: number
  processingJobs: number
  completedJobs: number
  failedJobs: number
  averageProcessingTime: number
  throughputPerHour: number
}

export function ProcessingMonitor() {
  const [stats, setStats] = useState<ProcessingStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [retrying, setRetrying] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 30000) // Update every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const fetchStats = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/processing/stats')
      const data = await response.json()
      
      if (data.success) {
        setStats(data.stats)
        setLastUpdated(new Date())
      }
    } catch (error) {
      console.error('Failed to fetch processing stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const retryFailedJobs = async () => {
    try {
      setRetrying(true)
      const response = await fetch('/api/processing/retry', { method: 'POST' })
      const data = await response.json()
      
      if (data.success) {
        console.log(`Retried ${data.retriedJobs} jobs`)
        await fetchStats() // Refresh stats
      }
    } catch (error) {
      console.error('Failed to retry jobs:', error)
    } finally {
      setRetrying(false)
    }
  }

  const getHealthStatus = () => {
    if (!stats) return 'unknown'
    
    const failureRate = stats.totalJobs > 0 ? stats.failedJobs / stats.totalJobs : 0
    const hasBacklog = stats.pendingJobs > 50
    
    if (failureRate > 0.1) return 'unhealthy'
    if (hasBacklog) return 'backlogged'
    return 'healthy'
  }

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-50 border-green-200'
      case 'backlogged': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'unhealthy': return 'text-red-600 bg-red-50 border-red-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  if (loading && !stats) {
    return <div>Loading processing monitor...</div>
  }

  const healthStatus = getHealthStatus()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Content Processing Monitor</h2>
          <p className="text-muted-foreground">
            Real-time monitoring of content ingestion and processing pipeline
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchStats}
            disabled={loading}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
          {stats && stats.failedJobs > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={retryFailedJobs}
              disabled={retrying}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", retrying && "animate-spin")} />
              Retry Failed ({stats.failedJobs})
            </Button>
          )}
        </div>
      </div>

      {/* System Health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5" />
            <span>System Health</span>
          </CardTitle>
          <CardDescription>
            Overall status of the content processing pipeline
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Badge className={cn("px-3 py-1", getHealthColor(healthStatus))}>
                {healthStatus === 'healthy' && <CheckCircle className="h-3 w-3 mr-1" />}
                {healthStatus === 'backlogged' && <Clock className="h-3 w-3 mr-1" />}
                {healthStatus === 'unhealthy' && <AlertCircle className="h-3 w-3 mr-1" />}
                {healthStatus.charAt(0).toUpperCase() + healthStatus.slice(1)}
              </Badge>
              {lastUpdated && (
                <span className="text-sm text-muted-foreground">
                  Last updated: {lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </div>
            {stats && (
              <div className="text-right">
                <div className="text-lg font-semibold">{stats.totalJobs}</div>
                <div className="text-sm text-muted-foreground">Total Jobs</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Processing Stats */}
      {stats && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-orange-500" />
                <span className="text-2xl font-bold">{stats.pendingJobs}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Queued for processing
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Processing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Zap className="h-4 w-4 text-blue-500" />
                <span className="text-2xl font-bold">{stats.processingJobs}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Currently active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Completed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-2xl font-bold">{stats.completedJobs}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Successfully processed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Failed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span className="text-2xl font-bold">{stats.failedJobs}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Need attention
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Performance Metrics */}
      {stats && (
        <div className="grid gap-6 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5" />
                <span>Processing Performance</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Average Processing Time</span>
                    <span className="text-sm text-muted-foreground">
                      {stats.averageProcessingTime.toFixed(0)}ms
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${Math.min((stats.averageProcessingTime / 10000) * 100, 100)}%` 
                      }}
                    />
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Throughput</span>
                    <span className="text-sm text-muted-foreground">
                      {stats.throughputPerHour.toFixed(1)} jobs/hour
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-600 h-2 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${Math.min((stats.throughputPerHour / 100) * 100, 100)}%` 
                      }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Queue Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm">Success Rate</span>
                  <span className="text-sm font-medium">
                    {stats.totalJobs > 0 
                      ? ((stats.completedJobs / stats.totalJobs) * 100).toFixed(1)
                      : 0}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Failure Rate</span>
                  <span className="text-sm font-medium">
                    {stats.totalJobs > 0 
                      ? ((stats.failedJobs / stats.totalJobs) * 100).toFixed(1)
                      : 0}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Queue Utilization</span>
                  <span className="text-sm font-medium">
                    {stats.totalJobs > 0 
                      ? (((stats.pendingJobs + stats.processingJobs) / stats.totalJobs) * 100).toFixed(1)
                      : 0}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}