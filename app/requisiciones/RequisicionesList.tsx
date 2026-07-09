'use client'

import { useState, useMemo } from 'react'
import { Loader2, AlertCircle, ClipboardList, Trash2, Edit2, Sparkles } from 'lucide-react'
import type { EstatusRequisicion, PrioridadRequisicion, TipoRequisicion, Requisicion } from '@/lib/schemas'
import type { NuevaRequisicionPayload } from '@/lib/requisiciones'
import { useRequisiciones } from '@/lib/hooks/useRequisiciones'
import { formatFecha, normalizar } from '@/lib/format'
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
    fechaPedido: new Date().toISOString().split('T')[0],
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

export default function RequisicionesList() {
  const {
    requisiciones,
    loading,
    error,
    fetchRequisiciones,
    agregarRequisicion,
    actualizarEstado,
    borrarRequisicion,
    borrarRequisicionesLote,
    editarRequisicion,
  } = useRequisiciones()

  const [tipoActivo, setTipoActivo] = useState<TipoRequisicion>('general')
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [scraping, setScraping] = useState(false)
  const [scrapeError, setScrapeError] = useState<string | null>(null)
  const [filtroEstado, setFiltroEstado] = useState<EstatusRequisicion | 'todos'>('todos')
  const [filtroEmpresa, setFiltroEmpresa] = useState('')
  const [busqueda, setBusqueda] = useState('')

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
        fechaPedido: form.fechaPedido || new Date().toISOString().split('T')[0],
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
    if (!confirm(`¿Eliminar "${desc.slice(0, 60)}"?`)) return
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
    if (window.confirm(`¿Estás seguro de que deseas eliminar ${selectedIds.size} requisiciones seleccionadas?`)) {
      setIsDeletingBulk(true)
      const success = await borrarRequisicionesLote(Array.from(selectedIds))
      if (success) {
        setSelectedIds(new Set())
      } else {
        alert('No se pudieron eliminar las requisiciones. Por favor, intenta de nuevo.')
      }
      setIsDeletingBulk(false)
    }
  }

  function handleFormSaved() {
    setRequisicionToEdit(null)
    fetchRequisiciones()
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
      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {(['general', 'automatizacion'] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTipoActivo(t); setFiltroEstado('todos'); setFiltroEmpresa(''); setBusqueda(''); setSelectedIds(new Set()) }}
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
              {filtradas.length} de {requisiciones.length} requisiciones
            </p>
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
            <div className="overflow-x-auto">
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
        </div>
      )}

      {requisicionToEdit && (
        <RequisicionFormModal
          requisicionBase={requisicionToEdit}
          onClose={() => setRequisicionToEdit(null)}
          onSaved={handleFormSaved}
        />
      )}
    </div>
  )
}
