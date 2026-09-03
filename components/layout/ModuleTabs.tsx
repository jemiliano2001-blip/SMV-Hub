"use client"

import { useEffect, type ReactNode } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type TabBadgeVariant = "default" | "muted" | "amber" | "emerald" | "rose" | "sky"

export interface ModuleTabItem {
  value: string
  label: ReactNode
  content: ReactNode
  disabled?: boolean
  /** Insignia o conteo numérico mostrado junto a la etiqueta del tab */
  badge?: ReactNode | number | string
  badgeVariant?: TabBadgeVariant
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
  /** Parámetro de URL para sincronizar automáticamente (ej. 'tab') */
  urlParam?: string
  /** Fija la barra de pestañas al hacer scroll en listas largas */
  stickyHeader?: boolean
}

function obtenerBadgeClasses(variant: TabBadgeVariant = "default") {
  switch (variant) {
    case "amber":
      return "border-amber-400/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
    case "emerald":
      return "border-emerald-400/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
    case "rose":
      return "border-rose-400/40 bg-rose-500/10 text-rose-700 dark:text-rose-400"
    case "sky":
      return "border-sky-400/40 bg-sky-500/10 text-sky-700 dark:text-sky-400"
    case "muted":
      return "border-border bg-muted/60 text-muted-foreground"
    case "default":
    default:
      return "border-border/60 bg-muted/80 text-foreground"
  }
}

export default function ModuleTabs({
  items,
  value,
  onValueChange,
  className,
  listClassName,
  headerClassName,
  actions,
  urlParam,
  stickyHeader = false,
}: ModuleTabsProps) {
  // Sincronización inicial desde la URL (si urlParam está activo)
  useEffect(() => {
    if (!urlParam || typeof window === "undefined") return

    try {
      const searchParams = new URLSearchParams(window.location.search)
      const paramVal = searchParams.get(urlParam)
      if (paramVal && items.some((item) => item.value === paramVal) && paramVal !== value) {
        onValueChange(paramVal)
      }
    } catch {
      // Entorno seguro en caso de fallos de parsing
    }
  }, [urlParam, items, onValueChange, value])

  // Actualizar URL cuando cambia el tab activo
  const handleTabChange = (nuevoValor: string) => {
    onValueChange(nuevoValor)

    if (urlParam && typeof window !== "undefined") {
      try {
        const url = new URL(window.location.href)
        url.searchParams.set(urlParam, nuevoValor)
        window.history.replaceState(null, "", url.toString())
      } catch {
        // Ignorar en caso de error en window history
      }
    }
  }

  return (
    <Tabs value={value} onValueChange={handleTabChange} className={cn("flex flex-col gap-4", className)}>
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 transition-colors",
          stickyHeader && "sticky top-14 z-20 -my-1 py-1.5 bg-background/85 backdrop-blur-md",
          headerClassName
        )}
      >
        <TabsList className={cn("h-auto w-full flex-wrap justify-start sm:w-fit", listClassName)}>
          {items.map((item) => (
            <TabsTrigger
              key={item.value}
              value={item.value}
              disabled={item.disabled}
              className="text-xs sm:text-sm gap-1.5 cursor-pointer"
            >
              <span>{item.label}</span>
              {item.badge !== undefined && item.badge !== null && item.badge !== "" ? (
                <Badge
                  variant="outline"
                  className={cn(
                    "ml-0.5 h-4 min-w-[16px] px-1 py-0 text-[10px] font-mono font-semibold rounded-full",
                    obtenerBadgeClasses(item.badgeVariant)
                  )}
                >
                  {item.badge}
                </Badge>
              ) : null}
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
