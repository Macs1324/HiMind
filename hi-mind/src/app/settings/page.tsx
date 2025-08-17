import { Suspense } from "react"
import { AppShell } from "@/components/layout/app-shell"
import { PageHeader } from "@/components/dashboard/page-header"
import { OrganizationSettings } from "@/components/settings/organization-settings"
// import { Settings } from "lucide-react"

export default function SettingsPage() {
  return (
    <AppShell>
      <div className="space-y-6 sm:space-y-8">
        <PageHeader
          title="Organization Settings"
          description="Manage your organization configuration and preferences"
        />

        <Suspense fallback={<div>Loading settings...</div>}>
          <OrganizationSettings />
        </Suspense>
      </div>
    </AppShell>
  )
}