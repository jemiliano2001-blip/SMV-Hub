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
}

export default function ModuleTabs({
  items,
  value,
  onValueChange,
  className,
  listClassName,
}: ModuleTabsProps) {
  return (
    <Tabs value={value} onValueChange={onValueChange} className={cn("flex flex-col gap-4", className)}>
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
      {items.map((item) => (
        <TabsContent key={item.value} value={item.value}>
          {item.content}
        </TabsContent>
      ))}
    </Tabs>
  )
}
