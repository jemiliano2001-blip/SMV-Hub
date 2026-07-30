'use client'

import { useState } from 'react'
import type {
  EstadoSolicitudDocumento,
  MensajeSolicitudDocumento,
  SolicitudDocumento,
  VentaOdooSo,
} from '@/lib/schemas'

type Props = {
  solicitud: SolicitudDocumento
  so: VentaOdooSo | null
  mensajes: MensajeSolicitudDocumento[]
  uid: string
  nombre: string
  atiende: boolean
  onClose: () => void
  onActualizarEstado: (args: {
    id: string
    desde: EstadoSolicitudDocumento
    hacia: EstadoSolicitudDocumento
    esAtendedor: boolean
    esSolicitante: boolean
    uid: string
    nombre: string
    folioOdoo?: string | null
    motivoRechazo?: string | null
  }) => Promise<void>
  onEnviarMensaje: (
    solicitudId: string,
    texto: string,
    autorUid: string,
    autorNombre: string
  ) => Promise<string>
}

export default function SolicitudDetalleModal({
  solicitud,
  so,
  mensajes,
  uid,
  nombre,
  atiende,
  onClose,
  onActualizarEstado,
  onEnviarMensaje,
}: Props) {
  const esSolicitante = solicitud.solicitadoPorUid === uid
  const [folio, setFolio] = useState(solicitud.folioOdoo ?? '')
  const [motivo, setMotivo] = useState('')
  const [texto, setTexto] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function cambiarEstado(hacia: EstadoSolicitudDocumento) {
    setBusy(true)
    setError(null)
    try {
      await onActualizarEstado({
        id: solicitud.id,
        desde: solicitud.estado,
        hacia,
        esAtendedor: atiende,
        esSolicitante,
        uid,
        nombre,
        folioOdoo: hacia === 'completada' ? folio.trim() || null : undefined,
        motivoRechazo: hacia === 'rechazada' ? motivo.trim() : undefined,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar')
    } finally {
      setBusy(false)
    }
  }

  async function enviar() {
    const t = texto.trim()
    if (!t) return
    setBusy(true)
    setError(null)
    try {
      await onEnviarMensaje(solicitud.id, t, uid, nombre)
      setTexto('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-xl shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              {solicitud.tipo === 'factura' ? 'Factura' : 'Remisión'} ·{' '}
              {solicitud.odooSoName}
            </h2>
            <p className="text-xs text-slate-500">
              {solicitud.partnerName}
              {solicitud.clientOrderRef ? ` · PO ${solicitud.clientOrderRef}` : ''} ·{' '}
              {solicitud.estado.replace('_', ' ')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800"
          >
            Cerrar
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-3 space-y-3 flex-1">
          {solicitud.partidas.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">
                Partidas
              </p>
              <ul className="text-sm space-y-1">
                {solicitud.partidas.map((p) => (
                  <li key={p.odooLineId}>
                    {p.qtySolicitada} × {p.productName}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {solicitud.nota && (
            <p className="text-sm text-slate-700 bg-slate-50 rounded-lg px-3 py-2">
              {solicitud.nota}
            </p>
          )}

          {solicitud.folioOdoo && (
            <p className="text-xs text-emerald-700">Folio Odoo: {solicitud.folioOdoo}</p>
          )}
          {solicitud.motivoRechazo && (
            <p className="text-xs text-red-700">Motivo: {solicitud.motivoRechazo}</p>
          )}

          {so && (
            <p className="text-[10px] text-slate-400">
              Espejo: {so.invoiceStatus} · {so.lineas.length} líneas ·{' '}
              {so.remisiones.length} remisiones
            </p>
          )}

          {(atiende || (esSolicitante && solicitud.estado === 'pendiente')) &&
            solicitud.estado !== 'completada' &&
            solicitud.estado !== 'rechazada' && (
              <div className="space-y-2 border-t border-slate-100 pt-3">
                {atiende && (
                  <>
                    <label className="block text-xs font-semibold text-slate-600">
                      Folio Odoo (al completar)
                      <input
                        value={folio}
                        onChange={(e) => setFolio(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                        placeholder="WH/OUT/… o INV/…"
                      />
                    </label>
                    <label className="block text-xs font-semibold text-slate-600">
                      Motivo rechazo
                      <input
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {solicitud.estado === 'pendiente' && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void cambiarEstado('en_proceso')}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-sky-200 text-sky-800 bg-sky-50"
                        >
                          Tomar
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void cambiarEstado('completada')}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 text-white"
                      >
                        Completar
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void cambiarEstado('rechazada')}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-200 text-red-700"
                      >
                        Rechazar
                      </button>
                    </div>
                  </>
                )}
                {!atiende && esSolicitante && solicitud.estado === 'pendiente' && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setBusy(true)
                      setError(null)
                      void onActualizarEstado({
                        id: solicitud.id,
                        desde: solicitud.estado,
                        hacia: 'rechazada',
                        esAtendedor: false,
                        esSolicitante: true,
                        uid,
                        nombre,
                        motivoRechazo: 'Cancelada por solicitante',
                      })
                        .catch((e) => {
                          setError(
                            e instanceof Error ? e.message : 'No se pudo cancelar'
                          )
                        })
                        .finally(() => setBusy(false))
                    }}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200"
                  >
                    Cancelar solicitud
                  </button>
                )}
              </div>
            )}

          <div className="border-t border-slate-100 pt-3 space-y-2">
            <p className="text-[10px] font-bold uppercase text-slate-400">Chat</p>
            <ul className="space-y-2 max-h-48 overflow-y-auto">
              {mensajes.length === 0 && (
                <li className="text-xs text-slate-400">Sin mensajes aún.</li>
              )}
              {mensajes.map((m) => (
                <li
                  key={m.id}
                  className={`text-sm rounded-lg px-3 py-2 ${
                    m.autorUid === uid ? 'bg-sky-50 ml-6' : 'bg-slate-50 mr-6'
                  }`}
                >
                  <span className="text-[10px] font-bold text-slate-400">
                    {m.autorNombre}
                  </span>
                  <p>{m.texto}</p>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void enviar()
                  }
                }}
                className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                placeholder="Escribe un mensaje…"
              />
              <button
                type="button"
                disabled={busy || !texto.trim()}
                onClick={() => void enviar()}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-900 text-white disabled:opacity-40"
              >
                Enviar
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  )
}
