import { useState, useEffect } from "react"
import type { FacturaCliente } from "@/lib/schemas"
import { listarFacturas, obtenerEstadoSync, type EstadoSyncFinanzas } from "@/lib/finanzas-facturas"

export function useFinanzasFacturas() {
  const [facturas, setFacturas] = useState<FacturaCliente[]>([])
  const [estadoSync, setEstadoSync] = useState<EstadoSyncFinanzas | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    cargarFacturas()
  }, [])

  async function cargarFacturas() {
    setLoading(true)
    setError(null)
    try {
      const [datos, sync] = await Promise.all([listarFacturas(), obtenerEstadoSync()])
      setFacturas(datos)
      setEstadoSync(sync)
    } catch (err) {
      console.error("Error cargando facturas de Finanzas:", err)
      setError("No se pudieron cargar las facturas.")
    } finally {
      setLoading(false)
    }
  }

  return { facturas, estadoSync, loading, error, recargar: cargarFacturas }
}
