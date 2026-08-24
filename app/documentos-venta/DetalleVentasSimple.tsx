'use client'

import { useState } from 'react'
import type {
  EstadoSolicitudDocumento,
  MensajeSolicitudDocumento,
  SolicitudDocumento,
} from '@/lib/schemas'
import {
  etiquetaEstadoSolicitudDocumento,
  ordenCompraSolicitud,
} from '@/lib/documentos-venta-helpers'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type Props = {
  solicitud: SolicitudDocumento
  mensajes: MensajeSolicitudDocumento[]
  uid: string
  nombre: string
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

export default function DetalleVentasSimple({
  solicitud,
  mensajes,
  uid,
  nombre,
  onClose,
  onActualizarEstado,
  onEnviarMensaje,
}: Props) {
  const [folio, setFolio] = useState(solicitud.folioOdoo ?? '')
  const [motivo, setMotivo] = useState('')
  const [texto, setTexto] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const oc = ordenCompraSolicitud(solicitud)
  const tipoLabel = solicitud.tipo === 'factura' ? 'Factura' : 'Remisión'

  async function cambiarEstado(hacia: EstadoSolicitudDocumento) {
    const motivoLimpio = motivo.trim()
    if (hacia === 'rechazada' && !motivoLimpio) {
      setError('Escribe el motivo antes de cancelar la solicitud')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onActualizarEstado({
        id: solicitud.id,
        desde: solicitud.estado,
        hacia,
        esAtendedor: true,
        esSolicitante: false,
        uid,
        nombre,
        folioOdoo: hacia === 'completada' ? folio.trim() || null : undefined,
        motivoRechazo: hacia === 'rechazada' ? motivoLimpio : undefined,
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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[92vh] max-w-xl flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle>
            {tipoLabel} · {solicitud.partnerName}
          </DialogTitle>
          <DialogDescription>
            SO {solicitud.odooSoName}
            {oc ? ` · Orden de compra ${oc}` : ' · Sin orden de compra'}
          </DialogDescription>
          <p className="text-xs font-semibold text-muted-foreground">
            {etiquetaEstadoSolicitudDocumento(solicitud.estado)}
          </p>
          {solicitud.atendidoPorNombre && (
            <p className="text-xs text-muted-foreground">
              Atiende {solicitud.atendidoPorNombre}
            </p>
          )}
          {solicitud.folioOdoo && (
            <p className="text-xs text-emerald-700">
              Folio Odoo: {solicitud.folioOdoo}
            </p>
          )}
          {solicitud.motivoRechazo && (
            <p className="text-xs text-destructive">
              Motivo: {solicitud.motivoRechazo}
            </p>
          )}
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {solicitud.partidas.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Descripción · Cantidad
              </p>
              <ul className="space-y-2">
                {solicitud.partidas.map((p) => (
                  <li
                    key={p.odooLineId}
                    className="flex justify-between gap-3 rounded-xl border border-border px-3 py-2 text-base"
                  >
                    <span className="min-w-0 whitespace-pre-wrap break-words text-foreground">
                      {p.productName}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-foreground">
                      {p.qtySolicitada}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {solicitud.nota.trim() !== '' && (
            <p className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-base text-foreground">
              {solicitud.nota}
            </p>
          )}

          {solicitud.estado !== 'completada' && solicitud.estado !== 'rechazada' && (
            <div className="space-y-3 border-t border-border pt-4">
              {solicitud.estado === 'pendiente' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void cambiarEstado('en_proceso')}
                  className="w-full rounded-xl bg-sky-600 py-3 text-base font-bold text-white disabled:opacity-50"
                >
                  Atender
                </button>
              )}

              {solicitud.estado === 'en_proceso' && (
                <>
                  <label className="block text-sm font-semibold text-foreground">
                    Folio Odoo (opcional)
                    <input
                      value={folio}
                      onChange={(e) => setFolio(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-3 text-base text-foreground placeholder:text-muted-foreground"
                      placeholder="WH/OUT/… o factura"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void cambiarEstado('completada')}
                    className="w-full rounded-xl bg-emerald-600 py-3 text-base font-bold text-white disabled:opacity-50"
                  >
                    Listo
                  </button>
                  <label className="block text-sm font-semibold text-foreground">
                    Motivo obligatorio al cancelar
                    <input
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-input bg-card px-3 py-3 text-base text-foreground placeholder:text-muted-foreground"
                      placeholder="Indica por qué se cancela"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={busy || !motivo.trim()}
                    onClick={() => void cambiarEstado('rechazada')}
                    className="w-full rounded-xl border-2 border-red-200 py-3 text-base font-bold text-destructive disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                </>
              )}
            </div>
          )}

          <div className="space-y-3 border-t border-border pt-4">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Mensajes
            </p>
            <ul className="max-h-56 space-y-2 overflow-y-auto">
              {mensajes.length === 0 && (
                <li className="text-sm text-muted-foreground">Sin mensajes aún.</li>
              )}
              {mensajes.map((m) => (
                <li
                  key={m.id}
                  className={`rounded-xl px-4 py-3 text-base ${
                    m.autorUid === uid ? 'ml-4 bg-sky-50' : 'mr-4 bg-muted'
                  }`}
                >
                  <span className="mb-1 block text-xs font-bold text-muted-foreground">
                    {m.autorNombre}
                  </span>
                  <p className="whitespace-pre-wrap text-foreground">{m.texto}</p>
                </li>
              ))}
            </ul>
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-input bg-card px-4 py-3 text-base text-foreground placeholder:text-muted-foreground"
              placeholder="Escribe un mensaje…"
            />
            <Button
              type="button"
              disabled={busy || !texto.trim()}
              onClick={() => void enviar()}
              className="h-12 w-full text-base"
            >
              Enviar
            </Button>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
