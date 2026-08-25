'use client'

import { Printer, ArrowLeft, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { imprimirComoDocumento } from '@/lib/imprimir-documento'
import type { OrdenCompraUsa } from '@/lib/schemas'

interface OrdenCompraImprimibleProps {
  orden: OrdenCompraUsa
  onCerrar?: () => void
  onEnviarEmail?: () => void
}

/**
 * Formatea en el locale del documento (la PO va en ingles al proveedor USA),
 * pero con la moneda real de la orden: el encabezado imprime `orden.moneda` y
 * el schema admite MXN, asi que clavar 'USD' mostraria simbolos que no cuadran.
 */
function formatMonto(
  amount: number | null | undefined,
  moneda: OrdenCompraUsa['moneda'] | undefined
): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: moneda || 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount ?? 0)
}

function formatOrderDate(dateStr?: string | null): string {
  if (!dateStr) return '—'
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return dateStr
  const year = match[1]
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ]
  const month = monthNames[parseInt(match[2], 10) - 1] || match[2]
  const day = parseInt(match[3], 10)
  return `${month} ${day}, ${year}`
}

function getStatusLabelEN(estado?: string): string {
  switch (estado) {
    case 'enviada':
      return 'ISSUED / SENT'
    case 'confirmada':
      return 'CONFIRMED'
    case 'recibida':
      return 'FULFILLED / RECEIVED'
    case 'cancelada':
      return 'CANCELLED'
    case 'borrador':
    default:
      return 'DRAFT / RFQ'
  }
}

