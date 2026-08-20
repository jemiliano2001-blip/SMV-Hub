'use client'

import { useState } from 'react'
import { useOperadores } from '@/lib/hooks/useOperadores'
import { useUsuarios } from '@/lib/hooks/useUsuarios'
import { departamentoDesdeArea } from '@/lib/operadores-departamento'
import type { Area, Operador } from '@/lib/schemas'
import { Plus, Search, UserCheck, UserX, Download, Check, X, Mail, Copy, Edit2, Layers } from 'lucide-react'
import { toast } from 'sonner'
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

const SIN_HORAS_EXTRA_TITULO = 'Esta área no participa en horas extra (no tiene departamento equivalente en /horas-extra)'

function getInitials(name: string) {
  return name.trim().split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
}

const AREAS: { value: Area; label: string }[] = [
  { value: 'taller', label: 'Taller' },
  { value: 'diseno', label: 'Diseño' },
  { value: 'automatizacion', label: 'Automatización' },
  { value: 'cnc', label: 'CNC' },
  { value: 'limpieza', label: 'Limpieza' },
  { value: 'administracion', label: 'Administración' },
]

const AREA_COLORS: Record<Area, string> = {
  taller: 'bg-blue-50 text-blue-700 border-blue-200',
  diseno: 'bg-purple-50 text-purple-700 border-purple-200',
  automatizacion: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cnc: 'bg-amber-50 text-amber-700 border-amber-200',
  limpieza: 'bg-gray-50 text-gray-600 border-gray-200',
  administracion: 'bg-rose-50 text-rose-700 border-rose-200',
}

type OperadorCardProps = {
  op: Operador
  correoVinculado?: string | null
  editando: boolean
  nombreEditado: string
  onNombreEditadoChange: (v: string) => void
  onEmpezarEdicion: () => void
  onGuardarEdicion: () => void
  onCancelarEdicion: () => void
  onCambiarArea: (area: Area) => void
  onToggle: () => void
}

// Tarjeta para < md: mismos datos y acciones que la fila de tabla, sin scroll horizontal.
function OperadorCard({
  op,
  correoVinculado,
  editando,
  nombreEditado,
  onNombreEditadoChange,
  onEmpezarEdicion,
  onGuardarEdicion,
  onCancelarEdicion,
  onCambiarArea,
  onToggle,
}: OperadorCardProps) {
  return (
    <div className={`p-3 flex items-center justify-between gap-3 ${!op.activo ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${AREA_COLORS[op.area]}`}>
          {getInitials(op.nombre)}
        </div>
        {editando ? (
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <input
              type="text"
              value={nombreEditado}
              onChange={(e) => onNombreEditadoChange(e.target.value)}
              className="w-full min-w-0 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:border-primary"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') onGuardarEdicion()
                if (e.key === 'Escape') onCancelarEdicion()
              }}
            />
            <button onClick={onGuardarEdicion} className="text-emerald-600 bg-emerald-50 rounded p-1 hover:bg-emerald-100 shrink-0"><Check className="w-4 h-4" /></button>
            <button onClick={onCancelarEdicion} className="text-red-600 bg-red-50 rounded p-1 hover:bg-red-100 shrink-0"><X className="w-4 h-4" /></button>
          </div>
        ) : (
          <div className="min-w-0 flex-1">
            <p
              className="font-medium text-gray-900 truncate cursor-pointer hover:text-primary"
              onClick={onEmpezarEdicion}
              title="Clic para editar"
            >
              {op.nombre}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <select
                value={op.area}
                onChange={(e) => onCambiarArea(e.target.value as Area)}
                className={`text-xs font-medium px-2 py-0.5 rounded-full border cursor-pointer ${AREA_COLORS[op.area]}`}
              >
                {AREAS.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>

              {correoVinculado ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  <Mail className="w-3 h-3 text-emerald-600" />
                  {correoVinculado}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-400 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded-full">
                  Sin correo
                </span>
              )}
            </div>
            {!departamentoDesdeArea(op.area) && (
              <p className="mt-0.5 text-[10px] text-gray-400" title={SIN_HORAS_EXTRA_TITULO}>
                No aplica a horas extra
              </p>
            )}
          </div>
        )}
      </div>
      <button
        onClick={onToggle}
        className={`shrink-0 inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
          op.activo ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
        }`}
        title={op.activo ? 'Clic para desactivar' : 'Clic para activar'}
      >
        {op.activo ? <UserCheck className="h-3.5 w-3.5" /> : <UserX className="h-3.5 w-3.5" />}
      </button>
    </div>
  )
}

