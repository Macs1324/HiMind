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
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Building2,
  Users,
  Save,
  AlertCircle,
  CheckCircle,
  Slack,
  Github,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Organization {
  id: string
  name: string
  slug: string
  settings: {
    slack_enabled?: boolean
    github_enabled?: boolean
    processing_enabled?: boolean
    [key: string]: unknown
  }
  created_at: string
  updated_at: string
}

interface OrganizationStats {
  total_people: number
  active_people: number
  total_topics: number
  approved_topics: number
  total_statements: number
  processing_health: 'healthy' | 'degraded' | 'unhealthy'
}

export function OrganizationSettings() {
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [stats, setStats] = useState<OrganizationStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    slack_enabled: false,
    github_enabled: false,
    processing_enabled: true,
  })

  useEffect(() => {
    fetchOrganizationData()
  }, [])

  const fetchOrganizationData = async () => {
    try {
      setLoading(true)
      const [orgResponse, statsResponse] = await Promise.all([
        fetch('/api/organization'),
        fetch('/api/organization/stats')
      ])

      if (orgResponse.ok) {
        const orgData = await orgResponse.json()
        setOrganization(orgData.organization)
        setFormData({
          name: orgData.organization?.name || '',
          slack_enabled: orgData.organization?.settings?.slack_enabled || false,
          github_enabled: orgData.organization?.settings?.github_enabled || false,
          processing_enabled: orgData.organization?.settings?.processing_enabled !== false,
        })
      }

      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        setStats(statsData.stats)
      }
    } catch (error) {
      console.error('Failed to fetch organization data:', error)
      setMessage({ type: 'error', text: 'Failed to load organization settings' })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setMessage(null)

      const response = await fetch('/api/organization', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          settings: {
            slack_enabled: formData.slack_enabled,
            github_enabled: formData.github_enabled,
            processing_enabled: formData.processing_enabled,
          }
        }),
      })

      if (response.ok) {
        setMessage({ type: 'success', text: 'Settings saved successfully!' })
        await fetchOrganizationData() // Refresh data
      } else {
        setMessage({ type: 'error', text: 'Failed to save settings' })
      }
    } catch (error) {
      console.error('Failed to save settings:', error)
      setMessage({ type: 'error', text: 'Failed to save settings' })
    } finally {
      setSaving(false)
    }
  }

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'degraded':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-red-500" />
    }
  }

  const getHealthBadge = (health: string) => {
    switch (health) {
      case 'healthy':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Healthy</Badge>
      case 'degraded':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Degraded</Badge>
      default:
        return <Badge className="bg-red-100 text-red-800 border-red-200">Unhealthy</Badge>
    }
  }

  if (loading) {
    return <div>Loading organization settings...</div>
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Message */}
      {message && (
        <div className={cn(
          "p-4 rounded-md border",
          message.type === 'success' 
            ? "bg-green-50 border-green-200 text-green-800" 
            : "bg-red-50 border-red-200 text-red-800"
        )}>
          <div className="flex items-center space-x-2">
            {message.type === 'success' ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <span className="text-sm font-medium">{message.text}</span>
          </div>
        </div>
      )}

      {/* Organization Overview */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total People</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_people || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.active_people || 0} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Topics</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_topics || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.approved_topics || 0} approved
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Knowledge</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_statements || 0}</div>
            <p className="text-xs text-muted-foreground">statements</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            {stats?.processing_health && getHealthIcon(stats.processing_health)}
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              {stats?.processing_health && getHealthBadge(stats.processing_health)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Processing pipeline</p>
          </CardContent>
        </Card>
      </div>

      {/* Organization Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Organization Details</CardTitle>
          <CardDescription>
            Basic information about your organization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Organization Name
              </label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Your Organization"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">
                Slug
              </label>
              <Input
                value={organization?.slug || ''}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Organization slug cannot be changed
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Integration Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
          <CardDescription>
            Configure platform integrations for content processing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Slack Integration */}
          <div className="flex items-center justify-between space-x-4">
            <div className="flex items-center space-x-3">
              <Slack className="h-5 w-5 text-muted-foreground" />
              <div>
                <h4 className="text-sm font-medium">Slack Integration</h4>
                <p className="text-xs text-muted-foreground">
                  Process messages and threads from Slack channels
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant={formData.slack_enabled ? "default" : "secondary"}>
                {formData.slack_enabled ? "Enabled" : "Disabled"}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFormData({ 
                  ...formData, 
                  slack_enabled: !formData.slack_enabled 
                })}
              >
                {formData.slack_enabled ? "Disable" : "Enable"}
              </Button>
            </div>
          </div>

          {/* GitHub Integration */}
          <div className="flex items-center justify-between space-x-4">
            <div className="flex items-center space-x-3">
              <Github className="h-5 w-5 text-muted-foreground" />
              <div>
                <h4 className="text-sm font-medium">GitHub Integration</h4>
                <p className="text-xs text-muted-foreground">
                  Process pull requests, issues, and code reviews
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant={formData.github_enabled ? "default" : "secondary"}>
                {formData.github_enabled ? "Enabled" : "Disabled"}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFormData({ 
                  ...formData, 
                  github_enabled: !formData.github_enabled 
                })}
              >
                {formData.github_enabled ? "Disable" : "Enable"}
              </Button>
            </div>
          </div>

          {/* Content Processing */}
          <div className="flex items-center justify-between space-x-4">
            <div className="flex items-center space-x-3">
              <Zap className="h-5 w-5 text-muted-foreground" />
              <div>
                <h4 className="text-sm font-medium">Content Processing</h4>
                <p className="text-xs text-muted-foreground">
                  Automatic content analysis and topic extraction
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant={formData.processing_enabled ? "default" : "secondary"}>
                {formData.processing_enabled ? "Enabled" : "Disabled"}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFormData({ 
                  ...formData, 
                  processing_enabled: !formData.processing_enabled 
                })}
              >
                {formData.processing_enabled ? "Disable" : "Enable"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="w-full sm:w-auto"
        >
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  )
}