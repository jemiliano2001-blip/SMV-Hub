'use client'

import { useState } from "react"
import { RefreshCw } from "lucide-react"
import type { EstadoSyncFinanzas } from "@/lib/finanzas-facturas"
import { sincronizarFinanzasOdoo } from "@/lib/services/finanzas-sync"

function hace(fecha: Date): string {
  const minutos = Math.floor((Date.now() - fecha.getTime()) / 60_000)
  if (minutos < 1) return "hace un momento"
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `hace ${horas} h`
  return `hace ${Math.floor(horas / 24)} d`
}

type Props = {
  estadoSync: EstadoSyncFinanzas | null
  onSincronizado?: () => void
}

export default function BannerSync({ estadoSync, onSincronizado }: Props) {
  const [sincronizando, setSincronizando] = useState(false)
  const [errorManual, setErrorManual] = useState<string | null>(null)

  async function handleSincronizar() {
    setSincronizando(true)
    setErrorManual(null)
    try {
      await sincronizarFinanzasOdoo()
      onSincronizado?.()
    } catch (err) {
      console.error("Error al sincronizar con Odoo:", err)
      setErrorManual(err instanceof Error ? err.message : "No se pudo sincronizar con Odoo.")
    } finally {
      setSincronizando(false)
    }
  }

  const boton = (
    <button
      onClick={handleSincronizar}
      disabled={sincronizando}
      className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50 print:hidden"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${sincronizando ? "animate-spin" : ""}`} />
      {sincronizando ? "Sincronizando…" : "Sincronizar ahora"}
    </button>
  )

  if (errorManual) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 print:hidden">
          {errorManual}
        </div>
        {boton}
      </div>
    )
  }

  if (estadoSync?.ultimoError) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 print:hidden">
          La última sincronización con Odoo falló: {estadoSync.ultimoError}. Los datos mostrados son del
          último espejo sincronizado con éxito.
        </div>
        {boton}
      </div>
    )
  }

  if (!estadoSync?.ultimaCorridaEn) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <div className="rounded-lg border border-border bg-muted px-4 py-2 text-sm text-muted-foreground print:hidden">
          Todavía no hay una sincronización con Odoo registrada.
        </div>
        {boton}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-xs text-muted-foreground print:hidden">Sincronizado con Odoo {hace(estadoSync.ultimaCorridaEn)}</p>
      {boton}
    </div>
  )
}
