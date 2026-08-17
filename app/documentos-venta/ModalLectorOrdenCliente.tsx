'use client'

import { useState, useRef } from 'react'
import {
  FileText,
  UploadCloud,
  Sparkles,
  Loader2,
  AlertTriangle,
  Building2,
  Calendar,
  DollarSign,
  ArrowRight,
  Boxes,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { getClienteAuth } from '@/lib/firebase'
import { formatPrecio } from '@/lib/format'
import type { VentaOdooSo } from '@/lib/schemas'
import {
  type OrdenCompraClienteExtraida,
  type EmparejamientoVentaOdoo,
  emparejarConVentasOdoo,
} from '@/lib/documentos-venta-lector-ia'

interface ModalLectorOrdenClienteProps {
  abierto: boolean
  onClose: () => void
  sos: readonly VentaOdooSo[]
  onSeleccionarSoConPartidas?: (so: VentaOdooSo, qtyPorLinea: Record<number, number>) => void
}

export default function ModalLectorOrdenCliente({
  abierto,
  onClose,
  sos,
  onSeleccionarSoConPartidas,
}: ModalLectorOrdenClienteProps) {
  const [procesando, setProcesando] = useState(false)
  const [ordenExtraida, setOrdenExtraida] = useState<OrdenCompraClienteExtraida | null>(null)
  const [emparejamientos, setEmparejamientos] = useState<EmparejamientoVentaOdoo[]>([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const limpiar = () => {
    setOrdenExtraida(null)
    setEmparejamientos([])
    setProcesando(false)
  }

  const handleCerrar = () => {
    limpiar()
    onClose()
  }

  const procesarArchivo = async (file: File) => {
    if (!file) return

    const tiposPermitidos = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/jpg',
    ]

    if (!tiposPermitidos.includes(file.type)) {
      toast.error('Formato no soportado. Por favor sube un archivo PDF o imagen (PNG/JPG/WebP).')
      return
    }

    if (file.size > 15 * 1024 * 1024) {
      toast.error('El archivo es demasiado grande (máximo 15 MB).')
      return
    }

    setProcesando(true)
    setOrdenExtraida(null)
    setEmparejamientos([])

    try {
      // Convertir a base64
      const reader = new FileReader()
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string
          const base64Clean = result.includes(',') ? result.split(',')[1] : result
          resolve(base64Clean)
        }
        reader.onerror = () => reject(reader.error)
      })
      reader.readAsDataURL(file)

      const base64 = await base64Promise
      const auth = getClienteAuth()
      const token = (await auth.currentUser?.getIdToken()) || ''

      const res = await fetch('/api/documentos-venta/extraer-po', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          base64,
          mimeType: file.type || 'application/pdf',
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || `Error en el servidor (${res.status})`)
      }

      const data = await res.json()
      const extraida: OrdenCompraClienteExtraida = data.orden
      setOrdenExtraida(extraida)

      // Emparejar con órdenes de venta Odoo
      const matches = emparejarConVentasOdoo(extraida, sos)
      setEmparejamientos(matches)

      toast.success(
        `Orden de compra ${extraida.numeroOrdenCompraCliente} leída con éxito (${extraida.partidas.length} partidas)`
      )
    } catch (err) {
      console.error('[lector-orden-cliente]', err)
      toast.error(
        err instanceof Error ? err.message : 'No se pudo procesar la orden de compra del cliente'
      )
    } finally {
      setProcesando(false)
    }
  }

  const aplicarSo = (match: EmparejamientoVentaOdoo) => {
    if (!onSeleccionarSoConPartidas) return

    const qtyMap: Record<number, number> = {}
    for (const part of match.partidasSugeridas) {
      qtyMap[part.odooLineId] = part.qtySolicitada
    }

    onSeleccionarSoConPartidas(match.so, qtyMap)
    handleCerrar()
    toast.success(`Orden de venta ${match.so.name} seleccionada con partidas sugeridas`)
  }

  return (
    <Dialog open={abierto} onOpenChange={(open) => !open && handleCerrar()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto font-sans p-6">
        <DialogHeader>
          <div className="flex items-center gap-2 text-sky-600">
            <Sparkles className="h-5 w-5" />
            <DialogTitle className="text-xl font-bold text-slate-900">
              Lector Inteligente de Órdenes de Compra (PO)
            </DialogTitle>
          </div>
          <DialogDescription className="text-slate-500 text-sm">
            Sube el archivo PDF o imagen de la orden de compra emitida por el cliente. Gemini 3.7
            extraerá las partidas y buscará la orden de venta (SO) correspondiente en Odoo.
          </DialogDescription>
        </DialogHeader>

        {/* Zona de Carga de Archivo */}
        {!ordenExtraida && !procesando && (
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const f = e.dataTransfer.files?.[0]
              if (f) void procesarArchivo(f)
            }}
            className="mt-4 border-2 border-dashed border-sky-300 hover:border-sky-500 bg-sky-50/50 hover:bg-sky-50/80 transition-colors rounded-2xl p-8 text-center cursor-pointer flex flex-col items-center justify-center gap-3"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void procesarArchivo(f)
              }}
            />
            <div className="h-14 w-14 rounded-full bg-sky-100 flex items-center justify-center text-sky-600 shadow-xs">
              <UploadCloud className="h-7 w-7" />
            </div>
            <div>
              <p className="font-bold text-slate-800 text-base">
                Arrastra tu PDF o imagen de la Orden de Compra aquí
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Soporta archivos PDF, escaneos y capturas JPG / PNG hasta 15 MB
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-sky-300 text-sky-700 bg-white hover:bg-sky-50"
            >
              Seleccionar archivo de tu equipo
            </Button>
          </div>
        )}

        {/* Estado de Procesamiento Animado */}
        {procesando && (
          <div className="mt-8 py-12 flex flex-col items-center justify-center gap-4 text-center">
            <div className="relative">
              <div className="h-16 w-16 rounded-full bg-sky-100 flex items-center justify-center text-sky-600 animate-pulse">
                <Sparkles className="h-8 w-8 animate-spin" style={{ animationDuration: '3s' }} />
              </div>
              <Loader2 className="h-6 w-6 text-sky-500 animate-spin absolute -top-1 -right-1" />
            </div>
            <div>
              <h4 className="font-bold text-slate-800 text-lg">Analizando Orden de Compra con IA...</h4>
              <p className="text-xs text-slate-500 max-w-md mt-1">
                Extrayendo número de PO, razón social, partidas, precios y comparando con órdenes de
                venta activas en Odoo.
              </p>
            </div>
          </div>
        )}

        {/* Vista de Resultados Extraídos */}
        {ordenExtraida && !procesando && (
          <div className="mt-4 space-y-6">
            {/* Header de Datos Principales Extraídos */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Orden de Compra / PO
                    </span>
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 font-mono text-xs">
                      {ordenExtraida.numeroOrdenCompraCliente}
                    </Badge>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5 mt-0.5">
                    <Building2 className="h-4 w-4 text-slate-400" />
                    {ordenExtraida.nombreCliente}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-600">
                {ordenExtraida.fechaEntregaRequerida && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    <span>Entrega: <strong className="text-slate-800">{ordenExtraida.fechaEntregaRequerida}</strong></span>
                  </div>
                )}
                {ordenExtraida.total !== null && ordenExtraida.total !== undefined && (
                  <div className="flex items-center gap-1 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs font-bold text-slate-800">
                    <DollarSign className="h-4 w-4 text-emerald-600" />
                    <span>{formatPrecio(ordenExtraida.total, ordenExtraida.moneda)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Emparejamiento con Órdenes de Venta Odoo */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                <Boxes className="h-3.5 w-3.5 text-sky-600" />
                <span>Órdenes de Venta Coincidentes en Odoo ({emparejamientos.length})</span>
              </h4>

              {emparejamientos.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3 text-amber-800 text-xs">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
                  <div>
                    <span className="font-bold">No se encontró una orden de venta Odoo idéntica.</span>
                    <p className="mt-0.5 text-amber-700">
                      Puedes buscarla manualmente en la lista de SOs con el número de PO{' '}
                      <strong>{ordenExtraida.numeroOrdenCompraCliente}</strong>.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {emparejamientos.map((match) => (
                    <div
                      key={match.so.id}
                      className="border border-sky-200 bg-sky-50/40 hover:bg-sky-50/80 rounded-xl p-3.5 flex flex-col justify-between gap-3 transition-colors shadow-2xs"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-sm text-slate-900 font-mono">
                            {match.so.name}
                          </span>
                          <Badge className="bg-emerald-600 text-white font-bold text-[10px]">
                            {match.scoreCoincidencia}% match
                          </Badge>
                        </div>
                        <p className="text-xs font-medium text-slate-700 mt-1">
                          {match.so.partnerName || 'Sin cliente'}
                        </p>
                        <p className="text-[11px] text-sky-700 font-mono mt-0.5">
                          {match.motivoCoincidencia}
                        </p>
                      </div>

                      <div className="flex items-center justify-between border-t border-sky-100 pt-2 text-xs">
                        <span className="text-slate-500">
                          {match.partidasSugeridas.length} partidas sugeridas
                        </span>
                        <Button
                          size="sm"
                          onClick={() => aplicarSo(match)}
                          className="bg-sky-600 hover:bg-sky-700 text-white font-semibold h-7 text-xs flex items-center gap-1 shadow-2xs"
                        >
                          <span>Usar para Solicitud</span>
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tabla de Partidas Extraídas de la PO */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Partidas Extraídas de la Orden de Compra ({ordenExtraida.partidas.length})
              </h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3 w-12 text-center">#</th>
                      <th className="py-2 px-3">No. Parte / Ref</th>
                      <th className="py-2 px-3">Descripción de Producto</th>
                      <th className="py-2 px-3 text-right">Cant.</th>
                      <th className="py-2 px-3 text-right">P. Unitario</th>
                      <th className="py-2 px-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {ordenExtraida.partidas.map((p, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 px-3 text-center text-slate-400 font-mono">
                          {p.numeroLinea || idx + 1}
                        </td>
                        <td className="py-2 px-3 font-mono font-medium text-slate-700">
                          {p.numeroParteCliente || '-'}
                        </td>
                        <td className="py-2 px-3 text-slate-800">{p.descripcion}</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900">
                          {p.cantidad} {p.unidad}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-600 font-mono">
                          {p.precioUnitario !== null && p.precioUnitario !== undefined
                            ? formatPrecio(p.precioUnitario, ordenExtraida.moneda)
                            : '-'}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-slate-800 font-mono">
                          {p.total !== null && p.total !== undefined
                            ? formatPrecio(p.total, ordenExtraida.moneda)
                            : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Botón para subir otro archivo */}
            <div className="flex justify-between items-center pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={limpiar}
                className="text-xs text-slate-600"
              >
                Cargar otra Orden de Compra
              </Button>
              <Button size="sm" onClick={handleCerrar} className="text-xs">
                Cerrar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
