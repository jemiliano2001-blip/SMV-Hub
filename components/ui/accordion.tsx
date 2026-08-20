"use client"

import * as React from "react"
import { ChevronDownIcon } from "lucide-react"
import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion"

import { cn } from "@/lib/utils"

export interface AccordionProps
  extends Omit<React.ComponentProps<typeof AccordionPrimitive.Root>, "value" | "defaultValue" | "onValueChange"> {
  type?: "single" | "multiple"
  value?: string | string[]
  defaultValue?: string | string[]
  onValueChange?: (value: string | string[]) => void
}

function Accordion({
  type = "single",
  value,
  defaultValue,
  onValueChange,
  multiple,
  ...props
}: AccordionProps) {
  const isMultiple = multiple ?? (type === "multiple")

  const normalizedValue = React.useMemo(() => {
    if (value === undefined) return undefined
    if (Array.isArray(value)) return value
    return value ? [value] : []
  }, [value])

  const normalizedDefaultValue = React.useMemo(() => {
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
    <AccordionPrimitive.Root
      data-slot="accordion"
      multiple={isMultiple}
      value={normalizedValue}
      defaultValue={normalizedDefaultValue}
      onValueChange={handleValueChange}
      {...props}
    />
  )
}

function AccordionItem({
  className,
  value,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Item>) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      value={value}
      className={cn("border-b last:border-b-0", className)}
      {...props}
    />
  )
}

function AccordionTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "flex flex-1 items-start justify-between gap-4 rounded-md py-4 text-left text-sm font-medium transition-all outline-none hover:underline focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&[data-state=open]>svg]:rotate-180 [&[data-panel-open]>svg]:rotate-180",
          className
        )}
        {...props}
      >
        {children}
        <ChevronDownIcon className="pointer-events-none size-4 shrink-0 translate-y-0.5 text-muted-foreground transition-transform duration-200" />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}

function AccordionContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Panel>) {
  return (
    <AccordionPrimitive.Panel
      data-slot="accordion-content"
      className="overflow-hidden text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
      {...props}
    >
      <div className={cn("pt-0 pb-4", className)}>{children}</div>
    </AccordionPrimitive.Panel>
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
