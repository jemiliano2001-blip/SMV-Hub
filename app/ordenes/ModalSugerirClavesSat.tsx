'use client'

import { useState, useEffect, Fragment } from 'react'
import { Loader2, X, Search, Check, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import type { OrdenCompra, ItemFactura } from '@/lib/schemas'
import { normalizarClaveProdServ } from '@/lib/sat/normalizar'
import { actualizarClavesSatLote } from '@/lib/ordenes'
import { getClienteAuth } from '@/lib/firebase'
import { extraerEntradasHistorialSat } from '@/lib/sat/extraer-historial-ordenes'
import { guardarAsignacionesSatValidadas } from '@/lib/sat/mapeos-persistir'
import type { AlternativaSat } from '@/lib/sat/types'

type SugerenciaApi = {
  claveProdServ: string | null
  descripcionSat: string | null
  confianza: 'alta' | 'media' | 'baja'
  motivo: string
  fuente: string
  terminosBusqueda?: string
  alternativas?: AlternativaSat[]
}

export type FilaSugerenciaSat = {
  ordenId: string
  ordenProveedor: string
  itemIndex: number
  descripcion: string
  claveProdServ: string
  descripcionSat: string | null
  confianza: 'alta' | 'media' | 'baja'
  motivo: string
  fuente: string
  terminosBusqueda: string
  alternativas: AlternativaSat[]
  aplicar: boolean
  buscando: boolean
  mostrarAlternativas: boolean
}

interface Props {
  ordenes: OrdenCompra[]
  historialOrdenes: OrdenCompra[]
  onClose: () => void
  onApplied: (ordenesActualizadas: OrdenCompra[]) => void
}

function confianzaClase(confianza: FilaSugerenciaSat['confianza']): string {
  switch (confianza) {
    case 'alta':
      return 'bg-green-100 text-green-800'
    case 'media':
      return 'bg-yellow-100 text-yellow-800'
    default:
      return 'bg-red-100 text-red-800'
  }
}

function necesitaAdvertencia(fila: FilaSugerenciaSat): boolean {
  return (
    fila.confianza !== 'alta' &&
    (fila.fuente === 'glosario' || fila.fuente === 'traduccion' || fila.fuente === 'ia_rag')
  )
}

function itemsPendientes(orden: OrdenCompra): number[] {
  return (orden.items ?? [])
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.satPendiente !== false && !normalizarClaveProdServ(item.claveProdServ))
    .map(({ index }) => index)
}

