"use client"

import { useCallback, useEffect, useState } from "react"
import {
  calcularRangoPreciosDesdeItems,
  listarItemsComprasOdoo,
  medidasDesdeItems,
  obtenerEstadoSyncComprasOdoo,
  tiposDesdeItems,
  type EstadoSyncComprasOdoo,
} from "@/lib/compras-odoo-store"
import type { CompraOdooItem } from "@/lib/schemas"
import type { RangoPreciosFamilia } from "@/lib/compras-odoo/rangos"
import { sincronizarComprasOdoo } from "@/lib/services/compras-odoo-sync"

export function useComprasOdoo() {
  const [items, setItems] = useState<CompraOdooItem[]>([])
  const [estadoSync, setEstadoSync] = useState<EstadoSyncComprasOdoo | null>(null)
  const [cargando, setCargando] = useState(true)
  const [sincronizando, setSincronizando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [familia, setFamilia] = useState("metals")
  const [tipo, setTipo] = useState("")
  const [medida, setMedida] = useState("")
  const [moneda, setMoneda] = useState<string>("")

  const recargar = useCallback(() => {
    return Promise.all([
      listarItemsComprasOdoo(),
      obtenerEstadoSyncComprasOdoo(),
    ])
      .then(([lista, estado]) => {
        setItems(lista)
        setEstadoSync(estado)
        setError(null)
        setCargando(false)
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "No se pudieron cargar compras Odoo")
        setCargando(false)
      })
  }, [])

  useEffect(() => {
    void recargar()
  }, [recargar])

  const tipos = tiposDesdeItems(items, familia)
  const medidas = medidasDesdeItems(items, familia, tipo || null)

  const rango: RangoPreciosFamilia | null =
    tipo.trim().length > 0
      ? calcularRangoPreciosDesdeItems(items, {
          categoriaId: familia,
          tipo,
          medida: medida || null,
          moneda: moneda || null,
        })
      : null

  async function sincronizarAhora() {
    setSincronizando(true)
    setError(null)
    try {
      await sincronizarComprasOdoo()
      await recargar()
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falló la sincronización con Odoo"
      // Callable no deployada suele llegar como internal / CORS
      setError(
        /internal|CORS|not-found|NOT_FOUND/i.test(msg)
          ? `${msg} — ¿ya se desplegó syncOdooComprasManual?`
          : msg
      )
    } finally {
      setSincronizando(false)
    }
  }

  return {
    items,
    estadoSync,
    cargando,
    sincronizando,
    error,
    recargar,
    sincronizarAhora,
    familia,
    setFamilia: (f: string) => {
      setFamilia(f)
      setTipo("")
      setMedida("")
    },
    tipo,
    setTipo: (t: string) => {
      setTipo(t)
      setMedida("")
    },
    medida,
    setMedida,
    moneda,
    setMoneda,
    tipos,
    medidas,
    rango,
    // aliases legacy
    tipoMetal: tipo,
    setTipoMetal: (t: string) => {
      setTipo(t)
      setMedida("")
    },
    tiposMetal: tipos,
  }
}
