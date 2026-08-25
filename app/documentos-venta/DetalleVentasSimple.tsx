'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Send,
  MessageSquare,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  FileText,
  Package,
} from 'lucide-react'
import type {
  EstadoSolicitudDocumento,
  MensajeSolicitudDocumento,
  SolicitudDocumento,
} from '@/lib/schemas'
import {
  etiquetaEstadoSolicitudDocumento,
  ordenCompraSolicitud,
} from '@/lib/documentos-venta-helpers'
import { Badge } from '@/components/ui/badge'
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

const CHIPS_VENTAS = [
  '⚡ En proceso de facturación',
  '⚡ Remisión generada en Odoo',
  '⚡ Falta información / lote',
  '⚡ Listo para entrega en almacén',
]

function formatearHora(d: Date): string {
  const hoy = new Date()
  const esHoy =
    d.getDate() === hoy.getDate() &&
    d.getMonth() === hoy.getMonth() &&
    d.getFullYear() === hoy.getFullYear()

  const hora = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  if (esHoy) return hora
  return `${d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })} ${hora}`
}

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/)
  if (partes.length === 0 || !partes[0]) return 'U'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[1][0]).toUpperCase()
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
  const chatScrollRef = useRef<HTMLDivElement>(null)

  const oc = ordenCompraSolicitud(solicitud)
  const tipoLabel = solicitud.tipo === 'factura' ? 'Factura' : 'Remisión'

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }
  }, [mensajes])

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

  async function enviar(textoAEnviar?: string) {
    const t = (textoAEnviar ?? texto).trim()
    if (!t) return
    setBusy(true)
    setError(null)
    try {
      await onEnviarMensaje(solicitud.id, t, uid, nombre)
      if (!textoAEnviar) {
        setTexto('')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[94vh] max-w-xl flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        {/* Cabecera Modo Ventas */}
        <DialogHeader className="border-b border-border bg-card px-5 py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge
                variant={solicitud.tipo === 'factura' ? 'default' : 'secondary'}
                className="font-bold text-xs"
              >
                <FileText className="mr-1 h-3 w-3" />
                {tipoLabel}
              </Badge>
              <DialogTitle className="text-lg font-bold text-foreground">
                {solicitud.partnerName}
              </DialogTitle>
            </div>
            <Badge
              variant="outline"
              className={`text-xs font-bold ${
                solicitud.estado === 'completada'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                  : solicitud.estado === 'en_proceso'
                    ? 'border-sky-300 bg-sky-50 text-sky-700'
                    : solicitud.estado === 'rechazada'
                      ? 'border-red-300 bg-red-50 text-destructive'
                      : 'border-amber-300 bg-amber-50 text-amber-700'
              }`}
            >
              {etiquetaEstadoSolicitudDocumento(solicitud.estado)}
            </Badge>
          </div>

          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            SO <strong className="text-foreground">{solicitud.odooSoName}</strong>
            {oc ? ` · Orden de compra: ${oc}` : ' · Sin orden de compra'}
          </DialogDescription>

          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>
              Pidió: <strong className="text-foreground">{solicitud.solicitadoPorNombre}</strong>
            </span>
            {solicitud.atendidoPorNombre && (
              <span>
                · Atiende: <strong className="text-foreground">{solicitud.atendidoPorNombre}</strong>
              </span>
            )}
            {solicitud.folioOdoo && (
              <span className="font-semibold text-emerald-600">
                · Folio Odoo: {solicitud.folioOdoo}
              </span>
            )}
          </div>
        </DialogHeader>

        <div className="flex flex-1 flex-col overflow-hidden bg-muted/20">
          {/* Partidas y Notas de la Solicitud */}
          <div className="border-b border-border bg-card px-5 py-3 text-xs space-y-2">
            {solicitud.partidas.length > 0 && (
              <div>
                <p className="mb-1 flex items-center gap-1 font-bold uppercase tracking-wide text-muted-foreground text-[11px]">
                  <Package className="h-3.5 w-3.5" />
                  Descripción · Cantidad
                </p>
                <ul className="max-h-24 space-y-1.5 overflow-y-auto pr-1">
                  {solicitud.partidas.map((p) => (
                    <li
                      key={p.odooLineId}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-muted/30 px-3 py-1.5 text-xs"
                    >
                      <span className="min-w-0 font-medium text-foreground">{p.productName}</span>
                      <span className="shrink-0 font-bold font-mono text-foreground">
                        Cant: {p.qtySolicitada}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {solicitud.nota.trim() !== '' && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
                <strong>Nota del taller:</strong> {solicitud.nota}
              </div>
            )}

            {solicitud.motivoRechazo && (
              <div className="flex items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 p-2 text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Motivo de cancelación: {solicitud.motivoRechazo}</span>
              </div>
            )}
          </div>

          {/* Botones Grandes de Estado para Ventas */}
          {solicitud.estado !== 'completada' && solicitud.estado !== 'rechazada' && (
            <div className="border-b border-border bg-card px-5 py-3 space-y-2">
              {solicitud.estado === 'pendiente' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void cambiarEstado('en_proceso')}
                  className="w-full cursor-pointer rounded-xl bg-sky-600 py-2.5 text-sm font-bold text-white shadow-xs transition-colors hover:bg-sky-700 disabled:opacity-50"
                >
                  Tomar y Atender Solicitud
                </button>
              )}

              {solicitud.estado === 'en_proceso' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      value={folio}
                      onChange={(e) => setFolio(e.target.value)}
                      className="flex-1 rounded-xl border border-input bg-card px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder="Folio Odoo (opcional: WH/OUT/…)"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void cambiarEstado('completada')}
                      className="cursor-pointer rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition-colors hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <CheckCircle2 className="mr-1.5 inline h-3.5 w-3.5" />
                      Listo / Completado
                    </button>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      className="flex-1 rounded-xl border border-input bg-card px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder="Motivo al cancelar…"
                    />
                    <button
                      type="button"
                      disabled={busy || !motivo.trim()}
                      onClick={() => void cambiarEstado('rechazada')}
                      className="cursor-pointer rounded-xl border border-red-200 bg-card px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-red-50 disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Mini-Chat Visual para Ventas */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-border bg-card/40 px-5 py-2">
              <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <MessageSquare className="h-3.5 w-3.5 text-primary" />
                <span>Mensajes con el solicitante</span>
              </div>
              <span className="text-[10px] text-muted-foreground">
                {mensajes.length} {mensajes.length === 1 ? 'mensaje' : 'mensajes'}
              </span>
            </div>

            {/* Lista de Mensajes */}
            <div
              ref={chatScrollRef}
              className="flex-1 space-y-3 overflow-y-auto p-4 min-h-[200px] max-h-[280px]"
            >
              {mensajes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
                  <div className="rounded-full bg-muted p-2.5">
                    <MessageSquare className="h-4 w-4 text-muted-foreground/60" />
                  </div>
                  <p className="mt-1.5 text-xs font-semibold text-foreground">Sin mensajes aún</p>
                  <p className="text-[11px] text-muted-foreground">
                    Comunícate directamente con el taller usando respuestas rápidas.
                  </p>
                </div>
              ) : (
                mensajes.map((m) => {
                  const esMio = m.autorUid === uid
                  return (
                    <div
                      key={m.id}
                      className={`flex items-end gap-2 ${esMio ? 'justify-end' : 'justify-start'}`}
                    >
                      {!esMio && (
                        <div
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-foreground border border-border shadow-2xs"
                          title={m.autorNombre}
                        >
                          {iniciales(m.autorNombre)}
                        </div>
                      )}

                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs shadow-2xs ${
                          esMio
                            ? 'bg-sky-600 text-white rounded-br-xs'
                            : 'bg-card text-foreground border border-border rounded-bl-xs'
                        }`}
                      >
                        {!esMio && (
                          <p className="mb-0.5 font-bold text-[10px] text-primary">
                            {m.autorNombre}
                          </p>
                        )}
                        <p className="whitespace-pre-wrap break-words leading-relaxed">{m.texto}</p>
                        <div
                          className={`mt-1 flex items-center justify-end gap-1 font-mono text-[9px] ${
                            esMio ? 'text-white/80' : 'text-muted-foreground'
                          }`}
                        >
                          <Clock className="h-2.5 w-2.5" />
                          <span>{formatearHora(m.creadoEn)}</span>
                        </div>
                      </div>

                      {esMio && (
                        <div
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-100 text-[10px] font-bold text-sky-800 border border-sky-300 shadow-2xs"
                          title="Tú"
                        >
                          Tú
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>

            {/* Chips de Respuestas Rápidas para Ventas */}
            <div className="border-t border-border bg-card/60 px-4 py-2">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] scrollbar-none">
                <span className="flex shrink-0 items-center text-muted-foreground font-semibold">
                  <Sparkles className="mr-1 h-3 w-3 text-amber-500" />
                  Rápidas:
                </span>
                {CHIPS_VENTAS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    disabled={busy}
                    onClick={() => void enviar(chip)}
                    className="shrink-0 cursor-pointer rounded-full border border-border bg-card px-2.5 py-1 font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:opacity-50"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* Input y Botón de Envío */}
            <div className="border-t border-border bg-card p-3">
              <div className="flex items-center gap-2">
                <input
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void enviar()
                    }
                  }}
                  placeholder="Escribe un mensaje… (Enter para enviar)"
                  className="flex-1 rounded-xl border border-input bg-muted/20 px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <Button
                  type="button"
                  disabled={busy || !texto.trim()}
                  onClick={() => void enviar()}
                  size="sm"
                  className="h-9 px-4 font-bold"
                >
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                  Enviar
                </Button>
              </div>

              {error && (
                <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-destructive">
                  {error}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
