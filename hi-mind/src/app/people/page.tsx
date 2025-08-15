import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/dashboard/page-header";
import { PeopleManagement } from "@/components/people/people-management";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PeoplePage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="People Management"
          description="Manage team members and their platform identities"
        >
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Person
          </Button>
        </PageHeader>

        <Suspense fallback={<div>Loading people...</div>}>
          <PeopleManagement />
        </Suspense>
      </div>
    </AppShell>
  );
}