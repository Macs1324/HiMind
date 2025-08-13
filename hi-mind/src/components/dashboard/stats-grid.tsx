import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface StatCardProps {
  title: string
  value: string | number
  description?: string
  icon?: React.ComponentType<{ className?: string }>
  trend?: {
    value: number
    label: string
    positive?: boolean
  }
  className?: string
}

export function StatCard({ 
  title, 
  value, 
  description, 
  icon: Icon,
  trend,
  className 
}: StatCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          {title}
        </CardTitle>
        {Icon && (
          <Icon className="h-4 w-4 text-muted-foreground" />
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
          {trend && (
            <span className={cn(
              "inline-flex items-center",
              trend.positive ? "text-green-600" : "text-red-600"
            )}>
              {trend.positive ? "+" : ""}{trend.value}%
            </span>
          )}
          {description && <span>{description}</span>}
          {trend?.label && <span>{trend.label}</span>}
        </div>
      </CardContent>
    </Card>
  )
}

interface StatsGridProps {
  children: React.ReactNode
  className?: string
}

export function StatsGrid({ children, className }: StatsGridProps) {
  return (
    <div className={cn(
      "grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4",
      className
    )}>
      {children}
    </div>
  )
}