'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

const TABS = [
  { href: "/finanzas", label: "Resumen" },
  { href: "/finanzas/facturacion", label: "Facturación por cliente" },
  { href: "/finanzas/cobranza", label: "Cobranza" },
  { href: "/finanzas/reportes", label: "Reportes" },
]

/** Nav entre rutas de finanzas — mismo look que ModuleTabs / TabsList. */
export default function FinanzasNav() {
  const pathname = usePathname()

  return (
    <div
      role="navigation"
      aria-label="Secciones de finanzas"
      className="inline-flex h-auto w-fit flex-wrap justify-start gap-1 rounded-lg bg-muted p-[3px] print:hidden"
    >
      {TABS.map((t) => {
        const activo = pathname === t.href
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "inline-flex items-center justify-center rounded-md px-3 py-1.5 text-xs font-medium transition-all sm:text-sm",
              activo
                ? "bg-background font-semibold text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </Link>
        )
      })}
    </div>
  )
}
