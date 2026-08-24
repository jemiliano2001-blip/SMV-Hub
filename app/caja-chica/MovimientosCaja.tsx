'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useCajaChica } from '@/lib/hooks/useCajaChica'
import {
  Plus,
  Search,
  Trash2,
  Edit2,
  CheckCircle,
  FileText,
  Filter,
  AlertTriangle,
  UserCheck,
  Scissors,
  RefreshCw,
  Copy,
  CheckCircle2,
} from 'lucide-react'
import ModalMovimientoCaja from './ModalMovimientoCaja'
import type { MovimientoCajaChica } from '@/lib/schemas'
import { listarCortesCaja, type CorteCaja, type ModoFiltroCaja } from '@/lib/caja-chica'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import ModuleSurface from '@/components/layout/ModuleSurface'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type FiltroTipo = 'TODOS' | 'ENTRADA' | 'SALIDA'
type FiltroEstado = 'TODOS' | 'VERIFICADO' | 'PENDIENTE'

// Regla de negocio: caja chica siempre es MXN.
const formatearDinero = (monto: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(monto)

type AccionesMovimiento = {
  m: MovimientoCajaChica
  onVerificar: (m: MovimientoCajaChica) => void
  onEditar: (m: MovimientoCajaChica) => void
  onBorrar: (m: MovimientoCajaChica) => void
}

function MovimientoRow({ m, onVerificar, onEditar, onBorrar }: AccionesMovimiento) {
  const isVale = m.comprobante === 'VALE'
  const isCortado = m.estadoCorte === 'CORTADO'

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <TableRow
          className={`hover:bg-muted/80 transition-colors text-xs cursor-pointer ${isVale ? 'bg-amber-50/30' : ''}`}
          onDoubleClick={() => onEditar(m)}
        >
          <TableCell className="px-3 py-2.5 font-mono text-foreground">
            <div className="flex items-center gap-1.5">
              <span>{m.fecha}</span>
              {isCortado && (
                <span
                  className="bg-muted text-muted-foreground border border-border px-1 py-0.2 rounded text-[9px] font-mono"
                  title="Este movimiento pertenece a un corte ya realizado"
                >
                  CORTADO
                </span>
              )}
            </div>
          </TableCell>
          <TableCell className="px-3 py-2.5 font-medium text-foreground max-w-[220px] truncate" title={m.descripcion}>
            <span>{m.descripcion}</span>
            {isVale && (
              <span className="ml-2 bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold">
                VALE PENDIENTE
              </span>
            )}
          </TableCell>
          <TableCell className="px-3 py-2.5 text-muted-foreground">{m.proveedor}</TableCell>
          <TableCell className="px-3 py-2.5 text-muted-foreground">
            <span className="bg-muted text-foreground px-2 py-0.5 rounded border border-border text-[11px] font-medium">
              {m.categoria}
            </span>
          </TableCell>
          <TableCell className="px-3 py-2.5 text-muted-foreground">{m.solicitante}</TableCell>
          <TableCell className="px-3 py-2.5 text-muted-foreground font-mono text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className={isVale ? 'text-amber-700 font-bold' : ''}>{m.comprobante}</span>
              {m.archivoUrl && (
                <a
                  href={m.archivoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-primary hover:text-sky-800 flex items-center gap-0.5 shrink-0"
                  title="Ver comprobante digital"
                >
                  <FileText className="h-3.5 w-3.5" />
                </a>
              )}
              {m.deducible && (
                <span className="text-[9px] font-bold text-sky-700 bg-sky-50 px-1 py-0.2 rounded border border-sky-200">
                  DED
                </span>
              )}
            </div>
          </TableCell>
          <TableCell className="px-3 py-2.5 text-right text-emerald-700 font-mono font-semibold tabular-nums">
            {m.tipo === 'ENTRADA' ? formatearDinero(m.monto) : '—'}
          </TableCell>
          <TableCell className="px-3 py-2.5 text-right text-rose-700 font-mono font-semibold tabular-nums">
            {m.tipo === 'SALIDA' ? formatearDinero(m.monto) : '—'}
          </TableCell>
          <TableCell className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => onVerificar(m)}
              className={`transition-transform active:scale-90 ${m.verificado ? 'text-emerald-600' : 'text-muted-foreground/40 hover:text-muted-foreground'}`}
              title={m.verificado ? 'Verificado' : 'Marcar como verificado'}
            >
              <CheckCircle className="h-4.5 w-4.5 mx-auto" />
            </button>
          </TableCell>
          <TableCell className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end gap-1">
              <button
                onClick={() => onEditar(m)}
                className="p-1 text-muted-foreground hover:text-primary hover:bg-sky-50 rounded transition-colors"
                title="Editar"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => onBorrar(m)}
                className="p-1 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                title="Eliminar"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </TableCell>
        </TableRow>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-56">
        <ContextMenuItem onClick={() => onEditar(m)}>
          <Edit2 className="text-primary" />
          <span>Editar movimiento</span>
          <ContextMenuShortcut>↵</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuItem onClick={() => onVerificar(m)}>
          <CheckCircle2 className={m.verificado ? 'text-muted-foreground' : 'text-emerald-600'} />
          <span>{m.verificado ? 'Desmarcar verificación' : 'Marcar como verificado'}</span>
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Copy className="text-muted-foreground" />
            <span>Copiar datos</span>
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
            <ContextMenuItem
              onClick={() => {
                void navigator.clipboard.writeText(m.descripcion)
                toast.success('Descripción copiada')
              }}
            >
              <span>Descripción</span>
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => {
                const montoTxt = formatearDinero(m.monto)
                void navigator.clipboard.writeText(montoTxt)
                toast.success('Monto copiado', { description: montoTxt })
              }}
            >
              <span>Monto ({formatearDinero(m.monto)})</span>
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => {
                void navigator.clipboard.writeText(m.solicitante)
                toast.success('Solicitante copiado')
              }}
            >
              <span>Solicitante ({m.solicitante})</span>
            </ContextMenuItem>
            {m.proveedor && (
              <ContextMenuItem
                onClick={() => {
                  void navigator.clipboard.writeText(m.proveedor || '')
                  toast.success('Proveedor copiado')
                }}
              >
                <span>Proveedor ({m.proveedor})</span>
              </ContextMenuItem>
            )}
          </ContextMenuSubContent>
        </ContextMenuSub>

        {m.archivoUrl && (
          <ContextMenuItem
            onClick={() => {
              if (m.archivoUrl) window.open(m.archivoUrl, '_blank', 'noopener,noreferrer')
            }}
          >
            <FileText className="text-amber-600" />
            <span>Ver comprobante digital</span>
          </ContextMenuItem>
        )}

        <ContextMenuSeparator />

        <ContextMenuItem
          className="text-rose-600"
          onClick={() => onBorrar(m)}
        >
          <Trash2 className="text-rose-600" />
          <span>Eliminar movimiento</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

