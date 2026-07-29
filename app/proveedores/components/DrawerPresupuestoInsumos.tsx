'use client'

import { useState } from 'react'
import { ShoppingCart, Download, Trash2, X, Plus, Minus, Building2, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatPrecio } from '@/lib/format'
import type { PartidaPresupuesto } from '@/lib/hooks/usePresupuestoInsumos'
import type { CompraOdooItem } from '@/lib/schemas'

type Props = {
  partidas: PartidaPresupuesto[]
  totalMxn: number
  totalUsd: number
  totalPartidas: number
  onActualizarCantidad: (id: string, nuevaCantidad: number) => void
  onRemoverPartida: (id: string) => void
  onCambiarProveedor: (id: string, proveedorNombre: string, precioUnitario: number, moneda: string) => void
  onLimpiarTodo: () => void
  onExportarAExcel: () => void
  todosLosItems: CompraOdooItem[]
}

export default function DrawerPresupuestoInsumos({
  partidas,
  totalMxn,
  totalUsd,
  totalPartidas,
  onActualizarCantidad,
  onRemoverPartida,
  onCambiarProveedor,
  onLimpiarTodo,
  onExportarAExcel,
  todosLosItems,
}: Props) {
  const [abierto, setAbierto] = useState(false)

  if (totalPartidas === 0 && !abierto) {
    return null
  }

  // Encontrar proveedores alternativos para un ítem determinado
  function alternativasParaItem(itemId: string, descripcion: string) {
    const descNorm = descripcion.toLowerCase().trim()
    const matches = todosLosItems.filter(
      (it) => it.descripcion.toLowerCase().trim() === descNorm && it.precioUnitario > 0
    )

    // Agrupar por proveedor y tomar la compra más reciente
    const porProv = new Map<string, CompraOdooItem>()
    for (const m of matches) {
      if (!porProv.has(m.proveedorNombre)) {
        porProv.set(m.proveedorNombre, m)
      }
    }
    return Array.from(porProv.values())
  }

  return (
    <>
      {/* Botón / Barra flotante en la esquina inferior derecha */}
      <div className="fixed bottom-5 right-5 z-40">
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-slate-900 to-sky-950 text-white rounded-full shadow-2xl hover:scale-105 transition-all border border-sky-400/30 group"
        >
          <div className="relative">
            <ShoppingCart className="h-5 w-5 text-sky-400" />
            <span className="absolute -top-2 -right-2 bg-emerald-500 text-slate-950 font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center">
              {totalPartidas}
            </span>
          </div>

          <div className="text-left font-mono">
            <p className="text-xs font-extrabold text-white">Presupuesto de Materiales</p>
            <p className="text-[11px] text-emerald-400 font-bold">
              {formatPrecio(totalMxn, 'MXN')} · {formatPrecio(totalUsd, 'USD')}
            </p>
          </div>

          <ChevronRight className="h-4 w-4 text-sky-400 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      {/* Drawer Overlay y Modal */}
      {abierto && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-300">
            {/* Header del Drawer */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <ShoppingCart className="h-5 w-5 text-sky-400" />
                <div>
                  <h2 className="text-sm font-extrabold">Presupuesto de Insumos</h2>
                  <p className="text-xs text-slate-400">
                    {totalPartidas} {totalPartidas === 1 ? 'partida agregada' : 'partidas agregadas'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Cuerpo del Drawer: Lista de Partidas */}
            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              {partidas.length === 0 ? (
                <div className="text-center py-16 space-y-2 text-slate-400">
                  <ShoppingCart className="h-12 w-12 mx-auto text-slate-300 stroke-1" />
                  <p className="text-sm font-bold text-slate-600">El presupuesto está vacío</p>
                  <p className="text-xs text-slate-400">
                    Agrega materiales desde la tabla comparativa o búsqueda.
                  </p>
                </div>
              ) : (
                partidas.map((p) => {
                  const alternativas = alternativasParaItem(p.itemId, p.descripcion)

                  return (
                    <div
                      key={p.id}
                      className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-extrabold text-slate-900 line-clamp-2">
                            {p.descripcion}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-[9px] font-mono">
                              {p.categoriaId}
                            </Badge>
                            {p.medida && (
                              <span className="text-[10px] font-mono text-slate-500">
                                Medida: {p.medida}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => onRemoverPartida(p.id)}
                          className="text-slate-400 hover:text-red-600 p-1 transition-colors"
                          title="Eliminar partida"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Proveedor y Alternativas */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200 text-xs">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-slate-500" />
                          {alternativas.length > 1 ? (
                            <select
                              value={p.proveedorNombre}
                              onChange={(e) => {
                                const alt = alternativas.find(
                                  (a) => a.proveedorNombre === e.target.value
                                )
                                if (alt) {
                                  onCambiarProveedor(
                                    p.id,
                                    alt.proveedorNombre,
                                    alt.precioUnitario,
                                    alt.moneda
                                  )
                                }
                              }}
                              className="rounded border border-slate-300 text-xs py-0.5 px-1.5 font-semibold bg-white text-slate-800"
                            >
                              {alternativas.map((alt) => (
                                <option key={alt.id} value={alt.proveedorNombre}>
                                  {alt.proveedorNombre} ({formatPrecio(alt.precioUnitario, alt.moneda === 'USD' ? 'USD' : 'MXN')})
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="font-bold text-slate-700">{p.proveedorNombre}</span>
                          )}
                        </div>

                        {/* Control de Cantidad y Precio */}
                        <div className="flex items-center gap-3">
                          <div className="flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden">
                            <button
                              type="button"
                              onClick={() => onActualizarCantidad(p.id, p.cantidad - 1)}
                              className="px-2 py-1 text-slate-600 hover:bg-slate-100 font-bold"
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="px-2 py-0.5 font-mono font-extrabold text-xs text-slate-900 min-w-[24px] text-center">
                              {p.cantidad}
                            </span>
                            <button
                              type="button"
                              onClick={() => onActualizarCantidad(p.id, p.cantidad + 1)}
                              className="px-2 py-1 text-slate-600 hover:bg-slate-100 font-bold"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>

                          <div className="text-right font-mono">
                            <p className="text-xs font-extrabold text-slate-900">
                              {formatPrecio(p.subtotal, p.moneda === 'USD' ? 'USD' : 'MXN')}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              ({formatPrecio(p.precioUnitario, p.moneda === 'USD' ? 'USD' : 'MXN')} c/u)
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Footer con Totales y Botones de Exportación */}
            {partidas.length > 0 && (
              <div className="p-4 bg-slate-100 border-t border-slate-200 space-y-3">
                <div className="grid grid-cols-2 gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs font-mono">
                  <div className="bg-emerald-50 border border-emerald-100 p-2.5 rounded-lg">
                    <p className="text-[10px] font-extrabold uppercase text-emerald-700">
                      Total MXN Estimado
                    </p>
                    <p className="text-lg font-black text-emerald-950 mt-0.5">
                      {formatPrecio(totalMxn, 'MXN')}
                    </p>
                  </div>

                  <div className="bg-sky-50 border border-sky-100 p-2.5 rounded-lg">
                    <p className="text-[10px] font-extrabold uppercase text-sky-700">
                      Total USD Estimado
                    </p>
                    <p className="text-lg font-black text-sky-950 mt-0.5">
                      {formatPrecio(totalUsd, 'USD')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onExportarAExcel}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl shadow-xs transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    Exportar a Excel (.csv)
                  </button>

                  <button
                    type="button"
                    onClick={onLimpiarTodo}
                    className="p-2.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-slate-300"
                    title="Vaciar presupuesto"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
