'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Loader2,
  AlertCircle,
  ClipboardList,
  Trash2,
  Edit2,
  Sparkles,
  ShoppingCart,
  ExternalLink,
  Zap,
  Plus,
  ArrowRight,
  Eye,
  Layers,
  Copy,
  CheckCircle2,
  UserCheck,
} from 'lucide-react'
import type { EstatusRequisicion, PrioridadRequisicion, TipoRequisicion, Requisicion } from '@/lib/schemas'
import type { NuevaRequisicionPayload } from '@/lib/requisiciones'
import { useRequisiciones } from '@/lib/hooks/useRequisiciones'
import { formatFecha, normalizar, fechaHoyLocal } from '@/lib/format'
import { getClienteAuth } from '@/lib/firebase'
import { useUsuario } from '@/lib/auth'
import {
  estadoAtraso,
  estadoAtrasoEntrega,
  hoyLocal,
  textoAtraso,
  ATRASO_BADGE,
} from '@/lib/requisicion-atraso'
import {
  ESTADOS_REQUISICION,
  ESTADO_BADGE,
  ESTADO_LABEL,
  REVISION_FINANZAS_OPCIONES,
  badgeEmpresa,
  truncarNota,
} from '@/lib/requisiciones-helpers'
import RequisicionFormModal from './RequisicionFormModal'
import { useRequisicionesFlujo } from '@/lib/hooks/useRequisicionesFlujo'
import NuevaRequisicionModal from './NuevaRequisicionModal'
import DetalleRequisicionModal from './DetalleRequisicionModal'
import { useConfirmDialog } from '@/components/ConfirmDialogProvider'
import { toast } from 'sonner'
import { copiarAlPortapapeles } from '@/lib/portapapeles'
import ModuleFilterChips from '@/components/layout/ModuleFilterChips'
import ModuleSurface from '@/components/layout/ModuleSurface'
import ModuleTabs from '@/components/layout/ModuleTabs'
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

export const SOLICITANTES = ['Lorena/Stock', 'Salvador', 'Oscar', 'Pantoja', 'Rojo']
export const EMPRESAS = ['AFX', 'Taller', 'OHD', 'Siltech']
export const PRIORIDADES: PrioridadRequisicion[] = ['1-2 dias', '3-5 dias', '7-14 dias', 'cuando se pueda']

const PRIORIDAD_BADGE: Record<PrioridadRequisicion, string> = {
  '1-2 dias': 'bg-red-50 text-red-700',
  '3-5 dias': 'bg-orange-50 text-orange-700',
  '7-14 dias': 'bg-yellow-50 text-yellow-700',
  'cuando se pueda': 'bg-muted text-muted-foreground',
}

function emptyForm() {
  return {
    descripcion: '',
    link: '',
    solicitante: '',
    cantidad: '',
    tienda: '',
    prioridad: '' as PrioridadRequisicion | '',
    empresa: '',
    ordenServicio: '',
    fechaPedido: fechaHoyLocal(),
    parteNumero: '',
    fechaEntregaEst: '',
    recibio: '',
    revisionFinanzas: '',
    nota: '',
  }
}

const INPUT_CLS =
  'rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-ring'

function esUrl(texto: string): boolean {
  return /^https?:\/\//i.test(texto.trim())
}

