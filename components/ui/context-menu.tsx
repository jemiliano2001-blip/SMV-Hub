"use client"

import * as React from "react"
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react"
import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu"

import { cn } from "@/lib/utils"

/**
 * Menú contextual (clic derecho / pulsación larga) sobre el componente nativo de
 * Base UI. La API exportada replica la de shadcn/Radix — `asChild`, `inset`,
 * `variant`, `sideOffset` — para que los módulos que ya lo usan no cambien.
 */

function ContextMenu({
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Root>) {
  return <ContextMenuPrimitive.Root {...props} />
}

export interface ContextMenuTriggerProps
  extends React.ComponentProps<typeof ContextMenuPrimitive.Trigger> {
  asChild?: boolean
  /**
   * Cuando es `true` no se monta el trigger: el área no abre menú, deja el clic
   * derecho al navegador y solo renderiza `children`. Los demás props de este
   * componente se descartan en ese modo — ponlos en el hijo (`asChild`).
   */
  disabled?: boolean
}

const ContextMenuTrigger = React.forwardRef<HTMLDivElement, ContextMenuTriggerProps>(
  ({ asChild = false, disabled = false, render, children, ...props }, ref) => {
    const hijoComoRender = asChild && React.isValidElement(children)

    // Sin trigger no hay menú: el área queda inerte y solo pinta su contenido.
    if (disabled) {
      return <>{children}</>
    }

    return (
      <ContextMenuPrimitive.Trigger
        ref={ref}
        data-slot="context-menu-trigger"
        render={hijoComoRender ? (children as React.ReactElement) : render}
        {...props}
      >
        {hijoComoRender ? undefined : children}
      </ContextMenuPrimitive.Trigger>
    )
  }
)
ContextMenuTrigger.displayName = "ContextMenuTrigger"

export interface ContextMenuContentProps
  extends React.ComponentProps<typeof ContextMenuPrimitive.Popup> {
  sideOffset?: number
  alignOffset?: number
  side?: React.ComponentProps<typeof ContextMenuPrimitive.Positioner>["side"]
  align?: React.ComponentProps<typeof ContextMenuPrimitive.Positioner>["align"]
}

function ContextMenuContent({
  className,
  sideOffset = 2,
  alignOffset = 0,
  side,
  align,
  children,
  ...props
}: ContextMenuContentProps) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Positioner
        className="z-50"
        side={side}
        align={align}
        sideOffset={sideOffset}
        alignOffset={alignOffset}
      >
        <ContextMenuPrimitive.Popup
          data-slot="context-menu-content"
          className={cn(
            "z-50 min-w-[10rem] overflow-hidden rounded-lg border bg-popover/95 backdrop-blur-md p-1 text-popover-foreground shadow-xl ring-1 ring-black/5 dark:ring-white/10 data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95",
            className
          )}
          {...props}
        >
          {children}
        </ContextMenuPrimitive.Popup>
      </ContextMenuPrimitive.Positioner>
    </ContextMenuPrimitive.Portal>
  )
}

function ContextMenuGroup({
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Group>) {
  return <ContextMenuPrimitive.Group data-slot="context-menu-group" {...props} />
}

export interface ContextMenuItemProps
  extends React.ComponentProps<typeof ContextMenuPrimitive.Item> {
  inset?: boolean
  variant?: "default" | "destructive"
}

function ContextMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: ContextMenuItemProps) {
  return (
    <ContextMenuPrimitive.Item
      data-slot="context-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "relative flex cursor-default select-none items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium outline-none transition-colors data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-accent data-highlighted:text-accent-foreground data-[variant=destructive]:text-rose-600 data-[variant=destructive]:data-highlighted:bg-rose-50 dark:data-[variant=destructive]:data-highlighted:bg-rose-950/50 data-[variant=destructive]:data-highlighted:text-rose-600 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
        inset && "pl-8",
        className
      )}
      {...props}
    />
  )
}

function ContextMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.CheckboxItem>) {
  return (
    <ContextMenuPrimitive.CheckboxItem
      data-slot="context-menu-checkbox-item"
      className={cn(
        "relative flex cursor-default select-none items-center rounded-md py-1.5 pr-2 pl-8 text-xs font-medium outline-none transition-colors data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-accent data-highlighted:text-accent-foreground",
        className
      )}
      checked={checked}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <ContextMenuPrimitive.CheckboxItemIndicator>
          <CheckIcon className="h-3.5 w-3.5" />
        </ContextMenuPrimitive.CheckboxItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.CheckboxItem>
  )
}

function ContextMenuRadioGroup({
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.RadioGroup>) {
  return <ContextMenuPrimitive.RadioGroup data-slot="context-menu-radio-group" {...props} />
}

function ContextMenuRadioItem({
  className,
  children,
  value,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.RadioItem>) {
  return (
    <ContextMenuPrimitive.RadioItem
      data-slot="context-menu-radio-item"
      value={value}
      className={cn(
        "relative flex cursor-default select-none items-center rounded-md py-1.5 pr-2 pl-8 text-xs font-medium outline-none transition-colors data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-accent data-highlighted:text-accent-foreground",
        className
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <ContextMenuPrimitive.RadioItemIndicator>
          <CircleIcon className="h-2 w-2 fill-current" />
        </ContextMenuPrimitive.RadioItemIndicator>
      </span>
      {children}
    </ContextMenuPrimitive.RadioItem>
  )
}

function ContextMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.GroupLabel> & {
  inset?: boolean
}) {
  return (
    <ContextMenuPrimitive.GroupLabel
      data-slot="context-menu-label"
      data-inset={inset}
      className={cn(
        "px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider",
        inset && "pl-8",
        className
      )}
      {...props}
    />
  )
}

function ContextMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Separator>) {
  return (
    <ContextMenuPrimitive.Separator
      data-slot="context-menu-separator"
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

function ContextMenuShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="context-menu-shortcut"
      className={cn("ml-auto text-[10px] font-mono tracking-widest text-muted-foreground", className)}
      {...props}
    />
  )
}

function ContextMenuSub({
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.SubmenuRoot>) {
  return <ContextMenuPrimitive.SubmenuRoot {...props} />
}

export interface ContextMenuSubTriggerProps
  extends React.ComponentProps<typeof ContextMenuPrimitive.SubmenuTrigger> {
  inset?: boolean
}

function ContextMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: ContextMenuSubTriggerProps) {
  return (
    <ContextMenuPrimitive.SubmenuTrigger
      data-slot="context-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        "flex cursor-default select-none items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-popup-open:bg-accent [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
        inset && "pl-8",
        className
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto h-3.5 w-3.5" />
    </ContextMenuPrimitive.SubmenuTrigger>
  )
}

export interface ContextMenuSubContentProps
  extends React.ComponentProps<typeof ContextMenuPrimitive.Popup> {
  sideOffset?: number
  alignOffset?: number
}

function ContextMenuSubContent({
  className,
  sideOffset = 2,
  alignOffset = -5,
  children,
  ...props
}: ContextMenuSubContentProps) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Positioner
        className="z-50"
        side="inline-end"
        sideOffset={sideOffset}
        align="start"
        alignOffset={alignOffset}
      >
        <ContextMenuPrimitive.Popup
          data-slot="context-menu-sub-content"
          className={cn(
            "z-50 min-w-[9rem] overflow-hidden rounded-lg border bg-popover/95 backdrop-blur-md p-1 text-popover-foreground shadow-xl ring-1 ring-black/5 dark:ring-white/10 data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95",
            className
          )}
          {...props}
        >
          {children}
        </ContextMenuPrimitive.Popup>
      </ContextMenuPrimitive.Positioner>
    </ContextMenuPrimitive.Portal>
  )
}

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuGroup,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuRadioGroup,
}
