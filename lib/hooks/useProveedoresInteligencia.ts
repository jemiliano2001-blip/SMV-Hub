import { useState, useEffect, useCallback, useMemo } from "react"
import {
  obtenerComprasProveedor,
  crearCompraProveedor,
  obtenerEvaluacionesProveedor,
  guardarEvaluacionProveedor,
  obtenerCotizacionesComparacion,
  crearCotizacionComparacion,
  calcularMetricasProveedor,
  calcularRankingCotizacion,
  type NuevaCompraPayload,
  type NuevaCotizacionComparacionPayload,
} from "@/lib/proveedores-inteligencia"
import type { CompraProveedor, EvaluacionProveedor, CotizacionComparacion } from "@/lib/schemas"

export function useProveedoresInteligencia({
  proveedorSeleccionadoId,
  habilitado = true,
}: {
  proveedorSeleccionadoId?: string
  /** `false` evita leer Firestore (p. ej. directorio de proveedores). Default carga. */
  habilitado?: boolean
} = {}) {
  const [compras, setCompras] = useState<CompraProveedor[]>([])
  const [evaluaciones, setEvaluaciones] = useState<EvaluacionProveedor[]>([])
  const [cotizaciones, setCotizaciones] = useState<CotizacionComparacion[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargarDatos = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const [dataCompras, dataEval, dataCot] = await Promise.all([
        obtenerComprasProveedor(),
        obtenerEvaluacionesProveedor(),
        obtenerCotizacionesComparacion(),
      ])
      setCompras(dataCompras)
      setEvaluaciones(dataEval)
      setCotizaciones(dataCot)
    } catch (err) {
      console.error("Error al cargar inteligencia de proveedores:", err)
      setError("No se pudieron cargar los datos de compras y cotizaciones.")
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    if (!habilitado) return
    // La inteligencia es bajo demanda; no se descarga al entrar al directorio.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargarDatos()
  }, [cargarDatos, habilitado])

  // Filtrar compras para un proveedor específico si aplica
  const comprasFiltradas = useMemo(() => {
    if (!proveedorSeleccionadoId) return compras
    return compras.filter((c) => c.proveedorId === proveedorSeleccionadoId)
  }, [compras, proveedorSeleccionadoId])

  // Métricas del proveedor seleccionado o del global
  const metricasProveedor = useMemo(() => {
    return calcularMetricasProveedor(comprasFiltradas)
  }, [comprasFiltradas])

  // Mapa de calificaciones para ranking
  const calificacionesMap = useMemo(() => {
    const map: Record<string, number> = {}
    evaluaciones.forEach((ev) => {
      map[ev.proveedorId] = ev.promedioGeneral
    })
    return map
  }, [evaluaciones])

  // Cotizaciones procesadas con ranking inteligente
  const cotizacionesConRanking = useMemo(() => {
    return cotizaciones.map((cot) => ({
      ...cot,
      ofertasRanking: calcularRankingCotizacion(cot.ofertas, calificacionesMap),
    }))
  }, [cotizaciones, calificacionesMap])

  async function handleCrearCompra(payload: NuevaCompraPayload) {
    try {
      const nueva = await crearCompraProveedor(payload)
      setCompras((prev) => [nueva, ...prev])
      return nueva
    } catch (err) {
      console.error("Error al registrar compra:", err)
      throw new Error("No se pudo registrar la compra")
    }
  }

  async function handleGuardarEvaluacion(payload: Omit<EvaluacionProveedor, "id" | "creadoEn">) {
    try {
      const nueva = await guardarEvaluacionProveedor(payload)
      setEvaluaciones((prev) => [...prev.filter((e) => e.proveedorId !== payload.proveedorId), nueva])
      return nueva
    } catch (err) {
      console.error("Error al guardar evaluación:", err)
      throw new Error("No se pudo guardar la evaluación")
    }
  }

  async function handleCrearCotizacion(payload: NuevaCotizacionComparacionPayload) {
    try {
      const nueva = await crearCotizacionComparacion(payload)
      setCotizaciones((prev) => [nueva, ...prev])
      return nueva
    } catch (err) {
      console.error("Error al crear cotización de comparación:", err)
      throw new Error("No se pudo crear la comparación")
    }
  }

  return {
    compras: comprasFiltradas,
    todasCompras: compras,
    evaluaciones,
    cotizaciones: cotizacionesConRanking,
    metricasProveedor,
    cargando,
    error,
    recargar: cargarDatos,
    crearCompra: handleCrearCompra,
    guardarEvaluacion: handleGuardarEvaluacion,
    crearCotizacion: handleCrearCotizacion,
  }
}
