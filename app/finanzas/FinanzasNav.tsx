'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"

const TABS = [
  { href: "/finanzas", label: "Resumen" },
  { href: "/finanzas/facturacion", label: "Facturación por cliente" },
  { href: "/finanzas/cobranza", label: "Cobranza" },
  { href: "/finanzas/reportes", label: "Reportes" },
]

export default function FinanzasNav() {
  const pathname = usePathname()

  return (
    <div className="flex bg-gray-200/50 p-1 rounded-lg w-fit flex-wrap gap-1 print:hidden">
      {TABS.map((t) => {
        const activo = pathname === t.href
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
              activo
                ? "bg-white text-primary shadow-sm"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-200/50"
            }`}
          >
            {t.label}
          </Link>
        )
      })}
    </div>
  )
}
