'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import NuevaCompraForm from './NuevaCompraForm'
import { subirImagenOrden } from '@/lib/storage'
import { crearOrden } from '@/lib/ordenes'
import { marcarPedidoAlmacenComprado } from '@/lib/pedidos-almacen'
import type { NuevaCompraForm as FormData } from '@/lib/schemas'
import { sincronizarCamposLegacyOrden } from '@/lib/schemas'
import { generarMensajeWhatsApp, copiarOrdenAlPortapapeles, LINK_GRUPO_WHATSAPP } from '@/lib/ordenes-display'

export default function NuevaCompraFormWrapper({
  pedidoId,
  descripcionInicial,
}: {
  pedidoId?: string
  descripcionInicial?: string
} = {}) {
  const router = useRouter()
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null)

  async function handleSubmit(data: FormData, imagen?: File, notificarWhatsApp?: boolean) {
    setErrorGuardado(null)
    try {
      const imagenGuardada = imagen ? await subirImagenOrden(imagen) : null
      const ordenId = await crearOrden(
        sincronizarCamposLegacyOrden({
          ...data,
          ...(imagenGuardada
            ? { imagenUrl: imagenGuardada.url, imagenPath: imagenGuardada.path }
            : {}),
        })
      )

      if (pedidoId) {
        // Best-effort: la orden ya se guardó, que es lo importante — si esto
        // falla no bloqueamos la navegación, solo queda el pedido sin vincular.
        try {
          await marcarPedidoAlmacenComprado(pedidoId, ordenId)
        } catch (err) {
          console.error('[nueva-compra] no se pudo vincular el pedido de almacén:', err)
        }
      }

      if (notificarWhatsApp) {
        const msg = generarMensajeWhatsApp({
          ...data,
          id: ordenId,
          estado: 'pendiente',
          creadoEn: new Date(),
          actualizadoEn: new Date(),
        })
        try {
          await copiarOrdenAlPortapapeles(msg)
        } catch (err) {
          console.warn('[nueva-compra] no se pudo copiar al portapapeles:', err)
        }
        window.open(LINK_GRUPO_WHATSAPP, '_blank')
      }

      router.push('/ordenes')
    } catch (err) {
      console.error('[nueva-compra] error al guardar:', err)
      setErrorGuardado('No se pudo guardar la compra. Revisa tu conexión e intenta de nuevo.')
    }
  }

  return (
    <>
      {errorGuardado && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorGuardado}
        </div>
      )}
      <NuevaCompraForm onSubmit={handleSubmit} initialDescripcion={descripcionInicial} />
    </>
  )
}
