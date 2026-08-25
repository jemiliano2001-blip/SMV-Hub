'use client'

import { Printer, X, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import LogoSMV from '@/app/LogoSMV'
import { formatearMoneda } from '@/lib/format'
import type { OrdenCompraUsa } from '@/lib/schemas'

interface OrdenCompraImprimibleProps {
  orden: OrdenCompraUsa
  onCerrar?: () => void
  onEnviarEmail?: () => void
}

export default function OrdenCompraImprimible({
  orden,
  onCerrar,
  onEnviarEmail,
}: OrdenCompraImprimibleProps) {
  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Barra de herramientas (oculta en print) */}
      <div className="flex items-center justify-between border-b border-border pb-3 print:hidden">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">
            Vista Previa de Purchase Order: <span className="font-mono text-primary">{orden.folio}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onEnviarEmail && (
            <Button variant="outline" size="sm" onClick={onEnviarEmail} className="cursor-pointer">
              <Mail className="mr-1.5 size-4" />
              Enviar por correo
            </Button>
          )}
          <Button size="sm" onClick={handlePrint} className="cursor-pointer">
            <Printer className="mr-1.5 size-4" />
            Imprimir / Guardar PDF
          </Button>
          {onCerrar && (
            <Button variant="ghost" size="sm" onClick={onCerrar} className="cursor-pointer">
              <X className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Hoja de Impresión Formal (Purchase Order USA) */}
      <div className="mx-auto w-full max-w-4xl rounded-xl border border-border bg-card p-8 text-foreground shadow-sm print:m-0 print:border-none print:bg-white print:p-0 print:text-black print:shadow-none">
        {/* Encabezado Superior */}
        <div className="flex items-start justify-between border-b border-border pb-6 print:border-slate-300">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <LogoSMV height={32} />
              <span className="text-lg font-bold tracking-tight text-foreground print:text-black">
                SMV INDUSTRIAL & MACHINING
              </span>
            </div>
            <p className="text-xs text-muted-foreground print:text-slate-600">
              Precision Tooling & Manufacturing Services
            </p>
            <p className="text-xs text-muted-foreground print:text-slate-600">
              Operaciones México - USA Logistics
            </p>
          </div>

          <div className="text-right">
            <h1 className="text-2xl font-black tracking-tight text-primary print:text-slate-900">
              PURCHASE ORDER
            </h1>
            <div className="mt-1 font-mono text-base font-bold text-foreground print:text-black">
              {orden.folio}
            </div>
            <div className="mt-1 text-xs text-muted-foreground print:text-slate-600">
              Date: <span className="font-semibold text-foreground print:text-black">{orden.fechaPedido}</span>
            </div>
            {orden.fechaEntregaEstimada && (
              <div className="text-xs text-muted-foreground print:text-slate-600">
                Delivery Date: <span className="font-semibold text-foreground print:text-black">{orden.fechaEntregaEstimada}</span>
              </div>
            )}
          </div>
        </div>

        {/* Sección Proveedor / Envío (Ship To) */}
        <div className="grid grid-cols-2 gap-6 border-b border-border py-6 print:border-slate-300">
          {/* Vendor */}
          <div className="flex flex-col gap-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground print:text-slate-500">
              Vendor / Proveedor:
            </h3>
            <div className="text-sm font-bold text-foreground print:text-black">
              {orden.proveedor}
            </div>
            {orden.referenciaProveedor && (
              <div className="text-xs text-muted-foreground print:text-slate-600">
                Ref / Quote #: <span className="font-mono font-medium text-foreground print:text-black">{orden.referenciaProveedor}</span>
              </div>
            )}
            <div className="text-xs text-muted-foreground print:text-slate-600">
              Currency: <span className="font-semibold text-foreground print:text-black">{orden.moneda || 'USD'}</span>
            </div>
          </div>

          {/* Ship To (USA Address) */}
          <div className="flex flex-col gap-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground print:text-slate-500">
              Ship To / Dirección de Entrega USA:
            </h3>
            <div className="text-sm font-semibold text-foreground print:text-black">
              SMV LOGISTICS / WAREHOUSE
            </div>
            <div className="text-xs text-muted-foreground print:text-slate-700">
              {orden.shippingAddressUSA || '5423 Lovers Ln Brownsville, Texas 78526'}
            </div>
            {orden.brokerAduanal && (
              <div className="text-xs text-muted-foreground print:text-slate-600">
                Customs Broker: <span className="font-medium text-foreground print:text-black">{orden.brokerAduanal}</span>
              </div>
            )}
          </div>
        </div>

        {/* Metadatos Comerciales */}
        <div className="grid grid-cols-4 gap-4 border-b border-border py-3 text-xs print:border-slate-300">
          <div>
            <span className="text-muted-foreground print:text-slate-500">Payment Terms:</span>
            <div className="font-semibold text-foreground print:text-black">{orden.terminosPago || 'Net 30'}</div>
          </div>
          <div>
            <span className="text-muted-foreground print:text-slate-500">Shipping Method:</span>
            <div className="font-semibold text-foreground print:text-black">{orden.metodoEnvio || 'UPS Ground'}</div>
          </div>
          <div>
            <span className="text-muted-foreground print:text-slate-500">Buyer / Comprador:</span>
            <div className="font-semibold text-foreground print:text-black">{orden.comprador || 'SMV Purchasing'}</div>
          </div>
          <div>
            <span className="text-muted-foreground print:text-slate-500">Work Order / OT:</span>
            <div className="font-semibold text-foreground print:text-black">{orden.ordenTrabajo || 'N/A'}</div>
          </div>
        </div>

        {/* Tabla de Partidas */}
        <div className="py-6">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40 font-semibold text-muted-foreground print:border-slate-300 print:bg-slate-100 print:text-slate-700">
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Part # / SKU</th>
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-3 text-right">Qty</th>
                <th className="py-2.5 px-3 text-right">Unit Price</th>
                <th className="py-2.5 px-3 text-right">Ext. Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border print:divide-slate-200">
              {orden.items.map((it, idx) => (
                <tr key={it.id || idx} className="text-foreground print:text-black">
                  <td className="py-2.5 px-3 text-muted-foreground print:text-slate-500">{idx + 1}</td>
                  <td className="py-2.5 px-3 font-mono font-medium">{it.producto || '—'}</td>
                  <td className="py-2.5 px-3 font-medium">
                    <div>{it.descripcion}</div>
                    {it.ordenTrabajo && (
                      <div className="text-[10px] text-muted-foreground print:text-slate-500">
                        OT: {it.ordenTrabajo} {it.cuentaCargo ? `| Cargo: ${it.cuentaCargo}` : ''}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right font-semibold">{it.cantidad}</td>
                  <td className="py-2.5 px-3 text-right font-mono">
                    {formatearMoneda(it.precioUnitario, orden.moneda || 'USD')}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-semibold">
                    {formatearMoneda(it.subtotal, orden.moneda || 'USD')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totales y Notas */}
        <div className="grid grid-cols-12 gap-6 border-t border-border pt-4 print:border-slate-300">
          <div className="col-span-7 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground print:text-slate-500">
                Instructions / Notes:
              </h4>
              <p className="mt-1 text-xs text-muted-foreground whitespace-pre-line print:text-slate-700">
                {orden.notas || 'Please reference this Purchase Order number on all shipping documents, packing slips, and invoices.'}
              </p>
            </div>

            <div className="mt-8 border-t border-border pt-3 print:border-slate-300">
              <div className="text-xs font-semibold text-foreground print:text-black">Authorized Signature:</div>
              <div className="mt-6 border-b border-border w-48 print:border-slate-400"></div>
              <div className="text-[10px] text-muted-foreground print:text-slate-500 mt-1">
                SMV Purchasing Department
              </div>
            </div>
          </div>

          <div className="col-span-5 flex flex-col gap-2 rounded-lg bg-muted/30 p-4 print:bg-slate-50">
            <div className="flex justify-between text-xs text-muted-foreground print:text-slate-600">
              <span>Subtotal:</span>
              <span className="font-mono font-semibold text-foreground print:text-black">
                {formatearMoneda(orden.subtotal, orden.moneda || 'USD')}
              </span>
            </div>
            {orden.envio > 0 && (
              <div className="flex justify-between text-xs text-muted-foreground print:text-slate-600">
                <span>Shipping & Handling:</span>
                <span className="font-mono font-semibold text-foreground print:text-black">
                  {formatearMoneda(orden.envio, orden.moneda || 'USD')}
                </span>
              </div>
            )}
            {orden.impuestos > 0 && (
              <div className="flex justify-between text-xs text-muted-foreground print:text-slate-600">
                <span>Sales Tax:</span>
                <span className="font-mono font-semibold text-foreground print:text-black">
                  {formatearMoneda(orden.impuestos, orden.moneda || 'USD')}
                </span>
              </div>
            )}
            <div className="border-t border-border pt-2 print:border-slate-300 flex justify-between text-sm font-bold text-foreground print:text-black">
              <span>Total ({orden.moneda || 'USD'}):</span>
              <span className="font-mono text-primary print:text-slate-950">
                {formatearMoneda(orden.total, orden.moneda || 'USD')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
