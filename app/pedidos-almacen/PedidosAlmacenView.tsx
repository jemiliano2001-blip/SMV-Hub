'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Camera, Loader2, Send, ShoppingCart, X } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { authBypassActivo, useUsuario } from '@/lib/auth'
import { usePermisos } from '@/lib/hooks/useRol'
import { tieneModulo } from '@/lib/roles'
import { usePedidosAlmacen } from '@/lib/hooks/usePedidosAlmacen'
import { subirImagenPedidoAlmacen } from '@/lib/storage'
import { formatFechaHoraCorta } from '@/lib/format'
import type { PedidoAlmacen } from '@/lib/schemas'
import { ModalCamara } from '@/components/ModalCamara'

const ESTADO_LABEL: Record<PedidoAlmacen['estado'], string> = {
  pendiente: 'Pendiente',
  comprado: 'Comprado',
  cancelado: 'Cancelado',
}

export default function PedidosAlmacenView() {
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
    if (!confirm('¿Cancelar este pedido?')) return
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
    return (
      <div className="flex gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs hover:shadow-xs transition-all">
        {pedido.imagenUrl && (
          <a href={pedido.imagenUrl} target="_blank" rel="noreferrer" className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pedido.imagenUrl}
              alt="Foto del pedido"
              className="h-16 w-16 rounded-xl border border-slate-200 object-cover"
            />
          </a>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900 break-words">{pedido.descripcion}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {pedido.urgente && (
              <Badge variant="outline" className="bg-red-50 text-red-900 border-red-300 font-mono text-[10px] font-bold">
                🚨 URGENTE
              </Badge>
            )}
            <Badge
              variant="outline"
              className={[
                'font-mono text-[10px] font-bold uppercase',
                pedido.estado === 'pendiente'
                  ? 'bg-sky-50 text-[#0369A1] border-sky-200'
                  : pedido.estado === 'comprado'
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                  : 'bg-slate-100 text-slate-600 border-slate-200',
              ].join(' ')}
            >
              {ESTADO_LABEL[pedido.estado]}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-slate-500 font-mono">
            {pedido.solicitadoPorNombre} · {formatFechaHoraCorta(pedido.creadoEn)}
          </p>
          {puedeGestionar && pedido.estado === 'pendiente' && (
            <div className="mt-2.5 flex flex-wrap gap-2">
              <Link
                href={`/nueva-compra?pedidoId=${pedido.id}&descripcion=${encodeURIComponent(pedido.descripcion)}`}
                className="inline-flex items-center gap-1 rounded-xl bg-[#0369A1] hover:bg-[#0284C7] active:scale-98 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition-all"
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                Comprar ahora
              </Link>
              <button
                type="button"
                onClick={() => handleCancelar(pedido.id)}
                className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:scale-98 px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs transition-all cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      </div>
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

      <form onSubmit={handleEnviar} className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <textarea
          ref={textareaRef}
          autoFocus
          required
          rows={2}
          placeholder="¿Qué necesitas que se compre? Ej. 5 brocas de 3/8"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <div className="flex flex-wrap items-center gap-2">
          {(['normal', 'urgente'] as const).map((opcion) => (
            <button
              key={opcion}
              type="button"
              onClick={() => setUrgente(opcion === 'urgente')}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                urgente === (opcion === 'urgente')
                  ? 'border-[#0369A1] bg-[#0369A1] text-white'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-[#0369A1]/50'
              }`}
            >
              {opcion === 'urgente' ? 'Urgente' : 'Normal'}
            </button>
          ))}

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
              <img src={previewUrl} alt="Foto seleccionada" className="h-9 w-9 rounded-md border object-cover" />
              <button
                type="button"
                onClick={quitarImagen}
                className="absolute -right-1.5 -top-1.5 rounded-full bg-gray-900 p-0.5 text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsCamaraOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:border-[#0369A1]/50 hover:bg-sky-50/50"
            >
              <Camera className="h-4 w-4" />
              Foto (opcional)
            </button>
          )}

          <button
            type="submit"
            disabled={enviando || !descripcion.trim()}
            className="ml-auto inline-flex items-center gap-2 rounded-md bg-[#0369A1] px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#0284C7] disabled:opacity-50"
          >
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar pedido
          </button>
        </div>
      </form>

      <ModalCamara
        isOpen={isCamaraOpen}
        onClose={() => setIsCamaraOpen(false)}
        onCapture={handleFotoCapturada}
        titulo="Foto de Pedido de Almacén"
      />

      {loading ? (
        <div className="h-24 animate-pulse rounded-lg bg-gray-100"></div>
      ) : error ? (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">{error}</div>
      ) : (
        <div className="space-y-6">
          <div>
            <h3 className="mb-3 text-sm font-medium text-gray-900">
              Pendientes ({pendientes.length})
            </h3>
            {pendientes.length === 0 ? (
              <p className="text-sm text-gray-500">No hay pedidos pendientes.</p>
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
              <summary className="cursor-pointer text-sm font-medium text-gray-900">
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
