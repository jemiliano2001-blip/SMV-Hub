"use client"

import * as React from "react"
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"

import { cn } from "@/lib/utils"

export interface TooltipProviderProps
  extends React.ComponentProps<typeof TooltipPrimitive.Provider> {
  delayDuration?: number
}

function TooltipProvider({
  delayDuration = 200,
  delay,
  ...props
}: TooltipProviderProps) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delay={delay ?? delayDuration}
      {...props}
    />
  )
}

function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipProvider>
  )
}

export interface TooltipTriggerProps
  extends React.ComponentProps<typeof TooltipPrimitive.Trigger> {
  asChild?: boolean
}

function TooltipTrigger({
  asChild = false,
  children,
  render,
  ...props
}: TooltipTriggerProps) {
  const resolvedRender = asChild && React.isValidElement(children) ? children : render

  return (
    <TooltipPrimitive.Trigger
      data-slot="tooltip-trigger"
      render={resolvedRender}
      {...props}
    >
      {asChild && React.isValidElement(children) ? undefined : children}
    </TooltipPrimitive.Trigger>
  )
}

export interface TooltipContentProps
  extends React.ComponentProps<typeof TooltipPrimitive.Popup> {
  sideOffset?: number
  side?: "top" | "right" | "bottom" | "left" | "inline-start" | "inline-end"
  align?: "start" | "center" | "end"
}

function TooltipContent({
  className,
  sideOffset = 4,
  side = "top",
  align = "center",
  children,
  ...props
}: TooltipContentProps) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner sideOffset={sideOffset} side={side} align={align}>
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className={cn(
            "z-50 overflow-hidden rounded-md bg-slate-900 px-3 py-1.5 text-xs text-slate-50 shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
            className
          )}
          {...props}
        >
          {children}
          <TooltipPrimitive.Arrow className="fill-slate-900 z-50 size-2.5 translate-y-[calc(-50%_-_1px)] rotate-45 rounded-[2px]" />
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
