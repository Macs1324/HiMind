import { 
  Users, 
  TrendingUp, 
  FileText, 
  BarChart3,
  Plus,
  Filter
} from "lucide-react"
import { AppShell } from "@/components/layout/app-shell"
import { PageHeader } from "@/components/dashboard/page-header"
import { StatsGrid, StatCard } from "@/components/dashboard/stats-grid"
import { ContentGrid } from "@/components/dashboard/content-grid"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { initializeSlack } from '@/lib/init-slack';

// Initialize Slack on server startup 
initializeSlack().catch(console.error);


import { initializeSlack } from '@/lib/init-slack';

// Initialize Slack on server startup 
initializeSlack().catch(console.error);


export default function Home() {
  return (
    <AppShell>
      <div className="space-y-6 sm:space-y-8">
        <PageHeader
          title="Dashboard"
          description="Welcome back! Here's what's happening with your projects."
        >
          <Button className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Button>
        </PageHeader>

        <StatsGrid>
          <StatCard
            title="Total Users"
            value="2,847"
            description="from last month"
            icon={Users}
            trend={{ value: 12.5, label: "from last month", positive: true }}
          />
          <StatCard
            title="Revenue"
            value="$45,231"
            description="from last month"
            icon={TrendingUp}
            trend={{ value: 8.2, label: "from last month", positive: true }}
          />
          <StatCard
            title="Documents"
            value="1,234"
            description="from last month"
            icon={FileText}
            trend={{ value: -2.1, label: "from last month", positive: false }}
          />
          <StatCard
            title="Analytics"
            value="98.5%"
            description="uptime"
            icon={BarChart3}
            trend={{ value: 0.3, label: "from last month", positive: true }}
          />
        </StatsGrid>

        <ContentGrid>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent Activity</CardTitle>
                <Button variant="outline" size="sm">
                  <Filter className="mr-2 h-4 w-4" />
                  Filter
                </Button>
              </div>
              <CardDescription>
                Latest updates from your team and projects
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  "Project Alpha was updated",
                  "New user registered",
                  "Document uploaded",
                  "Team meeting scheduled"
                ].map((activity, i) => (
                  <div key={i} className="flex items-center space-x-4">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <span className="text-sm">{activity}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>
                Common tasks and shortcuts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2">
                <Button variant="outline" className="justify-start w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Create New Document
                </Button>
                <Button variant="outline" className="justify-start w-full">
                  <Users className="mr-2 h-4 w-4" />
                  Invite Team Member
                </Button>
                <Button variant="outline" className="justify-start w-full">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  View Analytics
                </Button>
              </div>
            </CardContent>
          </Card>
        </ContentGrid>
      </div>
    </AppShell>
  )
}