export default function OrdenCompraImprimible({
  orden,
  onCerrar,
  onEnviarEmail,
}: OrdenCompraImprimibleProps) {
  const handlePrint = () => {
    imprimirComoDocumento(`PO_${orden.folio}_${orden.proveedor || 'Proveedor'}`)
  }

  const buyerCompany = orden.empresa?.trim() || 'RGV Metal and Plastics CO.'
  const shipToAddress = orden.shippingAddressUSA?.trim() || '5423 Lovers Ln Brownsville, Texas 78526'

  return (
    <div className="flex flex-col gap-6">
      {/* ── TOOLBAR DE ACCIONES (Oculta al imprimir) ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground shadow-xs print:hidden">
        <div className="flex items-center gap-3">
          {onCerrar && (
            <Button
              variant="outline"
              size="sm"
              onClick={onCerrar}
              className="cursor-pointer gap-1.5"
            >
              <ArrowLeft className="size-4" />
              Volver al formulario
            </Button>
          )}
          <div className="text-sm">
            <span className="text-muted-foreground">Documento: </span>
            <span className="font-mono font-bold text-foreground">{orden.folio}</span>
            <span className="ml-2 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              PDF Formal (US Standard)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onEnviarEmail && (
            <Button
              variant="outline"
              size="sm"
              onClick={onEnviarEmail}
              className="cursor-pointer"
            >
              <Mail className="mr-1.5 size-4" />
              Enviar por correo
            </Button>
          )}
          <Button
            size="sm"
            onClick={handlePrint}
            className="cursor-pointer bg-primary font-semibold text-primary-foreground shadow-xs hover:bg-primary/90"
          >
            <Printer className="mr-1.5 size-4" />
            Imprimir / Guardar como PDF
          </Button>
        </div>
      </div>

      {/* ── DOCUMENTO FORMAL DE PURCHASE ORDER (ESTÁNDAR USA) ── */}
      <div className="orden-compra-paper-container mx-auto w-full max-w-[850px] rounded-lg border border-border bg-card p-8 text-foreground shadow-md sm:p-12 print:m-0 print:max-w-none print:w-full print:rounded-none print:border-none print:bg-white print:p-0 print:text-black print:shadow-none">
        
        {/* Encabezado Superior Corporativo */}
        <div className="flex items-start justify-between border-b-2 border-foreground/80 pb-5 print:border-black">
          <div className="flex flex-col">
            <h1 className="text-xl font-black tracking-tight text-foreground sm:text-2xl uppercase print:text-black">
              {buyerCompany}
            </h1>
            <p className="text-xs font-semibold text-muted-foreground tracking-wide mt-0.5 print:text-gray-700">
              Precision Machining, Tooling & Industrial Supply
            </p>
            <p className="text-xs text-muted-foreground mt-1 print:text-gray-600">
              5423 Lovers Ln, Brownsville, TX 78526, United States
            </p>
            <p className="text-[11px] text-muted-foreground print:text-gray-500">
              Operations & Logistics | Email: purchasing@rgvmetalplastics.com
            </p>
          </div>

          <div className="flex flex-col items-end text-right">
            <span className="text-2xl font-black tracking-widest text-primary sm:text-3xl print:text-black">
              PURCHASE ORDER
            </span>
            <div className="mt-2 w-48 rounded border border-border bg-muted/40 p-2 text-left text-xs print:border-black print:bg-transparent">
              <div className="flex justify-between">
                <span className="font-bold text-muted-foreground print:text-gray-600">P.O. NUMBER:</span>
                <span className="font-mono font-bold text-foreground print:text-black">{orden.folio}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="font-bold text-muted-foreground print:text-gray-600">P.O. DATE:</span>
                <span className="font-medium text-foreground print:text-black">{formatOrderDate(orden.fechaPedido)}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="font-bold text-muted-foreground print:text-gray-600">STATUS:</span>
                <span className="font-bold text-foreground print:text-black">{getStatusLabelEN(orden.estado)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sección VENDOR y SHIP TO (2 Cajas B2B) */}
        <div className="grid grid-cols-2 gap-4 py-4">
          {/* Vendor / Supplier Box */}
          <div className="rounded border border-border bg-card print:border-black print:bg-white">
            <div className="border-b border-border bg-muted/60 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-foreground print:border-black print:bg-gray-100 print:text-black">
              Vendor / Supplier
            </div>
            <div className="p-3 text-xs leading-relaxed">
              <div className="font-bold text-sm text-foreground print:text-black">{orden.proveedor}</div>
              {orden.referenciaProveedor && (
                <div className="mt-1 text-muted-foreground print:text-gray-700">
                  <span className="font-semibold text-foreground print:text-black">Quotation / Ref #:</span>{' '}
                  <span className="font-mono">{orden.referenciaProveedor}</span>
                </div>
              )}
              <div className="mt-1 text-muted-foreground print:text-gray-700">
                <span className="font-semibold text-foreground print:text-black">Payment Terms:</span>{' '}
                {orden.terminosPago || 'Credit (Net 30)'}
              </div>
              <div className="mt-0.5 text-muted-foreground print:text-gray-700">
                <span className="font-semibold text-foreground print:text-black">Currency:</span>{' '}
                {orden.moneda || 'USD'} ($)
              </div>
            </div>
          </div>

          {/* Ship To Box */}
          <div className="rounded border border-border bg-card print:border-black print:bg-white">
            <div className="border-b border-border bg-muted/60 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-foreground print:border-black print:bg-gray-100 print:text-black">
              Ship To (Delivery Destination)
            </div>
            <div className="p-3 text-xs leading-relaxed">
              <div className="font-bold text-sm text-foreground print:text-black">{buyerCompany}</div>
              <div className="mt-1 text-muted-foreground whitespace-pre-line print:text-gray-700">{shipToAddress}</div>
              {orden.brokerAduanal && (
                <div className="mt-1 text-muted-foreground print:text-gray-700">
                  <span className="font-semibold text-foreground print:text-black">Customs Broker:</span> {orden.brokerAduanal}
                </div>
              )}
              <div className="mt-0.5 text-muted-foreground print:text-gray-700">
                <span className="font-semibold text-foreground print:text-black">Attention:</span>{' '}
                {orden.solicitante || orden.comprador || 'Plant Receiving Dept.'}
              </div>
            </div>
          </div>
        </div>

        {/* Barra de Términos Comerciales */}
        <div className="overflow-hidden rounded border border-border text-xs print:border-black">
          <div className="grid grid-cols-5 bg-muted/60 border-b border-border text-[10px] font-bold uppercase tracking-wider text-foreground text-center print:border-black print:bg-gray-100 print:text-black">
            <div className="p-1.5 border-r border-border print:border-black">Requisitioner / Buyer</div>
            <div className="p-1.5 border-r border-border print:border-black">Payment Terms</div>
            <div className="p-1.5 border-r border-border print:border-black">Shipping Method</div>
            <div className="p-1.5 border-r border-border print:border-black">Delivery Date</div>
            <div className="p-1.5">Work Order / OT</div>
          </div>
          <div className="grid grid-cols-5 text-center text-xs py-2 bg-card text-foreground font-medium print:bg-white print:text-black">
            <div className="px-2 border-r border-border truncate print:border-black">
              {orden.comprador || orden.solicitante || 'Purchasing Agent'}
            </div>
            <div className="px-2 border-r border-border truncate print:border-black">
              {orden.terminosPago || 'Credit (Net 30)'}
            </div>
            <div className="px-2 border-r border-border truncate print:border-black">
              {orden.metodoEnvio || 'UPS Ground'}
            </div>
            <div className="px-2 border-r border-border truncate print:border-black">
              {orden.fechaEntregaEstimada ? formatOrderDate(orden.fechaEntregaEstimada) : 'Prompt Delivery'}
            </div>
            <div className="px-2 truncate font-mono">
              {orden.ordenTrabajo || 'N/A'}
            </div>
          </div>
        </div>

        {/* Tabla de Partidas Formal */}
        <div className="my-5 overflow-hidden rounded border border-border print:border-black">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-muted/60 border-b border-border text-[11px] font-bold uppercase tracking-wider text-foreground print:border-black print:bg-gray-100 print:text-black">
                <th className="py-2 px-3 text-center w-10 border-r border-border print:border-black">Item</th>
                <th className="py-2 px-3 w-36 border-r border-border print:border-black">Part # / SKU</th>
                <th className="py-2 px-3 border-r border-border print:border-black">Description & Specifications</th>
                <th className="py-2 px-3 text-right w-14 border-r border-border print:border-black">Qty</th>
                <th className="py-2 px-3 text-right w-24 border-r border-border print:border-black">Unit Price</th>
                <th className="py-2 px-3 text-right w-28">Total Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border print:divide-gray-300">
              {orden.items.map((it, idx) => (
                <tr key={it.id || idx} className="text-foreground print:text-black">
                  <td className="py-2.5 px-3 text-center font-semibold text-muted-foreground border-r border-border print:border-gray-300 print:text-gray-600">
                    {idx + 1}
                  </td>
                  <td className="py-2.5 px-3 font-mono font-bold text-foreground border-r border-border print:border-gray-300 print:text-black">
                    {it.producto || '—'}
                  </td>
                  <td className="py-2.5 px-3 border-r border-border print:border-gray-300">
                    <div className="font-semibold text-foreground print:text-black">{it.descripcion}</div>
                    {(it.ordenTrabajo || it.cuentaCargo) && (
                      <div className="text-[10px] text-muted-foreground mt-0.5 font-mono print:text-gray-600">
                        {it.ordenTrabajo ? `Job/OT: ${it.ordenTrabajo}` : ''}
                        {it.ordenTrabajo && it.cuentaCargo ? ' | ' : ''}
                        {it.cuentaCargo ? `Account: ${it.cuentaCargo}` : ''}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-foreground border-r border-border print:border-gray-300 print:text-black">
                    {it.cantidad}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-foreground border-r border-border print:border-gray-300 print:text-black">
                    {formatMonto(it.precioUnitario, orden.moneda)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground print:text-black">
                    {formatMonto(it.subtotal, orden.moneda)}
                  </td>
                </tr>
              ))}

              {/* Relleno visual si la orden tiene pocas partidas para mantener proporción formal */}
              {orden.items.length < 3 && (
                Array.from({ length: 3 - orden.items.length }).map((_, i) => (
                  <tr key={`empty-${i}`} className="text-transparent select-none print:hidden">
                    <td className="py-2 px-3 text-center border-r border-border">&nbsp;</td>
                    <td className="py-2 px-3 border-r border-border">&nbsp;</td>
                    <td className="py-2 px-3 border-r border-border">&nbsp;</td>
                    <td className="py-2 px-3 border-r border-border">&nbsp;</td>
                    <td className="py-2 px-3 border-r border-border">&nbsp;</td>
                    <td className="py-2 px-3">&nbsp;</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Sección Inferior: Instrucciones, Firma y Totales */}
        <div className="grid grid-cols-12 gap-6 pt-2">
          {/* Lado Izquierdo: Términos, Instrucciones y Firma Autorizada */}
          <div className="col-span-7 flex flex-col justify-between">
            <div className="rounded border border-border bg-muted/30 p-3 text-[11px] text-muted-foreground leading-relaxed print:border-gray-300 print:bg-transparent print:text-gray-700">
              <div className="font-bold text-xs uppercase tracking-wider text-foreground mb-1 print:text-black">
                Standard Terms & Special Instructions:
              </div>
              <ol className="list-decimal list-inside space-y-0.5 text-[10.5px]">
                <li>Please reference this Purchase Order number on all shipping labels, packing slips, and invoices.</li>
                <li>Send invoice copies to Accounts Payable upon dispatch.</li>
                <li>All materials and tooling are subject to inspection and approval upon delivery.</li>
              </ol>
              {orden.notas && (
                <div className="mt-2 pt-2 border-t border-border text-foreground whitespace-pre-line font-medium print:border-gray-300 print:text-black">
                  <span className="font-bold">Additional Notes: </span>
                  {orden.notas}
                </div>
              )}
            </div>

            <div className="mt-8 pt-4">
              <div className="flex flex-col gap-1">
                <div className="w-56 border-b border-foreground/80 print:border-black"></div>
                <span className="text-xs font-bold text-foreground mt-1 uppercase tracking-wider print:text-black">
                  Authorized Purchasing Signature
                </span>
                <span className="text-[10px] text-muted-foreground print:text-gray-600">
                  {buyerCompany} — Purchasing Department
                </span>
              </div>
            </div>
          </div>

          {/* Lado Derecho: Bloque Formal de Totales */}
          <div className="col-span-5 flex flex-col">
            <div className="rounded border border-border bg-card print:border-black print:bg-white">
              <div className="divide-y divide-border text-xs print:divide-gray-300">
                <div className="flex justify-between py-2 px-3">
                  <span className="font-semibold text-muted-foreground print:text-gray-700">Subtotal:</span>
                  <span className="font-mono font-semibold text-foreground print:text-black">{formatMonto(orden.subtotal, orden.moneda)}</span>
                </div>

                <div className="flex justify-between py-2 px-3">
                  <span className="text-muted-foreground print:text-gray-700">Shipping & Handling:</span>
                  <span className="font-mono text-foreground print:text-black">
                    {formatMonto(orden.envio > 0 ? orden.envio : 0, orden.moneda)}
                  </span>
                </div>

                <div className="flex justify-between py-2 px-3">
                  <span className="text-muted-foreground print:text-gray-700">Estimated Sales Tax:</span>
                  <span className="font-mono text-foreground print:text-black">
                    {formatMonto(orden.impuestos > 0 ? orden.impuestos : 0, orden.moneda)}
                  </span>
                </div>

                <div className="flex justify-between py-3 px-3 bg-muted/60 border-t-2 border-foreground/80 font-bold text-sm text-foreground print:border-black print:bg-gray-100 print:text-black">
                  <span>TOTAL AMOUNT ({orden.moneda || 'USD'}):</span>
                  <span className="font-mono text-base">{formatMonto(orden.total, orden.moneda)}</span>
                </div>
              </div>
            </div>

            <div className="mt-3 text-center text-[10px] text-muted-foreground font-mono print:text-gray-500">
              Thank you for your business.
            </div>
          </div>
        </div>

        {/* Pie de página formal */}
        <div className="mt-8 border-t border-border pt-2 flex items-center justify-between text-[10px] text-muted-foreground print:border-gray-300 print:text-gray-500">
          <span>{buyerCompany} &bull; Purchase Order Document</span>
          <span>Generated via SMV Hub &bull; Page 1 of 1</span>
        </div>
      </div>
    </div>
  )
}
