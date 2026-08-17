'use client'

import { useMemo, useState } from 'react'
import { Sparkles } from 'lucide-react'
import type {
  NuevaSolicitudDocumento,
  SolicitudDocumento,
  TipoSolicitudDocumento,
  VentaOdooSo,
} from '@/lib/schemas'
import {
  lineasDisponiblesParaSolicitud,
  ordenCompraEfectiva,
  validarPartidasRemision,
} from '@/lib/documentos-venta-helpers'
import ModalLectorOrdenCliente from './ModalLectorOrdenCliente'

type Props = {
  sos: VentaOdooSo[]
  solicitudesActivas: SolicitudDocumento[]
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
  solicitudesActivas,
  busqueda,
  onBusquedaChange,
  uid,
  nombre,
  onCrear,
}: Props) {
  const [soId, setSoId] = useState<string | null>(null)
  const [modalLectorAbierto, setModalLectorAbierto] = useState(false)
  const [tipo, setTipo] = useState<TipoSolicitudDocumento>('remision')
  const [nota, setNota] = useState('')
  const [qtyPorLinea, setQtyPorLinea] = useState<Record<number, number>>({})
  const [seleccionadas, setSeleccionadas] = useState<Set<number>>(new Set())
  const [enviando, setEnviando] = useState(false)
  const [errorLocal, setErrorLocal] = useState<string | null>(null)

  const so = useMemo(() => sos.find((s) => s.id === soId) ?? null, [sos, soId])
  const lineasDisponibles = useMemo(
    () => (so ? lineasDisponiblesParaSolicitud(so.lineas, solicitudesActivas, so.odooId) : []),
    [so, solicitudesActivas]
  )

  function elegirSo(s: VentaOdooSo) {
    setSoId(s.id)
    setErrorLocal(null)
    const nextQty: Record<number, number> = {}
    const nextSel = new Set<number>()
    for (const l of lineasDisponiblesParaSolicitud(s.lineas, solicitudesActivas, s.odooId)) {
      if (l.qtyPending > 0) {
        nextQty[l.odooLineId] = l.qtyPending
        nextSel.add(l.odooLineId)
      }
    }
    setQtyPorLinea(nextQty)
    setSeleccionadas(nextSel)
  }

  function handleSeleccionarSoConIA(s: VentaOdooSo, qtyMap: Record<number, number>) {
    setSoId(s.id)
    setErrorLocal(null)
    const nextSel = new Set<number>()
    const nextQty: Record<number, number> = {}
    for (const l of lineasDisponiblesParaSolicitud(s.lineas, solicitudesActivas, s.odooId)) {
      if (qtyMap[l.odooLineId] !== undefined) {
        nextQty[l.odooLineId] = qtyMap[l.odooLineId]
        nextSel.add(l.odooLineId)
      } else if (l.qtyPending > 0) {
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
        ? lineasDisponibles
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
      lineasDisponibles.map((l) => ({ odooLineId: l.odooLineId, qtyPending: l.qtyPending }))
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
      ordenCompra: ordenCompraEfectiva(so),
      partnerName: so.partnerName || 'Sin cliente',
      partidas,
      nota: nota.trim(),
      solicitadoPorUid: uid,
      solicitadoPorNombre: nombre,
    }

    setEnviando(true)
    try {
      await onCrear(payload, {
        lineasSo: lineasDisponibles.map((l) => ({
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
      {/* Barra Superior con Buscador y Botón IA */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <label className="block text-xs font-semibold text-slate-600 flex-1">
            Buscar empresa, orden de compra o SO
            <input
              value={busqueda}
              onChange={(e) => onBusquedaChange(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Ej. OHD, PO.20263330, 2026/S01126"
            />
          </label>

          <div className="sm:self-end">
            <button
              type="button"
              onClick={() => setModalLectorAbierto(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white font-semibold text-xs shadow-xs transition-all"
            >
              <Sparkles className="h-4 w-4" />
              <span>Escanear Orden de Compra Cliente (IA)</span>
            </button>
          </div>
        </div>

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
                    {ordenCompraEfectiva(s)
                      ? `Orden de compra ${ordenCompraEfectiva(s)}`
                      : 'Sin orden de compra'}{' '}
                    · {s.invoiceStatus}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {so && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-2xs">
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
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {t === 'remision' ? 'Remisión' : 'Factura'}
              </button>
            ))}
          </div>

          {tipo === 'remision' && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-600">Partidas a solicitar</p>
              {lineasDisponibles.length === 0 ? (
                <p className="text-xs text-slate-400">Sin líneas con cantidad pendiente</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {lineasDisponibles.map((l) => (
                    <li
                      key={l.odooLineId}
                      className="flex flex-wrap items-center justify-between gap-2 border border-slate-100 rounded-lg p-2"
                    >
                      <label className="flex items-center gap-2 flex-1 min-w-[200px]">
                        <input
                          type="checkbox"
                          checked={seleccionadas.has(l.odooLineId)}
                          onChange={(e) => {
                            const next = new Set(seleccionadas)
                            if (e.target.checked) next.add(l.odooLineId)
                            else next.delete(l.odooLineId)
                            setSeleccionadas(next)
                          }}
                        />
                        <span className="text-xs text-slate-800">{l.productName}</span>
                      </label>
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <span>Cant:</span>
                        <input
                          type="number"
                          min={0.01}
                          step={1}
                          max={l.qtyPending}
                          value={qtyPorLinea[l.odooLineId] ?? l.qtyPending}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0
                            setQtyPorLinea((prev) => ({ ...prev, [l.odooLineId]: val }))
                          }}
                          className="w-16 rounded border border-slate-200 px-1 py-0.5 text-right text-xs"
                        />
                        <span>/ {l.qtyPending}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
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
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50 shadow-xs"
          >
            {enviando ? 'Enviando…' : 'Crear solicitud'}
          </button>
        </div>
      )}

      {/* Modal Lector Inteligente de Órdenes de Compra */}
      <ModalLectorOrdenCliente
        abierto={modalLectorAbierto}
        onClose={() => setModalLectorAbierto(false)}
        sos={sos}
        onSeleccionarSoConPartidas={handleSeleccionarSoConIA}
      />
    </div>
  )
}
