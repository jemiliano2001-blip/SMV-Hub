'use client'

import {
  ChevronRight,
  Clock,
  Edit2,
  ExternalLink,
  Copy,
  Eye,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Proveedor } from '@/lib/schemas'
import { etiquetaCategoriaProveedor } from '@/lib/proveedores/categorias-proveedor'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'

interface TarjetaProveedorProps {
  proveedor: Proveedor
  onSelect: (proveedor: Proveedor) => void
  onEdit: (proveedor: Proveedor) => void
  esPrimario?: boolean
  esBackup?: boolean
}

export default function TarjetaProveedor({
  proveedor,
  onSelect,
  onEdit,
}: TarjetaProveedorProps) {
  const sitioWeb = proveedor.web

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-card transition-all duration-200 hover:border-primary hover:shadow-md cursor-pointer select-none"
          onDoubleClick={() => onSelect(proveedor)}
        >
          <div className="flex flex-col gap-3 p-5 pb-3">
            <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Badge variant="outline" className="text-[10px]">
                {proveedor.pais === 'Estados Unidos' ? 'USA' : 'MX'}
              </Badge>
              {typeof proveedor.ordenesOdoo === 'number' && proveedor.ordenesOdoo >= 1 && (
                <Badge variant="outline" className="border-sky-200 bg-sky-50 text-[9px] text-sky-800">
                  {proveedor.ordenesOdoo} compras Odoo
                </Badge>
              )}
            </div>

            <div>
              <button
                type="button"
                onClick={() => onSelect(proveedor)}
                className="flex w-full cursor-pointer items-center justify-between text-left text-base font-bold text-foreground transition-colors group-hover:text-primary"
              >
                <span className="line-clamp-2">{proveedor.nombre}</span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            </div>

            {proveedor.categorias.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-0.5">
                {proveedor.categorias.map((cat) => (
                  <Badge key={cat} variant="secondary" className="text-[9px] font-semibold">
                    {etiquetaCategoriaProveedor(cat)}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-border bg-muted/50 px-5 py-3 text-xs">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="size-3.5" aria-hidden />
              <span>{proveedor.leadTimeDias || '3-5'}d</span>
            </div>

            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onEdit(proveedor)}
                title="Editar proveedor"
              >
                <Edit2 aria-hidden />
              </Button>
              <Button variant="outline" size="sm" onClick={() => onSelect(proveedor)}>
                Ficha detalle
              </Button>
            </div>
          </div>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-56">
        <ContextMenuItem onClick={() => onSelect(proveedor)}>
          <Eye className="text-primary" />
          <span>Ver ficha de detalle</span>
          <ContextMenuShortcut>↵</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuItem onClick={() => onEdit(proveedor)}>
          <Edit2 className="text-muted-foreground" />
          <span>Editar proveedor</span>
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Copy className="text-muted-foreground" />
            <span>Copiar información</span>
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
            <ContextMenuItem
              onClick={() => {
                void navigator.clipboard.writeText(proveedor.nombre)
                toast.success('Nombre copiado')
              }}
            >
              <span>Nombre ({proveedor.nombre})</span>
            </ContextMenuItem>
            {proveedor.email && (
              <ContextMenuItem
                onClick={() => {
                  void navigator.clipboard.writeText(proveedor.email || '')
                  toast.success('Email copiado')
                }}
              >
                <span>Email ({proveedor.email})</span>
              </ContextMenuItem>
            )}
            {proveedor.telefono && (
              <ContextMenuItem
                onClick={() => {
                  void navigator.clipboard.writeText(proveedor.telefono || '')
                  toast.success('Teléfono copiado')
                }}
              >
                <span>Teléfono ({proveedor.telefono})</span>
              </ContextMenuItem>
            )}
          </ContextMenuSubContent>
        </ContextMenuSub>

        {sitioWeb && (
          <ContextMenuItem
            onClick={() => {
              if (sitioWeb) window.open(sitioWeb, '_blank', 'noopener,noreferrer')
            }}
          >
            <ExternalLink className="text-sky-600" />
            <span>Abrir sitio web oficial</span>
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}
