'use client'

import { useState } from 'react'
import { Ghost, Link2, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import type { Proveedor } from '@/lib/schemas'
import {
  detectarProveedoresFantasma,
  backfillProveedorIdEnOrdenes,
  backfillProveedorIdEnCotizaciones,
  vincularProveedorManual,
  type ProveedorFantasma,
  type ResultadoBackfill,
} from '@/lib/proveedores-vinculacion'

interface Props {
  catalogo: Proveedor[]
}

export default function PanelProveedoresFantasma({ catalogo }: Props) {
  const [fantasmas, setFantasmas] = useState<ProveedorFantasma[]>([])
  const [cargando, setCargando] = useState(false)
  const [backfillOrd, setBackfillOrd] = useState<ResultadoBackfill | null>(null)
  const [backfillCot, setBackfillCot] = useState<ResultadoBackfill | null>(null)
  const [ejecutando, setEjecutando] = useState<string | null>(null)
  const [seleccionVinculo, setSeleccionVinculo] = useState<Record<string, string>>({})
  const [vinculando, setVinculando] = useState<string | null>(null)

  async function vincularManualmente(f: ProveedorFantasma) {
    const proveedorId = seleccionVinculo[`${f.origen}-${f.nombreLibre}`]
    if (!proveedorId) return
    const coleccion = f.origen === 'orden' ? 'ordenes' : 'cotizaciones'
    setVinculando(f.nombreLibre)
    try {
      await Promise.all(f.idsDocs.map((docId) => vincularProveedorManual(coleccion, docId, proveedorId)))
      toast.success(`"${f.nombreLibre}" vinculado (${f.idsDocs.length} ${coleccion}).`)
      await escanear()
    } catch (err) {
      console.error(err)
      toast.error('No se pudo vincular manualmente.')
    } finally {
      setVinculando(null)
    }
  }

  async function escanear() {
    setCargando(true)
    try {
      const lista = await detectarProveedoresFantasma(catalogo)
      setFantasmas(lista)
      toast.success(`Encontrados ${lista.length} nombres sin vínculo al catálogo`)
    } catch (err) {
      console.error(err)
      toast.error('No se pudo escanear proveedores fantasma')
    } finally {
      setCargando(false)
    }
  }

  async function correrBackfillOrdenes() {
    setEjecutando('ordenes')
    try {
      const res = await backfillProveedorIdEnOrdenes(catalogo)
      setBackfillOrd(res)
      toast.success(`Órdenes: ${res.vinculados} vinculadas, ${res.sinMatch} sin match`)
      await escanear()
    } catch (err) {
      console.error(err)
      toast.error('Falló el backfill de órdenes')
    } finally {
      setEjecutando(null)
    }
  }

  async function correrBackfillCotizaciones() {
    setEjecutando('cotizaciones')
    try {
      const res = await backfillProveedorIdEnCotizaciones(catalogo)
      setBackfillCot(res)
      toast.success(`Cotizaciones: ${res.vinculados} vinculadas, ${res.sinMatch} sin match`)
      await escanear()
    } catch (err) {
      console.error(err)
      toast.error('Falló el backfill de cotizaciones')
    } finally {
      setEjecutando(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Ghost className="h-4 w-4 text-slate-500" />
            Proveedores fantasma
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Nombres en órdenes/cotizaciones que no matchean el catálogo USA Tooling.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={escanear}
            disabled={cargando}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {cargando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ghost className="h-3.5 w-3.5" />}
            Escanear
          </button>
          <button
            type="button"
            onClick={correrBackfillOrdenes}
            disabled={!!ejecutando}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {ejecutando === 'ordenes' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Link2 className="h-3.5 w-3.5" />
            )}
            Backfill órdenes
          </button>
          <button
            type="button"
            onClick={correrBackfillCotizaciones}
            disabled={!!ejecutando}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {ejecutando === 'cotizaciones' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Link2 className="h-3.5 w-3.5" />
            )}
            Backfill cotizaciones
          </button>
        </div>
      </div>

      {(backfillOrd || backfillCot) && (
        <div className="grid gap-2 sm:grid-cols-2">
          {backfillOrd && (
            <div className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-900">
              <CheckCircle2 className="inline h-3.5 w-3.5 mr-1" />
              Órdenes: {backfillOrd.vinculados} vinculadas / {backfillOrd.sinMatch} sin match /{' '}
              {backfillOrd.yaTenianId} ya tenían ID
            </div>
          )}
          {backfillCot && (
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
              <CheckCircle2 className="inline h-3.5 w-3.5 mr-1" />
              Cotizaciones: {backfillCot.vinculados} vinculadas / {backfillCot.sinMatch} sin match /{' '}
              {backfillCot.yaTenianId} ya tenían ID
            </div>
          )}
        </div>
      )}

      {fantasmas.length === 0 ? (
        <p className="text-xs text-slate-500 py-6 text-center border border-dashed border-slate-200 rounded-lg">
          Sin fantasmas detectados (o aún no has escaneado).
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Nombre libre</th>
                <th className="text-left px-3 py-2 font-semibold">Origen</th>
                <th className="text-right px-3 py-2 font-semibold">Docs</th>
                <th className="text-left px-3 py-2 font-semibold">Sugerencia catálogo</th>
                <th className="text-left px-3 py-2 font-semibold">Vincular manualmente</th>
              </tr>
            </thead>
            <tbody>
              {fantasmas.map((f) => {
                const key = `${f.origen}-${f.nombreLibre}`
                return (
                <tr key={key} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-900">
                    <AlertTriangle className="inline h-3 w-3 text-amber-500 mr-1" />
                    {f.nombreLibre}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{f.origen}</td>
                  <td className="px-3 py-2 text-right font-mono">{f.cantidadDocs}</td>
                  <td className="px-3 py-2 text-slate-500">
                    {f.sugerenciaCatalogo
                      ? `${f.sugerenciaCatalogo.nombre} (${f.sugerenciaCatalogo.id})`
                      : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <select
                        value={seleccionVinculo[key] ?? ''}
                        onChange={(e) => setSeleccionVinculo((prev) => ({ ...prev, [key]: e.target.value }))}
                        className="rounded-md border border-slate-200 px-2 py-1 text-xs"
                      >
                        <option value="">Elegir proveedor…</option>
                        {catalogo.map((p) => (
                          <option key={p.id} value={p.id}>{p.nombre}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => vincularManualmente(f)}
                        disabled={!seleccionVinculo[key] || vinculando === f.nombreLibre}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-md bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-40"
                      >
                        {vinculando === f.nombreLibre ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
                        Vincular
                      </button>
                    </div>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
