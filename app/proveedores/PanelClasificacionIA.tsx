'use client'

import { useState } from 'react'
import { Sparkles, Check, CheckCheck, X, RefreshCw, AlertCircle, Edit2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { getClienteAuth } from '@/lib/firebase'
import type { CompraOdooItem } from '@/lib/schemas'
import { CATEGORIAS_PRODUCTO_REGISTRO } from '@/lib/compras-odoo'
import type { ClasificacionIA } from '@/lib/compras-odoo/clasificar-items-ia'
import {
  aprobarYGuardarClasificacion,
  cargarMapeosClasificacion,
  aplicarMapeosAprobados,
} from '@/lib/compras-odoo/mapeos-clasificacion'

type ItemSugerido = {
  item: CompraOdooItem
  clasificacion: ClasificacionIA
  categoriaEditada: string
  tipoEditado: string
  medidaEditada: string
  estado: 'pendiente' | 'guardando' | 'aprobado' | 'error'
  error?: string
}

type Props = {
  items: CompraOdooItem[]
  onActualizado: () => Promise<void>
}

export default function PanelClasificacionIA({ items, onActualizado }: Props) {
  const [sugerencias, setSugerencias] = useState<ItemSugerido[]>([])
  const [procesando, setProcesando] = useState(false)
  const [mensajeGlobal, setMensajeGlobal] = useState<string | null>(null)
  const [itemsAutoAprobados, setItemsAutoAprobados] = useState(0)

  const itemsSinClasificar = items.filter((i) => i.categoriaId === 'otros')

  async function clasificarConIa() {
    setProcesando(true)
    setMensajeGlobal(null)
    setItemsAutoAprobados(0)

    try {
      // 1. Cargar mapeos aprobados previamente desde Firestore
      const mapeosExistentes = await cargarMapeosClasificacion()

      // Convertir CompraOdooItem a CompraOdooItemNormalizado para la función de match
      const itemsNormalizados = itemsSinClasificar.map((i) => ({
        ...i,
        tipoInsumo: i.tipoInsumo ?? i.tipoMetal ?? null,
        odooCategoria: i.odooCategoria ?? null,
        odooUom: i.odooUom ?? null,
        odooCostoEstandar: i.odooCostoEstandar ?? null,
        odooRefInterna: i.odooRefInterna ?? null,
        clasificadoPorIa: i.clasificadoPorIa ?? false,
      }))

      const { aplicados, pendientes } = aplicarMapeosAprobados(itemsNormalizados, mapeosExistentes)

      // Auto-aplicar coincidencia exacta de mapeos existentes
      let autoCount = 0
      const currentUserEmail = getClienteAuth().currentUser?.email ?? 'usuario'
      for (const match of aplicados) {
        await aprobarYGuardarClasificacion({
          itemId: match.item.id,
          descripcion: match.item.descripcion,
          categoriaId: match.mapeo.categoriaId,
          tipoInsumo: match.mapeo.tipoInsumo,
          medida: match.mapeo.medida,
          aprobadoPor: currentUserEmail,
        })
        autoCount++
      }
      setItemsAutoAprobados(autoCount)

      if (pendientes.length === 0) {
        if (autoCount > 0) {
          setMensajeGlobal(`¡Se auto-clasificaron ${autoCount} ítems con mapeos previos!`)
          await onActualizado()
        } else {
          setMensajeGlobal('No hay ítems en "Otros" pendientes por clasificar.')
        }
        return
      }

      // 2. Enviar los pendientes (máximo 50 por lote) a la API con Gemini
      const loteBatch = pendientes.slice(0, 50).map((i) => ({
        id: i.id,
        descripcion: i.descripcion,
        proveedorNombre: i.proveedorNombre,
        odooCategoria: i.odooCategoria ?? null,
      }))

      const idToken = await getClienteAuth().currentUser?.getIdToken()
      const res = await fetch('/api/clasificar-items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({ items: loteBatch }),
      })

      if (!res.ok) {
        const errorData = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(errorData.error || `HTTP ${res.status}`)
      }

      const data = (await res.json()) as {
        items: Array<{ id: string; clasificacion: ClasificacionIA }>
      }

      const itemMap = new Map(itemsSinClasificar.map((i) => [i.id, i]))
      const nuevasSugerencias: ItemSugerido[] = []

      for (const resItem of data.items) {
        const originalItem = itemMap.get(resItem.id)
        if (!originalItem) continue
        nuevasSugerencias.push({
          item: originalItem,
          clasificacion: resItem.clasificacion,
          categoriaEditada: resItem.clasificacion.categoriaId,
          tipoEditado: resItem.clasificacion.tipoInsumo ?? '',
          medidaEditada: resItem.clasificacion.medida ?? '',
          estado: 'pendiente',
        })
      }

      setSugerencias(nuevasSugerencias)
      if (nuevasSugerencias.length === 0) {
        setMensajeGlobal('Gemini no generó sugerencias para el lote actual.')
      }
    } catch (err) {
      setMensajeGlobal(err instanceof Error ? err.message : 'Error al clasificar con IA')
    } finally {
      setProcesando(false)
    }
  }

  async function aprobarFila(sugIndex: number) {
    const sug = sugerencias[sugIndex]
    if (!sug || sug.estado === 'guardando') return

    // Actualizar estado a guardando
    setSugerencias((prev) =>
      prev.map((s, idx) => (idx === sugIndex ? { ...s, estado: 'guardando' } : s))
    )

    try {
      const currentUserEmail = getClienteAuth().currentUser?.email ?? 'usuario'
      await aprobarYGuardarClasificacion({
        itemId: sug.item.id,
        descripcion: sug.item.descripcion,
        categoriaId: sug.categoriaEditada,
        tipoInsumo: sug.tipoEditado || null,
        medida: sug.medidaEditada || null,
        aprobadoPor: currentUserEmail,
      })

      setSugerencias((prev) =>
        prev.map((s, idx) => (idx === sugIndex ? { ...s, estado: 'aprobado' } : s))
      )
      await onActualizado()
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error al guardar'
      setSugerencias((prev) =>
        prev.map((s, idx) => (idx === sugIndex ? { ...s, estado: 'error', error: errorMsg } : s))
      )
    }
  }

  async function aprobarTodasAltaConfianza() {
    const indices = sugerencias
      .map((s, idx) => ({ sug: s, idx }))
      .filter(({ sug }) => sug.estado === 'pendiente' && sug.clasificacion.confianza >= 0.8)
      .map(({ idx }) => idx)

    for (const i of indices) {
      await aprobarFila(i)
    }
  }

  function descartarFila(sugIndex: number) {
    setSugerencias((prev) => prev.filter((_, idx) => idx !== sugIndex))
  }

  if (itemsSinClasificar.length === 0 && sugerencias.length === 0) {
    return null
  }

  return (
    <div className="bg-gradient-to-r from-sky-50 via-slate-50 to-emerald-50 border border-sky-200 rounded-xl p-4 shadow-xs space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-sky-600 text-white rounded-lg shadow-xs">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              Clasificación Inteligente IA
              <Badge variant="secondary" className="bg-sky-100 text-sky-800 font-mono text-[10px]">
                Gemini 3.5 Flash Lite
              </Badge>
            </h3>
            <p className="text-xs text-slate-600">
              Hay{' '}
              <span className="font-bold text-sky-700">{itemsSinClasificar.length} ítems</span> en
              &quot;Otros&quot; sin categoría asignada.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void clasificarConIa()}
          disabled={procesando}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 disabled:opacity-60 text-white text-xs font-bold rounded-lg shadow-xs transition-all"
        >
          <RefreshCw className={`h-4 w-4 ${procesando ? 'animate-spin' : ''}`} />
          {procesando ? 'Analizando con IA…' : 'Clasificar con IA'}
        </button>
      </div>

      {mensajeGlobal && (
        <div className="rounded-lg border border-sky-200 bg-white p-3 text-xs text-slate-700 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-sky-600 shrink-0 mt-0.5" />
          <div>
            <span>{mensajeGlobal}</span>
            {itemsAutoAprobados > 0 && (
              <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">
                ✅ {itemsAutoAprobados} ítems auto-clasificados con mapeos previos en Firestore.
              </p>
            )}
          </div>
        </div>
      )}

      {sugerencias.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-2.5 rounded-lg border border-slate-200">
            <span className="text-xs font-bold text-slate-700">
              Sugerencias recibidas ({sugerencias.filter((s) => s.estado === 'pendiente').length}{' '}
              pendientes)
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void aprobarTodasAltaConfianza()}
                className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-md transition-colors"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Aprobar Alta Confianza (≥80%)
              </button>
              <button
                type="button"
                onClick={() => setSugerencias([])}
                className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 underline px-2"
              >
                Cerrar sugerencias
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-left text-[11px]">
                <thead className="sticky top-0 bg-slate-100 text-slate-600 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-2">Descripción Producto</th>
                    <th className="px-3 py-2">Categoría Sugerida</th>
                    <th className="px-3 py-2">Tipo Insumo</th>
                    <th className="px-3 py-2">Medida</th>
                    <th className="px-3 py-2 text-center">Confianza</th>
                    <th className="px-3 py-2 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sugerencias.map((sug, idx) => (
                    <tr
                      key={sug.item.id}
                      className={`hover:bg-slate-50 ${sug.estado === 'aprobado' ? 'bg-emerald-50/50' : ''}`}
                    >
                      <td className="px-3 py-2 max-w-[240px]">
                        <p className="font-semibold text-slate-900 truncate" title={sug.item.descripcion}>
                          {sug.item.descripcion}
                        </p>
                        {sug.item.odooCategoria && (
                          <p className="text-[10px] text-slate-400 font-mono truncate">
                            Cat Odoo: {sug.item.odooCategoria}
                          </p>
                        )}
                      </td>

                      <td className="px-3 py-2">
                        <select
                          value={sug.categoriaEditada}
                          disabled={sug.estado !== 'pendiente'}
                          onChange={(e) => {
                            const val = e.target.value
                            setSugerencias((prev) =>
                              prev.map((s, i) => (i === idx ? { ...s, categoriaEditada: val } : s))
                            )
                          }}
                          className="rounded border border-slate-300 px-2 py-1 text-xs bg-white focus:ring-1 focus:ring-sky-500 font-medium"
                        >
                          {CATEGORIAS_PRODUCTO_REGISTRO.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.etiqueta}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={sug.tipoEditado}
                          disabled={sug.estado !== 'pendiente'}
                          placeholder="ej. acero_1018, fresa"
                          onChange={(e) => {
                            const val = e.target.value
                            setSugerencias((prev) =>
                              prev.map((s, i) => (i === idx ? { ...s, tipoEditado: val } : s))
                            )
                          }}
                          className="w-28 rounded border border-slate-300 px-2 py-1 text-xs bg-white font-mono focus:ring-1 focus:ring-sky-500"
                        />
                      </td>

                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={sug.medidaEditada}
                          disabled={sug.estado !== 'pendiente'}
                          placeholder='ej. 1/4" x 2"'
                          onChange={(e) => {
                            const val = e.target.value
                            setSugerencias((prev) =>
                              prev.map((s, i) => (i === idx ? { ...s, medidaEditada: val } : s))
                            )
                          }}
                          className="w-24 rounded border border-slate-300 px-2 py-1 text-xs bg-white font-mono focus:ring-1 focus:ring-sky-500"
                        />
                      </td>

                      <td className="px-3 py-2 text-center font-mono">
                        <Badge
                          variant="outline"
                          className={
                            sug.clasificacion.confianza >= 0.8
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : sug.clasificacion.confianza >= 0.6
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-red-50 text-red-700 border-red-200'
                          }
                        >
                          {Math.round(sug.clasificacion.confianza * 100)}%
                        </Badge>
                      </td>

                      <td className="px-3 py-2 text-right">
                        {sug.estado === 'pendiente' && (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => void aprobarFila(idx)}
                              title="Aprobar clasificación"
                              className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => descartarFila(idx)}
                              title="Descartar"
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded transition-colors"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                        {sug.estado === 'guardando' && (
                          <span className="text-xs text-sky-600 font-semibold flex items-center justify-end gap-1">
                            <RefreshCw className="h-3 w-3 animate-spin" /> Guardando…
                          </span>
                        )}
                        {sug.estado === 'aprobado' && (
                          <span className="text-xs text-emerald-600 font-bold flex items-center justify-end gap-1">
                            <Check className="h-3.5 w-3.5" /> Aprobado
                          </span>
                        )}
                        {sug.estado === 'error' && (
                          <span
                            className="text-xs text-red-600 font-semibold truncate max-w-[100px]"
                            title={sug.error}
                          >
                            Error
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
