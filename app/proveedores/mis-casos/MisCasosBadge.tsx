'use client'

import { useEffect, useState } from "react"
import { listIntegrityCases } from "@/lib/services/reportes-integridad"

export const MIS_CASOS_UPDATED_EVENT = "smv-integrity-cases-updated"

export default function MisCasosBadge() {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    const load = () => {
      void listIntegrityCases({ scope: "mine", limit: 1 })
        .then((response) => {
          if (active && response.scope === "mine") setCount(response.total)
        })
        .catch(() => {
          if (active) setCount(null)
        })
    }
    load()
    window.addEventListener(MIS_CASOS_UPDATED_EVENT, load)
    return () => {
      active = false
      window.removeEventListener(MIS_CASOS_UPDATED_EVENT, load)
    }
  }, [])

  if (!count) return null
  const visible = count > 99 ? "99+" : String(count)
  return (
    <span
      className="inline-flex min-w-5 items-center justify-center rounded-full bg-rose-700 px-1.5 py-0.5 text-[11px] font-bold text-white"
      aria-label={`${count} casos propios abiertos`}
    >
      {visible}
    </span>
  )
}
