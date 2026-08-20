"use client"

import * as React from "react"
import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

function AlertDialog({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />
}

export interface AlertDialogTriggerProps
  extends React.ComponentProps<typeof AlertDialogPrimitive.Trigger> {
  asChild?: boolean
}

function AlertDialogTrigger({
  asChild = false,
  children,
  render,
  ...props
}: AlertDialogTriggerProps) {
  const resolvedRender = asChild && React.isValidElement(children) ? children : render

  return (
    <AlertDialogPrimitive.Trigger
      data-slot="alert-dialog-trigger"
      render={resolvedRender}
      {...props}
    >
      {asChild && React.isValidElement(children) ? undefined : children}
    </AlertDialogPrimitive.Trigger>
  )
}

function AlertDialogPortal({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Portal>) {
  return <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />
}

function AlertDialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Backdrop>) {
  return (
    <AlertDialogPrimitive.Backdrop
      data-slot="alert-dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-closed:animate-out data-closed:fade-out-0 data-open:animate-in data-open:fade-in-0",
        className
      )}
      {...props}
    />
  )
}

function AlertDialogContent({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Popup>) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Popup
        data-slot="alert-dialog-content"
        className={cn(
          "fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-background p-6 shadow-lg duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 sm:max-w-lg",
          className
        )}
        {...props}
      />
    </AlertDialogPortal>
  )
}

function AlertDialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function AlertDialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {props.children}
    </div>
  )
}

function AlertDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn("text-lg font-semibold", className)}
      {...props}
    />
  )
}

export interface AlertDialogDescriptionProps
  extends React.ComponentProps<typeof AlertDialogPrimitive.Description> {
  asChild?: boolean
}

function AlertDialogDescription({
  className,
  asChild = false,
  children,
  render,
  ...props
}: AlertDialogDescriptionProps) {
  const resolvedRender = asChild && React.isValidElement(children) ? children : render

  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      render={resolvedRender}
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    >
      {asChild && React.isValidElement(children) ? undefined : children}
    </AlertDialogPrimitive.Description>
  )
}

export interface AlertDialogActionProps
  extends React.ComponentProps<typeof AlertDialogPrimitive.Close> {
  asChild?: boolean
}

function AlertDialogAction({
  className,
  asChild = false,
  children,
  render,
  ...props
}: AlertDialogActionProps) {
  const resolvedRender = asChild && React.isValidElement(children) ? children : render

  return (
    <AlertDialogPrimitive.Close
      data-slot="alert-dialog-action"
      render={resolvedRender}
      className={cn(buttonVariants({ variant: "destructive" }), className)}
      {...props}
    >
      {asChild && React.isValidElement(children) ? undefined : children}
    </AlertDialogPrimitive.Close>
  )
}

export interface AlertDialogCancelProps
  extends React.ComponentProps<typeof AlertDialogPrimitive.Close> {
  asChild?: boolean
}

function AlertDialogCancel({
  className,
  asChild = false,
  children,
  render,
  ...props
}: AlertDialogCancelProps) {
  const resolvedRender = asChild && React.isValidElement(children) ? children : render

  return (
    <AlertDialogPrimitive.Close
      data-slot="alert-dialog-cancel"
      render={resolvedRender}
      className={cn(buttonVariants({ variant: "outline" }), className)}
      {...props}
    >
      {asChild && React.isValidElement(children) ? undefined : children}
    </AlertDialogPrimitive.Close>
  )
}

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
}
