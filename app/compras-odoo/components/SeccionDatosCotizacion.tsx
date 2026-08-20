'use client'

import { Building2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

import type { ProveedorSugerido } from './tipos-captura'

export interface SeccionDatosCotizacionProps {
  proveedor: string
  proveedorId: number | null
  referenciaProveedor: string
  moneda: 'MXN' | 'USD'
  fecha: string
  fechaRecepcion: string
  notas: string
  sugerenciasProveedores: ProveedorSugerido[]
  cargandoProveedores: boolean
  proveedorInvalido: boolean
  onProveedorChange: (valor: string) => void
  onSeleccionarProveedor: (p: ProveedorSugerido) => void
  onReferenciaChange: (valor: string) => void
  onMonedaChange: (moneda: 'MXN' | 'USD') => void
  onFechaChange: (valor: string) => void
  onFechaRecepcionChange: (valor: string) => void
  onNotasChange: (valor: string) => void
}

export default function SeccionDatosCotizacion({
  proveedor,
  proveedorId,
  referenciaProveedor,
  moneda,
  fecha,
  fechaRecepcion,
  notas,
  sugerenciasProveedores,
  cargandoProveedores,
  proveedorInvalido,
  onProveedorChange,
  onSeleccionarProveedor,
  onReferenciaChange,
  onMonedaChange,
  onFechaChange,
  onFechaRecepcionChange,
  onNotasChange,
}: SeccionDatosCotizacionProps) {
  return (
    <Card className="gap-4 py-4 shadow-sm lg:col-span-7">
      <CardHeader className="border-b px-4 pb-3 [.border-b]:pb-3">
        <CardTitle className="flex items-center gap-2 text-xs font-bold tracking-wider uppercase">
          <Building2 className="text-primary" aria-hidden />
          1. Datos de la Cotización
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        <FieldGroup className="gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field data-invalid={proveedorInvalido || undefined} className="relative gap-1.5">
              <FieldLabel htmlFor="odoo-proveedor">Proveedor *</FieldLabel>
              <Input
                id="odoo-proveedor"
                placeholder="ej. PROTOSA, HIGOH..."
                value={proveedor}
                aria-invalid={proveedorInvalido || undefined}
                onChange={(e) => onProveedorChange(e.target.value)}
                autoComplete="off"
              />
              {cargandoProveedores && (
                <span className="text-muted-foreground absolute top-7 right-2 font-mono text-[10px]">
                  Buscando...
                </span>
              )}
              {proveedorId != null && (
                <Badge variant="secondary" className="w-fit font-mono text-[10px]">
                  Odoo #{proveedorId}
                </Badge>
              )}
              {proveedorInvalido && (
                <FieldDescription className="text-destructive">
                  Selecciona un proveedor de la lista de Odoo.
                </FieldDescription>
              )}
              {sugerenciasProveedores.length > 0 && (
                <div className="bg-popover absolute z-20 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border p-1 shadow-lg">
                  {sugerenciasProveedores.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onSeleccionarProveedor(s)}
                      className="hover:bg-accent hover:text-accent-foreground w-full cursor-pointer rounded px-2 py-1 text-left text-xs font-medium"
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </Field>

            <Field className="gap-1.5">
              <FieldLabel htmlFor="odoo-ref">Ref. Proveedor / Cotización</FieldLabel>
              <Input
                id="odoo-ref"
                placeholder="ej. 251165"
                value={referenciaProveedor}
                onChange={(e) => onReferenciaChange(e.target.value)}
                className="font-mono"
              />
            </Field>

            <Field className="gap-1.5">
              <FieldLabel htmlFor="odoo-moneda">Moneda</FieldLabel>
              <Select
                value={moneda}
                onValueChange={(v) => {
                  if (v === 'MXN' || v === 'USD') onMonedaChange(v)
                }}
              >
                <SelectTrigger id="odoo-moneda" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="MXN">MXN (Pesos Mexicanos)</SelectItem>
                    <SelectItem value="USD">USD (Dólares)</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Field className="gap-1.5">
              <FieldLabel htmlFor="odoo-fecha">Fecha de la orden</FieldLabel>
              <Input
                id="odoo-fecha"
                type="date"
                value={fecha}
                onChange={(e) => onFechaChange(e.target.value)}
                className="font-mono"
              />
            </Field>

            <Field className="gap-1.5">
              <FieldLabel htmlFor="odoo-fecha-recepcion">Fecha de recepción</FieldLabel>
              <Input
                id="odoo-fecha-recepcion"
                type="date"
                value={fechaRecepcion}
                onChange={(e) => onFechaRecepcionChange(e.target.value)}
                className="font-mono"
              />
              <FieldDescription>Se envía a Odoo como fecha planificada de recepción.</FieldDescription>
            </Field>
          </div>

          <Field className="gap-1.5">
            <FieldLabel htmlFor="odoo-notas">Notas / términos</FieldLabel>
            <Textarea
              id="odoo-notas"
              rows={3}
              placeholder="Términos de entrega, condiciones o notas internas para la RFQ en Odoo..."
              value={notas}
              onChange={(e) => onNotasChange(e.target.value)}
            />
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
