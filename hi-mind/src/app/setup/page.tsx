import { Suspense } from "react"
import { AppShell } from "@/components/layout/app-shell"
import { PageHeader } from "@/components/dashboard/page-header"
import { OrganizationSetup } from "@/components/setup/organization-setup"
import { Building2 } from "lucide-react"

export default function SetupPage() {
  return (
    <AppShell>
      <div className="space-y-6 sm:space-y-8">
        <PageHeader
          title="Organization Setup"
          description="Create and configure your organization to get started"
        />

        <Suspense fallback={<div>Loading setup...</div>}>
          <OrganizationSetup />
        </Suspense>
      </div>
    </AppShell>
  )
}