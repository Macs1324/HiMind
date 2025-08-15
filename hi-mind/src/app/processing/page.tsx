import { Suspense } from "react"
import { AppShell } from "@/components/layout/app-shell"
import { PageHeader } from "@/components/layout/page-header"
import { ProcessingMonitor } from "@/components/processing/processing-monitor"

export default function ProcessingPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="Processing Pipeline"
          description="Monitor and manage the content processing system"
        />
        
        <Suspense fallback={<div>Loading processing monitor...</div>}>
          <ProcessingMonitor />
        </Suspense>
      </div>
    </AppShell>
  )
}