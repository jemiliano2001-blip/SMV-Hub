'use client'

import {
  Award,
  Building2,
  Edit2,
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  Package,
  Phone,
  Star,
  Trash2,
  Zap,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { Proveedor } from '@/lib/schemas'

interface DrawerDetalleProveedorProps {
  proveedor: Proveedor | null
  open: boolean
  onClose: () => void
  onEdit: (proveedor: Proveedor) => void
  onDelete: (id: string) => void
  scorecard?: {
    promedioGeneral: number
    leadTimePromedio: number
    leadTimeReal: number
    ordenesAprobadas: number
    totalOrdenes: number
  }
}

function etiquetaTipo(tipo: Proveedor['tipoProveedor']) {
  if (tipo === 'premium') return { label: 'Premium', icon: Star }
  if (tipo === 'barato') return { label: 'Económico', icon: Zap }
  return { label: 'Estándar', icon: Package }
}

export default function DrawerDetalleProveedor({
  proveedor,
  open,
  onClose,
  onEdit,
  onDelete,
  scorecard,
}: DrawerDetalleProveedorProps) {
  if (!proveedor) return null

  const tipo = etiquetaTipo(proveedor.tipoProveedor)
  const TipoIcon = tipo.icon

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b border-border bg-muted/40 px-6 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-[10px] font-bold uppercase">
              <TipoIcon className="mr-1 inline size-3" aria-hidden />
              {tipo.label}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {proveedor.pais === 'Estados Unidos' ? 'USA' : 'México'}
            </Badge>
          </div>
          <SheetTitle className="text-left text-lg font-bold">{proveedor.nombre}</SheetTitle>
          <div className="flex items-center justify-between pt-2 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="flex items-center gap-1 font-bold text-amber-500">
                <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden />
                {proveedor.calificacion || 5}.0
              </span>
              <span>Lead time: {proveedor.leadTimeDias || '3-5'} días</span>
            </div>
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
              {proveedor.estatus === 'actual' ? 'Activo' : proveedor.estatus}
            </Badge>
          </div>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-5 text-foreground">
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <div className="mb-3 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Award className="size-4 text-primary" aria-hidden />
                Scorecard SMV
              </span>
              <span>{scorecard ? `${scorecard.promedioGeneral.toFixed(1)} / 5.0` : 'Sin datos'}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-border bg-card p-2.5">
                <div className="text-[10px] text-muted-foreground">Lead time prometido</div>
                <div className="text-sm font-bold">
                  {scorecard?.leadTimePromedio ?? 'Sin datos'}
                  {scorecard ? ' días' : ''}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-card p-2.5">
                <div className="text-[10px] text-muted-foreground">Lead time real (Odoo)</div>
                <div className="text-sm font-bold text-emerald-700">
                  {scorecard?.leadTimeReal ?? 'Sin datos'}
                  {scorecard ? ' días' : ''}
                </div>
              </div>
            </div>
          </div>

          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Contacto y web
            </h3>
            <div className="flex flex-col gap-2 text-sm">
              {proveedor.web ? (
                <a
                  href={proveedor.web.startsWith('http') ? proveedor.web : `https://${proveedor.web}`}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-center justify-between rounded-lg border border-sky-200/60 bg-sky-50/60 p-2.5 text-xs font-semibold text-primary transition-all hover:bg-sky-100/80"
                >
                  <span className="flex items-center gap-2">
                    <Globe className="size-4" aria-hidden />
                    {proveedor.web}
                  </span>
                  <ExternalLink className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </a>
              ) : null}
              {proveedor.email ? (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-2.5 text-xs">
                  <Mail className="size-4 text-muted-foreground" aria-hidden />
                  <span>{proveedor.email}</span>
                </div>
              ) : null}
              {proveedor.telefono ? (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-2.5 text-xs">
                  <Phone className="size-4 text-muted-foreground" aria-hidden />
                  <span>{proveedor.telefono}</span>
                </div>
              ) : null}
              {proveedor.contacto ? (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-2.5 text-xs">
                  <Building2 className="size-4 text-muted-foreground" aria-hidden />
                  <span>
                    Atención: <strong>{proveedor.contacto}</strong>
                  </span>
                </div>
              ) : null}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Marcas representadas
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {proveedor.marcas && proveedor.marcas.length > 0 ? (
                proveedor.marcas.map((marca) => (
                  <Badge key={marca} variant="secondary" className="px-2.5 py-1 text-xs font-semibold">
                    {marca}
                  </Badge>
                ))
              ) : (
                <span className="text-xs italic text-muted-foreground">Sin marcas registradas</span>
              )}
            </div>
          </section>

          {proveedor.shippingAddressUSA ? (
            <div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-amber-900">
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <MapPin className="size-4 text-amber-600" aria-hidden />
                Dirección de envío (USA)
              </div>
              <p className="font-mono text-xs text-amber-800">{proveedor.shippingAddressUSA}</p>
            </div>
          ) : null}

          {proveedor.notas ? (
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              <span className="font-bold text-foreground">Notas de compras:</span>
              <p className="mt-1 leading-relaxed">{proveedor.notas}</p>
            </div>
          ) : null}
        </div>

        <SheetFooter className="flex-row justify-between border-t border-border bg-muted/40 px-6 py-4">
          <Button variant="destructive" size="sm" onClick={() => onDelete(proveedor.id)}>
            <Trash2 data-icon="inline-start" />
            Eliminar
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cerrar
            </Button>
            <Button size="sm" onClick={() => onEdit(proveedor)}>
              <Edit2 data-icon="inline-start" />
              Editar
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
