'use client'

import { useState } from 'react'
import { Mail, Copy, Check, ExternalLink } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { formatearMoneda } from '@/lib/format'
import type { OrdenCompraUsa } from '@/lib/schemas'

interface ModalEnviarEmailPOProps {
  orden: OrdenCompraUsa | null
  emailProveedorDefault?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function ModalEnviarEmailPO({
  orden,
  emailProveedorDefault = '',
  open,
  onOpenChange,
}: ModalEnviarEmailPOProps) {
  const [destinatario, setDestinatario] = useState(emailProveedorDefault)
  const [copiado, setCopiado] = useState(false)

  if (!orden) return null

  const asunto = `Purchase Order ${orden.folio} - SMV Industrial`
  
  const lineasItems = orden.items
    .map(
      (it, i) =>
        `${i + 1}. [${it.producto || 'N/A'}] ${it.descripcion} - Qty: ${it.cantidad} @ ${formatearMoneda(it.precioUnitario, orden.moneda)} = ${formatearMoneda(it.subtotal, orden.moneda)}`
    )
    .join('\n')

  const cuerpo = `Dear ${orden.proveedor} Sales / Order Team,

Please find attached / detailed our Purchase Order ${orden.folio}:

PO Number: ${orden.folio}
Date: ${orden.fechaPedido}
${orden.referenciaProveedor ? `Quote / Reference #: ${orden.referenciaProveedor}\n` : ''}Payment Terms: ${orden.terminosPago || 'Net 30'}
Shipping Method: ${orden.metodoEnvio || 'UPS Ground'}

Ship To Address:
SMV Logistics / Warehouse
${orden.shippingAddressUSA || '5423 Lovers Ln Brownsville, Texas 78526'}

Order Items:
----------------------------------------
${lineasItems}
----------------------------------------
Subtotal: ${formatearMoneda(orden.subtotal, orden.moneda)}
${orden.envio > 0 ? `Shipping: ${formatearMoneda(orden.envio, orden.moneda)}\n` : ''}${orden.impuestos > 0 ? `Tax: ${formatearMoneda(orden.impuestos, orden.moneda)}\n` : ''}Total: ${formatearMoneda(orden.total, orden.moneda)}

Notes & Instructions:
${orden.notas || 'Please confirm receipt and expected delivery date.'}

Best regards,
${orden.comprador || 'SMV Purchasing Team'}
SMV Industrial & Machining`

  const mailtoUrl = `mailto:${encodeURIComponent(destinatario)}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`

  const handleCopiar = async () => {
    try {
      await navigator.clipboard.writeText(`Subject: ${asunto}\n\n${cuerpo}`)
      setCopiado(true)
      toast.success('Contenido del correo copiado al portapapeles')
      setTimeout(() => setCopiado(false), 2500)
    } catch {
      toast.error('No se pudo copiar el texto')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card text-foreground border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Mail className="size-5 text-primary" />
            Enviar Purchase Order por Correo
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Redacta y abre tu cliente de correo para enviar la orden <span className="font-mono font-semibold text-foreground">{orden.folio}</span> a {orden.proveedor}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Correo del Proveedor / Destinatario:</label>
            <input
              type="email"
              value={destinatario}
              onChange={(e) => setDestinatario(e.target.value)}
              placeholder="sales@vendor.com"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground">Asunto:</label>
            <div className="mt-1 rounded-md border border-input bg-muted/40 px-3 py-2 text-sm font-medium text-foreground">
              {asunto}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground">Cuerpo del Mensaje:</label>
            <textarea
              readOnly
              rows={8}
              value={cuerpo}
              className="mt-1 w-full rounded-md border border-input bg-muted/20 p-3 font-mono text-xs text-foreground focus:outline-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={handleCopiar} className="cursor-pointer">
            {copiado ? (
              <>
                <Check className="mr-1.5 size-4 text-emerald-600" />
                Copiado
              </>
            ) : (
              <>
                <Copy className="mr-1.5 size-4" />
                Copiar mensaje
              </>
            )}
          </Button>

          <Button size="sm" asChild className="cursor-pointer">
            <a href={mailtoUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-1.5 size-4" />
              Abrir cliente de correo
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
