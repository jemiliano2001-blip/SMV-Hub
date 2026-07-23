"use client"

import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function RouteError({
  title = "No pudimos cargar esta sección",
  description = "Puede ser un problema temporal de conexión. Intenta nuevamente.",
  onRetry,
}: {
  title?: string
  description?: string
  onRetry: () => void
}) {
  return (
    <main className="min-h-[70vh] bg-[#F8FAFC] px-4 py-10 sm:px-6" role="alert">
      <div className="mx-auto flex max-w-xl flex-col items-center rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
        <div className="mb-4 rounded-full bg-rose-50 p-3 text-rose-700">
          <AlertTriangle className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="text-lg font-bold text-slate-950">{title}</h1>
        <p className="mt-2 max-w-md text-sm text-slate-600">{description}</p>
        <Button onClick={onRetry} className="mt-6 min-h-10 bg-[#0369A1] hover:bg-[#075985]">
          <RefreshCw aria-hidden="true" />
          Intentar nuevamente
        </Button>
      </div>
    </main>
  )
}

