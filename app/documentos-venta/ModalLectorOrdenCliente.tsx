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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import ModuleSurface from '@/components/layout/ModuleSurface'

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
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto p-6 font-sans">
        <DialogHeader>
          <div className="flex items-center gap-2 text-sky-600">
            <Sparkles className="h-5 w-5" />
            <DialogTitle className="text-xl font-bold text-foreground">
              Lector Inteligente de Órdenes de Compra (PO)
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            Sube el archivo PDF o imagen de la orden de compra emitida por el cliente. Gemini 3.7
            extraerá las partidas y buscará la orden de venta (SO) correspondiente en Odoo.
          </DialogDescription>
        </DialogHeader>

        {!ordenExtraida && !procesando && (
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const f = e.dataTransfer.files?.[0]
              if (f) void procesarArchivo(f)
            }}
            className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-sky-300 bg-sky-50/50 p-8 text-center transition-colors hover:border-sky-500 hover:bg-sky-50/80"
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
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-sky-100 text-sky-600 shadow-xs">
              <UploadCloud className="h-7 w-7" />
            </div>
            <div>
              <p className="text-base font-bold text-foreground">
                Arrastra tu PDF o imagen de la Orden de Compra aquí
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Soporta archivos PDF, escaneos y capturas JPG / PNG hasta 15 MB
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-sky-300 bg-card text-sky-700 hover:bg-sky-50"
            >
              Seleccionar archivo de tu equipo
            </Button>
          </div>
        )}

        {procesando && (
          <div className="mt-8 flex flex-col items-center justify-center gap-4 py-12 text-center">
            <div className="relative">
              <div className="flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-sky-100 text-sky-600">
                <Sparkles className="h-8 w-8 animate-spin" style={{ animationDuration: '3s' }} />
              </div>
              <Loader2 className="absolute -top-1 -right-1 h-6 w-6 animate-spin text-sky-500" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-foreground">Analizando Orden de Compra con IA...</h4>
              <p className="mt-1 max-w-md text-xs text-muted-foreground">
                Extrayendo número de PO, razón social, partidas, precios y comparando con órdenes de
                venta activas en Odoo.
              </p>
            </div>
          </div>
        )}

        {ordenExtraida && !procesando && (
          <div className="mt-4 space-y-6">
            <ModuleSurface className="flex flex-wrap items-center justify-between gap-4 bg-muted p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 font-bold text-sky-700">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Orden de Compra / PO
                    </span>
                    <Badge variant="outline" className="border-emerald-300 bg-emerald-50 font-mono text-xs text-emerald-700">
                      {ordenExtraida.numeroOrdenCompraCliente}
                    </Badge>
                  </div>
                  <h3 className="mt-0.5 flex items-center gap-1.5 text-base font-bold text-foreground">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    {ordenExtraida.nombreCliente}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {ordenExtraida.fechaEntregaRequerida && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>
                      Entrega:{' '}
                      <strong className="text-foreground">{ordenExtraida.fechaEntregaRequerida}</strong>
                    </span>
                  </div>
                )}
                {ordenExtraida.total !== null && ordenExtraida.total !== undefined && (
                  <div className="flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 font-bold text-foreground shadow-xs">
                    <DollarSign className="h-4 w-4 text-emerald-600" />
                    <span>{formatPrecio(ordenExtraida.total, ordenExtraida.moneda)}</span>
                  </div>
                )}
              </div>
            </ModuleSurface>

            <div>
              <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <Boxes className="h-3.5 w-3.5 text-sky-600" />
                <span>Órdenes de Venta Coincidentes en Odoo ({emparejamientos.length})</span>
              </h4>

              {emparejamientos.length === 0 ? (
                <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
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
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {emparejamientos.map((match) => (
                    <div
                      key={match.so.id}
                      className="flex flex-col justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50/40 p-3.5 shadow-xs transition-colors hover:bg-sky-50/80"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-sm font-bold text-foreground">
                            {match.so.name}
                          </span>
                          <Badge className="bg-emerald-600 text-[10px] font-bold text-white">
                            {match.scoreCoincidencia}% match
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs font-medium text-foreground">
                          {match.so.partnerName || 'Sin cliente'}
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] text-sky-700">
                          {match.motivoCoincidencia}
                        </p>
                      </div>

                      <div className="flex items-center justify-between border-t border-sky-100 pt-2 text-xs">
                        <span className="text-muted-foreground">
                          {match.partidasSugeridas.length} partidas sugeridas
                        </span>
                        <Button
                          size="sm"
                          onClick={() => aplicarSo(match)}
                          className="flex h-7 items-center gap-1 bg-sky-600 text-xs font-semibold text-white shadow-xs hover:bg-sky-700"
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

            <div>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Partidas Extraídas de la Orden de Compra ({ordenExtraida.partidas.length})
              </h4>
              <ModuleSurface>
                <Table className="w-full text-left text-xs">
                  <TableHeader className="border-b border-border bg-muted font-semibold text-muted-foreground">
                    <TableRow>
                      <TableHead className="w-12 px-3 py-2 text-center">#</TableHead>
                      <TableHead className="px-3 py-2">No. Parte / Ref</TableHead>
                      <TableHead className="px-3 py-2">Descripción de Producto</TableHead>
                      <TableHead className="px-3 py-2 text-right">Cant.</TableHead>
                      <TableHead className="px-3 py-2 text-right">P. Unitario</TableHead>
                      <TableHead className="px-3 py-2 text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-border bg-card">
                    {ordenExtraida.partidas.map((p, idx) => (
                      <TableRow key={idx} className="hover:bg-muted">
                        <TableCell className="px-3 py-2 text-center font-mono text-muted-foreground">
                          {p.numeroLinea || idx + 1}
                        </TableCell>
                        <TableCell className="px-3 py-2 font-mono font-medium text-foreground">
                          {p.numeroParteCliente || '-'}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-foreground">{p.descripcion}</TableCell>
                        <TableCell className="px-3 py-2 text-right font-bold text-foreground">
                          {p.cantidad} {p.unidad}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-right font-mono text-muted-foreground">
                          {p.precioUnitario !== null && p.precioUnitario !== undefined
                            ? formatPrecio(p.precioUnitario, ordenExtraida.moneda)
                            : '-'}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-right font-mono font-bold text-foreground">
                          {p.total !== null && p.total !== undefined
                            ? formatPrecio(p.total, ordenExtraida.moneda)
                            : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ModuleSurface>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={limpiar}
                className="text-xs text-muted-foreground"
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