export default function OperadoresList() {
  const {
    operadores,
    loading,
    error,
    fetchOperadores,
    agregarOperador,
    editarOperador,
    toggleActivo,
    cambiarArea,
  } = useOperadores()

  const { usuarios } = useUsuarios()

  function obtenerCorreoVinculado(opId: string, opNombre: string): string | null {
    const porId = usuarios.find((u) => u.operadorId === opId)
    if (porId) return porId.email
    const porNombre = usuarios.find(
      (u) => u.operadorNombre?.trim().toLowerCase() === opNombre.trim().toLowerCase()
    )
    if (porNombre) return porNombre.email
    return null
  }

  const [busqueda, setBusqueda] = useState('')
  const [filtroArea, setFiltroArea] = useState<Area | 'todas'>('todas')
  const [mostrarInactivos, setMostrarInactivos] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevaArea, setNuevaArea] = useState<Area>('taller')
  const [agregando, setAgregando] = useState(false)
  const [errorForm, setErrorForm] = useState<string | null>(null)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [nombreEditado, setNombreEditado] = useState('')

  const filtrados = operadores.filter((op) => {
    if (!mostrarInactivos && !op.activo) return false
    if (filtroArea !== 'todas' && op.area !== filtroArea) return false
    if (busqueda) {
      const q = busqueda.toLowerCase()
      const correo = obtenerCorreoVinculado(op.id, op.nombre)?.toLowerCase() || ''
      return op.nombre.toLowerCase().includes(q) || correo.includes(q)
    }
    return true
  })

  async function handleAgregar(e: React.FormEvent) {
    e.preventDefault()
    const nombre = nuevoNombre.trim()
    if (!nombre) return

    // Verificar duplicado
    const existe = operadores.some(
      (op) => op.nombre.toLowerCase() === nombre.toLowerCase()
    )
    if (existe) {
      setErrorForm(`"${nombre}" ya existe en el catálogo`)
      return
    }

    setAgregando(true)
    setErrorForm(null)
    try {
      await agregarOperador({ nombre, area: nuevaArea, activo: true })
      setNuevoNombre('')
      setNuevaArea('taller')
    } catch (err) {
      console.error('Error agregando operador:', err)
      setErrorForm('No se pudo agregar. Intenta de nuevo.')
    } finally {
      setAgregando(false)
    }
  }

  async function handleToggle(id: string, activo: boolean) {
    try {
      await toggleActivo(id, !activo)
    } catch (err) {
      console.error('Error cambiando estado:', err)
    }
  }

  async function handleCambiarArea(id: string, area: Area) {
    try {
      await cambiarArea(id, area)
    } catch (err) {
      console.error('Error cambiando área:', err)
    }
  }

  async function guardarEdicion(id: string) {
    const nuevo = nombreEditado.trim()
    if (!nuevo) {
      setEditandoId(null)
      return
    }
    const existe = operadores.some(
      (op) => op.id !== id && op.nombre.trim().toLowerCase() === nuevo.toLowerCase()
    )
    if (existe) {
      setErrorForm(`"${nuevo}" ya existe en el catálogo`)
      return
    }
    try {
      await editarOperador(id, { nombre: nuevo })
      setErrorForm(null)
    } catch (err) {
      console.error('Error editando nombre:', err)
      setErrorForm('No se pudo actualizar el operador. Intenta de nuevo.')
    } finally {
      setEditandoId(null)
    }
  }

  const exportarCSV = () => {
    const encabezados = ['Nombre', 'Area', 'Correo Vinculado', 'Estado']
    const filas = filtrados.map((r) => [
      r.nombre,
      r.area,
      obtenerCorreoVinculado(r.id, r.nombre) || 'Sin correo',
      r.activo ? 'Activo' : 'Inactivo',
    ])
    const csvContent = [encabezados, ...filas].map((e) => e.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `catalogo_operadores.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm space-y-2">
        <p>{error}</p>
        <button onClick={fetchOperadores} className="font-semibold underline hover:no-underline">Reintentar</button>
      </div>
    )
  }

  const totalActivos = operadores.filter((op) => op.activo).length
  const totalInactivos = operadores.filter((op) => !op.activo).length

  return (
    <div className="space-y-6">
      {/* Resumen + Controles */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            <strong className="text-gray-900">{totalActivos}</strong> activos
            {totalInactivos > 0 && (
              <span className="ml-2 text-gray-400">· {totalInactivos} inactivos</span>
            )}
          </span>
          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
            <input
              type="checkbox"
              checked={mostrarInactivos}
              onChange={(e) => setMostrarInactivos(e.target.checked)}
              className="rounded border-gray-300 text-primary focus:ring-ring"
            />
            Mostrar inactivos
          </label>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Filtro por área */}
          <select
            value={filtroArea}
            onChange={(e) => setFiltroArea(e.target.value as Area | 'todas')}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary"
          >
            <option value="todas">Todas las áreas</option>
            {AREAS.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>

          {/* Búsqueda */}
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o correo…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary"
            />
          </div>
          <button
            onClick={exportarCSV}
            disabled={filtrados.length === 0}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors h-[38px]"
            title="Exportar a CSV"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Exportar</span>
          </button>
        </div>
      </div>

      {/* Formulario para agregar */}
      <form onSubmit={handleAgregar} className="flex items-end gap-3 bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-500 mb-1">Nombre</label>
          <input
            type="text"
            value={nuevoNombre}
            onChange={(e) => { setNuevoNombre(e.target.value); setErrorForm(null) }}
            placeholder="Nombre del operador…"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary"
            disabled={agregando}
          />
        </div>
        <div className="w-48">
          <label className="block text-xs font-medium text-gray-500 mb-1">Área</label>
          <select
            value={nuevaArea}
            onChange={(e) => setNuevaArea(e.target.value as Area)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-primary"
            disabled={agregando}
          >
            {AREAS.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={agregando || !nuevoNombre.trim()}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="h-4 w-4" />
          Agregar
        </button>
      </form>

      {errorForm && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-amber-700 text-sm">
          {errorForm}
        </div>
      )}

      {/* Tarjetas (celular) */}
      <div className="md:hidden bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
        {filtrados.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            {busqueda ? 'Sin resultados para la búsqueda' : 'No hay operadores registrados'}
          </div>
        ) : (
          filtrados.map((op) => (
            <OperadorCard
              key={op.id}
              op={op}
              correoVinculado={obtenerCorreoVinculado(op.id, op.nombre)}
              editando={editandoId === op.id}
              nombreEditado={nombreEditado}
              onNombreEditadoChange={setNombreEditado}
              onEmpezarEdicion={() => { setEditandoId(op.id); setNombreEditado(op.nombre) }}
              onGuardarEdicion={() => guardarEdicion(op.id)}
              onCancelarEdicion={() => setEditandoId(null)}
              onCambiarArea={(area) => handleCambiarArea(op.id, area)}
              onToggle={() => handleToggle(op.id, op.activo)}
            />
          ))
        )}
      </div>

      {/* Tabla de operadores (desktop) */}
      <div className="hidden md:block">
        <ModuleSurface>
        <Table className="text-sm">
          <TableHeader>
            <TableRow className="bg-gray-50 border-b border-gray-200">
              <TableHead className="text-left px-4 py-3 font-medium text-gray-500">Nombre</TableHead>
              <TableHead className="text-left px-4 py-3 font-medium text-gray-500">Área</TableHead>
              <TableHead className="text-left px-4 py-3 font-medium text-gray-500">Correo Vinculado</TableHead>
              <TableHead className="text-center px-4 py-3 font-medium text-gray-500">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-gray-100">
            {filtrados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12 text-gray-400">
                  {busqueda ? 'Sin resultados para la búsqueda' : 'No hay operadores registrados'}
                </TableCell>
              </TableRow>
            ) : (
              filtrados.map((op) => {
                const correo = obtenerCorreoVinculado(op.id, op.nombre)
                return (
                  <ContextMenu key={op.id}>
                    <ContextMenuTrigger asChild>
                      <TableRow
                        className={`hover:bg-gray-50 transition-colors cursor-pointer select-none ${!op.activo ? 'opacity-50' : ''}`}
                        onDoubleClick={() => {
                          setEditandoId(op.id)
                          setNombreEditado(op.nombre)
                        }}
                      >
                        <TableCell className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${AREA_COLORS[op.area]}`}>
                              {getInitials(op.nombre)}
                            </div>
                            {editandoId === op.id ? (
                              <div className="flex items-center gap-1.5 flex-1 max-w-[200px]" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="text"
                                  value={nombreEditado}
                                  onChange={(e) => setNombreEditado(e.target.value)}
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:border-primary"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') guardarEdicion(op.id)
                                    if (e.key === 'Escape') setEditandoId(null)
                                  }}
                                />
                                <button onClick={() => guardarEdicion(op.id)} className="text-emerald-600 bg-emerald-50 rounded p-1 hover:bg-emerald-100 cursor-pointer"><Check className="w-4 h-4" /></button>
                                <button onClick={() => setEditandoId(null)} className="text-red-600 bg-red-50 rounded p-1 hover:bg-red-100 cursor-pointer"><X className="w-4 h-4" /></button>
                              </div>
                            ) : (
                              <span 
                                className="font-medium text-gray-900 cursor-pointer hover:text-primary hover:underline"
                                onClick={() => { setEditandoId(op.id); setNombreEditado(op.nombre); }}
                                title="Clic para editar"
                              >
                                {op.nombre}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={op.area}
                            onChange={(e) => handleCambiarArea(op.id, e.target.value as Area)}
                            className={`text-xs font-medium px-2.5 py-1 rounded-full border cursor-pointer ${AREA_COLORS[op.area]}`}
                          >
                            {AREAS.map((a) => (
                              <option key={a.value} value={a.value}>{a.label}</option>
                            ))}
                          </select>
                          {!departamentoDesdeArea(op.area) && (
                            <p className="mt-0.5 text-[10px] text-gray-400" title={SIN_HORAS_EXTRA_TITULO}>
                              No aplica a horas extra
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          {correo ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-mono text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                              <Mail className="w-3.5 h-3.5 text-emerald-600" />
                              {correo}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-mono text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">
                              Sin correo
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleToggle(op.id, op.activo)}
                            className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full transition-colors cursor-pointer ${
                              op.activo
                                ? 'bg-green-50 text-green-700 hover:bg-green-100'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                            title={op.activo ? 'Clic para desactivar' : 'Clic para activar'}
                          >
                            {op.activo ? (
                              <><UserCheck className="h-3.5 w-3.5" /> Activo</>
                            ) : (
                              <><UserX className="h-3.5 w-3.5" /> Inactivo</>
                            )}
                          </button>
                        </TableCell>
                      </TableRow>
                    </ContextMenuTrigger>

                    <ContextMenuContent className="w-56">
                      <ContextMenuItem
                        onClick={() => {
                          setEditandoId(op.id)
                          setNombreEditado(op.nombre)
                        }}
                      >
                        <Edit2 className="text-primary" />
                        <span>Editar nombre ({op.nombre})</span>
                        <ContextMenuShortcut>↵</ContextMenuShortcut>
                      </ContextMenuItem>

                      <ContextMenuItem onClick={() => handleToggle(op.id, op.activo)}>
                        {op.activo ? (
                          <>
                            <UserX className="text-amber-600" />
                            <span>Desactivar operador</span>
                          </>
                        ) : (
                          <>
                            <UserCheck className="text-emerald-600" />
                            <span>Activar operador</span>
                          </>
                        )}
                      </ContextMenuItem>

                      <ContextMenuSeparator />

                      <ContextMenuSub>
                        <ContextMenuSubTrigger>
                          <Layers className="text-sky-600" />
                          <span>Cambiar área ({op.area})</span>
                        </ContextMenuSubTrigger>
                        <ContextMenuSubContent className="w-44">
                          {AREAS.map((a) => (
                            <ContextMenuItem
                              key={a.value}
                              onClick={() => handleCambiarArea(op.id, a.value)}
                            >
                              <span>{a.label}</span>
                            </ContextMenuItem>
                          ))}
                        </ContextMenuSubContent>
                      </ContextMenuSub>

                      <ContextMenuSeparator />

                      <ContextMenuSub>
                        <ContextMenuSubTrigger>
                          <Copy className="text-slate-500" />
                          <span>Copiar información</span>
                        </ContextMenuSubTrigger>
                        <ContextMenuSubContent className="w-48">
                          <ContextMenuItem
                            onClick={() => {
                              void navigator.clipboard.writeText(op.nombre)
                              toast.success('Nombre copiado')
                            }}
                          >
                            <span>Nombre ({op.nombre})</span>
                          </ContextMenuItem>
                          <ContextMenuItem
                            onClick={() => {
                              void navigator.clipboard.writeText(op.area)
                              toast.success('Área copiada')
                            }}
                          >
                            <span>Área ({op.area})</span>
                          </ContextMenuItem>
                          {correo && (
                            <ContextMenuItem
                              onClick={() => {
                                void navigator.clipboard.writeText(correo)
                                toast.success('Correo copiado')
                              }}
                            >
                              <span>Correo ({correo})</span>
                            </ContextMenuItem>
                          )}
                        </ContextMenuSubContent>
                      </ContextMenuSub>
                    </ContextMenuContent>
                  </ContextMenu>
                )
              })
            )}
          </TableBody>
        </Table>
        </ModuleSurface>
      </div>
    </div>
  )
}
