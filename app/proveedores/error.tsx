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
    void registrarErrorInterfaz("proveedores")
  }, [])

  return (
    <RouteError
      title="No pudimos abrir Proveedores"
      description="El directorio no está disponible en este momento. Tus datos no se modificaron."
      onRetry={unstable_retry}
    />
  )
}

