"use client"

import * as React from "react"
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react"
import { Menu as DropdownMenuPrimitive } from "@base-ui/react/menu"

import { cn } from "@/lib/utils"

interface ContextMenuContextType {
  open: boolean
  setOpen: (open: boolean) => void
  point: { x: number; y: number } | null
  setPoint: (point: { x: number; y: number } | null) => void
}

const ContextMenuContext = React.createContext<ContextMenuContextType | null>(null)

function useContextMenu() {
  const context = React.useContext(ContextMenuContext)
  if (!context) {
    throw new Error("useContextMenu must be used within a ContextMenu")
  }
  return context
}

export interface ContextMenuProps {
  children?: React.ReactNode
  onOpenChange?: (open: boolean) => void
}

function ContextMenu({ children, onOpenChange }: ContextMenuProps) {
  const [open, setOpenState] = React.useState(false)
  const [point, setPoint] = React.useState<{ x: number; y: number } | null>(null)

  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      setOpenState(nextOpen)
      onOpenChange?.(nextOpen)
      if (!nextOpen) {
        setPoint(null)
      }
    },
    [onOpenChange]
  )

  const value = React.useMemo(
    () => ({ open, setOpen, point, setPoint }),
    [open, setOpen, point]
  )

  return (
    <ContextMenuContext.Provider value={value}>
      <DropdownMenuPrimitive.Root
        open={open}
        onOpenChange={(isOpen) => setOpen(isOpen)}
        data-slot="context-menu"
      >
        {children}
      </DropdownMenuPrimitive.Root>
    </ContextMenuContext.Provider>
  )
}

export interface ContextMenuTriggerProps extends React.HTMLAttributes<HTMLElement> {
  asChild?: boolean
  disabled?: boolean
}

const ContextMenuTrigger = React.forwardRef<HTMLElement, ContextMenuTriggerProps>(
  ({ asChild = false, disabled = false, children, onContextMenu, ...props }, ref) => {
    const { setOpen, setPoint } = useContextMenu()

    const handleContextMenu = (e: React.MouseEvent<HTMLElement>) => {
      if (disabled) return
      e.preventDefault()
      e.stopPropagation()
      setPoint({ x: e.clientX, y: e.clientY })
      setOpen(true)
      onContextMenu?.(e)
    }

    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<React.HTMLAttributes<HTMLElement> & { ref?: React.Ref<HTMLElement> }>
      return React.cloneElement(child, {
        ...props,
        ref,
        onContextMenu: (e: React.MouseEvent<HTMLElement>) => {
          child.props.onContextMenu?.(e)
          handleContextMenu(e)
        },
      })
    }

    return (
      <div
        ref={ref as React.Ref<HTMLDivElement>}
        data-slot="context-menu-trigger"
        onContextMenu={handleContextMenu}
        {...props}
      >
        {children}
      </div>
    )
  }
)
ContextMenuTrigger.displayName = "ContextMenuTrigger"

export interface ContextMenuContentProps
  extends Omit<React.ComponentProps<typeof DropdownMenuPrimitive.Popup>, "side" | "align"> {
  sideOffset?: number
  alignOffset?: number
}

function ContextMenuContent({
  className,
  sideOffset = 2,
  alignOffset = 0,
  children,
  ...props
}: ContextMenuContentProps) {
  const { point } = useContextMenu()

  // Virtual anchor based on right-click client coordinates
  const virtualAnchor = React.useMemo(() => {
    if (!point) return undefined
    return {
      getBoundingClientRect: () =>
        ({
          x: point.x,
          y: point.y,
          top: point.y,
          bottom: point.y,
          left: point.x,
          right: point.x,
          width: 0,
          height: 0,
          toJSON: () => {},
        }) as DOMRect,
    }
  }, [point])

  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Positioner
        anchor={virtualAnchor}
        side="bottom"
        align="start"
        sideOffset={sideOffset}
        alignOffset={alignOffset}
      >
        <DropdownMenuPrimitive.Popup
          data-slot="context-menu-content"
          className={cn(
            "z-50 min-w-[10rem] overflow-hidden rounded-lg border bg-popover/95 backdrop-blur-md p-1 text-popover-foreground shadow-xl ring-1 ring-black/5 dark:ring-white/10 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0",
            className
          )}
          {...props}
        >
          {children}
        </DropdownMenuPrimitive.Popup>
      </DropdownMenuPrimitive.Positioner>
    </DropdownMenuPrimitive.Portal>
  )
}

