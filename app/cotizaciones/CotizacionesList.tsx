import { useMemo, useState, useEffect, useCallback, useRef, useDeferredValue, memo } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import {
  Loader2,
  AlertCircle,
  Search,
  ExternalLink,
  FileSearch,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Edit2,
  Sparkles,
  Upload,
  ShoppingCart,
  Copy,
  PlusCircle,
  Package,
  FileSpreadsheet,
} from 'lucide-react'

import type { Cotizacion, EstatusCotizacion } from '@/lib/schemas'
import { useConfirmDialog } from '@/components/ConfirmDialogProvider'
import { toast } from 'sonner'
import { formatPrecio, formatFecha } from '@/lib/format'
import {
  filtrarCotizaciones,
  ordenarCotizaciones,
  paginarCotizaciones,
  direccionDefaultColumna,
  hayTokens,
  TAMANO_PAGINA_COTIZACIONES,
  type ColumnaOrdenCotizacion,
  type DireccionOrden,
  type FiltroUbicacion,
  type FiltroEstatus,
  type FiltroOrigenCotizacion,
} from '@/lib/cotizaciones-tabla'
import { esCotizacionComprada } from '@/lib/cotizaciones-desde-ordenes'
import { useCotizaciones } from '@/lib/hooks/useCotizaciones'
import { descargarExcelCotizacionIndividual } from '@/lib/cotizaciones-excel-export'

const CotizacionFormModal = dynamic(() => import('./CotizacionFormModal'), { ssr: false })
const CotizacionIaModal = dynamic(() => import('./CotizacionIaModal'), { ssr: false })
const ModalExportarCotizaciones = dynamic(() => import('./ModalExportarCotizaciones'), { ssr: false })
import ModuleEmptyState from '@/components/layout/ModuleEmptyState'
import ModuleFilterChips from '@/components/layout/ModuleFilterChips'
import ModuleSurface from '@/components/layout/ModuleSurface'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const ESTATUS_BADGE: Record<EstatusCotizacion, string> = {
  cotizado: 'bg-green-50 text-green-700 ring-green-600/20',
  cancelado: 'bg-red-50 text-red-700 ring-red-600/20',
  revisar: 'bg-yellow-50 text-yellow-800 ring-yellow-600/20',
}

function BadgeComprada() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-800 ring-1 ring-inset ring-sky-600/20 dark:bg-sky-950/40 dark:text-sky-300">
      <Package className="h-2.5 w-2.5" />
      Comprada
    </span>
  )
}

type CotizacionCardProps = {
  c: Cotizacion
  selected: boolean
  onToggleSelect: (id: string, e: React.MouseEvent) => void
  onEditar: (c: Cotizacion) => void
  onComprarUsa: (c: Cotizacion) => void
  onCrearOdoo: (c: Cotizacion) => void
  onCopiarWhatsApp: (c: Cotizacion) => void
  onExportarExcel: (c: Cotizacion) => void
}

