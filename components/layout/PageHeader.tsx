import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export interface PageHeaderProps {
  title: string
  badge?: string
  description?: string
  icon?: LucideIcon
  actions?: ReactNode
  className?: string
}

export default function PageHeader({
  title,
  badge,
  description,
  icon: Icon,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {Icon ? <Icon className="size-5 shrink-0 text-primary" aria-hidden /> : null}
          <h1 className="text-base font-bold tracking-tight text-foreground">{title}</h1>
          {badge ? (
            <span className="rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] font-mono font-bold text-sky-800">
              {badge}
            </span>
          ) : null}
        </div>
        {description ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}
