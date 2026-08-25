'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Search,
  Printer,
  FileText,
  Edit,
  Trash2,
  Loader2,
  Plus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import ModuleSurface from '@/components/layout/ModuleSurface'
import ModuleFilterChips from '@/components/layout/ModuleFilterChips'
import ModuleEmptyState from '@/components/layout/ModuleEmptyState'
import { formatearMoneda, normalizar } from '@/lib/format'
import {
  listarOrdenesCompraUsa,
  eliminarOrdenCompraUsa,
} from '@/lib/ordenes-compra-usa'
import type { OrdenCompraUsa, EstadoOrdenCompraUsa } from '@/lib/schemas'
import { toast } from 'sonner'
import { useConfirmDialog } from '@/components/ConfirmDialogProvider'
import OrdenCompraImprimible from './components/OrdenCompraImprimible'

interface OrdenesCompraHistorialProps {
  onEditarOrden: (orden: OrdenCompraUsa) => void
  onNuevaOrden: () => void
}

type FiltroEstado = 'todos' | EstadoOrdenCompraUsa

const CHIPS_ESTADO: { id: FiltroEstado; label: string }[] = [
  { id: 'todos', label: 'Todas' },
  { id: 'borrador', label: 'Borrador' },
  { id: 'enviada', label: 'Enviada' },
  { id: 'confirmada', label: 'Confirmada' },
  { id: 'recibida', label: 'Recibida' },
  { id: 'cancelada', label: 'Cancelada' },
]

export default function OrdenesCompraHistorial({
  onEditarOrden,
  onNuevaOrden,
}: OrdenesCompraHistorialProps) {
  const confirmar = useConfirmDialog()
  const [ordenes, setOrdenes] = useState<OrdenCompraUsa[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState<FiltroEstado>('todos')
  const [ordenParaImprimir, setOrdenParaImprimir] = useState<OrdenCompraUsa | null>(null)

  useEffect(() => {
    let activo = true
    async function inicializar() {
      try {
        const data = await listarOrdenesCompraUsa()
        if (activo) {
          setOrdenes(data)
          setCargando(false)
        }
      } catch (err) {
        console.error('Error al inicializar historial:', err)
        if (activo) {
          setCargando(false)
        }
      }
    }
    inicializar()
    return () => {
      activo = false
    }
  }, [])

  const ordenesFiltradas = useMemo(() => {
    let list = ordenes

    if (estadoFiltro !== 'todos') {
      list = list.filter((o) => o.estado === estadoFiltro)
    }

    const q = normalizar(busqueda.trim())
    if (q) {
      list = list.filter((o) => {
        const str = [
          o.folio,
          o.proveedor,
          o.referenciaProveedor,
          o.solicitante,
          o.ordenTrabajo,
          o.empresa,
          ...o.items.map((it) => `${it.producto} ${it.descripcion}`),
        ]
          .join(' ')
          .toLowerCase()
        return normalizar(str).includes(q)
      })
    }

    return list
  }, [ordenes, estadoFiltro, busqueda])

  const handleEliminar = async (id: string, folio: string) => {
    const ok = await confirmar({
      title: 'Eliminar Orden de Compra',
      description: `¿Estás seguro de que deseas eliminar permanentemente la orden ${folio}? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
      variant: 'destructive',
    })

    if (!ok) return

    try {
      await eliminarOrdenCompraUsa(id)
      setOrdenes((prev) => prev.filter((o) => o.id !== id))
      toast.success(`Orden ${folio} eliminada`)
    } catch (err: unknown) {
      console.error('Error al eliminar orden:', err)
      toast.error('No se pudo eliminar la orden')
    }
  }

  const renderBadgeEstado = (st: EstadoOrdenCompraUsa) => {
    switch (st) {
      case 'borrador':
        return (
          <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
            Borrador
          </span>
        )
      case 'enviada':
        return (
          <span className="inline-flex items-center rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-600">
            Enviada
          </span>
        )
      case 'confirmada':
        return (
          <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
            Confirmada
          </span>
        )
      case 'recibida':
        return (
          <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600">
            Recibida
          </span>
        )
      case 'cancelada':
        return (
          <span className="inline-flex items-center rounded-md bg-rose-500/10 px-2 py-0.5 text-xs font-semibold text-rose-600">
            Cancelada
          </span>
        )
      default:
        return null
    }
  }

  if (ordenParaImprimir) {
    return (
      <OrdenCompraImprimible
        orden={ordenParaImprimir}
        onCerrar={() => setOrdenParaImprimir(null)}
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* Filtros y Barra de Búsqueda */}
      <ModuleSurface className="p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por Folio, Proveedor, SKU, OT, Solicitante..."
              className="w-full rounded-md border border-input bg-background pl-9 pr-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <ModuleFilterChips
            value={estadoFiltro}
            onValueChange={(val) => setEstadoFiltro(val as FiltroEstado)}
            options={CHIPS_ESTADO.map((c) => ({
              value: c.id,
              label: c.label,
            }))}
            ariaLabel="Filtrar por estado"
          />
        </div>
      </ModuleSurface>

      {/* Tabla del Historial */}
      <ModuleSurface className="p-0 overflow-hidden">
        {cargando ? (
          <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
            <Loader2 className="size-6 animate-spin mb-2" />
            <p className="text-sm">Cargando órdenes de compra...</p>
          </div>
        ) : ordenesFiltradas.length === 0 ? (
          <div className="p-8">
            <ModuleEmptyState
              icon={FileText}
              title="No se encontraron órdenes de compra"
              description={
                busqueda || estadoFiltro !== 'todos'
                  ? 'No hay órdenes que coincidan con los filtros seleccionados.'
                  : 'Crea tu primera Purchase Order (PO) para proveedores de Estados Unidos.'
              }
              action={
                <Button size="sm" onClick={onNuevaOrden} className="cursor-pointer">
                  <Plus className="mr-1.5 size-4" />
                  Nueva Purchase Order
                </Button>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/40 font-semibold text-muted-foreground">
                  <th className="py-3 px-4">Folio</th>
                  <th className="py-3 px-4">Proveedor</th>
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Solicitante / OT</th>
                  <th className="py-3 px-4 text-center">Partidas</th>
                  <th className="py-3 px-4 text-right">Total ({ordenesFiltradas[0]?.moneda || 'USD'})</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ordenesFiltradas.map((ord) => (
                  <tr key={ord.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-foreground">
                      {ord.folio}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-foreground">{ord.proveedor}</div>
                      {ord.referenciaProveedor && (
                        <div className="text-[11px] text-muted-foreground">
                          Ref: {ord.referenciaProveedor}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {ord.fechaPedido}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      <div>{ord.solicitante || 'SMV'}</div>
                      {ord.ordenTrabajo && (
                        <div className="text-[11px] font-mono text-foreground font-medium">
                          {ord.ordenTrabajo}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center font-semibold text-foreground">
                      {ord.items?.length || 0}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-foreground">
                      {formatearMoneda(ord.total, ord.moneda || 'USD')}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {renderBadgeEstado(ord.estado)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setOrdenParaImprimir(ord)}
                          title="Imprimir / Ver PDF"
                          className="h-7 px-2 text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          <Printer className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEditarOrden(ord)}
                          title="Editar orden"
                          className="h-7 px-2 text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          <Edit className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEliminar(ord.id, ord.folio)}
                          title="Eliminar"
                          className="h-7 px-2 text-muted-foreground hover:text-destructive cursor-pointer"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ModuleSurface>
    </div>
  )
}
