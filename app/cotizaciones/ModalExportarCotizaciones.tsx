'use client'

import { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  FileSpreadsheet,
  Loader2,
  Building2,
  User,
  Globe2,
  ListOrdered,
  Layers,
  FileText,
} from 'lucide-react'
import { toast } from 'sonner'
import type { Cotizacion } from '@/lib/schemas'
import {
  agruparCotizaciones,
  descargarExcelCotizaciones,
  type CriterioAgrupacionCotizaciones,
  type EstructuraLibroCotizaciones,
} from '@/lib/cotizaciones-excel-export'

interface Props {
  open: boolean
  onClose: () => void
  cotizacionesSeleccionadas: Cotizacion[]
  todasCotizacionesFiltradas: Cotizacion[]
}

export default function ModalExportarCotizaciones({
  open,
  onClose,
  cotizacionesSeleccionadas,
  todasCotizacionesFiltradas,
}: Props) {
  const [alcance, setAlcance] = useState<'seleccionadas' | 'todas'>(
    cotizacionesSeleccionadas.length > 0 ? 'seleccionadas' : 'todas'
  )
  const [criterio, setCriterio] =
    useState<CriterioAgrupacionCotizaciones>('proveedor')
  const [estructura, setEstructura] =
    useState<EstructuraLibroCotizaciones>('hojas_separadas')
  const [nombreProyecto, setNombreProyecto] = useState('')
  const [descargando, setDescargando] = useState(false)

  const itemsAExportar = useMemo(() => {
    if (alcance === 'seleccionadas' && cotizacionesSeleccionadas.length > 0) {
      return cotizacionesSeleccionadas
    }
    return todasCotizacionesFiltradas
  }, [alcance, cotizacionesSeleccionadas, todasCotizacionesFiltradas])

  const gruposVistaPrevia = useMemo(() => {
    return agruparCotizaciones(itemsAExportar, criterio)
  }, [itemsAExportar, criterio])

  const totalUSD = useMemo(
    () => gruposVistaPrevia.reduce((acc, g) => acc + g.totalUSD, 0),
    [gruposVistaPrevia]
  )
  const totalMXN = useMemo(
    () => gruposVistaPrevia.reduce((acc, g) => acc + g.totalMXN, 0),
    [gruposVistaPrevia]
  )

  const handleDescargar = async () => {
    if (itemsAExportar.length === 0) {
      toast.error('No hay cotizaciones disponibles para exportar')
      return
    }
    try {
      setDescargando(true)
      await descargarExcelCotizaciones({
        cotizaciones: itemsAExportar,
        criterioAgrupacion: criterio,
        estructura,
        nombreProyecto: nombreProyecto.trim() || undefined,
      })
      toast.success(
        `Excel de cotizaciones generado con ${gruposVistaPrevia.length} grupo(s)`
      )
      onClose()
    } catch (err) {
      console.error('Error al generar Excel de cotizaciones:', err)
      toast.error('No se pudo generar el archivo Excel de cotizaciones')
    } finally {
      setDescargando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border bg-muted/40 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg border border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
              <FileSpreadsheet className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Exportar Cotizaciones a Excel
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Genera un libro formal con membrete institucional y subtotales por grupo.
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto p-6 text-sm">
          {/* 1. Alcance de Cotizaciones */}
          <div className="space-y-2">
            <label className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">
              1. Alcance de la Exportación
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setAlcance('seleccionadas')}
                disabled={cotizacionesSeleccionadas.length === 0}
                className={`flex flex-col items-start rounded-lg border p-3 text-left transition-all ${
                  alcance === 'seleccionadas'
                    ? 'border-primary bg-primary/5 text-foreground ring-1 ring-primary'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                } ${cotizacionesSeleccionadas.length === 0 ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <span className="font-semibold text-foreground text-xs">
                  Seleccionadas ({cotizacionesSeleccionadas.length})
                </span>
                <span className="text-[11px] text-muted-foreground mt-0.5">
                  Solo las partidas marcadas con casillas
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAlcance('todas')}
                className={`flex flex-col items-start rounded-lg border p-3 text-left transition-all cursor-pointer ${
                  alcance === 'todas'
                    ? 'border-primary bg-primary/5 text-foreground ring-1 ring-primary'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                }`}
              >
                <span className="font-semibold text-foreground text-xs">
                  Todas las filtradas ({todasCotizacionesFiltradas.length})
                </span>
                <span className="text-[11px] text-muted-foreground mt-0.5">
                  Todas las visibles en el catálogo
                </span>
              </button>
            </div>
          </div>

          {/* 2. Criterio de Agrupación */}
          <div className="space-y-2">
            <label className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">
              2. Poner en Grupos (Criterio)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setCriterio('proveedor')}
                className={`flex flex-col items-center gap-1.5 rounded-lg border p-2.5 text-center transition-all cursor-pointer ${
                  criterio === 'proveedor'
                    ? 'border-emerald-600/60 bg-emerald-500/10 text-foreground ring-1 ring-emerald-600'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                }`}
              >
                <Building2 className="size-4 text-emerald-600" />
                <span className="text-xs font-semibold">Por Proveedor</span>
              </button>

              <button
                type="button"
                onClick={() => setCriterio('solicitante')}
                className={`flex flex-col items-center gap-1.5 rounded-lg border p-2.5 text-center transition-all cursor-pointer ${
                  criterio === 'solicitante'
                    ? 'border-emerald-600/60 bg-emerald-500/10 text-foreground ring-1 ring-emerald-600'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                }`}
              >
                <User className="size-4 text-primary" />
                <span className="text-xs font-semibold">Por Solicitante</span>
              </button>

              <button
                type="button"
                onClick={() => setCriterio('ubicacion')}
                className={`flex flex-col items-center gap-1.5 rounded-lg border p-2.5 text-center transition-all cursor-pointer ${
                  criterio === 'ubicacion'
                    ? 'border-emerald-600/60 bg-emerald-500/10 text-foreground ring-1 ring-emerald-600'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                }`}
              >
                <Globe2 className="size-4 text-indigo-600" />
                <span className="text-xs font-semibold">Por Ubicación / Divisa</span>
              </button>

              <button
                type="button"
                onClick={() => setCriterio('ninguno')}
                className={`flex flex-col items-center gap-1.5 rounded-lg border p-2.5 text-center transition-all cursor-pointer ${
                  criterio === 'ninguno'
                    ? 'border-emerald-600/60 bg-emerald-500/10 text-foreground ring-1 ring-emerald-600'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                }`}
              >
                <ListOrdered className="size-4 text-amber-600" />
                <span className="text-xs font-semibold">Sin agrupar</span>
              </button>
            </div>
          </div>

          {/* 3. Nombre del Proyecto / Grupo (Opcional) */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">
              3. Nombre del Proyecto / Membrete (Opcional)
            </label>
            <Input
              type="text"
              value={nombreProyecto}
              onChange={(e) => setNombreProyecto(e.target.value)}
              placeholder="Ej. Proyecto Celda 3, Maquinados CNC, Herramental..."
              className="text-xs"
            />
          </div>

          {/* 4. Estructura del Libro Excel */}
          <div className="space-y-2">
            <label className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">
              4. Estructura del Documento Excel
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setEstructura('hojas_separadas')}
                className={`flex items-start gap-2.5 rounded-lg border p-3 text-left transition-all cursor-pointer ${
                  estructura === 'hojas_separadas'
                    ? 'border-primary bg-primary/5 text-foreground ring-1 ring-primary'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                }`}
              >
                <Layers className="size-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-xs text-foreground block">
                    Pestañas separadas por grupo
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Crea una hoja para cada grupo con su propio total + hoja de resumen
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setEstructura('una_hoja')}
                className={`flex items-start gap-2.5 rounded-lg border p-3 text-left transition-all cursor-pointer ${
                  estructura === 'una_hoja'
                    ? 'border-primary bg-primary/5 text-foreground ring-1 ring-primary'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                }`}
              >
                <FileText className="size-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-xs text-foreground block">
                    Una sola hoja con secciones
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Tablas divididas por banners de grupo en una misma pestaña
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Vista previa / Resumen de exportación */}
          <div className="rounded-lg border border-border bg-muted/60 p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">Partidas a exportar:</span>
              <span className="font-bold text-foreground font-mono">{itemsAExportar.length} partidas</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">Grupos resultantes:</span>
              <span className="font-bold text-foreground font-mono">{gruposVistaPrevia.length} grupo(s)</span>
            </div>
            {(totalUSD > 0 || totalMXN > 0) && (
              <div className="flex items-center justify-between text-xs pt-1.5 border-t border-border">
                <span className="text-muted-foreground font-medium">Subtotal calculado:</span>
                <div className="font-mono font-bold text-foreground text-right space-x-2">
                  {totalUSD > 0 && <span className="text-primary">USD ${totalUSD.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>}
                  {totalMXN > 0 && <span className="text-emerald-700 dark:text-emerald-400">MXN ${totalMXN.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="border-t border-border bg-muted/30 px-6 py-3.5 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={descargando} type="button">
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleDescargar}
            disabled={descargando || itemsAExportar.length === 0}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs active:scale-[0.98] transition-transform cursor-pointer"
          >
            {descargando ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="size-4" />
            )}
            {descargando ? 'Generando Excel…' : `Descargar Excel (${itemsAExportar.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
