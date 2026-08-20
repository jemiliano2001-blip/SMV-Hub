'use client'

import { Loader2 } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { buttonVariants } from '@/components/ui/button'

import type { TotalesCotizacion } from './tipos-captura'

export interface DialogoConfirmarCotizacionProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  enviando: boolean
  proveedor: string
  proveedorId: number | null
  referenciaProveedor: string
  moneda: 'MXN' | 'USD'
  fecha: string
  fechaRecepcion: string
  itemsCount: number
  totales: TotalesCotizacion
  onConfirmar: () => void
}

function formatMoney(n: number) {
  return n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function DialogoConfirmarCotizacion({
  open,
  onOpenChange,
  enviando,
  proveedor,
  proveedorId,
  referenciaProveedor,
  moneda,
  fecha,
  fechaRecepcion,
  itemsCount,
  totales,
  onConfirmar,
}: DialogoConfirmarCotizacionProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Crear cotización en Odoo?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-muted-foreground flex flex-col gap-2 text-sm">
              <p>Se creará una solicitud de cotización (RFQ) en borrador en Odoo ERP.</p>
              <dl className="bg-muted/50 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 rounded-lg border p-3 text-xs">
                <dt className="text-muted-foreground font-medium">Proveedor</dt>
                <dd className="text-foreground font-semibold">
                  {proveedor}
                  {proveedorId != null ? (
                    <span className="text-muted-foreground ml-1 font-mono font-normal">
                      (#{proveedorId})
                    </span>
                  ) : null}
                </dd>
                <dt className="text-muted-foreground font-medium">Ref.</dt>
                <dd className="text-foreground font-mono">{referenciaProveedor || '—'}</dd>
                <dt className="text-muted-foreground font-medium">Moneda</dt>
                <dd className="text-foreground font-mono">{moneda}</dd>
                <dt className="text-muted-foreground font-medium">Fecha orden</dt>
                <dd className="text-foreground font-mono">{fecha || '—'}</dd>
                <dt className="text-muted-foreground font-medium">Recepción</dt>
                <dd className="text-foreground font-mono">{fechaRecepcion || '—'}</dd>
                <dt className="text-muted-foreground font-medium">Partidas</dt>
                <dd className="text-foreground font-mono">{itemsCount}</dd>
                <dt className="text-muted-foreground font-medium">Subtotal</dt>
                <dd className="text-foreground font-mono tabular-nums">
                  ${formatMoney(totales.subtotal)} {moneda}
                </dd>
                <dt className="text-muted-foreground font-medium">IVA est.</dt>
                <dd className="text-foreground font-mono tabular-nums">
                  ${formatMoney(totales.iva)} {moneda}
                </dd>
                <dt className="text-muted-foreground font-medium">Total</dt>
                <dd className="text-foreground font-mono font-bold tabular-nums">
                  ${formatMoney(totales.total)} {moneda}
                </dd>
              </dl>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={enviando}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={enviando}
            className={buttonVariants()}
            onClick={(e) => {
              e.preventDefault()
              onConfirmar()
            }}
          >
            {enviando ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
            {enviando ? 'Creando...' : 'Confirmar y crear'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
