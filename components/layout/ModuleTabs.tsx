"use client"

import type { ReactNode } from "react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

export interface ModuleTabItem {
  value: string
  label: ReactNode
  content: ReactNode
  disabled?: boolean
}

export interface ModuleTabsProps {
  items: ModuleTabItem[]
  value: string
  onValueChange: (value: string) => void
  className?: string
  listClassName?: string
  /** Clase del renglón tabs + actions (p. ej. print:hidden). */
  headerClassName?: string
  /** Acciones al lado de la lista de tabs (p. ej. CTA del tab activo). */
  actions?: ReactNode
}

export default function ModuleTabs({
  items,
  value,
  onValueChange,
  className,
  listClassName,
  headerClassName,
  actions,
}: ModuleTabsProps) {
  return (
    <Tabs value={value} onValueChange={onValueChange} className={cn("flex flex-col gap-4", className)}>
      <div className={cn("flex flex-wrap items-center justify-between gap-3", headerClassName)}>
        <TabsList className={cn("h-auto w-full flex-wrap justify-start sm:w-fit", listClassName)}>
          {items.map((item) => (
            <TabsTrigger
              key={item.value}
              value={item.value}
              disabled={item.disabled}
              className="text-xs sm:text-sm"
            >
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {items.map((item) => (
        <TabsContent key={item.value} value={item.value}>
          {item.content}
        </TabsContent>
      ))}
    </Tabs>
  )
}