function ContextMenuGroup({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Group>) {
  return <DropdownMenuPrimitive.Group data-slot="context-menu-group" {...props} />
}

export interface ContextMenuItemProps
  extends React.ComponentProps<typeof DropdownMenuPrimitive.Item> {
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
    <DropdownMenuPrimitive.Item
      data-slot="context-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "relative flex cursor-default select-none items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-highlighted:bg-accent data-highlighted:text-accent-foreground data-[variant=destructive]:text-rose-600 data-[variant=destructive]:focus:bg-rose-50 dark:data-[variant=destructive]:focus:bg-rose-950/50 data-[variant=destructive]:focus:text-rose-600 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
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
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      data-slot="context-menu-checkbox-item"
      className={cn(
        "relative flex cursor-default select-none items-center rounded-md py-1.5 pr-2 pl-8 text-xs font-medium outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-highlighted:bg-accent data-highlighted:text-accent-foreground",
        className
      )}
      checked={checked}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <DropdownMenuPrimitive.CheckboxItemIndicator>
          <CheckIcon className="h-3.5 w-3.5" />
        </DropdownMenuPrimitive.CheckboxItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  )
}

function ContextMenuRadioGroup({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>) {
  return <DropdownMenuPrimitive.RadioGroup data-slot="context-menu-radio-group" {...props} />
}

function ContextMenuRadioItem({
  className,
  children,
  value,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
  return (
    <DropdownMenuPrimitive.RadioItem
      data-slot="context-menu-radio-item"
      value={value}
      className={cn(
        "relative flex cursor-default select-none items-center rounded-md py-1.5 pr-2 pl-8 text-xs font-medium outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-highlighted:bg-accent data-highlighted:text-accent-foreground",
        className
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <DropdownMenuPrimitive.RadioItemIndicator>
          <CircleIcon className="h-2 w-2 fill-current" />
        </DropdownMenuPrimitive.RadioItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  )
}

function ContextMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.GroupLabel> & {
  inset?: boolean
}) {
  return (
    <DropdownMenuPrimitive.GroupLabel
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
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
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
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubmenuRoot>) {
  return <DropdownMenuPrimitive.SubmenuRoot data-slot="context-menu-sub" {...props} />
}

export interface ContextMenuSubTriggerProps
  extends React.ComponentProps<typeof DropdownMenuPrimitive.SubmenuTrigger> {
  inset?: boolean
}

function ContextMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: ContextMenuSubTriggerProps) {
  return (
    <DropdownMenuPrimitive.SubmenuTrigger
      data-slot="context-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        "flex cursor-default select-none items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium outline-none focus:bg-accent data-[state=open]:bg-accent data-popup-open:bg-accent [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
        inset && "pl-8",
        className
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto h-3.5 w-3.5" />
    </DropdownMenuPrimitive.SubmenuTrigger>
  )
}

export interface ContextMenuSubContentProps
  extends React.ComponentProps<typeof DropdownMenuPrimitive.Popup> {
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
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Positioner
        side="inline-end"
        sideOffset={sideOffset}
        align="start"
        alignOffset={alignOffset}
      >
        <DropdownMenuPrimitive.Popup
          data-slot="context-menu-sub-content"
          className={cn(
            "z-50 min-w-[9rem] overflow-hidden rounded-lg border bg-popover/95 backdrop-blur-md p-1 text-popover-foreground shadow-xl ring-1 ring-black/5 dark:ring-white/10 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0",
            className
          )}
          {...props}
        >
          {children}
        </DropdownMenuPrimitive.Popup>
      </DropdownMenuPrimitive.Positioner>
    </DropdownMenuPrimitive.Portal>
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
