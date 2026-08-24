'use client'

import { useState, useEffect, useCallback, useMemo } from "react"
import Link from "next/link"
import {
  listarOrdenes,
  listarOrdenesEnRango,
  listarOrdenesPorReporteContable,
  actualizarClavesSatLote,
} from "@/lib/ordenes"
import { aplanarLineas, type Linea } from "@/lib/reportes"
import type { OrdenCompra } from "@/lib/schemas"
import { getClienteAuth } from "@/lib/firebase"
import {
  acumularResumenProcesamiento,
  armarChunksOrdenes,
  crearResumenProcesamiento,
  type ResumenProcesamientoContableIa,
} from "@/lib/reportes-contables-ia"
import { extraerEntradasHistorialSat } from "@/lib/sat/extraer-historial-ordenes"
import { Loader2, AlertCircle, FileSpreadsheet, Printer, Sparkles, CheckCircle2, History, RefreshCw, Copy, ExternalLink } from "lucide-react"
import { listarLotesContables, crearLoteContable, type ReporteContableLote } from "@/lib/reportes-contables"
import {
  armarFilasExcelContable,
  generarBufferExcelContable,
  nombreArchivoExcelContable,
  subtituloContablePrint,
  tituloPdfContable,
} from "@/lib/reportes-contables-export"
import { useConfirmDialog } from "@/components/ConfirmDialogProvider"
import ModuleSurface from "@/components/layout/ModuleSurface"
import { toast } from "sonner"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table'

const MSG_ERROR = "No se pudieron cargar las órdenes. Verifica tu conexión."

type TabMode = "pendientes" | "historial"

type RespuestaProcesamientoIa = {
  resumen: ResumenProcesamientoContableIa
}

function mensajeError(error: unknown): string {
  return error instanceof Error ? error.message : "Ocurrió un error inesperado"
}

async function leerRespuestaProcesamiento(res: Response): Promise<RespuestaProcesamientoIa> {
  const texto = await res.text()
  let data: ({ error?: string } & Partial<RespuestaProcesamientoIa>) | null = null

  try {
    data = JSON.parse(texto) as { error?: string } & Partial<RespuestaProcesamientoIa>
  } catch {
    throw new Error(`El servidor devolvió HTTP ${res.status}. Reintenta en unos segundos.`)
  }

  if (!res.ok || !data.resumen) {
    throw new Error(data.error || `El servidor devolvió HTTP ${res.status}`)
  }

  return { resumen: data.resumen }
}