function CeldaAtraso({ r, hoy, isAuto }: { r: Requisicion; hoy: string; isAuto: boolean }) {
  const a = isAuto ? estadoAtrasoEntrega(r, hoy) : estadoAtraso(r, hoy)
  if (!a) return <span className="text-xs text-muted-foreground">—</span>
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${ATRASO_BADGE[a.tipo]}`}>
      {textoAtraso(a)}
    </span>
  )
}

function CeldaDescripcion({ r }: { r: Requisicion }) {
  const link = r.link?.trim() || (esUrl(r.descripcion) ? r.descripcion : null)
  return (
    <div className="min-w-[180px]">
      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          {r.descripcion}
        </a>
      ) : (
        <span className="text-foreground">{r.descripcion}</span>
      )}
      {r.nota?.trim() && (
        <p className="mt-0.5 text-xs text-red-600" title={r.nota}>
          {truncarNota(r.nota, 80)}
        </p>
      )}
    </div>
  )
}

type RequisicionCardProps = {
  r: Requisicion
  isAuto: boolean
  hoy: string
  selected: boolean
  onToggleSelect: (id: string, e: React.MouseEvent) => void
  onCambioEstado: (id: string, estado: EstatusRequisicion) => void
  onCampoInline: (id: string, campo: 'recibio' | 'revisionFinanzas', valor: string) => void
  onEditar: (r: Requisicion) => void
  onEliminar: (id: string, desc: string) => void
}

// Tarjeta para < md: mismos datos que la fila de tabla (general y automatización), sin scroll horizontal.
function RequisicionCard({
  r,
  isAuto,
  hoy,
  selected,
  onToggleSelect,
  onCambioEstado,
  onCampoInline,
  onEditar,
  onEliminar,
}: RequisicionCardProps) {
  return (
    <div className={`p-4 space-y-2.5 ${r.estado === 'parcial' ? 'bg-pink-50/40' : ''}`}>
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0 flex items-start gap-2.5">
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onToggleSelect(r.id, e as unknown as React.MouseEvent)}
            className="mt-1 h-4 w-4 rounded border-input text-primary focus:ring-ring shrink-0"
          />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">
              {formatFecha(r.fechaPedido)}
              {!isAuto && r.solicitante ? ` · ${r.solicitante}` : ''}
            </p>
            <div className="text-sm font-semibold text-foreground break-words">
              <CeldaDescripcion r={r} />
            </div>
          </div>
        </div>
        <select
          value={r.estado}
          onChange={(e) => onCambioEstado(r.id, e.target.value as EstatusRequisicion)}
          className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ring-1 ring-inset border-0 focus:ring-2 focus:ring-ring ${ESTADO_BADGE[r.estado]}`}
          title="Cambiar estado"
        >
          {ESTADOS_REQUISICION.map((e) => (
            <option key={e} value={e}>{ESTADO_LABEL[e]}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs pl-[26px]">
        {isAuto ? (
          <>
            <div className="min-w-0">
              <span className="text-muted-foreground block">Proveedor</span>
              <span className="text-foreground truncate block">{r.tienda || '-'}</span>
            </div>
            <div className="min-w-0">
              <span className="text-muted-foreground block">Parte # · Cant.</span>
              <span className="text-foreground truncate block font-mono">{r.parteNumero || '-'} · {r.cantidad || '-'}</span>
            </div>
            <div className="min-w-0">
              <span className="text-muted-foreground block">F. entrega</span>
              <span className="text-foreground block">{r.fechaEntregaEst ? formatFecha(r.fechaEntregaEst) : '-'}</span>
            </div>
            <div className="min-w-0">
              <span className="text-muted-foreground block">Plazo</span>
              <CeldaAtraso r={r} hoy={hoy} isAuto />
            </div>
            <div className="min-w-0">
              <span className="text-muted-foreground block">Empresa · O.T.</span>
              <span className="flex items-center gap-1.5">
                {r.empresa ? (
                  <span className={`rounded px-1.5 py-0.5 font-semibold ${badgeEmpresa(r.empresa)}`}>{r.empresa}</span>
                ) : '-'}
                <span className="text-foreground font-mono truncate">{r.ordenServicio || ''}</span>
              </span>
            </div>
            <div className="min-w-0">
              <span className="text-muted-foreground block">Link</span>
              {r.link ? (
                <a href={r.link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Abrir
                </a>
              ) : '-'}
            </div>
            <div className="min-w-0">
              <span className="text-muted-foreground block">Recibió</span>
              <select
                value={r.recibio ?? ''}
                onChange={(e) => onCampoInline(r.id, 'recibio', e.target.value)}
                className="rounded border-0 bg-transparent text-foreground focus:ring-1 focus:ring-ring -ml-1"
              >
                <option value="">—</option>
                {SOLICITANTES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="min-w-0">
              <span className="text-muted-foreground block">Rev. finanzas</span>
              <select
                value={r.revisionFinanzas ?? ''}
                onChange={(e) => onCampoInline(r.id, 'revisionFinanzas', e.target.value)}
                className={`rounded px-1 -ml-1 font-semibold border-0 focus:ring-1 focus:ring-ring ${
                  r.revisionFinanzas === 'Entrega parcial' ? 'bg-yellow-100 text-yellow-800' : 'bg-transparent text-foreground'
                }`}
              >
                {REVISION_FINANZAS_OPCIONES.map((op) => (
                  <option key={op || 'vacio'} value={op}>{op || '—'}</option>
                ))}
              </select>
            </div>
          </>
        ) : (
          <>
            <div className="min-w-0">
              <span className="text-muted-foreground block">Tienda</span>
              <span className="text-foreground truncate block">{r.tienda || '-'}</span>
            </div>
            <div className="min-w-0">
              <span className="text-muted-foreground block">Cantidad</span>
              <span className="text-foreground block">{r.cantidad || '-'}</span>
            </div>
            <div className="min-w-0">
              <span className="text-muted-foreground block">Prioridad</span>
              {r.prioridad ? (
                <span className={`inline-block rounded px-1.5 py-0.5 font-semibold ${PRIORIDAD_BADGE[r.prioridad]}`}>
                  {r.prioridad}
                </span>
              ) : '-'}
            </div>
            <div className="min-w-0">
              <span className="text-muted-foreground block">Límite</span>
              <CeldaAtraso r={r} hoy={hoy} isAuto={false} />
            </div>
            <div className="min-w-0">
              <span className="text-muted-foreground block">Empresa · O.T.</span>
              <span className="flex items-center gap-1.5">
                {r.empresa ? (
                  <span className={`rounded px-1.5 py-0.5 font-semibold ${badgeEmpresa(r.empresa)}`}>{r.empresa}</span>
                ) : '-'}
                <span className="text-foreground font-mono truncate">{r.ordenServicio || ''}</span>
              </span>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center justify-end gap-3 pl-[26px] pt-2 border-t border-border">
        {r.estado !== 'comprado' && r.estado !== 'recibido' ? (
          <Link
            href={`/nueva-compra?requisicionId=${r.id}&descripcion=${encodeURIComponent(r.descripcion || r.nota || '')}`}
            className="p-1.5 text-muted-foreground hover:text-emerald-600 transition-colors"
            title="Comprar en SMV Hub"
          >
            <ShoppingCart className="h-4 w-4" />
          </Link>
        ) : (
          <Link
            href="/ordenes"
            className="p-1.5 text-emerald-600 hover:text-emerald-700 transition-colors"
            title="Ver orden de compra vinculada"
          >
            <ExternalLink className="h-4 w-4" />
          </Link>
        )}
        <button onClick={() => onEditar(r)} className="p-1.5 text-muted-foreground hover:text-primary" title="Editar">
          <Edit2 className="h-4 w-4" />
        </button>
        <button onClick={() => onEliminar(r.id, r.descripcion)} className="p-1.5 text-muted-foreground hover:text-red-600" title="Eliminar">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export default function RequisicionesList() {
  const { usuario } = useUsuario()
  const confirmar = useConfirmDialog()
  const {
    requisiciones,
    loading,
    cargandoMas,
    cargandoCompleto,
    coleccionCompleta,
    hayMas,
    totalRequisiciones,
    error,
    fetchRequisiciones,
    cargarMas,
    cargarTodas,
    agregarRequisicion,
    actualizarEstado,
    borrarRequisicion,
    borrarRequisicionesLote,
    editarRequisicion,
    addOrUpdateRequisicion,
  } = useRequisiciones()

  const {
    todasRequisiciones: todasFlujo,
    crearRequisicion: crearReqFlujo,
    seleccionarGanador,
    generarOC,
    obtenerCotizaciones,
    agregarCotizacion,
  } = useRequisicionesFlujo({
    requisiciones,
    recargar: fetchRequisiciones,
    guardarLocal: addOrUpdateRequisicion,
  })

  const [tabVista, setTabVista] = useState<'flujo' | 'tabla'>('flujo')
  const [tipoActivo, setTipoActivo] = useState<TipoRequisicion>('general')
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [scraping, setScraping] = useState(false)
  const [scrapeError, setScrapeError] = useState<string | null>(null)
  const [filtroEstado, setFiltroEstado] = useState<EstatusRequisicion | 'todos'>('todos')
  const [filtroEmpresa, setFiltroEmpresa] = useState('')
  const [busqueda, setBusqueda] = useState('')

  // Modales de Flujo de Compras End-to-End
  const [modalNuevaFlujo, setModalNuevaFlujo] = useState(false)
  const [reqDetalleModal, setReqDetalleModal] = useState<Requisicion | null>(null)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isDeletingBulk, setIsDeletingBulk] = useState(false)
  const [requisicionToEdit, setRequisicionToEdit] = useState<Requisicion | null>(null)

  const hoy = hoyLocal()
  const isAuto = tipoActivo === 'automatizacion'

  const filtradas = useMemo(() => {
    const q = normalizar(busqueda.trim())
    return requisiciones.filter((r) => {
      if ((r.tipo ?? 'general') !== tipoActivo) return false
      if (filtroEstado !== 'todos' && r.estado !== filtroEstado) return false
      if (filtroEmpresa && r.empresa !== filtroEmpresa) return false
      if (q) {
        const haystack = normalizar(
          `${r.descripcion} ${r.solicitante} ${r.tienda ?? ''} ${r.ordenServicio ?? ''} ${r.parteNumero ?? ''} ${r.nota ?? ''} ${r.link ?? ''}`
        )
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [requisiciones, tipoActivo, filtroEstado, filtroEmpresa, busqueda])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.descripcion.trim()) return
    setSaving(true)
    try {
      const payload: NuevaRequisicionPayload = {
        tipo: tipoActivo,
        descripcion: form.descripcion.trim(),
        link: form.link.trim() || null,
        solicitante: form.solicitante,
        cantidad: form.cantidad.trim() || null,
        tienda: form.tienda.trim() || null,
        prioridad: (form.prioridad || null) as PrioridadRequisicion | null,
        empresa: form.empresa || null,
        ordenServicio: form.ordenServicio.trim() || null,
        fechaPedido: form.fechaPedido || fechaHoyLocal(),
        estado: 'no_comprado',
        parteNumero: isAuto ? (form.parteNumero.trim() || null) : null,
        fechaEntregaEst: isAuto ? (form.fechaEntregaEst || null) : null,
        recibio: form.recibio.trim() || null,
        revisionFinanzas: form.revisionFinanzas.trim() || null,
        nota: form.nota.trim() || null,
      }
      await agregarRequisicion(payload)
      setForm(emptyForm())
      setScrapeError(null)
    } catch (err) {
      console.error('Error al guardar requisición:', err)
      toast.error('No se pudo guardar la requisición', {
        description: err instanceof Error ? err.message : 'Intenta de nuevo.',
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleAutollenar() {
    const url = (form.link.trim() || form.descripcion.trim())
    if (!esUrl(url)) return
    setScraping(true)
    setScrapeError(null)
    try {
      const auth = getClienteAuth()
      const token = await auth.currentUser?.getIdToken()
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ url }),
      })
      const data = (await res.json()) as { title?: string; provider?: string; error?: string }
      if (!res.ok) throw new Error(data.error || 'No se pudo extraer la información')
      setForm((f) => ({
        ...f,
        descripcion: data.title || f.descripcion,
        tienda: f.tienda || data.provider || '',
        link: url,
      }))
    } catch (err) {
      setScrapeError(err instanceof Error ? err.message : 'No se pudo extraer la información')
    } finally {
      setScraping(false)
    }
  }

  async function handleCambioEstado(id: string, estado: EstatusRequisicion) {
    try {
      await actualizarEstado(id, estado)
    } catch (err) {
      console.error('Error al cambiar estado de requisición:', err)
      toast.error('No se pudo cambiar el estado', {
        description: err instanceof Error ? err.message : 'Intenta de nuevo.',
      })
    }
  }

  async function handleCampoInline(
    id: string,
    campo: 'recibio' | 'revisionFinanzas',
    valor: string
  ) {
    const normalizado = valor.trim() || null
    try {
      await editarRequisicion(id, { [campo]: normalizado })
    } catch (err) {
      console.error('Error al editar requisición:', err)
      toast.error('No se pudo guardar el cambio', {
        description: err instanceof Error ? err.message : 'Intenta de nuevo.',
      })
    }
  }

  async function handleEliminar(id: string, desc: string) {
    const aceptado = await confirmar({
      title: 'Eliminar requisición',
      description: `Se eliminará “${desc.slice(0, 60)}”.`,
      confirmLabel: 'Eliminar',
      variant: 'destructive',
    })
    if (!aceptado) return
    await borrarRequisicion(id)
  }

  function toggleSelection(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) newSelected.delete(id)
    else newSelected.add(id)
    setSelectedIds(newSelected)
  }

  function toggleAllSelection(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.checked) {
      setSelectedIds(new Set(filtradas.map((r) => r.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  async function handleDeleteMultiple() {
    if (selectedIds.size === 0) return
    const aceptado = await confirmar({
      title: 'Eliminar requisiciones seleccionadas',
      description: `Se eliminarán ${selectedIds.size} requisiciones y esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar requisiciones',
      variant: 'destructive',
    })
    if (!aceptado) return
    setIsDeletingBulk(true)
    const success = await borrarRequisicionesLote(Array.from(selectedIds))
    if (success) {
      setSelectedIds(new Set())
    } else {
      toast.error('No se pudieron eliminar las requisiciones. Intenta de nuevo.')
    }
    setIsDeletingBulk(false)
  }

  function handleFormSaved() {
    setRequisicionToEdit(null)
    fetchRequisiciones()
  }

  function prepararHistorialCompleto() {
    if (!coleccionCompleta) {
      void cargarTodas().catch(() => undefined)
    }
  }

  const urlParaAutollenar = form.link.trim() || form.descripcion.trim()

  return (
    <div className="space-y-6">
      <ModuleTabs
        value={tabVista}
        onValueChange={(value) => setTabVista(value as 'flujo' | 'tabla')}
        actions={
          tabVista === 'flujo' ? (
            <div className="flex flex-wrap items-center gap-2">
              {!coleccionCompleta && (
                <button
                  type="button"
                  onClick={() => void cargarTodas().catch(() => undefined)}
                  disabled={cargandoCompleto}
                  className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-800 hover:bg-sky-100 disabled:opacity-50"
                >
                  {cargandoCompleto && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {cargandoCompleto ? 'Cargando historial...' : 'Completar KPIs'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setModalNuevaFlujo(true)}
                className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-xs transition-transform hover:bg-primary/90 active:scale-95"
              >
                <Plus className="h-4 w-4" /> Nueva Requisición (Tooling)
              </button>
            </div>
          ) : undefined
        }
        items={[
          {
            value: 'flujo',
            label: (
              <span className="inline-flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" aria-hidden />
                Flujo de Compras End-to-End ({totalRequisiciones})
              </span>
            ),
            content: (
        <div className="space-y-6">
          {loading && (
            <div className="flex items-center justify-center gap-3 rounded-xl border border-border bg-card py-14 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-sky-600" />
              Cargando requisiciones…
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
              <p className="font-semibold text-red-800">No se pudo cargar el flujo de requisiciones.</p>
              <p className="mt-1">{error}</p>
              <button onClick={fetchRequisiciones} className="mt-3 font-semibold underline">
                Reintentar
              </button>
            </div>
          )}

          {!loading && !error && (
            <>
          {/* KPI STATS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-card p-4 rounded-xl border border-border shadow-2xs space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Solicitudes</span>
              <p className="text-xl font-bold text-foreground font-mono">{totalRequisiciones}</p>
            </div>
            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 shadow-2xs space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">En Cotización</span>
              <p className="text-xl font-bold text-amber-900 font-mono">
                {coleccionCompleta
                  ? todasFlujo.filter((r) => !r.estatusFlujo || r.estatusFlujo === 'cotizando' || r.estatusFlujo === 'enviada').length
                  : '—'}
              </p>
            </div>
            <div className="bg-purple-50 p-4 rounded-xl border border-purple-200 shadow-2xs space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700">Ganador Seleccionado</span>
              <p className="text-xl font-bold text-purple-900 font-mono">
                {coleccionCompleta ? todasFlujo.filter((r) => r.estatusFlujo === 'aprobada').length : '—'}
              </p>
            </div>
            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 shadow-2xs space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">OC Generadas</span>
              <p className="text-xl font-bold text-emerald-900 font-mono">
                {coleccionCompleta
                  ? todasFlujo.filter((r) => r.estatusFlujo === 'convertida_a_oc' || r.estado === 'comprado').length
                  : '—'}
              </p>
            </div>
          </div>

          {/* LISTADO DE REQUISICIONES EN FLUJO */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {todasFlujo.map((req) => {
              const esOC = req.estatusFlujo === 'convertida_a_oc' || req.estado === 'comprado'
              const esAprobada = req.estatusFlujo === 'aprobada'
              const esCotiz = req.estatusFlujo === 'cotizando'

              return (
                <div
                  key={req.id}
                  className="bg-card border border-border p-4 rounded-2xl shadow-2xs hover:shadow-md transition-all space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black bg-foreground text-background px-2.5 py-0.5 rounded-md">
                          {req.folio || `REQ-${req.id.substring(0, 6)}`}
                        </span>
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                          {req.departamento || req.empresa || 'Taller'}
                        </span>
                      </div>

                      <span
                        className={[
                          'text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border font-mono',
                          esOC
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : esAprobada
                            ? 'bg-purple-100 text-purple-800 border-purple-300'
                            : esCotiz
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : 'bg-sky-100 text-sky-800 border-sky-300',
                        ].join(' ')}
                      >
                        {esOC ? 'OC generada' : esAprobada ? 'Ganador elegido' : esCotiz ? 'Cotizando' : 'Enviada'}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-foreground leading-snug">{req.descripcion}</h3>

                    <div className="text-xs text-muted-foreground space-y-1 font-mono">
                      <div className="flex items-center justify-between">
                        <span>Solicitante:</span>
                        <strong className="text-foreground">{req.solicitante}</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Fecha:</span>
                        <span className="text-foreground">{req.fechaPedido}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Herramientas solicitadas:</span>
                        <strong className="text-foreground">{req.items?.length || 1} ítem(s)</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Atraso:</span>
                        <CeldaAtraso r={req} hoy={hoy} isAuto={req.tipo === 'automatizacion'} />
                      </div>
                    </div>

                    {req.proveedorGanadorNombre && (
                      <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-0.5">
                        <span className="text-[10px] font-bold text-emerald-800 uppercase block">Proveedor Seleccionado</span>
                        <p className="font-bold text-emerald-950 flex items-center justify-between">
                          <span>{req.proveedorGanadorNombre}</span>
                          {req.ordenCompraFolio && (
                            <span className="font-mono text-[10px] bg-emerald-700 text-white px-2 py-0.5 rounded">
                              {req.ordenCompraFolio}
                            </span>
                          )}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-border">
                    <button
                      onClick={() => setReqDetalleModal(req)}
                      className="w-full py-2 bg-primary hover:bg-primary/90 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Eye className="h-4 w-4" /> Ver Flujo / Cotizar / Emitir OC <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {hayMas && (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">
                Mostrando {todasFlujo.length} de {totalRequisiciones} requisiciones
              </p>
              <button
                onClick={cargarMas}
                disabled={cargandoMas}
                className="inline-flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-100 disabled:opacity-60"
              >
                {cargandoMas && <Loader2 className="h-4 w-4 animate-spin" />}
                {cargandoMas ? 'Cargando…' : 'Cargar más requisiciones'}
              </button>
            </div>
          )}
            </>
          )}
        </div>
            ),
          },
          {
            value: 'tabla',
            label: (
              <span className="inline-flex items-center gap-2">
                <Layers className="h-4 w-4" aria-hidden />
                Catálogo Tradicional de Requisiciones
              </span>
            ),
            content: (
        <div className="space-y-6">
          {/* Sub-tabs */}
          <ModuleFilterChips
            ariaLabel="Tipo de requisición"
            value={tipoActivo}
            onValueChange={(value) => {
              setTipoActivo(value as TipoRequisicion)
              setFiltroEstado('todos')
              setFiltroEmpresa('')
              setBusqueda('')
              setSelectedIds(new Set())
            }}
            options={[
              { value: 'general', label: 'Compras generales' },
              { value: 'automatizacion', label: 'Automatización' },
            ]}
          />

      {/* Form */}
      <ModuleSurface className="p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">
          {isAuto ? 'Nueva compra — Automatización' : 'Nueva requisición'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              placeholder="Descripción del artículo *"
              value={form.descripcion}
              onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
              required
              className={`min-w-[200px] flex-1 ${INPUT_CLS}`}
            />
            {isAuto && (
              <input
                type="url"
                placeholder="Link del producto"
                value={form.link}
                onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
                className={`min-w-[200px] flex-1 ${INPUT_CLS}`}
              />
            )}
            {esUrl(urlParaAutollenar) && (
              <button
                type="button"
                onClick={handleAutollenar}
                disabled={scraping}
                className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                {scraping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Autollenar
              </button>
            )}
            <select
              value={form.solicitante}
              onChange={(e) => setForm((f) => ({ ...f, solicitante: e.target.value }))}
              className={INPUT_CLS}
            >
              <option value="">Solicitante</option>
              {SOLICITANTES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <input
              type="text"
              placeholder="Cantidad"
              value={form.cantidad}
              onChange={(e) => setForm((f) => ({ ...f, cantidad: e.target.value }))}
              className={INPUT_CLS}
            />
            <input
              type="text"
              placeholder={isAuto ? 'Proveedor' : 'Tienda / Proveedor'}
              value={form.tienda}
              onChange={(e) => setForm((f) => ({ ...f, tienda: e.target.value }))}
              className={INPUT_CLS}
            />
            {!isAuto && (
              <select
                value={form.prioridad}
                onChange={(e) => setForm((f) => ({ ...f, prioridad: e.target.value as PrioridadRequisicion | '' }))}
                className={INPUT_CLS}
              >
                <option value="">Prioridad</option>
                {PRIORIDADES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            )}
            {isAuto && (
              <input
                type="text"
                placeholder="No. de parte"
                value={form.parteNumero}
                onChange={(e) => setForm((f) => ({ ...f, parteNumero: e.target.value }))}
                className={INPUT_CLS}
              />
            )}
            <select
              value={form.empresa}
              onChange={(e) => setForm((f) => ({ ...f, empresa: e.target.value }))}
              className={INPUT_CLS}
            >
              <option value="">Empresa</option>
              {EMPRESAS.map((emp) => (
                <option key={emp} value={emp}>{emp}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <input
              type="text"
              placeholder="S.O. / Orden de trabajo"
              value={form.ordenServicio}
              onChange={(e) => setForm((f) => ({ ...f, ordenServicio: e.target.value }))}
              className={`w-48 ${INPUT_CLS}`}
            />
            <input
              type="date"
              title={isAuto ? 'Fecha de compra' : 'Fecha de pedido'}
              value={form.fechaPedido}
              onChange={(e) => setForm((f) => ({ ...f, fechaPedido: e.target.value }))}
              className={INPUT_CLS}
            />
            {isAuto && (
              <input
                type="date"
                title="Fecha de entrega estimada"
                value={form.fechaEntregaEst}
                onChange={(e) => setForm((f) => ({ ...f, fechaEntregaEst: e.target.value }))}
                className={INPUT_CLS}
              />
            )}
            {isAuto && (
              <>
                <select
                  value={form.recibio}
                  onChange={(e) => setForm((f) => ({ ...f, recibio: e.target.value }))}
                  className={INPUT_CLS}
                >
                  <option value="">Recibió</option>
                  {SOLICITANTES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <select
                  value={form.revisionFinanzas}
                  onChange={(e) => setForm((f) => ({ ...f, revisionFinanzas: e.target.value }))}
                  className={INPUT_CLS}
                >
                  {REVISION_FINANZAS_OPCIONES.map((op) => (
                    <option key={op || 'vacio'} value={op}>
                      {op || 'Rev. finanzas'}
                    </option>
                  ))}
                </select>
              </>
            )}
            {isAuto && (
              <input
                type="text"
                placeholder="Nota (entregas parciales, seguimiento…)"
                value={form.nota}
                onChange={(e) => setForm((f) => ({ ...f, nota: e.target.value }))}
                className={`min-w-[200px] flex-1 ${INPUT_CLS}`}
              />
            )}
            <button
              type="submit"
              disabled={saving || !form.descripcion.trim()}
              className="ml-auto flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Agregar
            </button>
          </div>
        </form>
        {scrapeError && (
          <p className="mt-2 text-xs text-red-600">
            {scrapeError} — puedes guardar la requisición con el link tal cual.
          </p>
        )}
      </ModuleSurface>

      {/* Filters */}
      {!loading && !error && (
        <ModuleSurface className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold text-muted-foreground">Estado:</span>
            <ModuleFilterChips
              ariaLabel="Filtrar por estado"
              value={filtroEstado}
              onValueChange={(value) => setFiltroEstado(value as EstatusRequisicion | 'todos')}
              options={[
                { value: 'todos', label: 'Todos' },
                ...ESTADOS_REQUISICION.map((e) => ({ value: e, label: ESTADO_LABEL[e] })),
              ]}
            />
            <span className="text-xs font-semibold text-muted-foreground">Empresa:</span>
            <ModuleFilterChips
              ariaLabel="Filtrar por empresa"
              value={filtroEmpresa || 'todas'}
              onValueChange={(value) => setFiltroEmpresa(value === 'todas' ? '' : value)}
              options={[
                { value: 'todas', label: 'Todas' },
                ...EMPRESAS.map((emp) => ({ value: emp, label: emp })),
              ]}
            />
          </div>
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder={isAuto
              ? 'Buscar por descripción, proveedor, parte #, OT, nota…'
              : 'Buscar por descripción, solicitante, tienda…'}
            className={`w-full ${INPUT_CLS}`}
          />
          <div className="flex items-center gap-3">
            <p className="text-xs text-muted-foreground">
              {filtradas.length} coincidencias · {requisiciones.length} de {totalRequisiciones} cargadas
            </p>
            {!coleccionCompleta && (
              <button
                type="button"
                onClick={prepararHistorialCompleto}
                disabled={cargandoCompleto}
                className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800 hover:bg-sky-100 disabled:opacity-50"
              >
                {cargandoCompleto ? 'Cargando…' : 'Cargar historial completo'}
              </button>
            )}
            {cargandoCompleto && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Preparando historial completo…
              </span>
            )}
            {selectedIds.size > 0 && (
              <button
                onClick={handleDeleteMultiple}
                disabled={isDeletingBulk}
                className="inline-flex items-center gap-2 rounded-lg bg-red-50 text-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-100 transition-colors border border-red-200 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {isDeletingBulk ? 'Eliminando...' : `Eliminar ${selectedIds.size} seleccionadas`}
              </button>
            )}
          </div>
        </ModuleSurface>
      )}

      {/* Loading */}
      {loading && (
        <ModuleSurface className="flex flex-col items-center justify-center py-20">
          <Loader2 className="mb-4 size-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Cargando requisiciones…</p>
        </ModuleSurface>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-red-800">Error de carga</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
            <button
              onClick={fetchRequisiciones}
              className="mt-3 text-xs font-semibold text-red-800 underline hover:text-red-900"
            >
              Reintentar
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {!loading && !error && (
        <ModuleSurface>
          {filtradas.length === 0 ? (
            <div className="text-center py-20">
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4 text-muted-foreground">
                <ClipboardList className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                {filtradas.length === 0 && requisiciones.filter(r => (r.tipo ?? 'general') === tipoActivo).length === 0
                  ? `Sin ${isAuto ? 'compras de automatización' : 'requisiciones'}`
                  : 'Sin coincidencias'}
              </h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
                {filtradas.length === 0 && requisiciones.filter(r => (r.tipo ?? 'general') === tipoActivo).length === 0
                  ? 'Agrega la primera con el formulario de arriba.'
                  : 'Ningún registro coincide con los filtros actuales.'}
              </p>
            </div>
          ) : (
            <div className="hidden md:block">
              <Table className="text-sm text-left text-muted-foreground">
                <TableHeader className="text-xs text-foreground uppercase bg-muted border-b border-border">
                  <TableRow>
                    <TableHead className="px-3 py-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={filtradas.length > 0 && selectedIds.size === filtradas.length}
                        onChange={toggleAllSelection}
                        className="rounded border-input text-primary focus:ring-ring cursor-pointer"
                      />
                    </TableHead>
                    {isAuto ? (
                      <>
                        <TableHead className="px-3 py-3 font-semibold whitespace-nowrap">Fecha</TableHead>
                        <TableHead className="px-3 py-3 font-semibold whitespace-nowrap">F. entrega</TableHead>
                        <TableHead className="px-3 py-3 font-semibold whitespace-nowrap">Estado</TableHead>
                        <TableHead className="px-3 py-3 font-semibold whitespace-nowrap">Recibió</TableHead>
                        <TableHead className="px-3 py-3 font-semibold whitespace-nowrap">Rev. fin.</TableHead>
                        <TableHead className="px-3 py-3 font-semibold whitespace-nowrap">Proveedor</TableHead>
                        <TableHead className="px-3 py-3 font-semibold text-center">Cant.</TableHead>
                        <TableHead className="px-3 py-3 font-semibold min-w-[180px]">Descripción</TableHead>
                        <TableHead className="px-3 py-3 font-semibold whitespace-nowrap">Parte #</TableHead>
                        <TableHead className="px-3 py-3 font-semibold whitespace-nowrap">Link</TableHead>
                        <TableHead className="px-3 py-3 font-semibold">Empresa</TableHead>
                        <TableHead className="px-3 py-3 font-semibold">O.T.</TableHead>
                        <TableHead className="px-3 py-3 font-semibold whitespace-nowrap">Plazo</TableHead>
                      </>
                    ) : (
                      <>
                        <TableHead className="px-3 py-3 font-semibold whitespace-nowrap">Fecha</TableHead>
                        <TableHead className="px-3 py-3 font-semibold whitespace-nowrap">Solicitante</TableHead>
                        <TableHead className="px-3 py-3 font-semibold min-w-[180px]">Descripción</TableHead>
                        <TableHead className="px-3 py-3 font-semibold whitespace-nowrap">Tienda</TableHead>
                        <TableHead className="px-3 py-3 font-semibold text-center">Cant.</TableHead>
                        <TableHead className="px-3 py-3 font-semibold whitespace-nowrap">Prioridad</TableHead>
                        <TableHead className="px-3 py-3 font-semibold whitespace-nowrap">Límite</TableHead>
                        <TableHead className="px-3 py-3 font-semibold">Empresa</TableHead>
                        <TableHead className="px-3 py-3 font-semibold">O.T.</TableHead>
                        <TableHead className="px-3 py-3 font-semibold">Estado</TableHead>
                      </>
                    )}
                    <TableHead className="px-3 py-3" />
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-border">
                  {filtradas.map((r) => (
                    <ContextMenu key={r.id}>
                      <ContextMenuTrigger asChild>
                        <TableRow
                          className={`hover:bg-muted transition-colors cursor-pointer ${
                            r.estado === 'parcial' ? 'bg-pink-50/40' : ''
                          }`}
                          onDoubleClick={() => setReqDetalleModal(r)}
                        >
                          <TableCell className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(r.id)}
                              onChange={(e) => toggleSelection(r.id, e as unknown as React.MouseEvent)}
                              className="rounded border-input text-primary focus:ring-ring cursor-pointer"
                            />
                          </TableCell>
                          {isAuto ? (
                            <>
                              <TableCell className="px-3 py-3 whitespace-nowrap text-xs text-muted-foreground">
                                {formatFecha(r.fechaPedido)}
                              </TableCell>
                              <TableCell className="px-3 py-3 whitespace-nowrap text-xs text-muted-foreground">
                                {r.fechaEntregaEst ? formatFecha(r.fechaEntregaEst) : '-'}
                              </TableCell>
                              <TableCell className="px-3 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                <select
                                  value={r.estado}
                                  onChange={(e) => handleCambioEstado(r.id, e.target.value as EstatusRequisicion)}
                                  className={`rounded-full px-2 py-1 text-xs font-semibold ring-1 ring-inset cursor-pointer border-0 focus:ring-2 focus:ring-ring ${ESTADO_BADGE[r.estado]}`}
                                  title="Cambiar estado"
                                >
                                  {ESTADOS_REQUISICION.map((e) => (
                                    <option key={e} value={e}>{ESTADO_LABEL[e]}</option>
                                  ))}
                                </select>
                              </TableCell>
                              <TableCell className="px-3 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                <select
                                  value={r.recibio ?? ''}
                                  onChange={(e) => handleCampoInline(r.id, 'recibio', e.target.value)}
                                  className="rounded border-0 bg-transparent text-xs text-foreground focus:ring-1 focus:ring-ring cursor-pointer max-w-[120px]"
                                >
                                  <option value="">—</option>
                                  {SOLICITANTES.map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                  ))}
                                </select>
                              </TableCell>
                              <TableCell className="px-3 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                <select
                                  value={r.revisionFinanzas ?? ''}
                                  onChange={(e) => handleCampoInline(r.id, 'revisionFinanzas', e.target.value)}
                                  className={`rounded px-1.5 py-0.5 text-xs font-semibold border-0 cursor-pointer focus:ring-1 focus:ring-ring ${
                                    r.revisionFinanzas === 'Entrega parcial'
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : 'bg-transparent text-foreground'
                                  }`}
                                >
                                  {REVISION_FINANZAS_OPCIONES.map((op) => (
                                    <option key={op || 'vacio'} value={op}>{op || '—'}</option>
                                  ))}
                                </select>
                              </TableCell>
                              <TableCell className="px-3 py-3 whitespace-nowrap">{r.tienda || '-'}</TableCell>
                              <TableCell className="px-3 py-3 text-center whitespace-nowrap">{r.cantidad || '-'}</TableCell>
                              <TableCell className="px-3 py-3"><CeldaDescripcion r={r} /></TableCell>
                              <TableCell className="px-3 py-3 whitespace-nowrap font-mono text-xs">{r.parteNumero || '-'}</TableCell>
                              <TableCell className="px-3 py-3 whitespace-nowrap max-w-[100px]" onClick={(e) => e.stopPropagation()}>
                                {r.link ? (
                                  <a
                                    href={r.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline text-xs truncate block max-w-[100px]"
                                    title={r.link}
                                  >
                                    Link
                                  </a>
                                ) : '-'}
                              </TableCell>
                              <TableCell className="px-3 py-3 whitespace-nowrap">
                                {r.empresa ? (
                                  <span className={`rounded px-2 py-0.5 text-xs font-semibold ${badgeEmpresa(r.empresa)}`}>
                                    {r.empresa}
                                  </span>
                                ) : '-'}
                              </TableCell>
                              <TableCell className="px-3 py-3 whitespace-nowrap font-mono text-xs">
                                {r.ordenServicio || '-'}
                              </TableCell>
                              <TableCell className="px-3 py-3 whitespace-nowrap">
                                <CeldaAtraso r={r} hoy={hoy} isAuto />
                              </TableCell>
                            </>
                          ) : (
                            <>
                              <TableCell className="px-3 py-3 whitespace-nowrap text-xs text-muted-foreground">
                                {formatFecha(r.fechaPedido)}
                              </TableCell>
                              <TableCell className="px-3 py-3 whitespace-nowrap font-medium text-foreground">
                                {r.solicitante || '-'}
                              </TableCell>
                              <TableCell className="px-3 py-3"><CeldaDescripcion r={r} /></TableCell>
                              <TableCell className="px-3 py-3 whitespace-nowrap">{r.tienda || '-'}</TableCell>
                              <TableCell className="px-3 py-3 text-center whitespace-nowrap">{r.cantidad || '-'}</TableCell>
                              <TableCell className="px-3 py-3 whitespace-nowrap">
                                {r.prioridad ? (
                                  <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${PRIORIDAD_BADGE[r.prioridad]}`}>
                                    {r.prioridad}
                                  </span>
                                ) : '-'}
                              </TableCell>
                              <TableCell className="px-3 py-3 whitespace-nowrap">
                                <CeldaAtraso r={r} hoy={hoy} isAuto={false} />
                              </TableCell>
                              <TableCell className="px-3 py-3 whitespace-nowrap">
                                {r.empresa ? (
                                  <span className={`rounded px-2 py-0.5 text-xs font-semibold ${badgeEmpresa(r.empresa)}`}>
                                    {r.empresa}
                                  </span>
                                ) : '-'}
                              </TableCell>
                              <TableCell className="px-3 py-3 whitespace-nowrap font-mono text-xs">
                                {r.ordenServicio || '-'}
                              </TableCell>
                              <TableCell className="px-3 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                <select
                                  value={r.estado}
                                  onChange={(e) => handleCambioEstado(r.id, e.target.value as EstatusRequisicion)}
                                  className={`rounded-full px-2 py-1 text-xs font-semibold ring-1 ring-inset cursor-pointer border-0 focus:ring-2 focus:ring-ring ${ESTADO_BADGE[r.estado]}`}
                                  title="Cambiar estado"
                                >
                                  {ESTADOS_REQUISICION.map((e) => (
                                    <option key={e} value={e}>{ESTADO_LABEL[e]}</option>
                                  ))}
                                </select>
                              </TableCell>
                            </>
                          )}
                          <TableCell className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-2">
                              {r.estado !== 'comprado' && r.estado !== 'recibido' ? (
                                <Link
                                  href={`/nueva-compra?requisicionId=${r.id}&descripcion=${encodeURIComponent(r.descripcion || r.nota || '')}`}
                                  className="text-muted-foreground hover:text-emerald-600 transition-colors"
                                  title="Comprar en SMV Hub"
                                >
                                  <ShoppingCart className="h-4 w-4" />
                                </Link>
                              ) : (
                                <Link
                                  href="/ordenes"
                                  className="text-emerald-600 hover:text-emerald-700 transition-colors"
                                  title="Ver orden de compra vinculada"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Link>
                              )}
                              <button
                                onClick={() => setRequisicionToEdit(r)}
                                className="text-muted-foreground hover:text-primary transition-colors"
                                title="Editar"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleEliminar(r.id, r.descripcion)}
                                className="text-muted-foreground hover:text-red-600 transition-colors"
                                title="Eliminar"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                      </ContextMenuTrigger>

                      <ContextMenuContent className="w-56">
                        <ContextMenuItem onClick={() => setReqDetalleModal(r)}>
                          <Eye className="text-primary" />
                          <span>Ver detalle / Cotizaciones</span>
                          <ContextMenuShortcut>↵</ContextMenuShortcut>
                        </ContextMenuItem>

                        <ContextMenuItem onClick={() => setRequisicionToEdit(r)}>
                          <Edit2 className="text-muted-foreground" />
                          <span>Editar requisición</span>
                        </ContextMenuItem>

                        {isAuto && (
                          <ContextMenuItem
                            onClick={() => {
                              const nombreRecibio = usuario?.displayName?.split(' ')[0] || usuario?.email?.split('@')[0] || 'Taller'
                              void handleCampoInline(r.id, 'recibio', nombreRecibio)
                              toast.success(`Marcado como recibido por ${nombreRecibio}`)
                            }}
                          >
                            <UserCheck className="text-emerald-600" />
                            <span>Recibí yo ({usuario?.displayName?.split(' ')[0] || 'Mi usuario'})</span>
                          </ContextMenuItem>
                        )}

                        <ContextMenuSeparator />

                        <ContextMenuSub>
                          <ContextMenuSubTrigger>
                            <CheckCircle2 className="text-muted-foreground" />
                            <span>Cambiar estado ({ESTADO_LABEL[r.estado]})</span>
                          </ContextMenuSubTrigger>
                          <ContextMenuSubContent className="w-44">
                            {ESTADOS_REQUISICION.map((st) => (
                              <ContextMenuItem
                                key={st}
                                onClick={() => void handleCambioEstado(r.id, st)}
                              >
                                <span className={st === r.estado ? 'font-bold text-primary' : ''}>
                                  {ESTADO_LABEL[st]}
                                </span>
                              </ContextMenuItem>
                            ))}
                          </ContextMenuSubContent>
                        </ContextMenuSub>

                        <ContextMenuSub>
                          <ContextMenuSubTrigger>
                            <ShoppingCart className="text-muted-foreground" />
                            <span>Convertir / Comprar</span>
                          </ContextMenuSubTrigger>
                          <ContextMenuSubContent className="w-52">
                            <ContextMenuItem
                              onClick={() => {
                                window.location.href = `/nueva-compra?requisicionId=${r.id}&descripcion=${encodeURIComponent(r.descripcion || r.nota || '')}`
                              }}
                            >
                              <ShoppingCart className="text-emerald-600" />
                              <span>Nueva Compra (IA)</span>
                            </ContextMenuItem>
                            <ContextMenuItem
                              onClick={() => {
                                window.location.href = `/cotizaciones`
                              }}
                            >
                              <Layers className="text-sky-600" />
                              <span>Ir a Cotizaciones</span>
                            </ContextMenuItem>
                          </ContextMenuSubContent>
                        </ContextMenuSub>

                        <ContextMenuSeparator />

                        <ContextMenuSub>
                          <ContextMenuSubTrigger>
                            <Copy className="text-muted-foreground" />
                            <span>Copiar datos</span>
                          </ContextMenuSubTrigger>
                          <ContextMenuSubContent className="w-48">
                            <ContextMenuItem
                              onClick={() => {
                                void copiarAlPortapapeles(r.descripcion, 'Descripción copiada')
                              }}
                            >
                              <span>Descripción</span>
                            </ContextMenuItem>
                            {r.link && (
                              <ContextMenuItem
                                onClick={() => {
                                  void copiarAlPortapapeles(r.link || '', 'Enlace copiado')
                                }}
                              >
                                <span>Enlace de compra</span>
                              </ContextMenuItem>
                            )}
                            {r.parteNumero && (
                              <ContextMenuItem
                                onClick={() => {
                                  void copiarAlPortapapeles(r.parteNumero || '', 'No. parte copiado')
                                }}
                              >
                                <span>Parte # ({r.parteNumero})</span>
                              </ContextMenuItem>
                            )}
                            {r.nota && (
                              <ContextMenuItem
                                onClick={() => {
                                  void copiarAlPortapapeles(r.nota || '', 'Nota copiada')
                                }}
                              >
                                <span>Nota</span>
                              </ContextMenuItem>
                            )}
                          </ContextMenuSubContent>
                        </ContextMenuSub>

                        {r.link && (
                          <ContextMenuItem
                            onClick={() => {
                              if (r.link) window.open(r.link, '_blank', 'noopener,noreferrer')
                            }}
                          >
                            <ExternalLink className="text-sky-600" />
                            <span>Abrir link de compra</span>
                          </ContextMenuItem>
                        )}

                        <ContextMenuSeparator />

                        <ContextMenuItem
                          className="text-rose-600"
                          onClick={() => handleEliminar(r.id, r.descripcion)}
                        >
                          <Trash2 className="text-rose-600" />
                          <span>Eliminar requisición</span>
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {filtradas.length > 0 && (
            <div className="md:hidden divide-y divide-border">
              {filtradas.map((r) => (
                <RequisicionCard
                  key={r.id}
                  r={r}
                  isAuto={isAuto}
                  hoy={hoy}
                  selected={selectedIds.has(r.id)}
                  onToggleSelect={toggleSelection}
                  onCambioEstado={handleCambioEstado}
                  onCampoInline={handleCampoInline}
                  onEditar={setRequisicionToEdit}
                  onEliminar={handleEliminar}
                />
              ))}
            </div>
          )}

          {hayMas && !cargandoCompleto && (
            <div className="flex justify-center border-t border-border p-4">
              <button
                onClick={cargarMas}
                disabled={cargandoMas}
                className="inline-flex items-center gap-2 rounded-lg border border-input bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-60"
              >
                {cargandoMas && <Loader2 className="h-4 w-4 animate-spin" />}
                {cargandoMas ? 'Cargando…' : `Cargar más (${requisiciones.length} de ${totalRequisiciones})`}
              </button>
            </div>
          )}
        </ModuleSurface>
      )}
    </div>
            ),
          },
        ]}
      />

      {/* MODALES DE EDICIÓN TRADICIONAL */}
      {requisicionToEdit && (
        <RequisicionFormModal
          requisicionBase={requisicionToEdit}
          onClose={() => setRequisicionToEdit(null)}
          onSaved={handleFormSaved}
        />
      )}

      {/* MODALES DE FLUJO END-TO-END */}
      <NuevaRequisicionModal
        abierto={modalNuevaFlujo}
        onClose={() => setModalNuevaFlujo(false)}
        onCrear={crearReqFlujo}
      />

      <DetalleRequisicionModal
        abierto={!!reqDetalleModal}
        onClose={() => setReqDetalleModal(null)}
        requisicion={reqDetalleModal}
        obtenerCotizaciones={obtenerCotizaciones}
        agregarCotizacion={agregarCotizacion}
        seleccionarGanador={seleccionarGanador}
        generarOC={generarOC}
      />
    </div>
  )
}
