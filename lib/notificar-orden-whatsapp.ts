import type { OrdenCompra } from '@/lib/schemas'
import { generarMensajeWhatsApp, obtenerUrlWhatsApp } from '@/lib/ordenes-display'
import {
  copiarCapturaRemotaWhatsApp,
  type ResultadoCopiaImagenWhatsApp,
} from '@/lib/whatsapp-notificacion'

type VentanaWhatsApp = Pick<Window, 'location'>

export type ResultadoNotificacionOrdenWhatsApp = {
  whatsappUrl: string
  ventanaAbierta: boolean
  captura: ResultadoCopiaImagenWhatsApp
}

export type DependenciasNotificacionOrdenWhatsApp = {
  abrirVentana?: (url: string, target: string) => VentanaWhatsApp | null
  copiarCaptura?: (url: string | null | undefined) => Promise<ResultadoCopiaImagenWhatsApp>
}

/**
 * Punto único para reenviar una orden existente: abre WhatsApp con el texto
 * precargado y, si la orden conserva una imagen, deja esa captura lista para
 * Ctrl+V. La ventana se abre antes de esperar Storage para no caer en bloqueos
 * de popup del navegador.
 */
export async function notificarOrdenPorWhatsApp(
  orden: OrdenCompra,
  dependencias: DependenciasNotificacionOrdenWhatsApp = {}
): Promise<ResultadoNotificacionOrdenWhatsApp> {
  const whatsappUrl = obtenerUrlWhatsApp(generarMensajeWhatsApp(orden))
  const abrirVentana = dependencias.abrirVentana ?? ((url: string, target: string) => window.open(url, target))
  const copiarCaptura = dependencias.copiarCaptura ?? copiarCapturaRemotaWhatsApp

  const ventana = abrirVentana('about:blank', '_blank')
  // La copia remota puede tardar por Storage. La iniciamos aún bajo el gesto
  // del clic, pero no dejamos WhatsApp en blanco mientras termina.
  const copiaPendiente = copiarCaptura(orden.imagenUrl)
  if (ventana) ventana.location.href = whatsappUrl
  const captura = await copiaPendiente

  return {
    whatsappUrl,
    ventanaAbierta: Boolean(ventana),
    captura,
  }
}
