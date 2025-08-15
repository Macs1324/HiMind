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
  Plus,
  CheckCircle,
  AlertCircle,
  Users,
  Settings,
  Database,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Organization {
  id: string
  name: string
  slug: string
  settings: Record<string, any>
  created_at: string
}

export function OrganizationSetup() {
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [formData, setFormData] = useState({
    name: 'HiMind Demo Organization',
    slug: 'himind-demo',
  })

  useEffect(() => {
    checkExistingOrganization()
  }, [])

  const checkExistingOrganization = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/organization')
      
      if (response.ok) {
        const data = await response.json()
        setOrganization(data.organization)
      }
    } catch (error) {
      console.error('Failed to check organization:', error)
    } finally {
      setLoading(false)
    }
  }

  const createOrganization = async () => {
    try {
      setCreating(true)
      setMessage(null)

      const response = await fetch('/api/setup/organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          slug: formData.slug,
          settings: {
            slack_enabled: true,
            github_enabled: true,
            processing_enabled: true
          }
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage({ type: 'success', text: 'Organization created successfully!' })
        setOrganization(data.organization)
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to create organization' })
      }
    } catch (error) {
      console.error('Failed to create organization:', error)
      setMessage({ type: 'error', text: 'Failed to create organization' })
    } finally {
      setCreating(false)
    }
  }

  const createSampleData = async () => {
    try {
      setCreating(true)
      setMessage(null)

      const response = await fetch('/api/sample-data-management', {
        method: 'POST',
      })

      const data = await response.json()

      if (response.ok) {
        setMessage({ 
          type: 'success', 
          text: `Sample data created! ${data.people_created} people added.` 
        })
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to create sample data' })
      }
    } catch (error) {
      console.error('Failed to create sample data:', error)
      setMessage({ type: 'error', text: 'Failed to create sample data' })
    } finally {
      setCreating(false)
    }
  }

  const resetDatabase = async () => {
    if (!confirm('Are you sure you want to reset the database? This will delete all data.')) {
      return
    }

    try {
      setCreating(true)
      setMessage(null)

      const response = await fetch('/api/setup/reset', {
        method: 'POST',
      })

      const data = await response.json()

      if (response.ok) {
        setMessage({ type: 'success', text: 'Database reset successfully!' })
        setOrganization(null)
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to reset database' })
      }
    } catch (error) {
      console.error('Failed to reset database:', error)
      setMessage({ type: 'error', text: 'Failed to reset database' })
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return <div>Loading organization setup...</div>
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

      {/* Current Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Building2 className="h-5 w-5" />
            <span>Organization Status</span>
          </CardTitle>
          <CardDescription>
            Current state of your HiMind organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          {organization ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">{organization.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    Slug: {organization.slug}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Created: {new Date(organization.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Badge className="bg-green-100 text-green-800 border-green-200">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              </div>
              
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="flex items-center space-x-2 text-sm">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  <span>Slack: {organization.settings?.slack_enabled ? 'Enabled' : 'Disabled'}</span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  <span>GitHub: {organization.settings?.github_enabled ? 'Enabled' : 'Disabled'}</span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  <span>Processing: {organization.settings?.processing_enabled ? 'Enabled' : 'Disabled'}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-medium mb-2">No Organization Found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create an organization to get started with HiMind
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Setup Actions */}
      {!organization ? (
        <Card>
          <CardHeader>
            <CardTitle>Create Organization</CardTitle>
            <CardDescription>
              Set up your organization to start using HiMind
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
                  placeholder="Your Organization Name"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Slug
                </label>
                <Input
                  value={formData.slug}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')
                  })}
                  placeholder="organization-slug"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Used for URLs and identification
                </p>
              </div>
            </div>
            
            <Button 
              onClick={createOrganization} 
              disabled={creating || !formData.name || !formData.slug}
              className="w-full sm:w-auto"
            >
              <Plus className="mr-2 h-4 w-4" />
              {creating ? "Creating..." : "Create Organization"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {/* Sample Data */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Sample Data</span>
              </CardTitle>
              <CardDescription>
                Add sample people and topics to test the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={createSampleData} 
                disabled={creating}
                className="w-full"
              >
                <Plus className="mr-2 h-4 w-4" />
                {creating ? "Creating..." : "Create Sample Data"}
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Adds sample people with Slack/GitHub identities and topics
              </p>
            </CardContent>
          </Card>

          {/* Database Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Database className="h-5 w-5" />
                <span>Database</span>
              </CardTitle>
              <CardDescription>
                Manage your database and reset if needed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={resetDatabase} 
                disabled={creating}
                variant="destructive"
                className="w-full"
              >
                <AlertCircle className="mr-2 h-4 w-4" />
                {creating ? "Resetting..." : "Reset Database"}
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                ⚠️ This will delete all data including people and topics
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Links */}
      {organization && (
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common management tasks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Button variant="outline" className="justify-start w-full" asChild>
                <a href="/people">
                  <Users className="mr-2 h-4 w-4" />
                  Manage People
                </a>
              </Button>
              <Button variant="outline" className="justify-start w-full" asChild>
                <a href="/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  Organization Settings
                </a>
              </Button>
              <Button variant="outline" className="justify-start w-full" asChild>
                <a href="/">
                  <Building2 className="mr-2 h-4 w-4" />
                  Dashboard
                </a>
              </Button>
              <Button variant="outline" className="justify-start w-full" disabled>
                <Database className="mr-2 h-4 w-4" />
                Topics (Soon)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}