'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  Camera,
  ExternalLink,
  Inbox,
  Loader2,
  Send,
  ShoppingCart,
  X,
  MessageSquare,
  Copy,
  Trash2,
  Eye,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import ModuleEmptyState from '@/components/layout/ModuleEmptyState'
import ModuleFilterChips from '@/components/layout/ModuleFilterChips'
import ModuleSurface from '@/components/layout/ModuleSurface'
import { authBypassActivo, useUsuario } from '@/lib/auth'
import { usePermisos } from '@/lib/hooks/useRol'
import { tieneModulo } from '@/lib/roles'
import { usePedidosAlmacen } from '@/lib/hooks/usePedidosAlmacen'
import { subirImagenPedidoAlmacen } from '@/lib/storage'
import { formatFechaHoraCorta } from '@/lib/format'
import type { PedidoAlmacen } from '@/lib/schemas'
import { ModalCamara } from '@/components/ModalCamara'
import { useConfirmDialog } from '@/components/ConfirmDialogProvider'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'

const ESTADO_LABEL: Record<PedidoAlmacen['estado'], string> = {
  pendiente: 'Pendiente',
  comprado: 'Comprado',
  cancelado: 'Cancelado',
}

export default function PedidosAlmacenView() {
  const confirmar = useConfirmDialog()
  const { usuario } = useUsuario()
  const { modulos, esSuperAdmin } = usePermisos(authBypassActivo() ? null : usuario)
  const { pedidos, loading, error, agregarPedido, cancelarPedido } = usePedidosAlmacen()

  // Gestores: quienes compran (módulo nueva-compra) o super-admin
  const puedeGestionar = esSuperAdmin || tieneModulo(modulos, 'nueva-compra')

  const [descripcion, setDescripcion] = useState('')
  const [urgente, setUrgente] = useState(false)
  const [imagen, setImagen] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isCamaraOpen, setIsCamaraOpen] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [errorCaptura, setErrorCaptura] = useState<string | null>(null)
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function handleFotoCapturada(file: File) {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setImagen(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  function handleImagenChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    handleFotoCapturada(file)
    e.target.value = ''
  }

  function quitarImagen() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setImagen(null)
    setPreviewUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleEnviar(e: React.FormEvent) {
    e.preventDefault()
    setErrorCaptura(null)
    setMensajeExito(null)

    const texto = descripcion.trim()
    if (!texto) {
      setErrorCaptura('Escribe qué necesitas que se compre')
      return
    }
    if (!usuario) {
      setErrorCaptura('No se detectó tu sesión. Vuelve a iniciar sesión.')
      return
    }

    setEnviando(true)
    try {
      const imagenGuardada = imagen ? await subirImagenPedidoAlmacen(imagen) : null
      await agregarPedido({
        descripcion: texto,
        urgente,
        solicitadoPorUid: usuario.uid,
        solicitadoPorNombre: usuario.displayName || usuario.email || 'Sin nombre',
        ...(imagenGuardada
          ? { imagenUrl: imagenGuardada.url, imagenPath: imagenGuardada.path }
          : {}),
      })
      setMensajeExito('Pedido guardado')
      toast.success('Pedido de Almacén Guardado', {
        description: `Se registró el pedido para "${texto.substring(0, 40)}..."`,
      })
      setDescripcion('')
      setUrgente(false)
      quitarImagen()
      setTimeout(() => textareaRef.current?.focus(), 0)
    } catch (err) {
      console.error('Error guardando pedido de almacén:', err)
      setErrorCaptura('No se pudo guardar el pedido. Intenta de nuevo.')
      toast.error('Error al registrar pedido', {
        description: 'Verifica tu conexión e intenta de nuevo.',
      })
    } finally {
      setEnviando(false)
    }
  }

  async function handleCancelar(id: string) {
    const aceptado = await confirmar({
      title: 'Cancelar pedido de almacén',
      description: 'El pedido quedará marcado como cancelado.',
      confirmLabel: 'Cancelar pedido',
      variant: 'destructive',
    })
    if (!aceptado) return
    try {
      await cancelarPedido(id)
      toast.info('Pedido Cancelado')
    } catch (err) {
      console.error('Error cancelando pedido de almacén:', err)
      toast.error('Error al cancelar pedido')
    }
  }

  const pendientes = [...pedidos]
    .filter((p) => p.estado === 'pendiente')
    .sort((a, b) => {
      if (a.urgente !== b.urgente) return a.urgente ? -1 : 1
      return b.creadoEn.getTime() - a.creadoEn.getTime()
    })
  const historial = pedidos.filter((p) => p.estado !== 'pendiente')

  function Tarjeta({ pedido }: { pedido: PedidoAlmacen }) {
    const textoWhatsApp = encodeURIComponent(
      `Hola ${pedido.solicitadoPorNombre}, sobre tu pedido de almacén "${pedido.descripcion}":\nEstado: ${ESTADO_LABEL[pedido.estado]}`
    )

    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="flex cursor-pointer select-none gap-3 overflow-hidden rounded-xl border border-border bg-card p-4 shadow-xs transition-shadow hover:shadow-sm">
            {pedido.imagenUrl && (
              <a
                href={pedido.imagenUrl}
                target="_blank"
                rel="noreferrer"
                className="shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pedido.imagenUrl}
                  alt="Foto del pedido"
                  className="h-16 w-16 rounded-xl border border-border object-cover"
                />
              </a>
            )}
            <div className="min-w-0 flex-1">
              <p className="break-words text-sm font-bold text-foreground">{pedido.descripcion}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {pedido.urgente && (
                  <Badge
                    variant="outline"
                    className="border-red-300 bg-red-50 font-mono text-[10px] font-bold text-red-900"
                  >
                    <AlertTriangle className="mr-1 h-3 w-3" aria-hidden />
                    URGENTE
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  className={[
                    'font-mono text-[10px] font-bold uppercase',
                    pedido.estado === 'pendiente'
                      ? 'border-sky-200 bg-sky-50 text-primary'
                      : pedido.estado === 'comprado'
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                        : 'border-border bg-muted text-muted-foreground',
                  ].join(' ')}
                >
                  {ESTADO_LABEL[pedido.estado]}
                </Badge>
              </div>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {pedido.solicitadoPorNombre} · {formatFechaHoraCorta(pedido.creadoEn)}
              </p>
              {pedido.ordenIdVinculada && (
                <div className="mt-2">
                  <Link
                    href="/ordenes"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 rounded border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-600 hover:text-sky-700 hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Ver Orden de Compra vinculada
                  </Link>
                </div>
              )}
              {puedeGestionar && pedido.estado === 'pendiente' && (
                <div className="mt-2.5 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                  <Link
                    href={`/nueva-compra?pedidoId=${pedido.id}&descripcion=${encodeURIComponent(pedido.descripcion)}`}
                    className="inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-xs transition-all hover:bg-primary/90 active:scale-98"
                  >
                    <ShoppingCart className="h-3.5 w-3.5" />
                    Comprar ahora
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleCancelar(pedido.id)}
                    className="cursor-pointer rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-bold text-foreground shadow-2xs transition-all hover:bg-muted active:scale-98"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-56">
          {puedeGestionar && pedido.estado === 'pendiente' && (
            <ContextMenuItem
              onClick={() => {
                window.location.href = `/nueva-compra?pedidoId=${pedido.id}&descripcion=${encodeURIComponent(pedido.descripcion)}`
              }}
            >
              <ShoppingCart className="text-primary" />
              <span>Comprar ahora (IA)</span>
              <ContextMenuShortcut>↵</ContextMenuShortcut>
            </ContextMenuItem>
          )}

          <ContextMenuItem
            onClick={() => {
              window.open(`https://wa.me/?text=${textoWhatsApp}`, '_blank', 'noopener,noreferrer')
            }}
          >
            <MessageSquare className="text-emerald-600" />
            <span>Notificar por WhatsApp</span>
          </ContextMenuItem>

          <ContextMenuSeparator />

          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <Copy className="text-muted-foreground" />
              <span>Copiar información</span>
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-48">
              <ContextMenuItem
                onClick={() => {
                  void navigator.clipboard.writeText(pedido.descripcion)
                  toast.success('Descripción copiada')
                }}
              >
                <span>Descripción</span>
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => {
                  void navigator.clipboard.writeText(pedido.solicitadoPorNombre)
                  toast.success('Solicitante copiado')
                }}
              >
                <span>Solicitante ({pedido.solicitadoPorNombre})</span>
              </ContextMenuItem>
              {pedido.imagenUrl && (
                <ContextMenuItem
                  onClick={() => {
                    void navigator.clipboard.writeText(pedido.imagenUrl || '')
                    toast.success('Enlace de imagen copiado')
                  }}
                >
                  <span>Enlace de foto</span>
                </ContextMenuItem>
              )}
            </ContextMenuSubContent>
          </ContextMenuSub>

          {pedido.imagenUrl && (
            <ContextMenuItem
              onClick={() => {
                if (pedido.imagenUrl) window.open(pedido.imagenUrl, '_blank', 'noopener,noreferrer')
              }}
            >
              <Eye className="text-sky-600" />
              <span>Ver foto completa</span>
            </ContextMenuItem>
          )}

          {pedido.ordenIdVinculada && (
            <ContextMenuItem
              onClick={() => {
                window.location.href = '/ordenes'
              }}
            >
              <ExternalLink className="text-sky-600" />
              <span>Ver orden vinculada</span>
            </ContextMenuItem>
          )}

          {pedido.estado === 'pendiente' && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem
                variant="destructive"
                onClick={() => handleCancelar(pedido.id)}
              >
                <Trash2 />
                <span>Cancelar pedido</span>
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
    )
  }

  return (
    <div className="space-y-8">
      {mensajeExito && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          {mensajeExito}
        </div>
      )}
      {errorCaptura && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {errorCaptura}
        </div>
      )}

      <ModuleSurface className="space-y-3 p-4">
        <form onSubmit={handleEnviar} className="space-y-3">
          <textarea
            ref={textareaRef}
            autoFocus
            required
            rows={2}
            placeholder="¿Qué necesitas que se compre? Ej. 5 brocas de 3/8"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className="w-full resize-none rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />

          <div className="flex flex-wrap items-center gap-2">
            <ModuleFilterChips
              ariaLabel="Prioridad del pedido"
              value={urgente ? 'urgente' : 'normal'}
              onValueChange={(value) => setUrgente(value === 'urgente')}
              options={[
                { value: 'normal', label: 'Normal' },
                { value: 'urgente', label: 'Urgente' },
              ]}
            />

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImagenChange}
              className="hidden"
            />
            {previewUrl ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Foto seleccionada"
                  className="h-9 w-9 rounded-md border border-border object-cover"
                />
                <button
                  type="button"
                  onClick={quitarImagen}
                  className="absolute -right-1.5 -top-1.5 rounded-full bg-foreground p-0.5 text-background"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsCamaraOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted"
              >
                <Camera className="h-4 w-4" />
                Foto (opcional)
              </button>
            )}

            <button
              type="submit"
              disabled={enviando || !descripcion.trim()}
              className="ml-auto inline-flex items-center gap-2 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar pedido
            </button>
          </div>
        </form>
      </ModuleSurface>

      <ModalCamara
        isOpen={isCamaraOpen}
        onClose={() => setIsCamaraOpen(false)}
        onCapture={handleFotoCapturada}
        titulo="Foto de Pedido de Almacén"
      />

      {loading ? (
        <div className="h-24 animate-pulse rounded-lg bg-muted" />
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      ) : (
        <div className="space-y-6">
          <div>
            <h3 className="mb-3 text-sm font-medium text-foreground">
              Pendientes ({pendientes.length})
            </h3>
            {pendientes.length === 0 ? (
              <ModuleEmptyState
                icon={Inbox}
                title="No hay pedidos pendientes"
                description="Los requerimientos nuevos de piso aparecerán aquí."
              />
            ) : (
              <div className="space-y-2">
                {pendientes.map((p) => (
                  <Tarjeta key={p.id} pedido={p} />
                ))}
              </div>
            )}
          </div>

          {historial.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer text-sm font-medium text-foreground">
                Historial ({historial.length})
              </summary>
              <div className="mt-3 space-y-2">
                {historial.map((p) => (
                  <Tarjeta key={p.id} pedido={p} />
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
