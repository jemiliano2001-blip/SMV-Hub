'use client'

import { useEffect, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import type { TrustEnvelopeDTO } from "@/lib/reportes-integridad"
import { listIntegrityCases } from "@/lib/services/reportes-integridad"
import { TrustLedger } from "./TrustLedger"

export default function IntegrityTrustStrip() {
  const [trust, setTrust] = useState<TrustEnvelopeDTO | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    void listIntegrityCases({ scope: "all", limit: 1 })
      .then((response) => {
        if (active && response.scope === "all") setTrust(response.trust)
      })
      .catch(() => {
        if (active) setTrust(null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  if (loading) {
    return (
      <div className="mb-4 flex min-h-11 items-center gap-3 border-y border-slate-200 bg-white px-3 py-2 no-print">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-44" />
      </div>
    )
  }
  if (!trust) return null
  return <TrustLedger trust={trust} compact />
}
