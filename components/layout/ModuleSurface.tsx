import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export interface ModuleSurfaceProps {
  children: ReactNode
  className?: string
}

/** Contenedor canónico de tablas, filtros y paneles densos. */
export default function ModuleSurface({ children, className }: ModuleSurfaceProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card shadow-xs",
        className
      )}
    >
      {children}
    </div>
  )
}
