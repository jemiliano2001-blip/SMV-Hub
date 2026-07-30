'use client'

import { useMemo, useState } from 'react'
import type {
  NuevaSolicitudDocumento,
  TipoSolicitudDocumento,
  VentaOdooSo,
} from '@/lib/schemas'
import { validarPartidasRemision } from '@/lib/documentos-venta-helpers'

type Props = {
  sos: VentaOdooSo[]
  busqueda: string
  onBusquedaChange: (q: string) => void
  uid: string
  nombre: string
  onCrear: (
    data: NuevaSolicitudDocumento,
    opts?: { lineasSo?: readonly { odooLineId: number; qtyPending: number }[] }
  ) => Promise<string>
}

export default function NuevaSolicitudPanel({
  sos,
  busqueda,
  onBusquedaChange,
  uid,
  nombre,
  onCrear,
}: Props) {
  const [soId, setSoId] = useState<string | null>(null)
  const [tipo, setTipo] = useState<TipoSolicitudDocumento>('remision')
  const [nota, setNota] = useState('')
  const [qtyPorLinea, setQtyPorLinea] = useState<Record<number, number>>({})
  const [seleccionadas, setSeleccionadas] = useState<Set<number>>(new Set())
  const [enviando, setEnviando] = useState(false)
  const [errorLocal, setErrorLocal] = useState<string | null>(null)

  const so = useMemo(() => sos.find((s) => s.id === soId) ?? null, [sos, soId])

  function elegirSo(s: VentaOdooSo) {
    setSoId(s.id)
    setErrorLocal(null)
    const nextQty: Record<number, number> = {}
    const nextSel = new Set<number>()
    for (const l of s.lineas) {
      if (l.qtyPending > 0) {
        nextQty[l.odooLineId] = l.qtyPending
        nextSel.add(l.odooLineId)
      }
    }
    setQtyPorLinea(nextQty)
    setSeleccionadas(nextSel)
  }

  async function submit() {
    if (!so || !uid) return
    setErrorLocal(null)

    const partidas =
      tipo === 'remision'
        ? so.lineas
            .filter((l) => seleccionadas.has(l.odooLineId))
            .map((l) => ({
              odooLineId: l.odooLineId,
              productName: l.productName,
              qtySolicitada: qtyPorLinea[l.odooLineId] ?? l.qtyPending,
            }))
        : []

    const errPartidas = validarPartidasRemision(
      tipo,
      partidas,
      so.lineas.map((l) => ({ odooLineId: l.odooLineId, qtyPending: l.qtyPending }))
    )
    if (errPartidas) {
      setErrorLocal(errPartidas)
      return
    }

    const payload: NuevaSolicitudDocumento = {
      tipo,
      estado: 'pendiente',
      odooSoId: so.odooId,
      odooSoName: so.name,
      clientOrderRef: so.clientOrderRef,
      partnerName: so.partnerName || 'Sin cliente',
      partidas,
      nota: nota.trim(),
      solicitadoPorUid: uid,
      solicitadoPorNombre: nombre,
    }

    setEnviando(true)
    try {
      await onCrear(payload, {
        lineasSo: so.lineas.map((l) => ({
          odooLineId: l.odooLineId,
          qtyPending: l.qtyPending,
        })),
      })
      setSoId(null)
      setNota('')
    } catch (e) {
      setErrorLocal(e instanceof Error ? e.message : 'No se pudo crear')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <label className="block text-xs font-semibold text-slate-600">
          Buscar empresa, PO o SO
          <input
            value={busqueda}
            onChange={(e) => onBusquedaChange(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Ej. Suprajit, PO-123, S00042"
          />
        </label>

        {sos.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">
            No hay órdenes a facturar (to invoice / upselling). Sincroniza desde Odoo o espera la sync.
          </p>
        ) : (
          <ul className="max-h-56 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-lg">
            {sos.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => elegirSo(s)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-sky-50 ${
                    soId === s.id ? 'bg-sky-50' : ''
                  }`}
                >
                  <span className="font-semibold text-slate-900">{s.name}</span>
                  <span className="text-slate-500"> · {s.partnerName || 'Sin cliente'}</span>
                  <span className="block text-xs text-slate-400">
                    {s.clientOrderRef ? `PO ${s.clientOrderRef}` : 'Sin PO'} ·{' '}
                    {s.invoiceStatus}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {so && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-slate-900">
            {so.name} — {so.partnerName}
          </p>

          <div className="flex gap-2">
            {(['remision', 'factura'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTipo(t)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border ${
                  tipo === t
                    ? 'bg-sky-600 text-white border-sky-600'
                    : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                {t === 'remision' ? 'Remisión' : 'Factura'}
              </button>
            ))}
          </div>

          {tipo === 'remision' && (
            <div className="space-y-2">
              <div className="grid grid-cols-[auto_1fr_auto_auto] gap-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                <span />
                <span>Descripción</span>
                <span className="text-right">Cant.</span>
                <span className="w-20 text-right">Solicitar</span>
              </div>
              <ul className="space-y-2">
                {so.lineas.map((l) => {
                  const checked = seleccionadas.has(l.odooLineId)
                  return (
                    <li
                      key={l.odooLineId}
                      className="grid grid-cols-[auto_1fr_auto_auto] gap-2 items-start text-sm border border-slate-100 rounded-lg px-3 py-2"
                    >
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={checked}
                        disabled={l.qtyPending <= 0}
                        onChange={(e) => {
                          const next = new Set(seleccionadas)
                          if (e.target.checked) next.add(l.odooLineId)
                          else next.delete(l.odooLineId)
                          setSeleccionadas(next)
                        }}
                      />
                      <span className="min-w-0 whitespace-pre-wrap break-words text-slate-800">
                        {l.productName}
                      </span>
                      <span className="text-xs text-slate-500 tabular-nums text-right pt-0.5">
                        {l.qtyOrdered}
                        {l.qtyDelivered > 0 && (
                          <span className="block text-slate-400">
                            pend. {l.qtyPending}
                          </span>
                        )}
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={l.qtyPending}
                        step="any"
                        disabled={!checked}
                        value={qtyPorLinea[l.odooLineId] ?? l.qtyPending}
                        onChange={(e) =>
                          setQtyPorLinea((prev) => ({
                            ...prev,
                            [l.odooLineId]: Number(e.target.value),
                          }))
                        }
                        className="w-20 rounded border border-slate-200 px-2 py-1 text-xs"
                      />
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          <label className="block text-xs font-semibold text-slate-600">
            Nota
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Detalle extra para ventas…"
            />
          </label>

          {errorLocal && <p className="text-sm text-red-600">{errorLocal}</p>}

          <button
            type="button"
            disabled={enviando}
            onClick={() => void submit()}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {enviando ? 'Enviando…' : 'Crear solicitud'}
          </button>
        </div>
      )}
    </div>
  )
}
