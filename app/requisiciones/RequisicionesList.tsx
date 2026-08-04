'use client'

import { useState, useMemo } from 'react'
import { Loader2, AlertCircle, ClipboardList, Trash2, Edit2, Sparkles } from 'lucide-react'
import type { EstatusRequisicion, PrioridadRequisicion, TipoRequisicion, Requisicion } from '@/lib/schemas'
import type { NuevaRequisicionPayload } from '@/lib/requisiciones'
import { useRequisiciones } from '@/lib/hooks/useRequisiciones'
import { formatFecha, normalizar, fechaHoyLocal } from '@/lib/format'
import { getClienteAuth } from '@/lib/firebase'
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
import { Zap, Plus, ArrowRight, Eye, Layers } from 'lucide-react'

export const SOLICITANTES = ['Lorena/Stock', 'Salvador', 'Oscar', 'Pantoja', 'Rojo']
export const EMPRESAS = ['AFX', 'Taller', 'OHD', 'Siltech']
export const PRIORIDADES: PrioridadRequisicion[] = ['1-2 dias', '3-5 dias', '7-14 dias', 'cuando se pueda']

const PRIORIDAD_BADGE: Record<PrioridadRequisicion, string> = {
  '1-2 dias': 'bg-red-50 text-red-700',
  '3-5 dias': 'bg-orange-50 text-orange-700',
  '7-14 dias': 'bg-yellow-50 text-yellow-700',
  'cuando se pueda': 'bg-gray-100 text-gray-600',
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
  'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

function esUrl(texto: string): boolean {
  return /^https?:\/\//i.test(texto.trim())
}

function CeldaAtraso({ r, hoy, isAuto }: { r: Requisicion; hoy: string; isAuto: boolean }) {
  const a = isAuto ? estadoAtrasoEntrega(r, hoy) : estadoAtraso(r, hoy)
  if (!a) return <span className="text-xs text-gray-400">—</span>
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
          className="text-blue-600 hover:underline"
        >
          {r.descripcion}
        </a>
      ) : (
        <span className="text-gray-900">{r.descripcion}</span>
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
            className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0"
          />
          <div className="min-w-0">
            <p className="text-xs text-gray-500">
              {formatFecha(r.fechaPedido)}
              {!isAuto && r.solicitante ? ` · ${r.solicitante}` : ''}
            </p>
            <div className="text-sm font-semibold text-gray-900 break-words">
              <CeldaDescripcion r={r} />
            </div>
          </div>
        </div>
        <select
          value={r.estado}
          onChange={(e) => onCambioEstado(r.id, e.target.value as EstatusRequisicion)}
          className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ring-1 ring-inset border-0 focus:ring-2 focus:ring-blue-500 ${ESTADO_BADGE[r.estado]}`}
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
              <span className="text-gray-400 block">Proveedor</span>
              <span className="text-gray-900 truncate block">{r.tienda || '-'}</span>
            </div>
            <div className="min-w-0">
              <span className="text-gray-400 block">Parte # · Cant.</span>
              <span className="text-gray-900 truncate block font-mono">{r.parteNumero || '-'} · {r.cantidad || '-'}</span>
            </div>
            <div className="min-w-0">
              <span className="text-gray-400 block">F. entrega</span>
              <span className="text-gray-900 block">{r.fechaEntregaEst ? formatFecha(r.fechaEntregaEst) : '-'}</span>
            </div>
            <div className="min-w-0">
              <span className="text-gray-400 block">Plazo</span>
              <CeldaAtraso r={r} hoy={hoy} isAuto />
            </div>
            <div className="min-w-0">
              <span className="text-gray-400 block">Empresa · O.T.</span>
              <span className="flex items-center gap-1.5">
                {r.empresa ? (
                  <span className={`rounded px-1.5 py-0.5 font-semibold ${badgeEmpresa(r.empresa)}`}>{r.empresa}</span>
                ) : '-'}
                <span className="text-gray-900 font-mono truncate">{r.ordenServicio || ''}</span>
              </span>
            </div>
            <div className="min-w-0">
              <span className="text-gray-400 block">Link</span>
              {r.link ? (
                <a href={r.link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  Abrir
                </a>
              ) : '-'}
            </div>
            <div className="min-w-0">
              <span className="text-gray-400 block">Recibió</span>
              <select
                value={r.recibio ?? ''}
                onChange={(e) => onCampoInline(r.id, 'recibio', e.target.value)}
                className="rounded border-0 bg-transparent text-gray-900 focus:ring-1 focus:ring-blue-500 -ml-1"
              >
                <option value="">—</option>
                {SOLICITANTES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="min-w-0">
              <span className="text-gray-400 block">Rev. finanzas</span>
              <select
                value={r.revisionFinanzas ?? ''}
                onChange={(e) => onCampoInline(r.id, 'revisionFinanzas', e.target.value)}
                className={`rounded px-1 -ml-1 font-semibold border-0 focus:ring-1 focus:ring-blue-500 ${
                  r.revisionFinanzas === 'Entrega parcial' ? 'bg-yellow-100 text-yellow-800' : 'bg-transparent text-gray-900'
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
              <span className="text-gray-400 block">Tienda</span>
              <span className="text-gray-900 truncate block">{r.tienda || '-'}</span>
            </div>
            <div className="min-w-0">
              <span className="text-gray-400 block">Cantidad</span>
              <span className="text-gray-900 block">{r.cantidad || '-'}</span>
            </div>
            <div className="min-w-0">
              <span className="text-gray-400 block">Prioridad</span>
              {r.prioridad ? (
                <span className={`inline-block rounded px-1.5 py-0.5 font-semibold ${PRIORIDAD_BADGE[r.prioridad]}`}>
                  {r.prioridad}
                </span>
              ) : '-'}
            </div>
            <div className="min-w-0">
              <span className="text-gray-400 block">Límite</span>
              <CeldaAtraso r={r} hoy={hoy} isAuto={false} />
            </div>
            <div className="min-w-0">
              <span className="text-gray-400 block">Empresa · O.T.</span>
              <span className="flex items-center gap-1.5">
                {r.empresa ? (
                  <span className={`rounded px-1.5 py-0.5 font-semibold ${badgeEmpresa(r.empresa)}`}>{r.empresa}</span>
                ) : '-'}
                <span className="text-gray-900 font-mono truncate">{r.ordenServicio || ''}</span>
              </span>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center justify-end gap-3 pl-[26px] pt-2 border-t border-gray-50">
        <button onClick={() => onEditar(r)} className="p-1.5 text-gray-400 hover:text-blue-600" title="Editar">
          <Edit2 className="h-4 w-4" />
        </button>
        <button onClick={() => onEliminar(r.id, r.descripcion)} className="p-1.5 text-gray-400 hover:text-red-600" title="Eliminar">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export default function RequisicionesList() {
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
    await actualizarEstado(id, estado)
  }

  async function handleCampoInline(
    id: string,
    campo: 'recibio' | 'revisionFinanzas',
    valor: string
  ) {
    const normalizado = valor.trim() || null
    await editarRequisicion(id, { [campo]: normalizado })
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

  const chip = (activo: boolean, onClick: () => void, label: string) => (
    <button
      key={label}
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
        activo
          ? 'bg-blue-600 text-white'
          : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  )

  const urlParaAutollenar = form.link.trim() || form.descripcion.trim()

  return (
    <div className="space-y-6">
      {/* PESTAÑAS PRINCIPALES DE NAVEGACIÓN */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
          <button
            onClick={() => setTabVista('flujo')}
            className={[
              'px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2',
              tabVista === 'flujo'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60',
            ].join(' ')}
          >
            <Zap className="h-4 w-4 text-amber-400" />
            Flujo de Compras End-to-End ({totalRequisiciones})
          </button>
          <button
            onClick={() => {
              setTabVista('tabla')
            }}
            className={[
              'px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2',
              tabVista === 'tabla'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60',
            ].join(' ')}
          >
            <Layers className="h-4 w-4 text-slate-500" />
            Catálogo Tradicional de Requisiciones
          </button>
        </div>

        {tabVista === 'flujo' && (
          <div className="flex flex-wrap items-center gap-2">
            {!coleccionCompleta && (
              <button
                type="button"
                onClick={() => void cargarTodas().catch(() => undefined)}
                disabled={cargandoCompleto}
                className="flex items-center gap-1.5 px-3 py-2 border border-sky-200 bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs font-bold rounded-xl disabled:opacity-50"
              >
                {cargandoCompleto && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {cargandoCompleto ? 'Cargando historial...' : 'Completar KPIs'}
              </button>
            )}
            <button
              onClick={() => setModalNuevaFlujo(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#0369A1] hover:bg-[#0284C7] text-white text-xs font-bold rounded-xl shadow-xs transition-transform active:scale-95"
            >
              <Plus className="h-4 w-4" /> + Nueva Requisición (Tooling)
            </button>
          </div>
        )}
      </div>

      {/* VISTA 1: FLUJO DE COMPRAS END-TO-END */}
      {tabVista === 'flujo' && (
        <div className="space-y-6">
          {loading && (
            <div className="flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white py-14 text-sm text-slate-500">
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
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Solicitudes</span>
              <p className="text-xl font-extrabold text-slate-900 font-mono">{totalRequisiciones}</p>
            </div>
            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 shadow-2xs space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">En Cotización</span>
              <p className="text-xl font-extrabold text-amber-900 font-mono">
                {coleccionCompleta
                  ? todasFlujo.filter((r) => !r.estatusFlujo || r.estatusFlujo === 'cotizando' || r.estatusFlujo === 'enviada').length
                  : '—'}
              </p>
            </div>
            <div className="bg-purple-50 p-4 rounded-xl border border-purple-200 shadow-2xs space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700">Ganador Seleccionado</span>
              <p className="text-xl font-extrabold text-purple-900 font-mono">
                {coleccionCompleta ? todasFlujo.filter((r) => r.estatusFlujo === 'aprobada').length : '—'}
              </p>
            </div>
            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 shadow-2xs space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">OC Generadas</span>
              <p className="text-xl font-extrabold text-emerald-900 font-mono">
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
                  className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs hover:shadow-md transition-all space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black bg-slate-900 text-white px-2.5 py-0.5 rounded-md">
                          {req.folio || `REQ-${req.id.substring(0, 6)}`}
                        </span>
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
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
                        {esOC ? '✓ OC GENERADA' : esAprobada ? '★ GANADOR ELEGIDO' : esCotiz ? '⚡ COTIZANDO' : 'ENVIADA'}
                      </span>
                    </div>

                    <h3 className="text-sm font-extrabold text-slate-900 leading-snug">{req.descripcion}</h3>

                    <div className="text-xs text-slate-500 space-y-1 font-mono">
                      <div className="flex items-center justify-between">
                        <span>Solicitante:</span>
                        <strong className="text-slate-800">{req.solicitante}</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Fecha:</span>
                        <span className="text-slate-700">{req.fechaPedido}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Herramientas solicitadas:</span>
                        <strong className="text-slate-900">{req.items?.length || 1} ítem(s)</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Atraso:</span>
                        <CeldaAtraso r={req} hoy={hoy} isAuto={req.tipo === 'automatizacion'} />
                      </div>
                    </div>

                    {req.proveedorGanadorNombre && (
                      <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-0.5">
                        <span className="text-[10px] font-bold text-emerald-800 uppercase block">Proveedor Seleccionado</span>
                        <p className="font-extrabold text-emerald-950 flex items-center justify-between">
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

                  <div className="pt-3 border-t border-slate-100">
                    <button
                      onClick={() => setReqDetalleModal(req)}
                      className="w-full py-2 bg-[#0369A1] hover:bg-[#0284C7] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Eye className="h-4 w-4" /> Ver Flujo / Cotizar / Emitir OC <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {hayMas && (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">
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
      )}

      {/* VISTA 2: CATÁLOGO TRADICIONAL DE REQUISICIONES */}
      {tabVista === 'tabla' && (
        <div className="space-y-6">
          {/* Sub-tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
            {(['general', 'automatizacion'] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTipoActivo(t)
                  setFiltroEstado('todos')
                  setFiltroEmpresa('')
                  setBusqueda('')
                  setSelectedIds(new Set())
                }}
                className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                  tipoActivo === t
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t === 'general' ? 'Compras generales' : 'Automatización'}
              </button>
            ))}
          </div>

      {/* Form */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">
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
              className="ml-auto flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
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
      </div>

      {/* Filters */}
      {!loading && !error && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-gray-400 mr-1">Estado:</span>
            {chip(filtroEstado === 'todos', () => setFiltroEstado('todos'), 'Todos')}
            {ESTADOS_REQUISICION.map((e) =>
              chip(filtroEstado === e, () => setFiltroEstado(e), ESTADO_LABEL[e])
            )}
            <span className="text-xs font-semibold text-gray-400 mx-1 ml-3">Empresa:</span>
            {chip(!filtroEmpresa, () => setFiltroEmpresa(''), 'Todas')}
            {EMPRESAS.map((emp) =>
              chip(filtroEmpresa === emp, () => setFiltroEmpresa(filtroEmpresa === emp ? '' : emp), emp)
            )}
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
            <p className="text-xs text-gray-500">
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
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-gray-200 shadow-xs">
          <Loader2 className="h-10 w-10 animate-spin text-blue-500 mb-4" />
          <p className="text-gray-500 text-sm">Cargando requisiciones…</p>
        </div>
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
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          {filtradas.length === 0 ? (
            <div className="text-center py-20">
              <div className="mx-auto w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-4 text-gray-400">
                <ClipboardList className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900">
                {filtradas.length === 0 && requisiciones.filter(r => (r.tipo ?? 'general') === tipoActivo).length === 0
                  ? `Sin ${isAuto ? 'compras de automatización' : 'requisiciones'}`
                  : 'Sin coincidencias'}
              </h3>
              <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">
                {filtradas.length === 0 && requisiciones.filter(r => (r.tipo ?? 'general') === tipoActivo).length === 0
                  ? 'Agrega la primera con el formulario de arriba.'
                  : 'Ningún registro coincide con los filtros actuales.'}
              </p>
            </div>
          ) : (
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-500">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={filtradas.length > 0 && selectedIds.size === filtradas.length}
                        onChange={toggleAllSelection}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </th>
                    {isAuto ? (
                      <>
                        <th className="px-3 py-3 font-semibold whitespace-nowrap">Fecha</th>
                        <th className="px-3 py-3 font-semibold whitespace-nowrap">F. entrega</th>
                        <th className="px-3 py-3 font-semibold whitespace-nowrap">Estado</th>
                        <th className="px-3 py-3 font-semibold whitespace-nowrap">Recibió</th>
                        <th className="px-3 py-3 font-semibold whitespace-nowrap">Rev. fin.</th>
                        <th className="px-3 py-3 font-semibold whitespace-nowrap">Proveedor</th>
                        <th className="px-3 py-3 font-semibold text-center">Cant.</th>
                        <th className="px-3 py-3 font-semibold min-w-[180px]">Descripción</th>
                        <th className="px-3 py-3 font-semibold whitespace-nowrap">Parte #</th>
                        <th className="px-3 py-3 font-semibold whitespace-nowrap">Link</th>
                        <th className="px-3 py-3 font-semibold">Empresa</th>
                        <th className="px-3 py-3 font-semibold">O.T.</th>
                        <th className="px-3 py-3 font-semibold whitespace-nowrap">Plazo</th>
                      </>
                    ) : (
                      <>
                        <th className="px-3 py-3 font-semibold whitespace-nowrap">Fecha</th>
                        <th className="px-3 py-3 font-semibold whitespace-nowrap">Solicitante</th>
                        <th className="px-3 py-3 font-semibold min-w-[180px]">Descripción</th>
                        <th className="px-3 py-3 font-semibold whitespace-nowrap">Tienda</th>
                        <th className="px-3 py-3 font-semibold text-center">Cant.</th>
                        <th className="px-3 py-3 font-semibold whitespace-nowrap">Prioridad</th>
                        <th className="px-3 py-3 font-semibold whitespace-nowrap">Límite</th>
                        <th className="px-3 py-3 font-semibold">Empresa</th>
                        <th className="px-3 py-3 font-semibold">O.T.</th>
                        <th className="px-3 py-3 font-semibold">Estado</th>
                      </>
                    )}
                    <th className="px-3 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filtradas.map((r) => (
                    <tr
                      key={r.id}
                      className={`hover:bg-gray-50 transition-colors ${
                        r.estado === 'parcial' ? 'bg-pink-50/40' : ''
                      }`}
                    >
                      <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(r.id)}
                          onChange={(e) => toggleSelection(r.id, e as unknown as React.MouseEvent)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                      {isAuto ? (
                        <>
                          <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-500">
                            {formatFecha(r.fechaPedido)}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-500">
                            {r.fechaEntregaEst ? formatFecha(r.fechaEntregaEst) : '-'}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <select
                              value={r.estado}
                              onChange={(e) => handleCambioEstado(r.id, e.target.value as EstatusRequisicion)}
                              className={`rounded-full px-2 py-1 text-xs font-semibold ring-1 ring-inset cursor-pointer border-0 focus:ring-2 focus:ring-blue-500 ${ESTADO_BADGE[r.estado]}`}
                              title="Cambiar estado"
                            >
                              {ESTADOS_REQUISICION.map((e) => (
                                <option key={e} value={e}>{ESTADO_LABEL[e]}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <select
                              value={r.recibio ?? ''}
                              onChange={(e) => handleCampoInline(r.id, 'recibio', e.target.value)}
                              className="rounded border-0 bg-transparent text-xs text-gray-700 focus:ring-1 focus:ring-blue-500 cursor-pointer max-w-[120px]"
                            >
                              <option value="">—</option>
                              {SOLICITANTES.map((s) => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <select
                              value={r.revisionFinanzas ?? ''}
                              onChange={(e) => handleCampoInline(r.id, 'revisionFinanzas', e.target.value)}
                              className={`rounded px-1.5 py-0.5 text-xs font-semibold border-0 cursor-pointer focus:ring-1 focus:ring-blue-500 ${
                                r.revisionFinanzas === 'Entrega parcial'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-transparent text-gray-700'
                              }`}
                            >
                              {REVISION_FINANZAS_OPCIONES.map((op) => (
                                <option key={op || 'vacio'} value={op}>{op || '—'}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">{r.tienda || '-'}</td>
                          <td className="px-3 py-3 text-center whitespace-nowrap">{r.cantidad || '-'}</td>
                          <td className="px-3 py-3"><CeldaDescripcion r={r} /></td>
                          <td className="px-3 py-3 whitespace-nowrap font-mono text-xs">{r.parteNumero || '-'}</td>
                          <td className="px-3 py-3 whitespace-nowrap max-w-[100px]">
                            {r.link ? (
                              <a
                                href={r.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline text-xs truncate block max-w-[100px]"
                                title={r.link}
                              >
                                Link
                              </a>
                            ) : '-'}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            {r.empresa ? (
                              <span className={`rounded px-2 py-0.5 text-xs font-semibold ${badgeEmpresa(r.empresa)}`}>
                                {r.empresa}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap font-mono text-xs">
                            {r.ordenServicio || '-'}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <CeldaAtraso r={r} hoy={hoy} isAuto />
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-500">
                            {formatFecha(r.fechaPedido)}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap font-medium text-gray-900">
                            {r.solicitante || '-'}
                          </td>
                          <td className="px-3 py-3"><CeldaDescripcion r={r} /></td>
                          <td className="px-3 py-3 whitespace-nowrap">{r.tienda || '-'}</td>
                          <td className="px-3 py-3 text-center whitespace-nowrap">{r.cantidad || '-'}</td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            {r.prioridad ? (
                              <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${PRIORIDAD_BADGE[r.prioridad]}`}>
                                {r.prioridad}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <CeldaAtraso r={r} hoy={hoy} isAuto={false} />
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            {r.empresa ? (
                              <span className={`rounded px-2 py-0.5 text-xs font-semibold ${badgeEmpresa(r.empresa)}`}>
                                {r.empresa}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap font-mono text-xs">
                            {r.ordenServicio || '-'}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <select
                              value={r.estado}
                              onChange={(e) => handleCambioEstado(r.id, e.target.value as EstatusRequisicion)}
                              className={`rounded-full px-2 py-1 text-xs font-semibold ring-1 ring-inset cursor-pointer border-0 focus:ring-2 focus:ring-blue-500 ${ESTADO_BADGE[r.estado]}`}
                              title="Cambiar estado"
                            >
                              {ESTADOS_REQUISICION.map((e) => (
                                <option key={e} value={e}>{ESTADO_LABEL[e]}</option>
                              ))}
                            </select>
                          </td>
                        </>
                      )}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setRequisicionToEdit(r)}
                            className="text-gray-400 hover:text-blue-600 transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleEliminar(r.id, r.descripcion)}
                            className="text-gray-400 hover:text-red-600 transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {filtradas.length > 0 && (
            <div className="md:hidden divide-y divide-gray-100">
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
            <div className="flex justify-center border-t border-gray-100 p-4">
              <button
                onClick={cargarMas}
                disabled={cargandoMas}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                {cargandoMas && <Loader2 className="h-4 w-4 animate-spin" />}
                {cargandoMas ? 'Cargando…' : `Cargar más (${requisiciones.length} de ${totalRequisiciones})`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )}

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
