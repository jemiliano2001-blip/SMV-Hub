'use client'

import { useState } from 'react'
import type {
  EstadoSolicitudDocumento,
  MensajeSolicitudDocumento,
  SolicitudDocumento,
  VentaOdooSo,
} from '@/lib/schemas'
import { ordenCompraSolicitud } from '@/lib/documentos-venta-helpers'
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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border px-4 py-3">
          <DialogTitle>
            {solicitud.tipo === 'factura' ? 'Factura' : 'Remisión'} · {solicitud.odooSoName}
          </DialogTitle>
          <DialogDescription>
            {solicitud.partnerName}
            {ordenCompraSolicitud(solicitud)
              ? ` · Orden de compra ${ordenCompraSolicitud(solicitud)}`
              : ''}{' '}
            · {solicitud.estado.replace('_', ' ')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {solicitud.partidas.length > 0 && (
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase text-muted-foreground">
                Partidas
              </p>
              <ul className="space-y-1 text-sm text-foreground">
                {solicitud.partidas.map((p) => (
                  <li key={p.odooLineId}>
                    {p.qtySolicitada} × {p.productName}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {solicitud.nota && (
            <p className="rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
              {solicitud.nota}
            </p>
          )}

          {solicitud.folioOdoo && (
            <p className="text-xs text-emerald-700">Folio Odoo: {solicitud.folioOdoo}</p>
          )}
          {solicitud.motivoRechazo && (
            <p className="text-xs text-destructive">Motivo: {solicitud.motivoRechazo}</p>
          )}

          {so && (
            <p className="text-[10px] text-muted-foreground">
              Espejo: {so.invoiceStatus} · {so.lineas.length} líneas ·{' '}
              {so.remisiones.length} remisiones
            </p>
          )}

          {(atiende || (esSolicitante && solicitud.estado === 'pendiente')) &&
            solicitud.estado !== 'completada' &&
            solicitud.estado !== 'rechazada' && (
              <div className="space-y-2 border-t border-border pt-3">
                {atiende && (
                  <>
                    <label className="block text-xs font-semibold text-muted-foreground">
                      Folio Odoo (al completar)
                      <input
                        value={folio}
                        onChange={(e) => setFolio(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground"
                        placeholder="WH/OUT/… o INV/…"
                      />
                    </label>
                    <label className="block text-xs font-semibold text-muted-foreground">
                      Motivo rechazo
                      <input
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-1.5 text-sm text-foreground"
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {solicitud.estado === 'pendiente' && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void cambiarEstado('en_proceso')}
                          className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800"
                        >
                          Tomar
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void cambiarEstado('completada')}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        Completar
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void cambiarEstado('rechazada')}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-destructive"
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
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground"
                  >
                    Cancelar solicitud
                  </button>
                )}
              </div>
            )}

          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-[10px] font-bold uppercase text-muted-foreground">Chat</p>
            <ul className="max-h-48 space-y-2 overflow-y-auto">
              {mensajes.length === 0 && (
                <li className="text-xs text-muted-foreground">Sin mensajes aún.</li>
              )}
              {mensajes.map((m) => (
                <li
                  key={m.id}
                  className={`rounded-lg px-3 py-2 text-sm ${
                    m.autorUid === uid ? 'ml-6 bg-sky-50' : 'mr-6 bg-muted'
                  }`}
                >
                  <span className="text-[10px] font-bold text-muted-foreground">
                    {m.autorNombre}
                  </span>
                  <p className="text-foreground">{m.texto}</p>
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
                className="flex-1 rounded-lg border border-input bg-card px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground"
                placeholder="Escribe un mensaje…"
              />
              <Button
                type="button"
                disabled={busy || !texto.trim()}
                onClick={() => void enviar()}
                size="sm"
              >
                Enviar
              </Button>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </DialogContent>
    </Dialog>
  )
}