const CotizacionCard = memo(function CotizacionCard({
  c,
  selected,
  onToggleSelect,
  onEditar,
  onComprarUsa,
  onCrearOdoo,
  onCopiarWhatsApp,
  onExportarExcel,
}: CotizacionCardProps) {
  return (
    <div onClick={() => onEditar(c)} className="p-4 space-y-2.5 active:bg-muted cursor-pointer">
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0 flex items-start gap-2.5">
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onToggleSelect(c.id, e as unknown as React.MouseEvent)}
            onClick={(e) => e.stopPropagation()}
            className="mt-1 h-4 w-4 rounded border-input text-primary focus:ring-ring shrink-0"
          />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{formatFecha(c.fecha)} • {c.solicitante || '—'}</p>
            <p className="text-sm font-semibold text-foreground break-words">{c.descripcion}</p>
          </div>
        </div>
        <span className={`shrink-0 inline-flex rounded-full px-2 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${ESTATUS_BADGE[c.estatus]}`}>
          {c.estatus}
        </span>
      </div>
      {esCotizacionComprada(c.origen) && (
        <div className="pl-[26px]">
          <BadgeComprada />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 text-xs pl-[26px]">
        <div className="min-w-0">
          <span className="text-muted-foreground block">Proveedor</span>
          <span className="text-foreground truncate block">{c.proveedor}</span>
        </div>
        <div className="min-w-0">
          <span className="text-muted-foreground block">No. parte</span>
          <span className="text-foreground truncate block font-mono">{c.numeroParte || '-'}</span>
        </div>
        <div className="min-w-0">
          <span className="text-muted-foreground block">Ubicación</span>
          <span className={`inline-block rounded px-1.5 py-0.5 font-semibold ${c.ubicacion === 'USA' ? 'bg-blue-50 text-blue-700' : 'bg-muted text-foreground'}`}>
            {c.ubicacion === 'USA' ? 'EUA' : 'MX'}
          </span>
        </div>
        <div className="min-w-0">
          <span className="text-muted-foreground block">Cantidad</span>
          <span className="text-foreground">{c.cantidad ?? '-'}</span>
        </div>
      </div>

      <div className="flex items-center justify-between pl-[26px] pt-2 border-t border-border">
        <span className="text-xs text-muted-foreground">{formatPrecio(c.precioUnitario, c.moneda)} c/u</span>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-foreground">{formatPrecio(c.total, c.moneda)}</span>
          {c.link && /^https?:\/\//i.test(c.link) && (
            <a
              href={c.link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-muted-foreground hover:text-primary"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>

      {/* Botones de acción rápida en móvil */}
      <div className="flex items-center gap-2 pt-2 border-t border-border/40 pl-[26px]" onClick={(e) => e.stopPropagation()}>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-[11px] gap-1 px-2 flex-1"
          onClick={() => onComprarUsa(c)}
          title="Comprar en USA (/nueva-compra)"
        >
          <ShoppingCart className="h-3 w-3 text-emerald-600" />
          Comprar
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-[11px] gap-1 px-2 flex-1"
          onClick={() => onCrearOdoo(c)}
          title="Crear RFQ en Odoo (/compras-odoo)"
        >
          <PlusCircle className="h-3 w-3 text-indigo-600" />
          Odoo
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-[11px] gap-1 px-2 border-emerald-600/30 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30 font-semibold cursor-pointer"
          onClick={() => onExportarExcel(c)}
          title="Descargar cotización en Excel (.xlsx)"
        >
          <FileSpreadsheet className="h-3 w-3 text-emerald-600" />
          Excel
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-muted-foreground hover:text-foreground"
          onClick={() => onCopiarWhatsApp(c)}
          title="Copiar formato WhatsApp"
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
})

type CotizacionTableRowProps = {
  c: Cotizacion
  isSelected: boolean
  exportando: boolean
  onToggleSelect: (id: string, e: React.MouseEvent) => void
  onEditar: (c: Cotizacion) => void
  onExportarIndividual: (c: Cotizacion) => void
  onComprarUsa: (c: Cotizacion) => void
  onCrearOdoo: (c: Cotizacion) => void
  onCopiarWhatsApp: (c: Cotizacion) => void
  onEliminar: (c: Cotizacion) => void
  onIrAOrdenes: () => void
}

const CotizacionTableRow = memo(function CotizacionTableRow({
  c,
  isSelected,
  exportando,
  onToggleSelect,
  onEditar,
  onExportarIndividual,
  onComprarUsa,
  onCrearOdoo,
  onCopiarWhatsApp,
  onEliminar,
  onIrAOrdenes,
}: CotizacionTableRowProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <TableRow
          onClick={() => onEditar(c)}
          className={`cursor-pointer transition-colors hover:bg-muted/50 ${
            isSelected ? 'bg-primary/5' : ''
          }`}
        >
          <TableCell className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => onToggleSelect(c.id, e as unknown as React.MouseEvent)}
              className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
            />
          </TableCell>
          <TableCell className="px-4 py-3 text-xs font-mono">
            {formatFecha(c.fecha)}
          </TableCell>
          <TableCell className="px-4 py-3 text-xs text-foreground font-medium truncate max-w-[120px]">
            {c.solicitante || '—'}
          </TableCell>
          <TableCell className="px-4 py-3 text-xs text-foreground font-semibold truncate max-w-[140px]">
            {c.proveedor}
          </TableCell>
          <TableCell className="px-4 py-3 font-mono text-xs text-foreground truncate max-w-[120px]">
            {c.numeroParte || '—'}
          </TableCell>
          <TableCell className="px-4 py-3 text-xs text-foreground max-w-[220px] truncate" title={c.descripcion}>
            {c.descripcion}
          </TableCell>
          <TableCell className="px-4 py-3 text-xs">
            <span
              className={`inline-block rounded px-2 py-0.5 text-[11px] font-semibold ${
                c.ubicacion === 'USA'
                  ? 'bg-blue-50 text-blue-700'
                  : 'bg-indigo-50 text-indigo-700'
              }`}
            >
              {c.ubicacion === 'USA' ? 'EUA' : 'MX'}
            </span>
          </TableCell>
          <TableCell className="px-4 py-3 text-right font-mono text-xs">
            {c.cantidad ?? '—'}
          </TableCell>
          <TableCell className="px-4 py-3 text-right font-mono text-xs">
            {formatPrecio(c.precioUnitario, c.moneda)}
          </TableCell>
          <TableCell className="px-4 py-3 text-right font-mono text-xs font-bold text-foreground">
            {formatPrecio(c.total, c.moneda)}
          </TableCell>
          <TableCell className="px-4 py-3">
            <div className="flex flex-col items-start gap-1">
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ring-1 ring-inset ${
                  ESTATUS_BADGE[c.estatus]
                }`}
              >
                {c.estatus}
              </span>
              {esCotizacionComprada(c.origen) && <BadgeComprada />}
            </div>
          </TableCell>
          <TableCell className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
            {c.link && /^https?:\/\//i.test(c.link) ? (
              <a
                href={c.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-muted-foreground hover:text-primary transition-colors"
                title="Abrir enlace del producto"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            ) : (
              <span className="text-muted-foreground text-xs">—</span>
            )}
          </TableCell>
          <TableCell className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-end gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                onClick={() => void onExportarIndividual(c)}
                disabled={exportando}
                title="Descargar cotización en Excel (.xlsx)"
              >
                {exportando ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                onClick={() => onComprarUsa(c)}
                title="Comprar en USA (/nueva-compra)"
              >
                <ShoppingCart className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                onClick={() => onCrearOdoo(c)}
                title="Crear RFQ en Odoo (/compras-odoo)"
              >
                <PlusCircle className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
                onClick={() => onCopiarWhatsApp(c)}
                title="Copiar formato WhatsApp"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
                onClick={() => onEditar(c)}
                title="Editar cotización"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </TableCell>
        </TableRow>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => onComprarUsa(c)}>
          <ShoppingCart className="mr-2 h-4 w-4 text-emerald-600" />
          Comprar en USA (/nueva-compra)
        </ContextMenuItem>
        {c.ordenIdOrigen && (
          <ContextMenuItem onClick={onIrAOrdenes}>
            <Package className="mr-2 h-4 w-4 text-sky-700" />
            Ir a órdenes
            {c.notas ? ` (${c.notas})` : ''}
          </ContextMenuItem>
        )}
        <ContextMenuItem onClick={() => onCrearOdoo(c)}>
          <PlusCircle className="mr-2 h-4 w-4 text-indigo-600" />
          Crear RFQ en Odoo (/compras-odoo)
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onCopiarWhatsApp(c)}>
          <Copy className="mr-2 h-4 w-4" />
          Copiar para WhatsApp
        </ContextMenuItem>
        <ContextMenuItem onClick={() => void onExportarIndividual(c)}>
          <FileSpreadsheet className="mr-2 h-4 w-4 text-emerald-600" />
          Exportar a Excel (.xlsx)
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onEditar(c)}>
          <Edit2 className="mr-2 h-4 w-4" />
          Editar cotización
        </ContextMenuItem>
        {c.link && (
          <ContextMenuItem onClick={() => window.open(c.link || '', '_blank')}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Abrir enlace
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem
          className="text-red-600 focus:text-red-600 focus:bg-red-50"
          onClick={() => onEliminar(c)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Eliminar
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
})


interface CotizacionesListProps {
  onIrAImportar?: () => void
}

export default function CotizacionesList({ onIrAImportar }: CotizacionesListProps) {
  const router = useRouter()
  const confirmar = useConfirmDialog()
  const {
    cotizaciones,
    loading,
    error,
    fetchCotizaciones,
    cargarMas,
    cargarTodas,
    cargandoMas,
    cargandoCompleto,
    coleccionCompleta,
    hayMas,
    addOrUpdateCotizacion,
    handleEliminarLote,
  } = useCotizaciones()

  const [busqueda, setBusqueda] = useState('')
  const deferredBusqueda = useDeferredValue(busqueda)
  const [filtroUbicacion, setFiltroUbicacion] = useState<FiltroUbicacion>('todas')
  const [filtroEstatus, setFiltroEstatus] = useState<FiltroEstatus>('todos')
  const [filtroOrigen, setFiltroOrigen] = useState<FiltroOrigenCotizacion>('todas')
  const avisoHistorial = useRef(false)

  const [columnaOrden, setColumnaOrden] = useState<ColumnaOrdenCotizacion>('fecha')
  const [direccionOrden, setDireccionOrden] = useState<DireccionOrden>('desc')
  const [pagina, setPagina] = useState(1)
  const [ordenPersonalizado, setOrdenPersonalizado] = useState(false)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isDeletingBulk, setIsDeletingBulk] = useState(false)
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)
  const [exportandoIndividualId, setExportandoIndividualId] = useState<string | null>(null)
  const [isAddingMode, setIsAddingMode] = useState(false)
  const [isIaModalOpen, setIsIaModalOpen] = useState(false)
  const [initialPasteFile, setInitialPasteFile] = useState<File | null>(null)
  const [cotizacionToEdit, setCotizacionToEdit] = useState<Cotizacion | null>(null)

  const handleExportarIndividual = useCallback(async (c: Cotizacion) => {
    try {
      setExportandoIndividualId(c.id)
      await descargarExcelCotizacionIndividual(c)
      toast.success(`Excel descargado para ${c.proveedor}`)
    } catch (err) {
      console.error('Error al exportar cotización individual:', err)
      toast.error('No se pudo generar el Excel de la cotización')
    } finally {
      setExportandoIndividualId(null)
    }
  }, [])

  // Acciones de conversión
  const handleComprarUsa = useCallback((c: Cotizacion) => {
    const params = new URLSearchParams()
    if (c.proveedor) params.set('proveedor', c.proveedor)
    if (c.numeroParte) params.set('numeroParte', c.numeroParte)
    if (c.descripcion) params.set('descripcion', c.descripcion)
    if (c.precioUnitario !== null) params.set('precioUnitario', String(c.precioUnitario))
    if (c.cantidad !== null) params.set('cantidad', String(c.cantidad))
    if (c.total !== null) params.set('total', String(c.total))
    if (c.link) params.set('linkProveedor', c.link)
    if (c.solicitante) params.set('requisitor', c.solicitante)
    params.set('moneda', c.moneda || 'USD')
    params.set('cotizacionId', c.id)

    router.push(`/nueva-compra?${params.toString()}`)
  }, [router])

  const handleCrearOdoo = useCallback((c: Cotizacion) => {
    const params = new URLSearchParams()
    if (c.proveedor) params.set('proveedor', c.proveedor)
    if (c.numeroParte) params.set('numeroParte', c.numeroParte)
    if (c.descripcion) params.set('descripcion', c.descripcion)
    if (c.precioUnitario !== null) params.set('precioUnitario', String(c.precioUnitario))
    if (c.cantidad !== null) params.set('cantidad', String(c.cantidad))
    params.set('moneda', c.moneda || (c.ubicacion === 'USA' ? 'USD' : 'MXN'))
    if (c.numeroParte) params.set('referencia', c.numeroParte)

    router.push(`/compras-odoo?${params.toString()}`)
  }, [router])

  const handleCopiarWhatsApp = useCallback((c: Cotizacion) => {
    const lineas = [
      `📋 *COTIZACIÓN SMV*`,
      c.numeroParte ? `*No. Parte:* ${c.numeroParte}` : null,
      `*Descripción:* ${c.descripcion}`,
      `*Proveedor:* ${c.proveedor} (${c.ubicacion})`,
      c.cantidad ? `*Cantidad:* ${c.cantidad}` : null,
      c.precioUnitario !== null ? `*P. Unitario:* ${formatPrecio(c.precioUnitario, c.moneda)}` : null,
      c.total !== null ? `*Total:* ${formatPrecio(c.total, c.moneda)}` : null,
      c.diasHabiles ? `*Entrega:* ${c.diasHabiles}` : null,
      c.link ? `*Link:* ${c.link}` : null,
      c.notas ? `*Notas:* ${c.notas}` : null,
    ]
    const texto = lineas.filter(Boolean).join('\n')

    navigator.clipboard
      .writeText(texto)
      .then(() => toast.success('Cotización copiada al portapapeles en formato WhatsApp'))
      .catch(() => toast.error('No se pudo copiar al portapapeles'))
  }, [])


  // Listener global para Ctrl+V en la página de cotizaciones
  const handleGlobalPaste = useCallback((e: ClipboardEvent) => {
    const target = e.target as HTMLElement | null
    const tag = target?.tagName?.toLowerCase()
    if (tag === 'input' || tag === 'textarea') return

    const items = e.clipboardData?.items
    if (!items) return

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) {
          e.preventDefault()
          setInitialPasteFile(file)
          setIsIaModalOpen(true)
          toast.info('Captura del portapapeles detectada. Abriendo extractor con IA...')
          break
        }
      }
    }
  }, [])

  useEffect(() => {
    window.addEventListener('paste', handleGlobalPaste)
    return () => {
      window.removeEventListener('paste', handleGlobalPaste)
    }
  }, [handleGlobalPaste])

  const necesitaHistorialCompleto = hayTokens(busqueda) || filtroOrigen !== 'todas'

  useEffect(() => {
    if (!necesitaHistorialCompleto || coleccionCompleta || loading || cargandoCompleto) return
    const t = window.setTimeout(() => {
      if (!avisoHistorial.current) {
        avisoHistorial.current = true
        toast.info('Cargando el historial completo para buscar compras viejas…')
      }
      void cargarTodas().catch(() => undefined)
    }, 400)
    return () => window.clearTimeout(t)
  }, [necesitaHistorialCompleto, coleccionCompleta, loading, cargandoCompleto, cargarTodas])

  const filtros = useMemo(
    () => ({
      busqueda: deferredBusqueda,
      ubicacion: filtroUbicacion,
      estatus: filtroEstatus,
      origen: filtroOrigen,
    }),
    [deferredBusqueda, filtroUbicacion, filtroEstatus, filtroOrigen]
  )

  const filtradas = useMemo(
    () => filtrarCotizaciones(cotizaciones, filtros),
    [cotizaciones, filtros]
  )

  const ordenadas = useMemo(
    () =>
      ordenarCotizaciones(filtradas, columnaOrden, direccionOrden, {
        busqueda: filtros.busqueda,
        usarRelevancia: !ordenPersonalizado && hayTokens(filtros.busqueda),
      }),
    [filtradas, columnaOrden, direccionOrden, filtros.busqueda, ordenPersonalizado]
  )

  const paginaEfectiva = useMemo(() => {
    const totalPaginas = Math.ceil(ordenadas.length / TAMANO_PAGINA_COTIZACIONES)
    if (totalPaginas === 0) return 1
    return Math.min(pagina, totalPaginas)
  }, [ordenadas.length, pagina])

  const paginacion = useMemo(
    () => paginarCotizaciones(ordenadas, paginaEfectiva, TAMANO_PAGINA_COTIZACIONES),
    [ordenadas, paginaEfectiva]
  )

  const filasPagina = paginacion.filas

  const resetPaginaYSeleccion = () => {
    setPagina(1)
    setSelectedIds(new Set())
  }

  const cambiarPagina = (nuevaPagina: number) => {
    setPagina(nuevaPagina)
    setSelectedIds(new Set())
  }

  const handleOrdenColumna = (columna: ColumnaOrdenCotizacion) => {
    setOrdenPersonalizado(true)
    if (columnaOrden === columna) {
      setDireccionOrden((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setColumnaOrden(columna)
      setDireccionOrden(direccionDefaultColumna(columna))
    }
  }

  const iconoOrden = (columna: ColumnaOrdenCotizacion) => {
    if (columnaOrden !== columna) return null
    return direccionOrden === 'asc' ? (
      <ChevronUp className="inline h-3.5 w-3.5 ml-1" />
    ) : (
      <ChevronDown className="inline h-3.5 w-3.5 ml-1" />
    )
  }

  const thOrdenable = (
    columna: ColumnaOrdenCotizacion,
    label: string,
    className = ''
  ) => (
    <TableHead
      className={`px-4 py-3 font-semibold cursor-pointer select-none hover:bg-muted ${className}`}
      onClick={() => handleOrdenColumna(columna)}
    >
      {label}
      {iconoOrden(columna)}
    </TableHead>
  )

  const toggleSelection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) newSelected.delete(id)
    else newSelected.add(id)
    setSelectedIds(newSelected)
  }

  const toggleAllSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(filasPagina.map((c) => c.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleDeleteMultiple = async () => {
    if (selectedIds.size === 0) return
    const aceptado = await confirmar({
      title: 'Eliminar cotizaciones seleccionadas',
      description: `Se eliminarán ${selectedIds.size} cotizaciones y esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar cotizaciones',
      variant: 'destructive',
    })
    if (!aceptado) return
    setIsDeletingBulk(true)
    const success = await handleEliminarLote(Array.from(selectedIds))
    if (success) {
      setSelectedIds(new Set())
    } else {
      toast.error('No se pudieron eliminar las cotizaciones. Intenta de nuevo.')
    }
    setIsDeletingBulk(false)
  }

  const handleFormSaved = (cotizacionGuardada: Cotizacion) => {
    addOrUpdateCotizacion(cotizacionGuardada)
    setIsAddingMode(false)
    setIsIaModalOpen(false)
    setInitialPasteFile(null)
    setCotizacionToEdit(null)
  }

  if (loading) {
    return (
      <ModuleSurface className="flex flex-col items-center justify-center py-20">
        <Loader2 className="mb-4 size-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Cargando cotizaciones…</p>
      </ModuleSurface>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-semibold text-red-800">Error de carga</h3>
          <p className="text-sm text-red-700 mt-1">{error}</p>
          <button onClick={fetchCotizaciones} className="mt-3 text-xs font-semibold text-red-800 underline hover:text-red-900">
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  if (cotizaciones.length === 0) {
    return (
      <>
        <ModuleEmptyState
          icon={FileSearch}
          title="No hay cotizaciones registradas"
          description="Pega un screenshot con Ctrl+V o arrastra una imagen de producto para extraer su información con IA, o agrégala manualmente."
          action={
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button
                type="button"
                className="gap-2 bg-gradient-to-r from-primary to-primary/90 shadow-sm"
                onClick={() => {
                  setInitialPasteFile(null)
                  setIsIaModalOpen(true)
                }}
              >
                <Sparkles className="h-4 w-4 text-amber-300" />
                Extraer con IA (Ctrl+V)
              </Button>
              <Button type="button" variant="outline" onClick={() => setIsAddingMode(true)}>
                <Plus data-icon="inline-start" />
                Añadir manual
              </Button>
              {onIrAImportar && (
                <Button type="button" variant="ghost" onClick={onIrAImportar}>
                  <Upload className="h-4 w-4 mr-1.5" />
                  Importar CSV
                </Button>
              )}
            </div>
          }
        />
        {isIaModalOpen && (
          <CotizacionIaModal
            open={isIaModalOpen}
            onClose={() => {
              setIsIaModalOpen(false)
              setInitialPasteFile(null)
            }}
            onSaved={handleFormSaved}
            initialFile={initialPasteFile}
          />
        )}
        {isAddingMode && (
          <CotizacionFormModal
            onClose={() => setIsAddingMode(false)}
            onSaved={handleFormSaved}
          />
        )}
      </>
    )
  }

  return (
    <>
      <ModuleSurface className="mb-4 flex flex-col gap-3 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value)
              resetPaginaYSeleccion()
            }}
            placeholder="Buscar por descripción, no. de parte, proveedor o folio de factura…"
            className="pl-9"
            aria-label="Buscar cotizaciones y compras"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold text-muted-foreground">Origen:</span>
          <ModuleFilterChips
            ariaLabel="Filtrar por origen"
            value={filtroOrigen}
            onValueChange={(value) => {
              setFiltroOrigen(value as FiltroOrigenCotizacion)
              resetPaginaYSeleccion()
            }}
            options={[
              { value: 'todas', label: 'Todas' },
              { value: 'compra', label: 'Compradas' },
              { value: 'cotizacion', label: 'Solo cotizadas' },
            ]}
          />
          <span className="text-xs font-semibold text-muted-foreground">Ubicación:</span>
          <ModuleFilterChips
            ariaLabel="Filtrar por ubicación"
            value={filtroUbicacion}
            onValueChange={(value) => {
              setFiltroUbicacion(value as FiltroUbicacion)
              resetPaginaYSeleccion()
            }}
            options={[
              { value: 'todas', label: 'Todas' },
              { value: 'MX', label: 'México' },
              { value: 'USA', label: 'EUA' },
            ]}
          />
          <span className="text-xs font-semibold text-muted-foreground">Estatus:</span>
          <ModuleFilterChips
            ariaLabel="Filtrar por estatus"
            value={filtroEstatus}
            onValueChange={(value) => {
              setFiltroEstatus(value as FiltroEstatus)
              resetPaginaYSeleccion()
            }}
            options={[
              { value: 'todos', label: 'Todos' },
              { value: 'cotizado', label: 'Cotizado' },
              { value: 'revisar', label: 'Revisar' },
              { value: 'cancelado', label: 'Cancelado' },
            ]}
          />
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-xs text-muted-foreground">
                {filtradas.length} de {cotizaciones.length} cotizaciones cargadas
                {!coleccionCompleta && hayMas ? ' (hay más en el servidor)' : ''}
              </p>
              {hayMas && !coleccionCompleta && (
                <button
                  type="button"
                  onClick={() => void cargarMas()}
                  disabled={cargandoMas || loading}
                  className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50"
                >
                  {cargandoMas ? 'Cargando…' : 'Cargar más del servidor'}
                </button>
              )}
              {!coleccionCompleta && (
                <button
                  type="button"
                  onClick={() => void cargarTodas().catch(() => undefined)}
                  disabled={cargandoCompleto || loading}
                  className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800 hover:bg-sky-100 disabled:opacity-50"
                >
                  {cargandoCompleto ? 'Cargando historial…' : 'Cargar historial completo'}
                </button>
              )}
              {selectedIds.size > 0 && (
                <div className="inline-flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setIsExportModalOpen(true)}
                    className="gap-1.5 border-emerald-600/30 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30 font-semibold cursor-pointer"
                    title="Exportar cotizaciones seleccionadas a Excel con opciones de grupos"
                  >
                    <FileSpreadsheet className="size-4 text-emerald-600" />
                    Exportar Excel ({selectedIds.size})
                  </Button>
                  <button
                    onClick={handleDeleteMultiple}
                    disabled={isDeletingBulk}
                    className="inline-flex items-center gap-2 rounded-lg bg-rose-50 text-rose-600 px-3 py-1.5 text-xs font-semibold hover:bg-rose-100 transition-colors border border-rose-200 disabled:opacity-50 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                    {isDeletingBulk ? 'Eliminando...' : `Eliminar ${selectedIds.size}`}
                  </button>
                </div>
              )}
            </div>
            {paginacion.totalFilas > 0 && (
              <p className="text-xs text-muted-foreground">
                Mostrando {paginacion.indiceInicio}—{paginacion.indiceFin} de {paginacion.totalFilas} resultados
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setIsExportModalOpen(true)}
              className="gap-1.5 border-emerald-600/30 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30 font-semibold cursor-pointer"
              title="Exportar cotizaciones a Excel con opción de agrupar por proveedor, solicitante o moneda"
            >
              <FileSpreadsheet className="size-3.5 text-emerald-600" />
              Exportar Excel
            </Button>
            <Button
              type="button"
              size="sm"
              className="gap-2 bg-gradient-to-r from-primary to-primary/90 shadow-sm"
              onClick={() => {
                setInitialPasteFile(null)
                setIsIaModalOpen(true)
              }}
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              <span>Extraer con IA</span>
              <kbd className="hidden sm:inline-block rounded bg-primary-foreground/20 px-1 py-0.2 font-mono text-[10px]">
                Ctrl+V
              </kbd>
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setIsAddingMode(true)}>
              <Plus data-icon="inline-start" />
              Añadir manual
            </Button>
            {onIrAImportar && (
              <Button type="button" size="sm" variant="ghost" onClick={onIrAImportar}>
                <Upload className="h-3.5 w-3.5 mr-1" />
                CSV
              </Button>
            )}
          </div>
        </div>
      </ModuleSurface>

      <ModuleSurface>
        <div className="hidden md:block">
          <Table className="text-sm text-left text-muted-foreground">
            <TableHeader className="bg-muted/50 text-xs uppercase">
              <TableRow>
                <TableHead className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={
                      filasPagina.length > 0 &&
                      filasPagina.every((c) => selectedIds.has(c.id))
                    }
                    onChange={toggleAllSelection}
                    className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
                    aria-label="Seleccionar todas las cotizaciones de la página"
                  />
                </TableHead>
                {thOrdenable('fecha', 'Fecha')}
                {thOrdenable('solicitante', 'Solicitante')}
                {thOrdenable('proveedor', 'Proveedor')}
                {thOrdenable('numeroParte', 'No. Parte')}
                {thOrdenable('descripcion', 'Descripción')}
                <TableHead className="px-4 py-3 font-semibold">Ubicación</TableHead>
                {thOrdenable('cantidad', 'Cant.', 'text-right')}
                {thOrdenable('precioUnitario', 'P. Unitario', 'text-right')}
                {thOrdenable('total', 'Total', 'text-right')}
                <TableHead className="px-4 py-3 font-semibold">Estatus</TableHead>
                <TableHead className="px-4 py-3 font-semibold text-center">Link</TableHead>
                <TableHead className="w-10 px-4 py-3" />
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border">
              {filasPagina.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} className="py-8 text-center text-muted-foreground">
                    No se encontraron cotizaciones con los filtros actuales.
                  </TableCell>
                </TableRow>
              ) : (
                filasPagina.map((c) => (
                  <CotizacionTableRow
                    key={c.id}
                    c={c}
                    isSelected={selectedIds.has(c.id)}
                    exportando={exportandoIndividualId === c.id}
                    onToggleSelect={toggleSelection}
                    onEditar={(cot) => setCotizacionToEdit(cot)}
                    onExportarIndividual={handleExportarIndividual}
                    onComprarUsa={handleComprarUsa}
                    onCrearOdoo={handleCrearOdoo}
                    onCopiarWhatsApp={handleCopiarWhatsApp}
                    onEliminar={(cot) => {
                      setSelectedIds(new Set([cot.id]))
                      void handleDeleteMultiple()
                    }}
                    onIrAOrdenes={() => router.push('/ordenes')}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Vista Móvil: Tarjetas */}
        <div className="divide-y divide-border md:hidden">
          {filasPagina.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No se encontraron cotizaciones con los filtros actuales.
            </div>
          ) : (
            filasPagina.map((c) => (
              <CotizacionCard
                key={c.id}
                c={c}
                selected={selectedIds.has(c.id)}
                onToggleSelect={toggleSelection}
                onEditar={(cot) => setCotizacionToEdit(cot)}
                onComprarUsa={handleComprarUsa}
                onCrearOdoo={handleCrearOdoo}
                onCopiarWhatsApp={handleCopiarWhatsApp}
                onExportarExcel={handleExportarIndividual}
              />
            ))
          )}
        </div>


        {/* Paginador */}
        {paginacion.totalPaginas > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Página {paginacion.paginaActual} de {paginacion.totalPaginas}
            </p>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={paginacion.paginaActual <= 1}
                onClick={() => cambiarPagina(paginacion.paginaActual - 1)}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={paginacion.paginaActual >= paginacion.totalPaginas}
                onClick={() => cambiarPagina(paginacion.paginaActual + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}
      </ModuleSurface>

      {isIaModalOpen && (
        <CotizacionIaModal
          open={isIaModalOpen}
          onClose={() => {
            setIsIaModalOpen(false)
            setInitialPasteFile(null)
          }}
          onSaved={handleFormSaved}
          initialFile={initialPasteFile}
        />
      )}

      {isAddingMode && (
        <CotizacionFormModal
          onClose={() => setIsAddingMode(false)}
          onSaved={handleFormSaved}
        />
      )}

      {cotizacionToEdit && (
        <CotizacionFormModal
          cotizacionBase={cotizacionToEdit}
          onClose={() => setCotizacionToEdit(null)}
          onSaved={handleFormSaved}
        />
      )}

      {isExportModalOpen && (
        <ModalExportarCotizaciones
          open={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          cotizacionesSeleccionadas={cotizaciones.filter((c) => selectedIds.has(c.id))}
          todasCotizacionesFiltradas={filtradas}
        />
      )}
    </>
  )
}
