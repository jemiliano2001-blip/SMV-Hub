'use client'

import { useState } from 'react'
import { RefreshCw, Ghost } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { Proveedor } from '@/lib/schemas'
import {
  backfillProveedorIdEnOrdenes,
  backfillProveedorIdEnCotizaciones,
  detectarProveedoresFantasma,
  vincularProveedorManual,
  type ResultadoBackfill,
  type ProveedorFantasma,
} from '@/lib/proveedores-vinculacion'

interface Props {
  proveedores: Proveedor[]
}

export default function PanelVinculacionProveedores({ proveedores }: Props) {
  const [ejecutando, setEjecutando] = useState(false)
  const [resultado, setResultado] = useState<{ ordenes: ResultadoBackfill; cotizaciones: ResultadoBackfill } | null>(null)
  const [fantasmas, setFantasmas] = useState<ProveedorFantasma[] | null>(null)
  const [cargandoFantasmas, setCargandoFantasmas] = useState(false)
  const [vinculando, setVinculando] = useState<string | null>(null)

  async function cargarFantasmas() {
    setCargandoFantasmas(true)
    try {
      const lista = await detectarProveedoresFantasma(proveedores)
      setFantasmas(lista)
    } catch (err) {
      console.error(err)
      toast.error('No se pudieron detectar proveedores fantasma.')
    } finally {
      setCargandoFantasmas(false)
    }
  }

  async function handleVincularHistorico() {
    setEjecutando(true)
    try {
      const [ordenes, cotizaciones] = await Promise.all([
        backfillProveedorIdEnOrdenes(proveedores),
        backfillProveedorIdEnCotizaciones(proveedores),
      ])
      setResultado({ ordenes, cotizaciones })
      toast.success(`Vinculados ${ordenes.vinculados + cotizaciones.vinculados} registros por coincidencia de nombre.`)
      await cargarFantasmas()
    } catch (err) {
      console.error(err)
      toast.error('No se pudo vincular el histórico.')
    } finally {
      setEjecutando(false)
    }
  }

  async function handleVincularManual(fantasma: ProveedorFantasma, proveedorId: string) {
    if (!proveedorId) return
    const clave = `${fantasma.origen}-${fantasma.nombreLibre}`
    setVinculando(clave)
    try {
      await Promise.all(
        fantasma.idsDocs.map((docId) =>
          vincularProveedorManual(fantasma.origen === 'orden' ? 'ordenes' : 'cotizaciones', docId, proveedorId)
        )
      )
      toast.success(`"${fantasma.nombreLibre}" vinculado.`)
      await cargarFantasmas()
    } catch (err) {
      console.error(err)
      toast.error('No se pudo vincular manualmente.')
    } finally {
      setVinculando(null)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-violet-50 text-violet-700 border border-violet-200">
              <Ghost className="w-5 h-5" />
            </span>
            <h2 className="text-lg font-extrabold text-slate-900">Vincular Histórico al Catálogo</h2>
          </div>
          <p className="text-xs text-slate-500">
            Órdenes y cotizaciones capturadas con el proveedor como texto libre no quedan ligadas al
            catálogo, así que scorecards e historial de precios operan a medias. Esto liga por
            coincidencia exacta de nombre y muestra lo que no se pudo resolver solo.
          </p>
        </div>
        <Button
          onClick={() => void handleVincularHistorico()}
          disabled={ejecutando}
          className="bg-violet-700 hover:bg-violet-800 text-white font-bold text-xs gap-2 shadow-xs shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${ejecutando ? 'animate-spin' : ''}`} />
          {ejecutando ? 'Vinculando…' : 'Vincular histórico'}
        </Button>
      </div>

      {resultado && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3">
            <p className="font-bold text-emerald-700">Órdenes</p>
            <p className="text-slate-600">
              {resultado.ordenes.vinculados} vinculadas · {resultado.ordenes.sinMatch} sin match ·{' '}
              {resultado.ordenes.yaTenianId} ya tenían proveedor
            </p>
          </div>
          <div className="rounded-lg bg-sky-50 border border-sky-100 p-3">
            <p className="font-bold text-sky-700">Cotizaciones</p>
            <p className="text-slate-600">
              {resultado.cotizaciones.vinculados} vinculadas · {resultado.cotizaciones.sinMatch} sin match ·{' '}
              {resultado.cotizaciones.yaTenianId} ya tenían proveedor
            </p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-700">Proveedores fantasma (sin match automático)</h3>
          {!fantasmas && (
            <Button
              variant="outline"
              onClick={() => void cargarFantasmas()}
              disabled={cargandoFantasmas}
              className="text-xs font-bold"
            >
              {cargandoFantasmas ? 'Buscando…' : 'Buscar fantasmas'}
            </Button>
          )}
        </div>

        {fantasmas && fantasmas.length === 0 && (
          <p className="text-xs text-slate-500 py-2">
            Sin proveedores fantasma. Todo el histórico está ligado o se resolvió solo.
          </p>
        )}

        {fantasmas && fantasmas.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="p-2">Nombre libre</th>
                  <th className="p-2">Origen</th>
                  <th className="p-2 text-center" title="Un clic vincula hasta 20 documentos; si hay más, vuelve a aparecer para el resto.">Docs</th>
                  <th className="p-2">Vincular a</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {fantasmas.map((f) => {
                  const clave = `${f.origen}-${f.nombreLibre}`
                  return (
                    <tr key={clave}>
                      <td className="p-2 font-bold text-slate-900">{f.nombreLibre}</td>
                      <td className="p-2 text-slate-500">{f.origen === 'orden' ? 'Órdenes' : 'Cotizaciones'}</td>
                      <td className="p-2 text-center font-mono">{f.cantidadDocs}</td>
                      <td className="p-2">
                        <select
                          defaultValue={f.sugerenciaCatalogo?.id ?? ''}
                          disabled={vinculando === clave}
                          onChange={(e) => void handleVincularManual(f, e.target.value)}
                          className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs"
                        >
                          <option value="">Seleccionar proveedor…</option>
                          {proveedores.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nombre}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
