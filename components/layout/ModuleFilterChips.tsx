"use client"

import type { ReactNode } from "react"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"

export interface ModuleFilterChipOption {
  value: string
  label: ReactNode
  className?: string
}

export interface ModuleFilterChipsProps {
  value: string
  onValueChange: (value: string) => void
  options: ModuleFilterChipOption[]
  ariaLabel: string
  allowEmpty?: boolean
  className?: string
}

/** Chips de filtro exclusivos (ToggleGroup) para barras de módulos densos. */
export default function ModuleFilterChips({
  value,
  onValueChange,
  options,
  ariaLabel,
  allowEmpty = false,
  className,
}: ModuleFilterChipsProps) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(next) => {
        const val = Array.isArray(next) ? next[0] || "" : next
        if (!val && !allowEmpty) return
        onValueChange(val)
      }}
      spacing={1}
      size="sm"
      variant="outline"
      aria-label={ariaLabel}
      className={cn("flex max-w-full flex-wrap gap-1.5", className)}
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          className={cn(
            "h-7 rounded-full px-3 text-xs font-semibold [&_svg]:size-3",
            !option.className &&
              "data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-pressed:border-primary data-pressed:bg-primary data-pressed:text-primary-foreground",
            option.className,
          )}
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
