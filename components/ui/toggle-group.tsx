"use client"

import * as React from "react"
import { type VariantProps } from "class-variance-authority"
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group"
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"

import { cn } from "@/lib/utils"
import { toggleVariants } from "@/components/ui/toggle"

const ToggleGroupContext = React.createContext<
  VariantProps<typeof toggleVariants> & {
    spacing?: number
  }
>({
  size: "default",
  variant: "default",
  spacing: 0,
})

export interface ToggleGroupProps
  extends Omit<React.ComponentProps<typeof ToggleGroupPrimitive>, "value" | "defaultValue" | "onValueChange">,
    VariantProps<typeof toggleVariants> {
  spacing?: number
  type?: "single" | "multiple"
  value?: string | string[]
  defaultValue?: string | string[]
  onValueChange?: (value: string | string[]) => void
}

function ToggleGroup({
  className,
  variant,
  size,
  spacing = 0,
  type = "single",
  value,
  defaultValue,
  onValueChange,
  children,
  ...props
}: ToggleGroupProps) {
  const isMultiple = type === "multiple"

  const groupValue = React.useMemo(() => {
    if (value === undefined) return undefined
    if (Array.isArray(value)) return value
    return value ? [value] : []
  }, [value])

  const defaultGroupValue = React.useMemo(() => {
    if (defaultValue === undefined) return undefined
    if (Array.isArray(defaultValue)) return defaultValue
    return defaultValue ? [defaultValue] : []
  }, [defaultValue])

  const handleValueChange = (val: readonly unknown[]) => {
    if (!onValueChange) return
    const strArray = val.map(String)
    if (isMultiple) {
      onValueChange(strArray)
    } else {
      onValueChange(strArray[0] || "")
    }
  }

  return (
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      data-variant={variant}
      data-size={size}
      data-spacing={spacing}
      multiple={isMultiple}
      value={groupValue}
      defaultValue={defaultGroupValue}
      onValueChange={handleValueChange}
      style={{ "--gap": spacing } as React.CSSProperties}
      className={cn(
        "group/toggle-group flex w-fit items-center gap-[--spacing(var(--gap))] rounded-md data-[spacing=default]:data-[variant=outline]:shadow-xs",
        className
      )}
      {...props}
    >
      <ToggleGroupContext.Provider value={{ variant, size, spacing }}>
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive>
  )
}

function ToggleGroupItem({
  className,
  children,
  variant,
  size,
  value,
  ...props
}: React.ComponentProps<typeof TogglePrimitive> &
  VariantProps<typeof toggleVariants> & {
    value: string
  }) {
  const context = React.useContext(ToggleGroupContext)

  return (
    <TogglePrimitive
      data-slot="toggle-group-item"
      data-variant={context.variant || variant}
      data-size={context.size || size}
      data-spacing={context.spacing}
      value={value}
      className={cn(
        toggleVariants({
          variant: context.variant || variant,
          size: context.size || size,
        }),
        "w-auto min-w-0 shrink-0 px-3 focus:z-10 focus-visible:z-10",
        "data-[spacing=0]:rounded-none data-[spacing=0]:shadow-none data-[spacing=0]:first:rounded-l-md data-[spacing=0]:last:rounded-r-md data-[spacing=0]:data-[variant=outline]:border-l-0 data-[spacing=0]:data-[variant=outline]:first:border-l",
        className
      )}
      {...props}
    >
      {children}
    </TogglePrimitive>
  )
}

export { ToggleGroup, ToggleGroupItem }