export default function ModalSugerirClavesSat({
  ordenes,
  historialOrdenes,
  onClose,
  onApplied,
}: Props) {
  const [filas, setFilas] = useState<FilaSugerenciaSat[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function cargarSugerencias() {
      setLoading(true)
      setError(null)

      const pendientes: Array<{ orden: OrdenCompra; itemIndex: number }> = []
      for (const orden of ordenes) {
        for (const idx of itemsPendientes(orden)) {
          pendientes.push({ orden, itemIndex: idx })
        }
      }

      if (pendientes.length === 0) {
        if (!cancelled) {
          setFilas([])
          setLoading(false)
        }
        return
      }

      try {
        const auth = getClienteAuth()
        const token = await auth.currentUser?.getIdToken()

        const items = pendientes.map(({ orden, itemIndex }) => ({
          descripcion: orden.items[itemIndex].descripcion,
          proveedor: orden.proveedor,
        }))

        const historialEntradas = extraerEntradasHistorialSat(historialOrdenes)

        const res = await fetch('/api/sugerir-clave-sat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ items, historialEntradas }),
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Error al obtener sugerencias')

        const sugerencias = data.sugerencias as SugerenciaApi[]
        if (!cancelled) {
          setFilas(
            pendientes.map(({ orden, itemIndex }, i) => {
              const sug = sugerencias[i]
              const tieneClave = Boolean(sug?.claveProdServ)
              return {
                ordenId: orden.id,
                ordenProveedor: orden.proveedor,
                itemIndex,
                descripcion: orden.items[itemIndex].descripcion,
                claveProdServ: sug?.claveProdServ ?? '',
                descripcionSat: sug?.descripcionSat ?? null,
                confianza: sug?.confianza ?? 'baja',
                motivo: sug?.motivo ?? 'Sin sugerencia',
                fuente: sug?.fuente ?? 'manual',
                terminosBusqueda: sug?.terminosBusqueda ?? '',
                alternativas: sug?.alternativas ?? [],
                aplicar: tieneClave && sug?.confianza === 'alta',
                buscando: false,
                mostrarAlternativas: (sug?.alternativas?.length ?? 0) > 0,
              }
            })
          )
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error desconocido')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void cargarSugerencias()
    return () => {
      cancelled = true
    }
  }, [ordenes, historialOrdenes, reloadKey])

  const actualizarFila = (index: number, cambios: Partial<FilaSugerenciaSat>) => {
    setFilas((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...cambios } : f))
    )
  }

  const aplicarAlternativa = (filaIndex: number, alt: AlternativaSat) => {
    actualizarFila(filaIndex, {
      claveProdServ: alt.clave,
      descripcionSat: alt.descripcionSat,
      confianza: 'media',
      motivo: 'Alternativa seleccionada manualmente',
      fuente: 'manual',
      aplicar: true,
    })
  }

  const buscarClaveInline = async (filaIndex: number, query: string) => {
    if (!query.trim()) return
    actualizarFila(filaIndex, { buscando: true })
    try {
      const params = new URLSearchParams({ q: query.trim(), limit: '5' })
      const token = await getClienteAuth().currentUser?.getIdToken()
      const res = await fetch(`/api/claves-sat?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      const data = await res.json()
      const top = data.results?.[0]
      if (top) {
        actualizarFila(filaIndex, {
          claveProdServ: top.entry.clave,
          descripcionSat: top.entry.descripcion,
          confianza: 'media',
          motivo: 'Selección manual del catálogo',
          fuente: 'manual',
          aplicar: true,
          buscando: false,
        })
      } else {
        actualizarFila(filaIndex, { buscando: false })
      }
    } catch {
      actualizarFila(filaIndex, { buscando: false })
    }
  }

  const handleAplicar = async () => {
    const filasAplicar = filas.filter((f) => f.aplicar && normalizarClaveProdServ(f.claveProdServ))
    if (filasAplicar.length === 0) {
      setError('Selecciona al menos una fila con una clave SAT válida de 8 dígitos.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const porOrden = new Map<string, Map<number, string>>()
      for (const fila of filasAplicar) {
        const clave = normalizarClaveProdServ(fila.claveProdServ)
        if (!clave) continue
        if (!porOrden.has(fila.ordenId)) porOrden.set(fila.ordenId, new Map())
        porOrden.get(fila.ordenId)!.set(fila.itemIndex, clave)
      }

      const actualizaciones: Array<{ ordenId: string; items: ItemFactura[] }> = []
      const ordenesActualizadas: OrdenCompra[] = []

      for (const orden of ordenes) {
        const cambios = porOrden.get(orden.id)
        if (!cambios) continue

        const itemsActualizados = orden.items.map((item, idx) => {
          const nuevaClave = cambios.get(idx)
          if (!nuevaClave) return item
          return {
            ...item,
            claveProdServ: nuevaClave,
            satPendiente: false,
          }
        })

        actualizaciones.push({ ordenId: orden.id, items: itemsActualizados })
        ordenesActualizadas.push({
          ...orden,
          items: itemsActualizados,
          actualizadoEn: new Date(),
        })
      }

      await actualizarClavesSatLote(actualizaciones)

      const auth = getClienteAuth()
      const email = auth.currentUser?.email ?? undefined
      try {
        await guardarAsignacionesSatValidadas(
          filasAplicar.map((f) => ({
            descripcion: f.descripcion,
            claveProdServ: normalizarClaveProdServ(f.claveProdServ)!,
            validadoPor: email,
          }))
        )
      } catch {
        // No bloquear si falla el mapeo auxiliar
      }

      onApplied(ordenesActualizadas)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron guardar las claves')
    } finally {
      setSaving(false)
    }
  }

  const filasConClave = filas.filter((f) => f.aplicar && normalizarClaveProdServ(f.claveProdServ)).length

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col my-8">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Sugerir claves SAT</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Solo se preseleccionan sugerencias de confianza alta. Revisa media/baja antes de aplicar.
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-3" />
              <p className="text-sm">Generando sugerencias…</p>
            </div>
          ) : error ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-gray-600">No se pudieron generar sugerencias automáticas.</p>
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  setReloadKey((k) => k + 1)
                }}
                className="text-sm font-semibold text-blue-600 hover:text-blue-700 underline underline-offset-2"
              >
                Reintentar
              </button>
            </div>
          ) : filas.length === 0 ? (
            <p className="text-center text-gray-500 py-12 text-sm">
              No hay ítems pendientes de clave SAT en las órdenes seleccionadas.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                  <tr>
                    <th className="px-3 py-2 w-10">✓</th>
                    <th className="px-3 py-2">Proveedor</th>
                    <th className="px-3 py-2">Descripción (EN)</th>
                    <th className="px-3 py-2 w-28">Clave SAT</th>
                    <th className="px-3 py-2">Descripción SAT</th>
                    <th className="px-3 py-2 w-20">Conf.</th>
                    <th className="px-3 py-2">Motivo</th>
                    <th className="px-3 py-2 w-36">Buscar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filas.map((fila, index) => (
                    <Fragment key={`${fila.ordenId}-${fila.itemIndex}`}>
                      <tr className="hover:bg-gray-50">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={fila.aplicar}
                            onChange={(e) => actualizarFila(index, { aplicar: e.target.checked })}
                            className="rounded border-gray-300 text-blue-600"
                          />
                        </td>
                        <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{fila.ordenProveedor}</td>
                        <td className="px-3 py-2 text-gray-900 max-w-[200px]">
                          <div className="truncate" title={fila.descripcion}>
                            {fila.descripcion}
                          </div>
                          {necesitaAdvertencia(fila) && (
                            <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                              <AlertTriangle className="h-3 w-3" />
                              Revisar
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={fila.claveProdServ}
                            onChange={(e) => {
                              actualizarFila(index, {
                                claveProdServ: e.target.value,
                                fuente: 'manual',
                              })
                            }}
                            placeholder="8 dígitos"
                            className="w-full rounded border border-gray-300 px-2 py-1 text-xs font-mono focus:border-blue-400 focus:outline-none"
                          />
                        </td>
                        <td className="px-3 py-2 text-gray-600 text-xs max-w-[180px] truncate" title={fila.descripcionSat ?? ''}>
                          {fila.descripcionSat ?? '—'}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${confianzaClase(fila.confianza)}`}>
                            {fila.confianza}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-500 max-w-[160px]">
                          <div className="truncate" title={fila.motivo}>
                            {fila.motivo}
                          </div>
                          {fila.alternativas.length > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                actualizarFila(index, { mostrarAlternativas: !fila.mostrarAlternativas })
                              }
                              className="mt-1 flex items-center gap-0.5 text-blue-600 hover:text-blue-700 text-[10px] font-semibold"
                            >
                              {fila.mostrarAlternativas ? (
                                <ChevronUp className="h-3 w-3" />
                              ) : (
                                <ChevronDown className="h-3 w-3" />
                              )}
                              {fila.alternativas.length} alternativa(s)
                            </button>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <form
                            className="flex gap-1"
                            onSubmit={(e) => {
                              e.preventDefault()
                              const input = e.currentTarget.elements.namedItem('q') as HTMLInputElement
                              void buscarClaveInline(index, input.value)
                            }}
                          >
                            <input
                              name="q"
                              key={`q-${fila.terminosBusqueda || fila.descripcion}`}
                              placeholder="Buscar…"
                              defaultValue={fila.terminosBusqueda || fila.descripcion.slice(0, 40)}
                              className="flex-1 min-w-0 rounded border border-gray-300 px-1.5 py-1 text-xs focus:border-blue-400 focus:outline-none"
                            />
                            <button
                              type="submit"
                              disabled={fila.buscando}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded disabled:opacity-50"
                              title="Buscar en catálogo"
                            >
                              {fila.buscando ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Search className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </form>
                        </td>
                      </tr>
                      {fila.mostrarAlternativas && fila.alternativas.length > 0 && (
                        <tr className="bg-blue-50/50">
                          <td colSpan={8} className="px-3 py-2">
                            <div className="flex flex-wrap gap-2">
                              {fila.alternativas.map((alt) => (
                                <button
                                  key={alt.clave}
                                  type="button"
                                  onClick={() => aplicarAlternativa(index, alt)}
                                  className="text-left rounded border border-blue-200 bg-white px-2 py-1 text-xs hover:border-blue-400 hover:bg-blue-50"
                                >
                                  <span className="font-mono font-semibold text-blue-800">{alt.clave}</span>
                                  <span className="text-gray-600 ml-1.5">{alt.descripcionSat}</span>
                                </button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-gray-200 px-6 py-4 bg-gray-50 rounded-b-xl shrink-0">
          <p className="text-xs text-gray-500">
            {filasConClave} de {filas.length} filas listas para aplicar
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              type="button"
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={() => void handleAplicar()}
              disabled={saving || loading || filasConClave === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Aplicar seleccionadas
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
