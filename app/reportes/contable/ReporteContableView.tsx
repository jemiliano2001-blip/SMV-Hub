'use client'

import { useState, useEffect, useCallback, useMemo } from "react"
import Link from "next/link"
import { listarOrdenes } from "@/lib/ordenes"
import { aplanarLineas } from "@/lib/reportes"
import type { OrdenCompra } from "@/lib/schemas"
import { getClienteAuth } from "@/lib/firebase"
import {
  acumularResumenProcesamiento,
  armarChunksOrdenes,
  crearResumenProcesamiento,
  type ResumenProcesamientoContableIa,
} from "@/lib/reportes-contables-ia"
import { extraerEntradasHistorialSat } from "@/lib/sat/sugerir-clave"
import { Loader2, AlertCircle, FileSpreadsheet, Printer, Sparkles, CheckCircle2, History } from "lucide-react"
import * as XLSX from "xlsx"
import { listarLotesContables, crearLoteContable, type ReporteContableLote } from "@/lib/reportes-contables"

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

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const [ords, lts] = await Promise.all([
        listarOrdenes(),
        listarLotesContables()
      ])
      setOrdenes(ords)
      setLotes(lts)
    } catch {
      setError(MSG_ERROR)
    } finally {
      setCargando(false)
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
      setCargandoSat(true)
      try {
        const res = await fetch("/api/sat-descripciones", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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

    if (!confirm(`Esto completará mediante IA ${total} líneas sin descripción simplificada o clave SAT. ¿Continuar?`)) return

    const user = getClienteAuth().currentUser
    if (!user) {
      alert("Tu sesión expiró. Inicia sesión de nuevo para continuar.")
      return
    }

    setProcesandoIa(true)
    setProgresoIa({ actual: 0, total })
    setResultadoIa(null)
    let avance = 0
    try {
      const token = await user.getIdToken()
      const historialEntradas = extraerEntradasHistorialSat(ordenesFiltradas)
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
    if (ordenesFiltradas.length === 0) return
    const ids = ordenesFiltradas.map(o => o.id)
    if (!confirm(`¿Estás seguro de cerrar este reporte con ${ids.length} órdenes y enviarlo al historial?`)) return
    
    setGuardandoLote(true)
    try {
      await crearLoteContable(ids, lineasTodas.length)
      alert("Lote generado y guardado en el historial con éxito.")
      await cargar()
      setTab("pendientes") // Quedarse en pendientes (que ahora estará vacía)
    } catch (error) {
      alert("Error al guardar lote: " + mensajeError(error))
    } finally {
      setGuardandoLote(false)
    }
  }

  const exportarExcel = () => {
    const filas = lineas.map(l => ({
      "Fecha": l.dia ? l.dia.toISOString().split("T")[0] : "",
      "Proveedor": l.proveedor,
      "Descripción Simplificada": l.descripcionSimplificada || l.descripcion,
      "Clave SAT": l.claveProdServ || "",
      "Descripción Clave SAT": (l.claveProdServ && satDict[l.claveProdServ]) ? satDict[l.claveProdServ] : "",
      "Cantidad": l.cantidad || 0,
      "Precio Unitario": l.precioUnitario || 0,
      "Total": l.total,
    }))

    const worksheet = XLSX.utils.json_to_sheet(filas)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Reporte Contable")
    
    const nombre = tab === "pendientes" ? "reporte_contable_pendientes.xlsx" : `reporte_contable_${loteSeleccionado}.xlsx`
    XLSX.writeFile(workbook, nombre)
  }

  const imprimirPDF = () => {
    window.print()
  }

  if (cargando && ordenes.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500 mr-2" />
        <span className="text-sm text-gray-600">Cargando órdenes…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4">
        <AlertCircle className="h-8 w-8 text-red-500" />
        <p className="text-sm text-gray-700">{error}</p>
        <button onClick={cargar} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Reintentar
        </button>
      </div>
    )
  }

  const lineasConFaltantes = lineasTodas.filter(
    (linea) => !linea.descripcionSimplificada?.trim() || !linea.claveProdServ
  ).length

  return (
    <div className="w-full">
      <div className="max-w-[1400px] mx-auto px-4 py-6 print:max-w-none print:px-0 print:py-0">
        
        <div className="mb-4 no-print flex gap-4 text-sm">
          <Link href="/reportes" className="text-gray-500 hover:text-gray-900 transition-colors">
            Reporte Gerencial
          </Link>
          <span className="font-semibold text-blue-600 border-b-2 border-blue-600 pb-1">
            Reporte Contable
          </span>
        </div>

        <div className="no-print flex gap-4 mb-6 border-b border-gray-200">
          <button 
            onClick={() => setTab("pendientes")}
            className={`pb-2 px-1 font-medium transition-colors ${tab === "pendientes" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700"}`}
          >
            Nuevos (Pendientes por Enviar)
          </button>
          <button 
            onClick={() => {
              setTab("historial")
              if (!loteSeleccionado && lotes.length > 0) setLoteSeleccionado(lotes[0].id)
            }}
            className={`pb-2 px-1 font-medium transition-colors flex items-center ${tab === "historial" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700"}`}
          >
            <History className="w-4 h-4 mr-1" />
            Historial de Reportes
          </button>
        </div>

        <div className="flex gap-6 relative">
          
          {/* Sidebar de Lotes (Solo en Historial) */}
          {tab === "historial" && (
            <div className="w-64 shrink-0 no-print">
              <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-3">Lotes Guardados</h2>
              <div className="flex flex-col gap-2">
                {lotes.length === 0 ? (
                  <p className="text-sm text-gray-500">No hay lotes en el historial.</p>
                ) : (
                  lotes.map(lote => (
                    <button
                      key={lote.id}
                      onClick={() => setLoteSeleccionado(lote.id)}
                      className={`text-left px-3 py-3 rounded-lg border text-sm transition-colors ${loteSeleccionado === lote.id ? "bg-blue-50 border-blue-200" : "bg-white border-gray-200 hover:bg-gray-50"}`}
                    >
                      <div className="font-medium text-gray-900">{lote.id}</div>
                      <div className="text-gray-500 text-xs mt-1">{lote.fechaGeneracion.toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })}</div>
                      <div className="text-gray-400 text-xs mt-0.5">{lote.totalLineas} artículos</div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Contenido Principal */}
          <div className="flex-1 overflow-hidden min-w-0">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 no-print gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {tab === "pendientes" ? "Compras Pendientes de Enviar" : `Reporte ${loteSeleccionado || ""}`}
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  {tab === "pendientes" 
                    ? "Todas las compras no enviadas. Revisa y guarda el lote al finalizar."
                    : "Modo solo lectura. Visualizando un lote cerrado del historial."}
                </p>
              </div>
              
              <div className="flex flex-wrap items-center gap-3">
                {/* Selector de moneda */}
                {monedas.length > 1 && (
                  <select 
                    value={monedaActiva} 
                    onChange={e => setMoneda(e.target.value)}
                    className="rounded-lg border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                     className="flex items-center rounded-lg bg-amber-100 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-200 transition-colors"
                   >
                     {procesandoIa ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                     {procesandoIa && progresoIa
                       ? `Procesando ${progresoIa.actual}/${progresoIa.total}...`
                       : `Completar faltantes (${lineasConFaltantes})`}
                   </button>
                )}
                
                {tab === "pendientes" && ordenesFiltradas.length > 0 && (
                  <button
                    onClick={handleGuardarLote}
                    disabled={guardandoLote || procesandoIa}
                    className="flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
                  >
                    {guardandoLote ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                    Cerrar Reporte
                  </button>
                )}

                <button onClick={exportarExcel} className="flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors">
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Excel
                </button>
                <button onClick={imprimirPDF} className="flex items-center rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-900 transition-colors">
                  <Printer className="h-4 w-4 mr-2" />
                  PDF
                </button>
              </div>
            </div>

            {resultadoIa && (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 no-print">
                {resultadoIa}
              </div>
            )}

            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm print:rounded-none print:border-0 print:shadow-none print:overflow-visible">
              <div className="overflow-x-auto print:overflow-visible">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500 print:bg-white print:text-black print:border-b-2 print:border-black">
                    <tr>
                      <th className="px-4 py-3">Fecha</th>
                      <th className="px-4 py-3">Proveedor / Factura</th>
                      <th className="px-4 py-3">Descripción Simplificada</th>
                      <th className="px-4 py-3">Clave SAT</th>
                      <th className="px-4 py-3 text-right">Cant.</th>
                      <th className="px-4 py-3 text-right">Precio U.</th>
                      <th className="px-4 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 print:divide-gray-300">
                    {lineas.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center">
                          {tab === "pendientes" ? (
                            <div className="text-gray-500">
                              <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-400 mb-3" />
                              <p className="text-lg font-medium text-gray-900">¡Todo al día!</p>
                              <p>No hay compras pendientes por enviar a la contadora.</p>
                            </div>
                          ) : (
                            <p className="text-gray-500">Selecciona un lote del historial para ver sus compras.</p>
                          )}
                        </td>
                      </tr>
                    ) : (
                      lineas.map((l, i) => (
                        <tr key={`${l.ordenId}-${i}`} className="hover:bg-gray-50 print:hover:bg-transparent">
                          <td className="px-4 py-3 whitespace-nowrap">
                            {l.dia ? l.dia.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" }) : "-"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">{l.proveedor}</div>
                            <div className="text-xs text-gray-400">Ref: {l.referencia}</div>
                          </td>
                          <td className="px-4 py-3 max-w-xs">
                            {l.descripcionSimplificada ? (
                              <span className="font-medium text-gray-900">{l.descripcionSimplificada}</span>
                            ) : (
                              <span className="text-gray-400 italic" title={l.descripcion}>
                                {l.descripcion.length > 50 ? l.descripcion.substring(0, 50) + "..." : l.descripcion}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 max-w-xs">
                            <div className="font-medium text-gray-900">{l.claveProdServ || "—"}</div>
                            {!l.claveProdServ && (
                              <span className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 print:hidden">
                                Revisar
                              </span>
                            )}
                            <div className="text-xs text-gray-500 truncate" title={satDict[l.claveProdServ || ""]}>
                              {cargandoSat && l.claveProdServ && !satDict[l.claveProdServ] 
                                ? "Cargando..." 
                                : satDict[l.claveProdServ || ""] || ""}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-medium">
                            {l.cantidad !== null ? l.cantidad : "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {l.precioUnitario !== null 
                              ? new Intl.NumberFormat("es-MX", { style: "currency", currency: monedaActiva }).format(l.precioUnitario) 
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900">
                            {new Intl.NumberFormat("es-MX", { style: "currency", currency: monedaActiva }).format(l.total)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {lineas.length > 0 && (
                    <tfoot className="bg-gray-50 font-bold text-gray-900 print:bg-white print:border-t-2 print:border-black">
                      <tr>
                        <td colSpan={6} className="px-4 py-3 text-right uppercase text-xs text-gray-500 print:text-black">
                          Total ({monedaActiva})
                        </td>
                        <td className="px-4 py-3 text-right text-base">
                          {new Intl.NumberFormat("es-MX", { style: "currency", currency: monedaActiva }).format(
                            lineas.reduce((acc, curr) => acc + curr.total, 0)
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
            
          </div>
        </div>

      </div>
    </div>
  )
}