function MovimientoCard({ m, onVerificar, onEditar, onBorrar }: AccionesMovimiento) {
  const isVale = m.comprobante === 'VALE'
  const isCortado = m.estadoCorte === 'CORTADO'

  return (
    <ModuleSurface className={`mb-2.5 space-y-2.5 p-3.5 ${isVale ? 'border-amber-200 bg-amber-50/40' : ''}`}>
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-mono text-muted-foreground">{m.fecha}</span>
            {isVale && <span className="bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold">VALE</span>}
            {isCortado && <span className="bg-muted text-muted-foreground border border-border px-1.5 py-0.2 rounded text-[9px] font-mono">CORTADO</span>}
          </div>
          <h4 className="text-xs font-bold text-foreground mt-0.5 break-words">{m.descripcion}</h4>
        </div>
        <span className={`text-xs font-mono font-bold shrink-0 tabular-nums ${m.tipo === 'ENTRADA' ? 'text-emerald-700' : 'text-rose-700'}`}>
          {m.tipo === 'ENTRADA' ? '+' : '-'}{formatearDinero(m.monto)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="min-w-0">
          <span className="text-muted-foreground block text-[10px] uppercase font-mono">Proveedor</span>
          <span className="text-foreground truncate block font-medium">{m.proveedor}</span>
        </div>
        <div className="min-w-0">
          <span className="text-muted-foreground block text-[10px] uppercase font-mono">Categoría</span>
          <span className="bg-muted text-foreground px-1.5 py-0.5 rounded text-[10px] font-medium w-fit block truncate">
            {m.categoria}
          </span>
        </div>
        <div className="min-w-0">
          <span className="text-muted-foreground block text-[10px] uppercase font-mono">Comprobante</span>
          <div className="flex items-center gap-1">
            <span className={isVale ? 'text-amber-800 font-bold' : 'text-foreground'}>{m.comprobante}</span>
            {m.archivoUrl && (
              <a href={m.archivoUrl} target="_blank" rel="noopener noreferrer" className="text-primary">
                <FileText className="h-3 w-3" />
              </a>
            )}
            {m.deducible && <span className="text-[9px] text-sky-700 bg-sky-50 px-1 py-0.2 rounded border border-sky-200">DED</span>}
          </div>
        </div>
        <div className="min-w-0">
          <span className="text-muted-foreground block text-[10px] uppercase font-mono">Solicitante</span>
          <span className="text-foreground truncate block font-medium">{m.solicitante}</span>
        </div>
      </div>

      <div className="pt-2 border-t border-border flex justify-between items-center text-xs">
        <button
          onClick={() => onVerificar(m)}
          className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded transition-colors ${m.verificado ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-muted text-muted-foreground hover:bg-muted'}`}
        >
          <CheckCircle className="h-3.5 w-3.5" />
          {m.verificado ? 'Verificado' : 'Pendiente'}
        </button>
        <div className="flex gap-1">
          <button
            onClick={() => onEditar(m)}
            className="p-1 text-muted-foreground hover:text-primary hover:bg-sky-50 rounded"
            title="Editar"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onBorrar(m)}
            className="p-1 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 rounded"
            title="Eliminar"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </ModuleSurface>
  )
}

function SkeletonRow() {
  return (
    <TableRow>
      <TableCell colSpan={10} className="px-3 py-2.5">
        <div className="flex items-center justify-between gap-4">
          <div className="h-3.5 bg-muted rounded w-16 animate-pulse"></div>
          <div className="h-3.5 bg-muted rounded w-48 animate-pulse"></div>
          <div className="h-3.5 bg-muted rounded w-24 animate-pulse"></div>
          <div className="h-3.5 bg-muted rounded w-20 animate-pulse"></div>
          <div className="h-3.5 bg-muted rounded w-16 animate-pulse"></div>
          <div className="h-3.5 bg-muted rounded w-16 animate-pulse"></div>
          <div className="h-3.5 bg-muted rounded w-16 animate-pulse"></div>
          <div className="h-3.5 bg-muted rounded w-16 animate-pulse"></div>
          <div className="h-5 w-5 bg-muted rounded-full animate-pulse"></div>
          <div className="h-5 w-10 bg-muted rounded animate-pulse"></div>
        </div>
      </TableCell>
    </TableRow>
  )
}

export default function MovimientosCaja() {
  const [modoFiltro, setModoFiltro] = useState<ModoFiltroCaja>('CICLO_ACTIVO')
  const [periodoSel, setPeriodoSel] = useState(() => {
    const hoy = new Date()
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
  })
  const [corteIdSel, setCorteIdSel] = useState<string>('')
  const [cortesHistorial, setCortesHistorial] = useState<CorteCaja[]>([])

  const filtroActual = useMemo(() => {
    return {
      modo: modoFiltro,
      periodo: periodoSel,
      corteId: corteIdSel,
    }
  }, [modoFiltro, periodoSel, corteIdSel])

  const {
    movimientos,
    loading,
    error,
    agregarMovimiento,
    borrarMovimiento,
    actualizarMovimiento,
    realizarCorteCaja,
  } = useCajaChica(filtroActual)

  const [busqueda, setBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('TODOS')
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('TODOS')

  const [modalOpen, setModalOpen] = useState(false)
  const [movimientoEditar, setMovimientoEditar] = useState<MovimientoCajaChica | null>(null)
  const [initialValores, setInitialValores] = useState<Partial<MovimientoCajaChica> | undefined>(undefined)
  const [movimientoABorrar, setMovimientoABorrar] = useState<MovimientoCajaChica | null>(null)

  // Modal para confirmar Corte de Caja
  const [modalCorteOpen, setModalCorteOpen] = useState(false)
  const [notaCorte, setNotaCorte] = useState('')
  const [montoReabastecimientoInput, setMontoReabastecimientoInput] = useState('')
  const [haciendoCorte, setHaciendoCorte] = useState(false)

  const cargarHistorialCortes = useCallback(() => {
    listarCortesCaja()
      .then((res) => {
        setCortesHistorial(res)
        if (res.length > 0 && !corteIdSel) {
          setCorteIdSel(res[0].id)
        }
      })
      .catch((err) => console.error('Error cargando historial de cortes:', err))
  }, [corteIdSel])

  useEffect(() => {
    cargarHistorialCortes()
  }, [cargarHistorialCortes])

  const { totalSalidasAcumuladas, totalEntradasAcumuladas, saldoCalculado } = useMemo(() => {
    let totalEntradas = 0
    let totalSalidas = 0
    movimientos.forEach((m) => {
      if (m.tipo === 'ENTRADA') totalEntradas += m.monto
      else totalSalidas += m.monto
    })
    return {
      totalEntradasAcumuladas: totalEntradas,
      totalSalidasAcumuladas: totalSalidas,
      saldoCalculado: totalEntradas - totalSalidas,
    }
  }, [movimientos])

  const handleConfirmarCorte = async () => {
    setHaciendoCorte(true)
    try {
      const montoRepoParsed = montoReabastecimientoInput.trim() !== ''
        ? parseFloat(montoReabastecimientoInput)
        : totalSalidasAcumuladas
      const montoFinal = Number.isNaN(montoRepoParsed) || montoRepoParsed < 0
        ? totalSalidasAcumuladas
        : montoRepoParsed

      const res = await realizarCorteCaja(notaCorte, montoFinal)
      toast.success(
        `¡${res.corte.folio} realizado con éxito! Se registraron ${res.movimientosCortadosCount} movimientos y la entrada de reabastecimiento por ${formatearDinero(res.corte.saldoReembolsado)}.`
      )
      setModalCorteOpen(false)
      setNotaCorte('')
      setMontoReabastecimientoInput('')
      cargarHistorialCortes()
    } catch (err: unknown) {
      console.error(err)
      const msg = err instanceof Error ? err.message : 'No se pudo realizar el corte de caja.'
      toast.error(msg)
    } finally {
      setHaciendoCorte(false)
    }
  }

  const handleEliminar = async () => {
    if (movimientoABorrar) {
      await borrarMovimiento(movimientoABorrar.id)
      setMovimientoABorrar(null)
    }
  }

  const handleToggleVerificado = async (mov: MovimientoCajaChica) => {
    await actualizarMovimiento(mov.id, { verificado: !mov.verificado })
  }

  const handleEditar = (mov: MovimientoCajaChica) => {
    setMovimientoEditar(mov)
    setInitialValores(undefined)
    setModalOpen(true)
  }

  const handleNuevoGasto = () => {
    setMovimientoEditar(null)
    setInitialValores({ tipo: 'SALIDA' })
    setModalOpen(true)
  }

  const handleNuevoVale = () => {
    setMovimientoEditar(null)
    setInitialValores({
      tipo: 'SALIDA',
      comprobante: 'VALE',
      descripcion: 'Préstamo provisional para gasto',
      proveedor: 'Pendiente',
    })
    setModalOpen(true)
  }

  const filtrados = useMemo(() => {
    const queryStr = busqueda.toLowerCase()
    return movimientos.filter((m) => {
      const matchBusqueda =
        m.descripcion.toLowerCase().includes(queryStr) ||
        m.proveedor.toLowerCase().includes(queryStr) ||
        m.solicitante.toLowerCase().includes(queryStr) ||
        m.categoria.toLowerCase().includes(queryStr)
      const matchTipo = filtroTipo === 'TODOS' || m.tipo === filtroTipo
      const matchEstado =
        filtroEstado === 'TODOS' ||
        (filtroEstado === 'VERIFICADO' && m.verificado) ||
        (filtroEstado === 'PENDIENTE' && !m.verificado)
      return matchBusqueda && matchTipo && matchEstado
    })
  }, [movimientos, busqueda, filtroTipo, filtroEstado])

  return (
    <div className="space-y-4 font-sans">
      {/* Header & Balance Utilitario del Ciclo */}
      <ModuleSurface className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 divide-y sm:divide-y-0 sm:divide-x divide-border">
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">
                {modoFiltro === 'CICLO_ACTIVO' ? 'Saldo del Ciclo Activo' : 'Saldo de los Movimientos'}
              </p>
              {modoFiltro === 'CICLO_ACTIVO' && (
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border border-emerald-300">
                  EN CURSO
                </span>
              )}
            </div>
            <p
              className={`text-2xl font-bold font-mono tracking-tight ${saldoCalculado >= 0 ? 'text-foreground' : 'text-rose-600'}`}
            >
              {formatearDinero(saldoCalculado)}
            </p>
          </div>

          <div className="pt-2 sm:pt-0 sm:pl-4">
            <p className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">
              Total a Reembolsar (Gastos)
            </p>
            <p className="text-lg font-bold font-mono text-rose-700 tabular-nums">
              {formatearDinero(totalSalidasAcumuladas)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 w-full lg:w-auto justify-end">
          {modoFiltro === 'CICLO_ACTIVO' && (
            <button
              onClick={() => setModalCorteOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 justify-center shadow-xs active:scale-[0.98] w-full sm:w-auto"
              title="Cerrar el ciclo acumulado actual y generar el reembolso automático"
            >
              <Scissors className="h-4 w-4" />
              Hacer Corte de Caja
            </button>
          )}

          <button
            onClick={handleNuevoVale}
            className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 justify-center active:scale-[0.98] flex-1 sm:flex-none"
          >
            <UserCheck className="h-4 w-4" />
            Nuevo Vale
          </button>

          <button
            onClick={handleNuevoGasto}
            className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 justify-center shadow-xs active:scale-[0.98] flex-1 sm:flex-none"
          >
            <Plus className="h-4 w-4" />
            Nuevo Movimiento
          </button>
        </div>
      </ModuleSurface>

      {/* Toolbar de Filtros y Selección de Ciclo / Corte */}
      <ModuleSurface className="space-y-3 bg-muted/40 p-3">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por descripción, proveedor, solicitante..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-card border border-input rounded-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-ring text-foreground"
            />
          </div>

          <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center">
            <div className="flex items-center gap-1.5 text-xs w-full sm:w-auto">
              <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value as FiltroTipo)}
                className="w-full sm:w-auto px-2.5 py-1.5 bg-card text-xs border border-input rounded-md focus:outline-none focus:border-primary"
              >
                <option value="TODOS">Todos los Tipos</option>
                <option value="ENTRADA">Entradas</option>
                <option value="SALIDA">Salidas</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-xs w-full sm:w-auto">
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value as FiltroEstado)}
                className="w-full sm:w-auto px-2.5 py-1.5 bg-card text-xs border border-input rounded-md focus:outline-none focus:border-primary"
              >
                <option value="TODOS">Todos los Estados</option>
                <option value="VERIFICADO">Verificados</option>
                <option value="PENDIENTE">Pendientes</option>
              </select>
            </div>

            {/* Selector de Modo de Vista (Ciclo Activo / Todos / Mes / Corte) */}
            <div className="flex items-center gap-1.5 text-xs w-full sm:w-auto">
              <select
                value={modoFiltro}
                onChange={(e) => setModoFiltro(e.target.value as ModoFiltroCaja)}
                className="w-full sm:w-auto px-2.5 py-1.5 bg-card text-xs font-bold text-foreground border border-input rounded-md focus:outline-none focus:border-primary"
              >
                <option value="CICLO_ACTIVO">Ciclo activo (sin corte)</option>
                <option value="TODOS">Todos los movimientos</option>
                <option value="PERIODO">Filtrar por mes calendario</option>
                <option value="CORTE">Filtrar por corte realizado</option>
              </select>
            </div>

            {modoFiltro === 'PERIODO' && (
              <input
                type="month"
                value={periodoSel}
                onChange={(e) => setPeriodoSel(e.target.value)}
                className="w-full sm:w-auto px-2.5 py-1.5 bg-card text-xs border border-input rounded-md focus:outline-none focus:border-primary font-mono"
              />
            )}

            {modoFiltro === 'CORTE' && (
              <select
                value={corteIdSel}
                onChange={(e) => setCorteIdSel(e.target.value)}
                className="w-full sm:w-auto px-2.5 py-1.5 bg-card text-xs border border-input rounded-md focus:outline-none focus:border-primary font-mono"
              >
                {cortesHistorial.length === 0 ? (
                  <option value="">Sin cortes realizados</option>
                ) : (
                  cortesHistorial.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.folio} ({c.fechaCierre}) — {formatearDinero(c.totalSalidas)}
                    </option>
                  ))
                )}
              </select>
            )}
          </div>
        </div>
      </ModuleSurface>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 rounded-lg text-xs flex items-center gap-2 font-medium">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Tabla Utilitaria para Escritorio */}
      <div className="hidden md:block">
        <ModuleSurface>
        <Table className="text-xs text-left">
          <TableHeader className="bg-muted text-muted-foreground font-mono text-[11px] uppercase tracking-wider border-b border-border">
            <TableRow>
              <TableHead className="px-3 py-2.5">Fecha</TableHead>
              <TableHead className="px-3 py-2.5">Descripción</TableHead>
              <TableHead className="px-3 py-2.5">Proveedor</TableHead>
              <TableHead className="px-3 py-2.5">Categoría</TableHead>
              <TableHead className="px-3 py-2.5">Solicitante</TableHead>
              <TableHead className="px-3 py-2.5">Comprobante</TableHead>
              <TableHead className="px-3 py-2.5 text-right">Entrada</TableHead>
              <TableHead className="px-3 py-2.5 text-right">Salida</TableHead>
              <TableHead className="px-3 py-2.5 text-center">Verif.</TableHead>
              <TableHead className="px-3 py-2.5 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-border">
            {loading ? (
              <>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </>
            ) : filtrados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="px-4 py-8 text-center text-muted-foreground font-mono text-xs">
                  Sin movimientos registrados para la vista seleccionada.
                </TableCell>
              </TableRow>
            ) : (
              filtrados.map((m) => (
                <MovimientoRow
                  key={m.id}
                  m={m}
                  onVerificar={handleToggleVerificado}
                  onEditar={handleEditar}
                  onBorrar={setMovimientoABorrar}
                />
              ))
            )}
          </TableBody>
        </Table>
        </ModuleSurface>
      </div>

      {/* Vista Móvil / Tarjetas Compactas */}
      <div className="md:hidden space-y-2">
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="bg-muted p-4 border border-border rounded-lg animate-pulse h-28"></div>
            ))}
          </div>
        ) : filtrados.length === 0 ? (
          <ModuleSurface className="p-6 text-center text-muted-foreground text-xs font-mono">
            No hay movimientos.
          </ModuleSurface>
        ) : (
          filtrados.map((m) => (
            <MovimientoCard
              key={m.id}
              m={m}
              onVerificar={handleToggleVerificado}
              onEditar={handleEditar}
              onBorrar={setMovimientoABorrar}
            />
          ))
        )}
      </div>

      <Dialog open={modalCorteOpen} onOpenChange={(open) => !open && setModalCorteOpen(false)}>
        <DialogContent className="max-w-md gap-4 sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-emerald-700">
                <Scissors className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle>Realizar corte de caja chica</DialogTitle>
                <DialogDescription>Cierre de ciclo activo y solicitud de reembolso</DialogDescription>
              </div>
            </div>
          </DialogHeader>

            <div className="space-y-2 rounded-lg border border-border bg-muted p-3.5 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Movimientos en el ciclo:</span>
                <span className="font-bold text-foreground">{movimientos.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total de Entradas:</span>
                <span className="text-emerald-700">{formatearDinero(totalEntradasAcumuladas)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Gastado (Reembolso):</span>
                <span className="text-rose-700 font-bold">{formatearDinero(totalSalidasAcumuladas)}</span>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground">
                Monto real a depositar / reabastecer ($)
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={montoReabastecimientoInput}
                onChange={(e) => setMontoReabastecimientoInput(e.target.value)}
                placeholder={totalSalidasAcumuladas.toString()}
                className="w-full rounded-md border border-input bg-card p-2.5 text-xs font-mono font-bold text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Por defecto se deposita el gasto total del ciclo ({formatearDinero(totalSalidasAcumuladas)}), pero puedes ajustarlo si te entregan un monto parcial (ej. $7,221.00 por comprobantes pendientes).
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Notas u observaciones del corte (opcional)</label>
              <textarea
                value={notaCorte}
                onChange={(e) => setNotaCorte(e.target.value)}
                placeholder="Ej. Se reciben $7,221 por viáticos de Brownsville pendientes de entregar..."
                rows={2}
                className="w-full rounded-md border border-input p-2.5 text-xs focus:border-primary focus:outline-none"
              />
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setModalCorteOpen(false)}
                disabled={haciendoCorte}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmarCorte}
                disabled={haciendoCorte}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {haciendoCorte ? (
                  <>
                    <RefreshCw className="animate-spin" data-icon="inline-start" />
                    Procesando corte...
                  </>
                ) : (
                  <>
                    <Scissors data-icon="inline-start" />
                    Confirmar corte
                  </>
                )}
              </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={movimientoABorrar != null} onOpenChange={(open) => !open && setMovimientoABorrar(null)}>
        <DialogContent className="max-w-sm sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
              Confirmar eliminación
            </DialogTitle>
            <DialogDescription>
              ¿Eliminar el movimiento{' '}
              <span className="font-bold text-foreground">&ldquo;{movimientoABorrar?.descripcion}&rdquo;</span>{' '}
              por{' '}
              <span className="font-mono font-bold text-foreground">
                {movimientoABorrar ? formatearDinero(movimientoABorrar.monto) : ''}
              </span>
              ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMovimientoABorrar(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleEliminar}>
              Sí, eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Crear / Editar */}
      {modalOpen && (
        <ModalMovimientoCaja
          movimiento={movimientoEditar}
          initialValores={initialValores}
          agregarMovimiento={agregarMovimiento}
          actualizarMovimiento={actualizarMovimiento}
          onClose={() => {
            setModalOpen(false)
            setMovimientoEditar(null)
          }}
        />
      )}
    </div>
  )
}