export default function ReporteContableView() {
  const confirmar = useConfirmDialog()
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([])
  const [lotes, setLotes] = useState<ReporteContableLote[]>([])
  
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [tab, setTab] = useState<TabMode>("pendientes")
  const [loteSeleccionado, setLoteSeleccionado] = useState<string | null>(null)
  const [moneda, setMoneda] = useState("USD")
  
  const [satDict, setSatDict] = useState<Record<string, string>>({})
  const [cargandoSat, setCargandoSat] = useState(false)
  
  const [procesandoIa, setProcesandoIa] = useState(false)
  const [progresoIa, setProgresoIa] = useState<{ actual: number; total: number } | null>(null)
  const [resultadoIa, setResultadoIa] = useState<string | null>(null)
  const [guardandoLote, setGuardandoLote] = useState(false)
  const [cargandoHistorial, setCargandoHistorial] = useState(false)
  const [resugieriendo, setResugieriendo] = useState<Set<string>>(new Set())
  const [errorResugerir, setErrorResugerir] = useState<string | null>(null)
  const [altsPorLinea, setAltsPorLinea] = useState<
    Record<string, Array<{ clave: string; descripcionSat: string }>>
  >({})

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    const hasta = new Date()
    const desde = new Date()
    desde.setFullYear(desde.getFullYear() - 1)

    // Cargas independientes: un fallo en lotes no debe tumbar las órdenes pendientes.
    const [ordsResult, ltsResult] = await Promise.allSettled([
      listarOrdenesEnRango(desde, hasta),
      listarLotesContables(),
    ])

    if (ordsResult.status === "fulfilled") {
      setOrdenes(ordsResult.value)
    } else {
      console.error("ReporteContable: fallo al listar órdenes", ordsResult.reason)
      setError(MSG_ERROR)
    }

    if (ltsResult.status === "fulfilled") {
      setLotes(ltsResult.value)
    } else {
      console.error("ReporteContable: fallo al listar lotes contables", ltsResult.reason)
      if (ordsResult.status === "fulfilled") {
        toast.error("No se pudieron cargar los lotes históricos. Las órdenes pendientes sí están disponibles.")
      }
    }

    setCargando(false)
  }, [])

  const seleccionarLote = useCallback(async (id: string) => {
    setLoteSeleccionado(id)
    if (ordenes.some((orden) => orden.reporteContableId === id)) return

    setCargando(true)
    setError(null)
    try {
      const historicas = await listarOrdenesPorReporteContable(id)
      setOrdenes((actuales) => {
        const porId = new Map(actuales.map((orden) => [orden.id, orden]))
        for (const orden of historicas) porId.set(orden.id, orden)
        return [...porId.values()]
      })
    } catch {
      setError("No se pudo cargar el lote histórico. Verifica tu conexión.")
    } finally {
      setCargando(false)
    }
  }, [ordenes])

  const cargarHistorialCompleto = useCallback(async () => {
    setCargandoHistorial(true)
    try {
      const historicas = await listarOrdenes()
      setOrdenes((actuales) => {
        const porId = new Map(actuales.map((orden) => [orden.id, orden]))
        for (const orden of historicas) porId.set(orden.id, orden)
        return [...porId.values()]
      })
      toast.success("Historial completo cargado")
    } catch {
      toast.error("No se pudo cargar el historial completo")
    } finally {
      setCargandoHistorial(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void cargar()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [cargar])

  // Filtrar según el tab activo
  const ordenesFiltradas = useMemo(() => {
    if (tab === "pendientes") {
      return ordenes.filter(o => !o.reporteContableId)
    } else {
      if (!loteSeleccionado) return []
      return ordenes.filter(o => o.reporteContableId === loteSeleccionado)
    }
  }, [ordenes, tab, loteSeleccionado])

  const lineasTodas = useMemo(() => aplanarLineas(ordenesFiltradas), [ordenesFiltradas])
  const monedas = useMemo(() => [...new Set(lineasTodas.map((l) => l.moneda))].filter(Boolean), [lineasTodas])
  const monedaActiva = monedas.includes(moneda) ? moneda : (monedas[0] ?? "USD")
  const lineas = useMemo(() => lineasTodas.filter((l) => l.moneda === monedaActiva), [lineasTodas, monedaActiva])

  // Cargar las descripciones del SAT desde la API (para las claves presentes)
  useEffect(() => {
    const clavesUnicas = [...new Set(lineas.map(l => l.claveProdServ).filter(Boolean))] as string[]
    if (clavesUnicas.length === 0) return

    const fetchSat = async () => {
      const user = getClienteAuth().currentUser
      if (!user) return

      setCargandoSat(true)
      try {
        const token = await user.getIdToken()
        const res = await fetch("/api/sat-descripciones", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ claves: clavesUnicas })
        })
        if (res.ok) {
          const dict = await res.json()
          setSatDict(prev => ({...prev, ...dict}))
        }
      } catch (e) {
        console.error("Error cargando descripciones SAT:", e)
      } finally {
        setCargandoSat(false)
      }
    }
    fetchSat()
  }, [lineas])

  const procesarFaltantesIa = async () => {
    const chunks = armarChunksOrdenes(ordenesFiltradas)
    const total = lineasTodas.filter(
      (linea) => !linea.descripcionSimplificada?.trim() || !linea.claveProdServ
    ).length
    if (chunks.length === 0 || total === 0) return

    const aceptado = await confirmar({
      title: "Completar líneas mediante IA",
      description: `Se procesarán ${total} líneas sin descripción simplificada o clave SAT.`,
      confirmLabel: "Procesar líneas",
    })
    if (!aceptado) return

    const user = getClienteAuth().currentUser
    if (!user) {
      toast.error("Tu sesión expiró. Inicia sesión de nuevo para continuar.")
      return
    }

    setProcesandoIa(true)
    setProgresoIa({ actual: 0, total })
    setResultadoIa(null)
    let avance = 0
    try {
      const token = await user.getIdToken()
      const historialEntradas = extraerEntradasHistorialSat(ordenes)
      let resumen = crearResumenProcesamiento()

      for (const chunk of chunks) {
        const faltantesChunk = chunk.reduce(
          (cantidad, orden) => cantidad + orden.items.filter(
            (item) => !item.descripcionSimplificada?.trim() || !item.claveProdServ
          ).length,
          0
        )
        let respuesta: RespuestaProcesamientoIa | null = null
        let ultimoError: Error | null = null

        for (let intento = 0; intento < 2 && !respuesta; intento += 1) {
          try {
            const res = await fetch("/api/retro-traducir-lote", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                ordenesIds: chunk.map((orden) => orden.id),
                historialEntradas,
              }),
            })
            respuesta = await leerRespuestaProcesamiento(res)
          } catch (error) {
            ultimoError = error instanceof Error ? error : new Error(mensajeError(error))
          }
        }

        if (!respuesta) throw ultimoError ?? new Error("No se pudo procesar este bloque")
        resumen = acumularResumenProcesamiento(resumen, respuesta.resumen)
        avance += faltantesChunk
        setProgresoIa({ actual: Math.min(avance, total), total })
      }

      await cargar()
      const mensaje = `${resumen.traducidas} traducidas · ${resumen.clavesAsignadas} claves asignadas · ${resumen.clavesPendientes} pendientes de revisar`
      const pendientesReintento = resumen.ordenesFallidas.length + resumen.ordenesOmitidas.length
      setResultadoIa(
        pendientesReintento > 0
          ? `${mensaje}. ${pendientesReintento} órdenes requieren reintento.`
          : mensaje
      )
    } catch (error) {
      setResultadoIa(`Se procesaron ${avance} de ${total}. Reintenta para continuar. ${mensajeError(error)}`)
    } finally {
      setProcesandoIa(false)
      setProgresoIa(null)
    }
  }

  const handleGuardarLote = async () => {
    if (lineas.length === 0) return
    // Solo se cierran las órdenes de la moneda activa (monedaActiva): son las únicas
    // que aparecen en el Excel/tabla que se le entrega a la contadora.
    const ids = [...new Set(lineas.map((l) => l.ordenId))]
    const otrasMonedasPendientes = monedas.filter((m) => m !== monedaActiva)
    const aceptado = await confirmar({
      title: "Cerrar reporte contable",
      description:
        `Se cerrará el reporte con ${ids.length} órdenes en ${monedaActiva} y se enviará al historial.` +
        (otrasMonedasPendientes.length > 0
          ? ` Las órdenes en ${otrasMonedasPendientes.join(", ")} seguirán pendientes — ciérralas por separado cambiando la moneda activa.`
          : ""),
      confirmLabel: "Cerrar reporte",
    })
    if (!aceptado) return

    setGuardandoLote(true)
    try {
      await crearLoteContable(ids, lineas.length)
      toast.success("Lote generado y guardado en el historial.")
      await cargar()
      setTab("pendientes") // Quedarse en pendientes (que ahora estará vacía)
    } catch (error) {
      toast.error("Error al guardar lote: " + mensajeError(error))
    } finally {
      setGuardandoLote(false)
    }
  }

  const aplicarClaveLinea = async (
    linea: Linea,
    claveProdServ: string,
    alts: Array<{ clave: string; descripcionSat: string }> = []
  ) => {
    const orden = ordenes.find((o) => o.id === linea.ordenId)
    if (!orden) throw new Error("La orden ya no existe")

    const itemsActualizados = orden.items.map((item, idx) =>
      idx === linea.itemIndex
        ? { ...item, claveProdServ, satPendiente: false }
        : item
    )
    await actualizarClavesSatLote([{ ordenId: linea.ordenId, items: itemsActualizados }])
    const claveLinea = `${linea.ordenId}-${linea.itemIndex}`
    setAltsPorLinea((prev) => ({
      ...prev,
      [claveLinea]: alts.filter((a) => a.clave !== claveProdServ).slice(0, 3),
    }))
    await cargar()
  }

  const handleResugerir = async (linea: Linea) => {
    if (linea.itemIndex < 0) return
    const clave = `${linea.ordenId}-${linea.itemIndex}`
    setErrorResugerir(null)
    setResugieriendo((prev) => new Set(prev).add(clave))

    try {
      const user = getClienteAuth().currentUser
      if (!user) throw new Error("Tu sesión expiró. Inicia sesión de nuevo para continuar.")
      const token = await user.getIdToken()

      const res = await fetch("/api/sugerir-clave-sat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          items: [
            {
              descripcion: linea.descripcion,
              proveedor: linea.proveedor,
              terminosPrevios: linea.descripcionSimplificada || undefined,
            },
          ],
          historialEntradas: extraerEntradasHistorialSat(ordenesFiltradas),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "No se pudo generar la sugerencia")

      const sugerencia = data.sugerencias?.[0] as {
        claveProdServ: string | null
        alternativas?: Array<{ clave: string; descripcionSat: string }>
      } | undefined
      if (!sugerencia?.claveProdServ) {
        throw new Error("No hubo una nueva sugerencia de clave SAT para esta línea")
      }

      await aplicarClaveLinea(linea, sugerencia.claveProdServ, sugerencia.alternativas ?? [])
    } catch (error) {
      setErrorResugerir(mensajeError(error))
    } finally {
      setResugieriendo((prev) => {
        const next = new Set(prev)
        next.delete(clave)
        return next
      })
    }
  }

  const exportarExcel = async () => {
    try {
      const filas = armarFilasExcelContable(lineas, satDict, monedaActiva)
      const buffer = await generarBufferExcelContable({
        filas,
        moneda: monedaActiva,
        subtitulo: subtituloContablePrint(tab, loteSeleccionado),
      })
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = nombreArchivoExcelContable({
        tab,
        loteId: loteSeleccionado,
        moneda: monedaActiva,
      })
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("ReporteContable: fallo al exportar Excel", error)
      toast.error("No se pudo generar el Excel. Intenta de nuevo.")
    }
  }

  const imprimirPDF = () => {
    const tituloOriginal = document.title
    document.title = tituloPdfContable({
      tab,
      loteId: loteSeleccionado,
      moneda: monedaActiva,
    })
    window.print()
    document.title = tituloOriginal
  }

  if (cargando && ordenes.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="mr-2 size-6 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Cargando órdenes…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <AlertCircle className="size-8 text-destructive" />
        <p className="text-sm text-foreground">{error}</p>
        <button onClick={cargar} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Reintentar
        </button>
      </div>
    )
  }

  const lineasConFaltantes = lineasTodas.filter(
    (linea) => !linea.descripcionSimplificada?.trim() || !linea.claveProdServ
  ).length

  const subtituloPrint = subtituloContablePrint(tab, loteSeleccionado)
  const generadoEl = new Date().toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
  const totalMoneda = lineas.reduce((acc, curr) => acc + curr.total, 0)

  return (
    <div className="w-full">
      <div className="max-w-[1400px] mx-auto px-4 py-6 print:max-w-none print:px-0 print:py-0">
        
        <div className="mb-4 no-print flex flex-wrap gap-4 border-b border-border text-sm">
          <Link href="/reportes" className="min-h-11 content-center text-muted-foreground hover:text-foreground">
            Reporte gerencial
          </Link>
          <span className="min-h-11 content-center border-b-2 border-primary font-semibold text-primary">
            Cierre contable
          </span>
        </div>

        <div className="no-print mb-6 flex gap-4 border-b border-border">
          <button 
            onClick={() => setTab("pendientes")}
            className={`px-1 pb-2 font-medium transition-colors ${tab === "pendientes" ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            Nuevos (Pendientes por Enviar)
          </button>
          <button 
            onClick={() => {
              setTab("historial")
               if (!loteSeleccionado && lotes.length > 0) void seleccionarLote(lotes[0].id)
            }}
            className={`flex items-center px-1 pb-2 font-medium transition-colors ${tab === "historial" ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            <History className="mr-1 size-4" />
            Historial de Reportes
          </button>
        </div>

        <div className="flex gap-6 relative">
          
          {/* Sidebar de Lotes (Solo en Historial) */}
          {tab === "historial" && (
            <div className="w-64 shrink-0 no-print">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-foreground">Lotes Guardados</h2>
              <div className="flex flex-col gap-2">
                {lotes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay lotes en el historial.</p>
                ) : (
                  lotes.map(lote => (
                    <button
                      key={lote.id}
                      onClick={() => void seleccionarLote(lote.id)}
                      className={`rounded-lg border px-3 py-3 text-left text-sm transition-colors ${loteSeleccionado === lote.id ? "border-primary/30 bg-primary/10" : "border-border bg-card hover:bg-muted"}`}
                    >
                      <div className="font-medium text-foreground">{lote.id}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{lote.fechaGeneracion.toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{lote.totalLineas} artículos</div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Contenido Principal */}
          <div className="flex-1 overflow-hidden min-w-0">
            <div className="mb-4 flex flex-col items-start justify-between gap-4 no-print sm:flex-row sm:items-center">
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  {tab === "pendientes" ? "Compras Pendientes de Enviar" : `Reporte ${loteSeleccionado || ""}`}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {tab === "pendientes" 
                    ? "Compras no enviadas de los últimos 12 meses. Carga el historial completo si necesitas buscar más atrás."
                    : "Modo solo lectura. Visualizando un lote cerrado del historial."}
                </p>
              </div>
              
              <div className="flex flex-wrap items-center gap-3">
                {tab === "pendientes" && (
                  <button
                    type="button"
                    onClick={() => void cargarHistorialCompleto()}
                    disabled={cargandoHistorial}
                    className="flex items-center rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
                  >
                    {cargandoHistorial && <Loader2 className="mr-2 size-4 animate-spin" />}
                    {cargandoHistorial ? "Cargando historial..." : "Cargar historial completo"}
                  </button>
                )}
                {/* Selector de moneda */}
                {monedas.length > 1 && (
                  <select 
                    value={monedaActiva} 
                    onChange={e => setMoneda(e.target.value)}
                    className="rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground shadow-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {monedas.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                )}

                {tab === "pendientes" && lineasConFaltantes > 0 && (
                   <button
                     onClick={procesarFaltantesIa}
                     disabled={procesandoIa}
                     className="flex items-center rounded-lg bg-amber-100 px-4 py-2 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-200"
                   >
                     {procesandoIa ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
                     {procesandoIa && progresoIa
                       ? `Procesando ${progresoIa.actual}/${progresoIa.total}...`
                       : `Completar faltantes (${lineasConFaltantes})`}
                   </button>
                )}
                
                {tab === "pendientes" && lineas.length > 0 && (
                  <button
                    onClick={handleGuardarLote}
                    disabled={guardandoLote || procesandoIa}
                    className="flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 disabled:opacity-50"
                  >
                    {guardandoLote ? <Loader2 className="mr-2 size-4 animate-spin" /> : <CheckCircle2 className="mr-2 size-4" />}
                    Cerrar Reporte
                  </button>
                )}

                <button onClick={exportarExcel} className="flex items-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted">
                  <FileSpreadsheet className="mr-2 size-4" />
                  Excel
                </button>
                <button onClick={imprimirPDF} className="flex items-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted">
                  <Printer className="mr-2 size-4" />
                  PDF
                </button>
              </div>
            </div>

            {errorResugerir && (
              <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive no-print">
                {errorResugerir}
              </div>
            )}

            {resultadoIa && (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 no-print">
                {resultadoIa}
              </div>
            )}

            <div className="reporte-document">
              <div className="mb-3 hidden print:flex print:items-center print:justify-between print:bg-[#111111] print:px-3 print:py-2.5 print:text-white">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest">SMV Maquinados</p>
                  <p className="mt-0.5 text-[8px] tracking-wide print:text-gray-400">S.A. de C.V.</p>
                </div>
                <div className="text-center">
                  <p className="text-[12.5px] font-semibold uppercase tracking-wide">Cierre contable</p>
                  <p className="mt-1 text-[8.5px] print:text-gray-400">{subtituloPrint}</p>
                </div>
                <div className="text-right text-[8px] leading-relaxed print:text-gray-400">
                  <p>{monedaActiva} · {lineas.length} líneas</p>
                  <p>Generado el {generadoEl}</p>
                </div>
              </div>

              <ModuleSurface className="print:overflow-visible print:rounded-none print:border-0 print:shadow-none">
                <div className="overflow-x-auto print:overflow-visible">
                  <Table className="w-full border-collapse text-left text-sm text-muted-foreground print:min-w-0 print:text-[9px]">
                    <TableHeader className="bg-muted text-xs font-semibold uppercase text-muted-foreground print:bg-[#111111]">
                      <TableRow className="print:border-b-0">
                        <TableHead className="px-4 py-3 print:px-2 print:py-1.5 print:text-[7.5px] print:font-medium print:uppercase print:tracking-widest print:text-white">
                          Fecha
                        </TableHead>
                        <TableHead className="hidden print:table-cell print:px-2 print:py-1.5 print:text-[7.5px] print:font-medium print:uppercase print:tracking-widest print:text-white">
                          Factura
                        </TableHead>
                        <TableHead className="px-4 py-3 print:px-2 print:py-1.5 print:text-[7.5px] print:font-medium print:uppercase print:tracking-widest print:text-white">
                          Proveedor
                          <span className="print:hidden"> / Factura</span>
                        </TableHead>
                        <TableHead className="px-4 py-3 print:px-2 print:py-1.5 print:text-[7.5px] print:font-medium print:uppercase print:tracking-widest print:text-white">
                          Descripción Simplificada
                        </TableHead>
                        <TableHead className="px-4 py-3 print:px-2 print:py-1.5 print:text-[7.5px] print:font-medium print:uppercase print:tracking-widest print:text-white">
                          Clave SAT
                        </TableHead>
                        <TableHead className="px-4 py-3 text-right print:px-2 print:py-1.5 print:text-[7.5px] print:font-medium print:uppercase print:tracking-widest print:text-white">
                          Cant.
                        </TableHead>
                        <TableHead className="px-4 py-3 text-right print:px-2 print:py-1.5 print:text-[7.5px] print:font-medium print:uppercase print:tracking-widest print:text-white">
                          Precio U.
                        </TableHead>
                        <TableHead className="px-4 py-3 text-right print:px-2 print:py-1.5 print:text-[7.5px] print:font-medium print:uppercase print:tracking-widest print:text-white">
                          Total
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-border print:divide-gray-300">
                      {lineas.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="px-4 py-12 text-center">
                            {tab === "pendientes" ? (
                              <div className="text-muted-foreground">
                                <CheckCircle2 className="mx-auto mb-3 size-12 text-emerald-500" />
                                <p className="text-lg font-medium text-foreground">¡Todo al día!</p>
                                <p>No hay compras pendientes por enviar a la contadora en los últimos 12 meses.</p>
                              </div>
                            ) : (
                              <p className="text-muted-foreground">Selecciona un lote del historial para ver sus compras.</p>
                            )}
                          </TableCell>
                        </TableRow>
                      ) : (
                        lineas.map((l, i) => {
                          const totalFormateado = new Intl.NumberFormat("es-MX", { style: "currency", currency: monedaActiva }).format(l.total)
                          const descFinal = l.descripcionSimplificada || l.descripcion

                          return (
                            <ContextMenu key={`${l.ordenId}-${i}`}>
                              <ContextMenuTrigger asChild>
                                <TableRow
                                  className={`grupo-linea cursor-pointer select-none hover:bg-muted print:hover:bg-transparent ${i % 2 === 1 ? "print:bg-[#fafafa]" : ""}`}
                                >
                                  <TableCell className="whitespace-nowrap px-4 py-3 print:px-2 print:py-1 print:font-mono print:text-[8.5px]">
                                    {l.dia ? l.dia.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" }) : "-"}
                                  </TableCell>
                                  <TableCell className="hidden print:table-cell print:px-2 print:py-1 print:font-mono print:text-[8.5px] print:text-gray-600">
                                    {l.referencia || "—"}
                                  </TableCell>
                                  <TableCell className="px-4 py-3 print:px-2 print:py-1 print:text-[8.5px]">
                                    <div className="font-medium text-foreground print:font-semibold print:text-black">{l.proveedor}</div>
                                    <div className="text-xs text-muted-foreground print:hidden">Ref: {l.referencia}</div>
                                  </TableCell>
                                  <TableCell className="max-w-xs px-4 py-3 print:max-w-[200px] print:px-2 print:py-1 print:text-[8.5px]" title={descFinal}>
                                    {l.descripcionSimplificada ? (
                                      <span className="font-medium text-foreground print:font-normal print:text-black">{l.descripcionSimplificada}</span>
                                    ) : (
                                      <span className="italic text-muted-foreground" title={l.descripcion}>
                                        {l.descripcion.length > 50 ? `${l.descripcion.substring(0, 50)}...` : l.descripcion}
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell className="max-w-xs px-4 py-3 print:max-w-[140px] print:px-2 print:py-1">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-medium text-foreground print:font-mono print:text-[8.5px] print:text-black">
                                        {l.claveProdServ || "—"}
                                      </span>
                                      {l.itemIndex >= 0 && (
                                        <button
                                          type="button"
                                          onClick={() => handleResugerir(l)}
                                          disabled={resugieriendo.has(`${l.ordenId}-${l.itemIndex}`)}
                                          title="Volver a sugerir la clave SAT para esta línea"
                                          className="cursor-pointer text-muted-foreground hover:text-primary no-print disabled:opacity-50"
                                        >
                                          <RefreshCw
                                            className={`size-3.5 ${resugieriendo.has(`${l.ordenId}-${l.itemIndex}`) ? "animate-spin" : ""}`}
                                          />
                                        </button>
                                      )}
                                    </div>
                                    {!l.claveProdServ && (
                                      <span className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 print:hidden">
                                        Revisar
                                      </span>
                                    )}
                                    <div
                                      className="truncate text-xs text-muted-foreground print:text-[7.5px] print:leading-tight print:text-gray-600"
                                      title={satDict[l.claveProdServ || ""]}
                                    >
                                      {cargandoSat && l.claveProdServ && !satDict[l.claveProdServ]
                                        ? "Cargando..."
                                        : satDict[l.claveProdServ || ""] || ""}
                                    </div>
                                    {(altsPorLinea[`${l.ordenId}-${l.itemIndex}`]?.length ?? 0) > 0 && (
                                      <div className="mt-1.5 flex flex-wrap gap-1 no-print">
                                        {altsPorLinea[`${l.ordenId}-${l.itemIndex}`].map((alt) => (
                                          <button
                                            key={alt.clave}
                                            type="button"
                                            title={alt.descripcionSat}
                                            onClick={() => void aplicarClaveLinea(l, alt.clave, altsPorLinea[`${l.ordenId}-${l.itemIndex}`])}
                                            className="cursor-pointer rounded border border-primary/30 bg-card px-1.5 py-0.5 font-mono text-[10px] text-primary hover:bg-primary/10"
                                          >
                                            {alt.clave}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </TableCell>
                                  <TableCell className="px-4 py-3 text-right font-medium print:px-2 print:py-1 print:font-mono print:text-[8.5px]">
                                    {l.cantidad !== null ? l.cantidad : "—"}
                                  </TableCell>
                                  <TableCell className="px-4 py-3 text-right print:px-2 print:py-1 print:font-mono print:text-[8.5px]">
                                    {l.precioUnitario !== null
                                      ? new Intl.NumberFormat("es-MX", { style: "currency", currency: monedaActiva }).format(l.precioUnitario)
                                      : "—"}
                                  </TableCell>
                                  <TableCell className="px-4 py-3 text-right font-semibold text-foreground print:px-2 print:py-1 print:font-mono print:text-[9px] print:font-semibold print:text-black">
                                    {totalFormateado}
                                  </TableCell>
                                </TableRow>
                              </ContextMenuTrigger>

                              <ContextMenuContent className="w-56">
                                {l.itemIndex >= 0 && (
                                  <ContextMenuItem
                                    onClick={() => handleResugerir(l)}
                                    disabled={resugieriendo.has(`${l.ordenId}-${l.itemIndex}`)}
                                  >
                                    <Sparkles className="text-amber-500" />
                                    <span>Re-sugerir Clave SAT (IA)</span>
                                    <ContextMenuShortcut>↵</ContextMenuShortcut>
                                  </ContextMenuItem>
                                )}

                                <ContextMenuItem
                                  onClick={() => {
                                    window.location.href = `/ordenes`
                                  }}
                                >
                                  <ExternalLink className="text-primary" />
                                  <span>Ver orden en Compras</span>
                                </ContextMenuItem>

                                <ContextMenuSeparator />

                                <ContextMenuSub>
                                  <ContextMenuSubTrigger>
                                    <Copy className="text-muted-foreground" />
                                    <span>Copiar información</span>
                                  </ContextMenuSubTrigger>
                                  <ContextMenuSubContent className="w-48">
                                    {l.claveProdServ && (
                                      <ContextMenuItem
                                        onClick={() => {
                                          void navigator.clipboard.writeText(l.claveProdServ || '')
                                          toast.success('Clave SAT copiada')
                                        }}
                                      >
                                        <span>Clave SAT ({l.claveProdServ})</span>
                                      </ContextMenuItem>
                                    )}
                                    <ContextMenuItem
                                      onClick={() => {
                                        void navigator.clipboard.writeText(l.proveedor)
                                        toast.success('Proveedor copiado')
                                      }}
                                    >
                                      <span>Proveedor ({l.proveedor})</span>
                                    </ContextMenuItem>
                                    <ContextMenuItem
                                      onClick={() => {
                                        void navigator.clipboard.writeText(descFinal)
                                        toast.success('Descripción copiada')
                                      }}
                                    >
                                      <span>Descripción</span>
                                    </ContextMenuItem>
                                    {l.referencia && (
                                      <ContextMenuItem
                                        onClick={() => {
                                          void navigator.clipboard.writeText(l.referencia)
                                          toast.success('Referencia / Factura copiada')
                                        }}
                                      >
                                        <span>Ref. Factura ({l.referencia})</span>
                                      </ContextMenuItem>
                                    )}
                                    <ContextMenuItem
                                      onClick={() => {
                                        void navigator.clipboard.writeText(totalFormateado)
                                        toast.success('Total copiado', { description: totalFormateado })
                                      }}
                                    >
                                      <span>Total ({totalFormateado})</span>
                                    </ContextMenuItem>
                                  </ContextMenuSubContent>
                                </ContextMenuSub>
                              </ContextMenuContent>
                            </ContextMenu>
                          )
                        })
                      )}
                    </TableBody>
                    {lineas.length > 0 && (
                      <TableFooter className="bg-muted font-bold text-foreground print:border-t-[3px] print:border-double print:border-black print:bg-white">
                        <TableRow className="total-general">
                          <TableCell
                            colSpan={6}
                            className="px-4 py-3 text-right text-xs uppercase text-muted-foreground print:hidden"
                          >
                            Total ({monedaActiva})
                          </TableCell>
                          <TableCell
                            colSpan={7}
                            className="hidden px-2 py-2 text-right text-[10.5px] font-bold uppercase text-black print:table-cell"
                          >
                            Total ({monedaActiva})
                          </TableCell>
                          <TableCell className="px-4 py-3 text-right text-base print:px-2 print:py-2 print:font-mono print:text-[13px] print:text-black">
                            {new Intl.NumberFormat("es-MX", { style: "currency", currency: monedaActiva }).format(totalMoneda)}
                          </TableCell>
                        </TableRow>
                      </TableFooter>
                    )}
                  </Table>
                </div>
              </ModuleSurface>

              <div className="mt-3 hidden justify-between border-t border-border pt-2 text-[7.5px] tracking-wide text-muted-foreground print:flex">
                <span>SMV Hub · Cierre contable SAT</span>
                <span>{subtituloPrint} · {monedaActiva}</span>
              </div>
            </div>
            
          </div>
        </div>

      </div>
    </div>
  )
}
