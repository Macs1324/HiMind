import * as React from "react"
import { cn } from "@/lib/utils"

interface ContentGridProps {
  children: React.ReactNode
  cols?: 1 | 2 | 3 | 4
  className?: string
}

export function ContentGrid({ 
  children, 
  cols = 2, 
  className 
}: ContentGridProps) {
  return (
    <div className={cn(
      "grid gap-4 sm:gap-6",
      {
        "grid-cols-1": cols === 1,
        "grid-cols-1 lg:grid-cols-2": cols === 2,
        "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3": cols === 3,
        "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4": cols === 4,
      },
      className
    )}>
      {children}
    </div>
  )
}