"use client"

import { useEffect } from "react"
import RouteError from "@/components/RouteError"
import { registrarErrorInterfaz } from "@/lib/ux-telemetry"

export default function Error({
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    void registrarErrorInterfaz("app")
  }, [])

  return <RouteError onRetry={unstable_retry} />
}

