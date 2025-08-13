"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { AppHeader } from "./app-header"
import { AppSidebar } from "./app-sidebar"

interface AppShellProps {
  children: React.ReactNode
  className?: string
}

export function AppShell({ children, className }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false)

  return (
    <div className={cn("h-screen flex flex-col bg-background overflow-hidden", className)}>
      <AppHeader onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar 
          open={sidebarOpen} 
          onOpenChange={setSidebarOpen}
        />
        
        <main className="flex-1 overflow-auto">
          <div className="h-full px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}