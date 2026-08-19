import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

const MAX_WIDTH: Record<NonNullable<PageShellProps["maxWidth"]>, string> = {
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
}

export interface PageShellProps {
  children: ReactNode
  maxWidth?: "3xl" | "4xl" | "5xl" | "6xl" | "7xl"
  className?: string
  innerClassName?: string
  /** Para páginas con export print (reportes). */
  printClassName?: string
}

export default function PageShell({
  children,
  maxWidth = "7xl",
  className,
  innerClassName,
  printClassName,
}: PageShellProps) {
  return (
    <main
      className={cn(
        "min-h-screen flex flex-col bg-background font-sans",
        printClassName,
        className
      )}
    >
      <div
        className={cn(
          "mx-auto flex w-full flex-1 flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8",
          MAX_WIDTH[maxWidth],
          innerClassName
        )}
      >
        {children}
      </div>
    </main>
  )
}
