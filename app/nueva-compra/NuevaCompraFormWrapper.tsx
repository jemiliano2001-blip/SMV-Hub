'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import NuevaCompraForm, { type InitialDataCompra } from './NuevaCompraForm'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { subirImagenOrden } from '@/lib/storage'
import { crearOrden } from '@/lib/ordenes'
import { marcarPedidoAlmacenComprado } from '@/lib/pedidos-almacen'
import type { NuevaCompraForm as FormData } from '@/lib/schemas'
import { sincronizarCamposLegacyOrden } from '@/lib/schemas'
import { generarMensajeWhatsApp, obtenerUrlWhatsApp } from '@/lib/ordenes-display'
import { copiarCapturaWhatsApp, type ResultadoCopiaImagenWhatsApp } from '@/lib/whatsapp-notificacion'

export default function NuevaCompraFormWrapper({
  pedidoId,
  descripcionInicial,
  requisicionId,
  initialData,
}: {
  pedidoId?: string
  descripcionInicial?: string
  requisicionId?: string
  initialData?: InitialDataCompra
} = {}) {
  const router = useRouter()
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null)
  const [fallbackWhatsApp, setFallbackWhatsApp] = useState<{
    mensaje: string
    comprobanteUrl?: string
    whatsappUrl: string

  } | null>(null)

  async function handleSubmit(
    data: FormData,
    imagen?: File,
    notificarWhatsApp?: boolean,
    proveedorId?: string | null
  ) {
    setErrorGuardado(null)
    setFallbackWhatsApp(null)
    // Abrimos la pestaña y solicitamos el portapapeles mientras el clic del usuario
    // sigue activo. Después de subir a Storage/Firestore los navegadores pueden
    // bloquear ambas acciones aunque la compra se haya guardado correctamente.
    const ventanaWhatsApp = notificarWhatsApp ? window.open('about:blank', '_blank') : null
    const resultadoCopia: ResultadoCopiaImagenWhatsApp | null = notificarWhatsApp
      ? await copiarCapturaWhatsApp(imagen)
      : null
    try {
      const imagenGuardada = imagen ? await subirImagenOrden(imagen) : null
      const ordenId = await crearOrden(
        sincronizarCamposLegacyOrden({
          ...data,
          requisicionId: requisicionId ?? null,
          proveedorId: proveedorId ?? null,
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

      if (requisicionId) {
        try {
          const reqRef = doc(db, 'requisiciones', requisicionId)
          await setDoc(
            reqRef,
            {
              estado: 'comprado',
              estatusFlujo: 'convertida_a_oc',
              ordenCompraId: ordenId,
              actualizadoEn: serverTimestamp(),
            },
            { merge: true }
          )
        } catch (err) {
          console.error('[nueva-compra] no se pudo vincular la requisición:', err)
        }
      }

      if (notificarWhatsApp) {
        const msg = generarMensajeWhatsApp({
          ...data,
          id: ordenId,
          estado: 'pendiente',
          estadoRecepcion: 'pendiente',
          creadoEn: new Date(),
          actualizadoEn: new Date(),
        })
        const whatsappUrl = obtenerUrlWhatsApp(msg)
        if (ventanaWhatsApp) {
          ventanaWhatsApp.location.href = whatsappUrl
        }

        if (!ventanaWhatsApp || resultadoCopia?.estado !== 'copiada') {
          const mensajeFallback =
            resultadoCopia?.estado === 'fallback'
              ? resultadoCopia.mensaje
              : 'No se pudo copiar el comprobante como imagen.'
          setFallbackWhatsApp({
            mensaje: !ventanaWhatsApp
              ? 'El navegador bloqueó la pestaña de WhatsApp. Ábrela con el enlace de abajo.'
              : mensajeFallback,
            comprobanteUrl: imagenGuardada?.url,
            whatsappUrl,
          })
          return
        }
      }

      router.push('/ordenes')
    } catch (err) {
      ventanaWhatsApp?.close()
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
      {fallbackWhatsApp && (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Compra guardada; falta adjuntar el comprobante.</p>
          <p className="mt-1">{fallbackWhatsApp.mensaje}</p>
          <p className="mt-1">WhatsApp lleva el texto listo. Adjunta el comprobante manualmente antes de enviar.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={fallbackWhatsApp.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              Abrir WhatsApp con texto
            </a>
            {fallbackWhatsApp.comprobanteUrl && (
              <a
                href={fallbackWhatsApp.comprobanteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-amber-400 bg-white px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-100"
              >
                Abrir comprobante
              </a>
            )}
            <button
              type="button"
              onClick={() => router.push('/ordenes')}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Ir a órdenes
            </button>
          </div>
        </div>
      )}
      {!fallbackWhatsApp && (
        <NuevaCompraForm
          onSubmit={handleSubmit}
          initialDescripcion={descripcionInicial}
          initialData={initialData}
        />
      )}
    </>
  )

}
