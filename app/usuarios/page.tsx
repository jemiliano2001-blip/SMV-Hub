'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  UserPlus,
  Copy,
  Check,
  AlertCircle,
  Trash2,
  KeyRound,
  Shield,
  Pencil,
  UserCheck,
  UserX,
  Search,
  User,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Filter,
  Download,
  FileSpreadsheet,
  Users,
  Layers,
  SlidersHorizontal,
} from 'lucide-react'
import { toast } from 'sonner'
import { copiarAlPortapapeles } from '@/lib/portapapeles'
import AuthGuard from '../AuthGuard'
import ModuleEmptyState from '@/components/layout/ModuleEmptyState'
import ModuleFilterChips from '@/components/layout/ModuleFilterChips'
import ModuleSurface from '@/components/layout/ModuleSurface'
import ModuleTabs from '@/components/layout/ModuleTabs'
import PageHeader from '@/components/layout/PageHeader'
import PageShell from '@/components/layout/PageShell'
import { Button } from '@/components/ui/button'
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
import { useUsuarios, type UsuarioAdmin } from '@/lib/hooks/useUsuarios'
import { useOperadores } from '@/lib/hooks/useOperadores'
import type { ModuloId, Rol, Area, Operador } from '@/lib/schemas'
import {
  GRUPOS_MODULOS,
  MODULOS_POR_PLANTILLA,
  esMatrizPersonalizada,
  modulosDePlantilla,
} from '@/lib/roles'
import { useConfirmDialog } from '@/components/ConfirmDialogProvider'
import { descargarCSVUsuarios, exportarExcelUsuarios } from '@/lib/usuarios-export'

const PLANTILLAS: Rol[] = ['admin', 'compras', 'diseno', 'almacen', 'automatizacion']

const NOMBRES_PLANTILLAS: Record<Rol, string> = {
  admin: 'Administración Total',
  compras: 'Compras & Abastecimiento',
  diseno: 'Diseño e Ingeniería',
  almacen: 'Almacén & Operación',
  automatizacion: 'Automatización & Taller',
}

function plantillaRecomendadaPorArea(area?: Area): Rol {
  if (!area) return 'compras'
  switch (area) {
    case 'diseno':
      return 'diseno'
    case 'automatizacion':
      return 'automatizacion'
    case 'administracion':
      return 'compras'
    case 'taller':
    case 'cnc':
    case 'limpieza':
    default:
      return 'almacen'
  }
}

function BannerPasswordTemporal({ password, onClose }: { password: string; onClose: () => void }) {
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    await navigator.clipboard.writeText(password)
    setCopiado(true)
    toast.success('Contraseña temporal copiada al portapapeles')
  }

  return (
    <ModuleSurface className="border-sky-200 bg-sky-50/70 p-4">
      <p className="mb-2 font-mono text-xs font-bold uppercase tracking-wider text-primary">
        Contraseña temporal — cópiala ahora (no se vuelve a mostrar):
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 rounded-lg border border-sky-300 bg-card px-3 py-1.5 font-mono text-xs font-bold text-foreground">
          {password}
        </code>
        <button
          type="button"
          onClick={copiar}
          className="flex cursor-pointer items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {copiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copiado ? 'Copiada' : 'Copiar'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer px-2 py-1.5 text-xs text-muted-foreground hover:underline"
        >
          Cerrar
        </button>
      </div>
    </ModuleSurface>
  )
}

function MatrizModulos({
  modulos,
  onChange,
}: {
  modulos: ModuloId[]
  onChange: (m: ModuloId[]) => void
}) {
  const set = new Set(modulos)

  function toggle(id: ModuloId) {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange([...next])
  }

  function marcarGrupo(grupoModulos: { id: ModuloId }[], marcar: boolean) {
    const next = new Set(set)
    for (const m of grupoModulos) {
      if (marcar) next.add(m.id)
      else next.delete(m.id)
    }
    onChange([...next])
  }

  return (
    <div className="max-h-72 space-y-3 overflow-y-auto rounded-lg border border-border bg-muted/40 p-3">
      {GRUPOS_MODULOS.map((grupo) => {
        const todosSeleccionados = grupo.modulos.every((m) => set.has(m.id))
        return (
          <div key={grupo.nombre} className="rounded-md border border-border/50 bg-card/60 p-2.5">
            <div className="mb-1.5 flex items-center justify-between gap-2 border-b border-border/40 pb-1">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {grupo.nombre} ({grupo.modulos.filter((m) => set.has(m.id)).length}/{grupo.modulos.length})
              </span>
              <div className="flex items-center gap-1 text-[10px]">
                <button
                  type="button"
                  onClick={() => marcarGrupo(grupo.modulos, !todosSeleccionados)}
                  className="font-medium text-primary hover:underline"
                >
                  {todosSeleccionados ? 'Desmarcar todos' : 'Marcar todos'}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {grupo.modulos.map((m) => (
                <label
                  key={m.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs text-foreground hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    checked={set.has(m.id)}
                    onChange={() => toggle(m.id)}
                    className="rounded border-input text-primary focus:ring-ring"
                  />
                  <span>{m.label}</span>
                </label>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function TarjetaCoberturaOperadores({
  operadores,
  usuarios,
  onSeleccionarParaCrear,
}: {
  operadores: Operador[]
  usuarios: UsuarioAdmin[]
  onSeleccionarParaCrear: (op: Operador) => void
}) {
  const [expandido, setExpandido] = useState(true)
  const operadoresActivos = operadores.filter((op) => op.activo)

  const idsVinculados = new Set(usuarios.map((u) => u.operadorId).filter(Boolean))
  const nombresVinculados = new Set(
    usuarios.map((u) => u.operadorNombre?.toLowerCase().trim()).filter(Boolean)
  )

  const unlinkedOperadores = operadoresActivos.filter(
    (op) => !idsVinculados.has(op.id) && !nombresVinculados.has(op.nombre.toLowerCase().trim())
  )
  const totalActivos = operadoresActivos.length
  const vinculadosCount = totalActivos - unlinkedOperadores.length
  const porcentaje = totalActivos > 0 ? Math.round((vinculadosCount / totalActivos) * 100) : 100

  return (
    <ModuleSurface className="space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-sky-200 bg-sky-50 text-primary">
            <UserCheck className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Cobertura de Correos ↔ Catálogo de Operadores
            </h3>
            <p className="text-sm font-bold text-foreground">
              {vinculadosCount} de {totalActivos} operadores tienen correo vinculado ({porcentaje}%)
            </p>
          </div>
        </div>

        {unlinkedOperadores.length > 0 && (
          <button
            type="button"
            onClick={() => setExpandido(!expandido)}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 transition-colors hover:bg-amber-100"
          >
            <span>{unlinkedOperadores.length} pendientes de cuenta</span>
            {expandido ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-2 rounded-full bg-primary transition-all duration-300"
          style={{ width: `${porcentaje}%` }}
        />
      </div>

      {expandido && unlinkedOperadores.length > 0 && (
        <div className="border-t border-border pt-2">
          <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Operadores activos sin cuenta de usuario en SMV Hub:
          </p>
          <div className="flex flex-wrap gap-2">
            {unlinkedOperadores.map((op) => {
              const rec = plantillaRecomendadaPorArea(op.area)
              return (
                <div
                  key={op.id}
                  className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-1 text-xs text-foreground"
                >
                  <span className="font-semibold">{op.nombre}</span>
                  <span className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
                    {op.area}
                  </span>
                  <button
                    type="button"
                    onClick={() => onSeleccionarParaCrear(op)}
                    className="ml-1 flex cursor-pointer items-center gap-1 text-[11px] font-bold text-primary hover:underline"
                    title={`Crear usuario para ${op.nombre} (sugiere plantilla ${rec})`}
                  >
                    <UserPlus className="h-3 w-3" />
                    Crear usuario
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </ModuleSurface>
  )
}

function FormNuevoUsuario({
  operadores,
  operadorPreseleccionado,
  onCrear,
}: {
  operadores: Operador[]
  operadorPreseleccionado?: Operador | null
  onCrear: (input: {
    email: string
    plantilla: Rol
    modulos: ModuloId[]
    esSuperAdmin: boolean
    atiendeDocumentosVenta: boolean
    editaHorasExtra: boolean
    operadorId?: string | null
    operadorNombre?: string | null
    password?: string
  }) => Promise<void>
}) {
  const [email, setEmail] = useState('')
  const [plantilla, setPlantilla] = useState<Rol>('compras')
  const [modulos, setModulos] = useState<ModuloId[]>(() => modulosDePlantilla('compras'))
  const [esSuperAdmin, setEsSuperAdmin] = useState(false)
  const [atiendeDocumentosVenta, setAtiendeDocumentosVenta] = useState(false)
  const [editaHorasExtra, setEditaHorasExtra] = useState(false)
  const [operadorId, setOperadorId] = useState<string | null>(null)
  const [operadorNombre, setOperadorNombre] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (operadorPreseleccionado) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronizar operador seleccionado desde tarjeta externa
      setOperadorId(operadorPreseleccionado.id)
      setOperadorNombre(operadorPreseleccionado.nombre)
      const rec = plantillaRecomendadaPorArea(operadorPreseleccionado.area)
      setPlantilla(rec)
      setModulos(modulosDePlantilla(rec))
    }
  }, [operadorPreseleccionado])

  function handlePlantilla(p: Rol) {
    setPlantilla(p)
    setModulos(modulosDePlantilla(p))
    if (p === 'admin') setEsSuperAdmin(true)
  }

  function handleSeleccionarOperador(id: string) {
    if (!id) {
      setOperadorId(null)
      setOperadorNombre(null)
      return
    }
    const op = operadores.find((o) => o.id === id)
    if (op) {
      setOperadorId(op.id)
      setOperadorNombre(op.nombre)
      const rec = plantillaRecomendadaPorArea(op.area)
      setPlantilla(rec)
      setModulos(modulosDePlantilla(rec))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) {
      setError('El correo es obligatorio')
      return
    }
    setEnviando(true)
    setError(null)
    try {
      await onCrear({
        email: email.trim(),
        plantilla,
        modulos,
        esSuperAdmin,
        atiendeDocumentosVenta,
        editaHorasExtra,
        operadorId,
        operadorNombre,
        password: password || undefined,
      })
      setEmail('')
      setPassword('')
      setOperadorId(null)
      setOperadorNombre(null)
      setEsSuperAdmin(false)
      setAtiendeDocumentosVenta(false)
      setEditaHorasExtra(false)
      toast.success('Usuario creado exitosamente')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el usuario')
    } finally {
      setEnviando(false)
    }
  }

  const personalizado = esMatrizPersonalizada(plantilla, modulos)

  return (
    <ModuleSurface className="space-y-4 p-4">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Crear Nuevo Usuario en SMV Hub
        </h3>
        {personalizado && (
          <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-800">
            MATRIZ PERSONALIZADA
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <label className="mb-1 block font-mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Correo Institucional *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@smv.mx"
              className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block font-mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Operador del Catálogo
            </label>
            <select
              value={operadorId || ''}
              onChange={(e) => handleSeleccionarOperador(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
            >
              <option value="">-- Sin operador (administrativo) --</option>
              {operadores
                .filter((o) => o.activo)
                .map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.nombre} ({op.area})
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block font-mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Plantilla Base
            </label>
            <select
              value={plantilla}
              onChange={(e) => handlePlantilla(e.target.value as Rol)}
              className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
            >
              {PLANTILLAS.map((r) => (
                <option key={r} value={r}>
                  {r.toUpperCase()} — {NOMBRES_PLANTILLAS[r]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block font-mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Contraseña (Opcional)
            </label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="En blanco = temporal"
              className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border/60 bg-muted/20 p-2.5 text-xs">
          <label className="flex cursor-pointer items-center gap-2 text-foreground">
            <input
              type="checkbox"
              checked={esSuperAdmin}
              onChange={(e) => setEsSuperAdmin(e.target.checked)}
              className="rounded border-input text-primary"
            />
            <Shield className="h-3.5 w-3.5 text-rose-600" />
            <span className="font-medium">Super-admin (administra usuarios y permisos)</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-foreground">
            <input
              type="checkbox"
              checked={atiendeDocumentosVenta}
              onChange={(e) => setAtiendeDocumentosVenta(e.target.checked)}
              className="rounded border-input text-primary"
            />
            <span>Atiende documentos de venta (cola remisión/factura)</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-foreground">
            <input
              type="checkbox"
              checked={editaHorasExtra}
              onChange={(e) => setEditaHorasExtra(e.target.checked)}
              className="rounded border-input text-primary"
            />
            <span>Edita horas extra</span>
          </label>
        </div>

        <div>
          <p className="mb-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Matriz de Módulos Habilitados ({modulos.length} seleccionados)
          </p>
          <MatrizModulos modulos={modulos} onChange={setModulos} />
        </div>

        {error && <p className="font-mono text-xs text-destructive">{error}</p>}

        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={enviando} className="font-bold">
            <UserPlus className="h-3.5 w-3.5" data-icon="inline-start" />
            {enviando ? 'Creando cuenta...' : 'Crear usuario'}
          </Button>
        </div>
      </form>
    </ModuleSurface>
  )
}

function ModalEditarPermisos({
  usuario,
  usuariosLista,
  operadores,
  onGuardar,
  onCerrar,
}: {
  usuario: UsuarioAdmin
  usuariosLista: UsuarioAdmin[]
  operadores: Operador[]
  onGuardar: (cambios: {
    plantilla: Rol
    modulos: ModuloId[]
    esSuperAdmin: boolean
    atiendeDocumentosVenta: boolean
    editaHorasExtra: boolean
    operadorId: string | null
    operadorNombre: string | null
  }) => Promise<void>
  onCerrar: () => void
}) {
  const [plantilla, setPlantilla] = useState<Rol>(usuario.plantilla)
  const [modulos, setModulos] = useState<ModuloId[]>(usuario.modulos)
  const [esSuperAdmin, setEsSuperAdmin] = useState(usuario.esSuperAdmin)
  const [atiendeDocumentosVenta, setAtiendeDocumentosVenta] = useState(
    usuario.atiendeDocumentosVenta === true
  )
  const [editaHorasExtra, setEditaHorasExtra] = useState(
    usuario.editaHorasExtra === true
  )
  const [operadorId, setOperadorId] = useState<string | null>(usuario.operadorId ?? null)
  const [operadorNombre, setOperadorNombre] = useState<string | null>(usuario.operadorNombre ?? null)

  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handlePlantilla(p: Rol) {
    setPlantilla(p)
    setModulos(modulosDePlantilla(p))
    if (p === 'admin') setEsSuperAdmin(true)
  }

  function handleSeleccionarOperador(id: string) {
    if (!id) {
      setOperadorId(null)
      setOperadorNombre(null)
      return
    }
    const op = operadores.find((o) => o.id === id)
    if (op) {
      setOperadorId(op.id)
      setOperadorNombre(op.nombre)
    }
  }

  function aplicarSugerenciaArea() {
    if (!operadorId) return
    const op = operadores.find((o) => o.id === operadorId)
    if (op) {
      const rec = plantillaRecomendadaPorArea(op.area)
      handlePlantilla(rec)
      toast.success(`Plantilla recomendada '${rec}' aplicada`)
    }
  }

  function clonarPermisosDe(otroUsuarioId: string) {
    const otro = usuariosLista.find((u) => u.id === otroUsuarioId)
    if (!otro) return
    setPlantilla(otro.plantilla)
    setModulos([...otro.modulos])
    setEsSuperAdmin(otro.esSuperAdmin)
    setAtiendeDocumentosVenta(otro.atiendeDocumentosVenta === true)
    setEditaHorasExtra(otro.editaHorasExtra === true)
    toast.success(`Permisos copiados desde ${otro.email}`)
  }

  async function guardar() {
    setGuardando(true)
    setError(null)
    try {
      await onGuardar({
        plantilla,
        modulos,
        esSuperAdmin,
        atiendeDocumentosVenta,
        editaHorasExtra,
        operadorId,
        operadorNombre,
      })
      toast.success('Permisos actualizados correctamente')
      onCerrar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }

  const personalizado = esMatrizPersonalizada(plantilla, modulos)
  const opSeleccionado = operadores.find((o) => o.id === operadorId)

  return (
    <Dialog open onOpenChange={(open) => !open && onCerrar()}>
      <DialogContent className="flex max-h-[90vh] max-w-xl flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-border px-4 py-3">
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-primary" />
            <span>Editar Permisos y Operador</span>
          </DialogTitle>
          <DialogDescription className="break-all font-mono text-xs text-foreground">
            {usuario.email}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto p-4">
          {/* Clonar permisos */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-muted/40 p-2.5 text-xs">
            <span className="font-medium text-foreground">Clonar configuración desde otro usuario:</span>
            <select
              onChange={(e) => {
                if (e.target.value) clonarPermisosDe(e.target.value)
                e.target.value = ''
              }}
              defaultValue=""
              className="rounded-md border border-input bg-card px-2 py-1 text-xs text-foreground"
            >
              <option value="">-- Seleccionar usuario para copiar --</option>
              {usuariosLista
                .filter((u) => u.id !== usuario.id)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.email} ({u.plantilla} - {u.modulos.length} módulos)
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block font-mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Operador del Catálogo Vinculado
            </label>
            <div className="flex gap-2">
              <select
                value={operadorId || ''}
                onChange={(e) => handleSeleccionarOperador(e.target.value)}
                className="flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
              >
                <option value="">-- Sin operador vinculado --</option>
                {operadores.map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.nombre} ({op.area}){!op.activo ? ' - Inactivo' : ''}
                  </option>
                ))}
              </select>
              {opSeleccionado && (
                <button
                  type="button"
                  onClick={aplicarSugerenciaArea}
                  className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs font-bold text-primary hover:bg-sky-100"
                  title={`Aplicar plantilla recomendada (${plantillaRecomendadaPorArea(opSeleccionado.area)})`}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Sugerir plantilla
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block font-mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Plantilla Asignada
              </label>
              <select
                value={plantilla}
                onChange={(e) => handlePlantilla(e.target.value as Rol)}
                className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
              >
                {PLANTILLAS.map((r) => (
                  <option key={r} value={r}>
                    {r.toUpperCase()} — {NOMBRES_PLANTILLAS[r]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 pt-4">
              {personalizado && (
                <span className="rounded border border-amber-200 bg-amber-50 px-2 py-1 font-mono text-[10px] font-bold text-amber-800">
                  MATRIZ PERSONALIZADA
                </span>
              )}
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-3 text-xs">
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Permisos Especiales
            </p>
            <div className="flex flex-wrap gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-foreground">
                <input
                  type="checkbox"
                  checked={esSuperAdmin}
                  onChange={(e) => setEsSuperAdmin(e.target.checked)}
                  className="rounded border-input text-primary"
                />
                <Shield className="h-3.5 w-3.5 text-rose-600" />
                <span className="font-semibold">Super-admin</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-foreground">
                <input
                  type="checkbox"
                  checked={atiendeDocumentosVenta}
                  onChange={(e) => setAtiendeDocumentosVenta(e.target.checked)}
                  className="rounded border-input text-primary"
                />
                <span>Atiende documentos de venta</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-foreground">
                <input
                  type="checkbox"
                  checked={editaHorasExtra}
                  onChange={(e) => setEditaHorasExtra(e.target.checked)}
                  className="rounded border-input text-primary"
                />
                <span>Edita horas extra</span>
              </label>
            </div>
          </div>

          <div>
            <p className="mb-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Módulos Habilitados ({modulos.length})
            </p>
            <MatrizModulos modulos={modulos} onChange={setModulos} />
          </div>

          {error && <p className="font-mono text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter className="border-t border-border px-4 py-3">
          <Button type="button" variant="outline" size="sm" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button type="button" size="sm" disabled={guardando} onClick={guardar}>
            {guardando ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AccionesUsuario({
  usuario,
  onEditar,
  onCambiarActivo,
  onResetearPassword,
  onEliminar,
}: {
  usuario: UsuarioAdmin
  onEditar: () => void
  onCambiarActivo: (uid: string, activo: boolean) => Promise<void>
  onResetearPassword: (uid: string, password?: string) => Promise<void>
  onEliminar: (uid: string) => Promise<void>
}) {
  const confirmar = useConfirmDialog()
  const [mostrarReset, setMostrarReset] = useState(false)
  const [nuevaPassword, setNuevaPassword] = useState('')
  const [errorReset, setErrorReset] = useState<string | null>(null)

  async function confirmarReset() {
    if (nuevaPassword && nuevaPassword.length < 6) {
      setErrorReset('Mínimo 6 caracteres')
      return
    }
    await onResetearPassword(usuario.id, nuevaPassword || undefined)
    setMostrarReset(false)
    setNuevaPassword('')
    setErrorReset(null)
  }

  async function handleEliminar() {
    const aceptado = await confirmar({
      title: 'Eliminar acceso de usuario',
      description: `Se eliminará la cuenta de ${usuario.email} y perderá su acceso permanentemente.`,
      confirmLabel: 'Eliminar acceso',
      variant: 'destructive',
    })
    if (aceptado) await onEliminar(usuario.id)
  }

  async function handleToggleActivo() {
    const activar = !usuario.activo
    const aceptado = await confirmar({
      title: activar ? 'Activar usuario' : 'Desactivar usuario',
      description: activar
        ? `${usuario.email} volverá a tener acceso a SMV Hub.`
        : `${usuario.email} perderá acceso a SMV Hub de inmediato.`,
      confirmLabel: activar ? 'Activar' : 'Desactivar',
      variant: activar ? 'default' : 'destructive',
    })
    if (aceptado) await onCambiarActivo(usuario.id, activar)
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5 font-mono">
      <button
        type="button"
        onClick={onEditar}
        className="flex cursor-pointer items-center gap-1 text-[11px] font-bold text-primary hover:underline"
      >
        <Pencil className="h-3 w-3" />
        Permisos
      </button>
      {usuario.proveedor === 'password' &&
        (mostrarReset ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              autoFocus
              value={nuevaPassword}
              onChange={(e) => setNuevaPassword(e.target.value)}
              placeholder="Temporal..."
              className="w-24 rounded border border-input bg-background px-1.5 py-0.5 text-xs text-foreground"
            />
            <button
              type="button"
              onClick={confirmarReset}
              className="cursor-pointer text-[11px] font-bold text-primary hover:underline"
            >
              OK
            </button>
            <button
              type="button"
              onClick={() => {
                setMostrarReset(false)
                setNuevaPassword('')
                setErrorReset(null)
              }}
              className="cursor-pointer text-[11px] text-muted-foreground hover:underline"
            >
              X
            </button>
            {errorReset && <span className="text-[10px] text-destructive">{errorReset}</span>}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setMostrarReset(true)}
            className="flex cursor-pointer items-center gap-1 text-[11px] font-bold text-primary hover:underline"
          >
            <KeyRound className="h-3 w-3" />
            Password
          </button>
        ))}
      <button
        type="button"
        onClick={handleToggleActivo}
        className={`cursor-pointer rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold ${
          usuario.activo
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-border bg-muted text-muted-foreground'
        }`}
      >
        {usuario.activo ? 'ACTIVO' : 'INACTIVO'}
      </button>
      <button
        type="button"
        onClick={handleEliminar}
        className="flex cursor-pointer items-center gap-1 text-[11px] font-bold text-destructive hover:underline"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  )
}

function VistaMatrizPlantillas({
  usuarios,
  onSeleccionarPlantilla,
}: {
  usuarios: UsuarioAdmin[]
  onSeleccionarPlantilla: (p: Rol) => void
}) {
  const usuariosPorPlantilla = useMemo(() => {
    const conteo: Record<Rol, number> = {
      admin: 0,
      compras: 0,
      diseno: 0,
      almacen: 0,
      automatizacion: 0,
    }
    usuarios.forEach((u) => {
      if (u.plantilla in conteo) conteo[u.plantilla]++
    })
    return conteo
  }, [usuarios])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {PLANTILLAS.map((p) => {
          const modulos = MODULOS_POR_PLANTILLA[p]
          const cantUsuarios = usuariosPorPlantilla[p]
          return (
            <ModuleSurface key={p} className="flex flex-col justify-between p-3.5">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-primary">
                    {p}
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] font-bold text-foreground">
                    {cantUsuarios} cuentas
                  </span>
                </div>
                <h4 className="mt-1 text-xs font-semibold text-foreground">{NOMBRES_PLANTILLAS[p]}</h4>
                <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                  {modulos.length} módulos por defecto
                </p>
              </div>
              <button
                type="button"
                onClick={() => onSeleccionarPlantilla(p)}
                className="mt-3 inline-flex cursor-pointer items-center justify-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted"
              >
                <span>Filtrar usuarios ({cantUsuarios})</span>
              </button>
            </ModuleSurface>
          )
        })}
      </div>

      <ModuleSurface className="p-4">
        <h3 className="mb-3 font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Comparativa de Módulos por Plantilla
        </h3>
        <div className="overflow-x-auto">
          <Table className="text-left text-xs">
            <TableHeader className="border-b border-border bg-muted font-mono text-[11px] text-muted-foreground uppercase">
              <TableRow>
                <TableHead className="px-3 py-2">Grupo / Módulo</TableHead>
                {PLANTILLAS.map((p) => (
                  <TableHead key={p} className="px-3 py-2 text-center">
                    {p}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border">
              {GRUPOS_MODULOS.map((grupo) => (
                <div key={grupo.nombre} className="contents">
                  <TableRow className="bg-muted/40 font-mono text-[10px] font-bold uppercase text-muted-foreground">
                    <TableCell colSpan={6} className="px-3 py-1.5">
                      {grupo.nombre}
                    </TableCell>
                  </TableRow>
                  {grupo.modulos.map((m) => (
                    <TableRow key={m.id} className="hover:bg-muted/30">
                      <TableCell className="px-3 py-1.5 font-medium text-foreground">
                        {m.label}
                      </TableCell>
                      {PLANTILLAS.map((p) => {
                        const tiene = MODULOS_POR_PLANTILLA[p].includes(m.id)
                        return (
                          <TableCell key={p} className="px-3 py-1.5 text-center">
                            {tiene ? (
                              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                                ✓
                              </span>
                            ) : (
                              <span className="text-muted-foreground/40">—</span>
                            )}
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  ))}
                </div>
              ))}
            </TableBody>
          </Table>
        </div>
      </ModuleSurface>
    </div>
  )
}

function UsuariosContent() {
  const {
    usuarios,
    loading,
    error,
    fetchUsuarios,
    crearUsuario,
    actualizarUsuario,
    cambiarActivo,
    resetearPassword,
    eliminarUsuario,
  } = useUsuarios()

  const { operadores } = useOperadores()

  const [tabActual, setTabActual] = useState<'cuentas' | 'plantillas' | 'alta'>('cuentas')
  const [passwordTemporal, setPasswordTemporal] = useState<string | null>(null)
  const [accionError, setAccionError] = useState<string | null>(null)
  const [editando, setEditando] = useState<UsuarioAdmin | null>(null)
  const [operadorPreseleccionado, setOperadorPreseleccionado] = useState<Operador | null>(null)

  // Filtros y Búsqueda
  const [busqueda, setBusqueda] = useState('')
  const [filtroPlantilla, setFiltroPlantilla] = useState<Rol | 'todas'>('todas')
  const [filtroModulo, setFiltroModulo] = useState<ModuloId | 'todos'>('todos')
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'activos' | 'inactivos'>('todos')

  async function handleCrear(input: {
    email: string
    plantilla: Rol
    modulos: ModuloId[]
    esSuperAdmin: boolean
    atiendeDocumentosVenta: boolean
    editaHorasExtra: boolean
    operadorId?: string | null
    operadorNombre?: string | null
    password?: string
  }) {
    const tempPassword = await crearUsuario(input)
    if (tempPassword) setPasswordTemporal(tempPassword)
    setOperadorPreseleccionado(null)
    setTabActual('cuentas')
  }

  async function handleGuardarPermisos(cambios: {
    plantilla: Rol
    modulos: ModuloId[]
    esSuperAdmin: boolean
    atiendeDocumentosVenta: boolean
    editaHorasExtra: boolean
    operadorId: string | null
    operadorNombre: string | null
  }) {
    if (!editando) return
    setAccionError(null)
    await actualizarUsuario(editando.id, cambios)
  }

  async function handleCambiarActivo(uid: string, activo: boolean) {
    setAccionError(null)
    try {
      await cambiarActivo(uid, activo)
      toast.success(activo ? 'Usuario activado' : 'Usuario desactivado')
    } catch (err) {
      console.error('Error cambiando acceso:', err)
      setAccionError(err instanceof Error ? err.message : 'No se pudo cambiar el acceso.')
    }
  }

  async function handleResetPassword(uid: string, password?: string) {
    setAccionError(null)
    try {
      const tempPassword = await resetearPassword(uid, password)
      if (tempPassword) setPasswordTemporal(tempPassword)
      toast.success('Nueva contraseña temporal generada')
    } catch (err) {
      console.error('Error reseteando contraseña:', err)
      setAccionError('No se pudo resetear la contraseña. Intenta de nuevo.')
    }
  }

  async function handleEliminar(uid: string) {
    setAccionError(null)
    try {
      await eliminarUsuario(uid)
      toast.success('Usuario eliminado permanentemente')
    } catch (err) {
      console.error('Error eliminando usuario:', err)
      setAccionError(err instanceof Error ? err.message : 'No se pudo eliminar el usuario.')
    }
  }

  // Métricas
  const totalUsuarios = usuarios.length
  const totalActivos = usuarios.filter((u) => u.activo).length
  const totalSuperAdmins = usuarios.filter((u) => u.esSuperAdmin).length
  const totalCustom = usuarios.filter((u) => esMatrizPersonalizada(u.plantilla, u.modulos)).length
  const totalConOperador = usuarios.filter((u) => u.operadorId).length
  const porcentajeConOperador =
    totalUsuarios > 0 ? Math.round((totalConOperador / totalUsuarios) * 100) : 100

  // Filtrado de la lista de usuarios
  const usuariosFiltrados = useMemo(() => {
    return usuarios.filter((u) => {
      if (filtroEstado === 'activos' && !u.activo) return false
      if (filtroEstado === 'inactivos' && u.activo) return false
      if (filtroPlantilla !== 'todas' && u.plantilla !== filtroPlantilla) return false
      if (filtroModulo !== 'todos' && !u.modulos.includes(filtroModulo)) return false
      if (busqueda.trim()) {
        const q = busqueda.toLowerCase().trim()
        const matchEmail = u.email.toLowerCase().includes(q)
        const matchOperador = u.operadorNombre?.toLowerCase().includes(q)
        return matchEmail || matchOperador
      }
      return true
    })
  }, [usuarios, filtroEstado, filtroPlantilla, filtroModulo, busqueda])

  const todosLosModulos = useMemo(() => {
    const lista: { id: ModuloId; label: string; grupo: string }[] = []
    GRUPOS_MODULOS.forEach((g) => {
      g.modulos.forEach((m) => {
        lista.push({ id: m.id, label: m.label, grupo: g.nombre })
      })
    })
    return lista
  }, [])

  return (
    <PageShell maxWidth="6xl">
      <PageHeader
        title="Usuarios y matriz de permisos"
        badge="Super-admin"
        icon={Shield}
        description="Gestión integral de cuentas, asignación de roles por módulo y vinculación con operadores del catálogo."
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => descargarCSVUsuarios(usuariosFiltrados, operadores)}
            >
              <Download data-icon="inline-start" />
              Exportar CSV
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void exportarExcelUsuarios(usuariosFiltrados, operadores)}
            >
              <FileSpreadsheet data-icon="inline-start" />
              Exportar Excel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => setTabActual('alta')}
            >
              <UserPlus data-icon="inline-start" />
              Nuevo usuario
            </Button>
          </div>
        }
      />

      {passwordTemporal && (
        <BannerPasswordTemporal password={passwordTemporal} onClose={() => setPasswordTemporal(null)} />
      )}

      {(error || accionError) && (
        <div className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
          <div>
            <p className="font-medium text-rose-700">{error || accionError}</p>
            {error && (
              <button
                type="button"
                onClick={() => fetchUsuarios()}
                className="mt-1 cursor-pointer text-xs font-bold text-rose-800 underline hover:text-rose-900"
              >
                Reintentar
              </button>
            )}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        <ModuleSurface className="p-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Total Cuentas
          </p>
          <p className="mt-1 text-xl font-bold text-foreground">{totalUsuarios}</p>
        </ModuleSurface>
        <ModuleSurface className="p-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Usuarios Activos
          </p>
          <p className="mt-1 text-xl font-bold text-emerald-600">{totalActivos}</p>
        </ModuleSurface>
        <ModuleSurface className="p-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Super-Admins
          </p>
          <p className="mt-1 text-xl font-bold text-rose-600">{totalSuperAdmins}</p>
        </ModuleSurface>
        <ModuleSurface className="p-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Matrices Custom
          </p>
          <p className="mt-1 text-xl font-bold text-amber-600">{totalCustom}</p>
        </ModuleSurface>
        <ModuleSurface className="col-span-2 p-3 sm:col-span-1">
          <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Operador Vinculado
          </p>
          <p className="mt-1 text-xl font-bold text-primary">
            {totalConOperador} <span className="text-xs text-muted-foreground">({porcentajeConOperador}%)</span>
          </p>
        </ModuleSurface>
      </div>

      {/* Navegación por pestañas */}
      <ModuleTabs
        value={tabActual}
        onValueChange={(val) => setTabActual(val as 'cuentas' | 'plantillas' | 'alta')}
        items={[
          {
            value: 'cuentas',
            label: (
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                <span>Directorio & Cuentas ({usuariosFiltrados.length})</span>
              </span>
            ),
            content: (
              <div className="space-y-3">
                {/* Barra de Filtros y Búsqueda */}
                <ModuleSurface className="space-y-3 p-3.5">
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-4">
                    {/* Buscador */}
                    <div className="relative">
                      <Search className="absolute top-2.5 left-3 h-3.5 w-3.5 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Buscar correo u operador..."
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        className="w-full rounded-lg border border-input bg-background py-1.5 pr-3 pl-8 text-xs text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>

                    {/* Filtro Plantilla */}
                    <div className="relative">
                      <Layers className="absolute top-2.5 left-3 h-3.5 w-3.5 text-muted-foreground" />
                      <select
                        value={filtroPlantilla}
                        onChange={(e) => setFiltroPlantilla(e.target.value as Rol | 'todas')}
                        className="w-full rounded-lg border border-input bg-background py-1.5 pr-3 pl-8 text-xs text-foreground focus:border-primary focus:outline-none"
                      >
                        <option value="todas">Todas las plantillas</option>
                        {PLANTILLAS.map((p) => (
                          <option key={p} value={p}>
                            {p.toUpperCase()} — {NOMBRES_PLANTILLAS[p]}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Filtro Módulo Específico */}
                    <div className="relative">
                      <SlidersHorizontal className="absolute top-2.5 left-3 h-3.5 w-3.5 text-muted-foreground" />
                      <select
                        value={filtroModulo}
                        onChange={(e) => setFiltroModulo(e.target.value as ModuloId | 'todos')}
                        className="w-full rounded-lg border border-input bg-background py-1.5 pr-3 pl-8 text-xs text-foreground focus:border-primary focus:outline-none"
                      >
                        <option value="todos">Cualquier módulo asignado</option>
                        {todosLosModulos.map((m) => (
                          <option key={m.id} value={m.id}>
                            [{m.grupo}] {m.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Filtro Estado */}
                    <div className="flex items-center justify-end">
                      <ModuleFilterChips
                        ariaLabel="Filtrar por estado"
                        value={filtroEstado}
                        onValueChange={(value) =>
                          setFiltroEstado(value as 'todos' | 'activos' | 'inactivos')
                        }
                        options={[
                          { value: 'todos', label: 'Todos' },
                          { value: 'activos', label: 'Activos' },
                          { value: 'inactivos', label: 'Inactivos' },
                        ]}
                      />
                    </div>
                  </div>

                  {/* Resumen de filtros */}
                  <div className="flex items-center justify-between border-t border-border pt-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span>
                        Mostrando <strong className="text-foreground">{usuariosFiltrados.length}</strong> de{' '}
                        <strong className="text-foreground">{usuarios.length}</strong> usuarios
                      </span>
                      {(filtroPlantilla !== 'todas' || filtroModulo !== 'todos' || filtroEstado !== 'todos' || busqueda) && (
                        <span className="inline-flex items-center gap-1 rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 font-mono text-[11px] text-rose-700">
                          <Filter className="h-3 w-3" /> Filtros aplicados
                        </span>
                      )}
                    </div>
                    {(filtroPlantilla !== 'todas' || filtroModulo !== 'todos' || filtroEstado !== 'todos' || busqueda) && (
                      <button
                        type="button"
                        onClick={() => {
                          setFiltroPlantilla('todas')
                          setFiltroModulo('todos')
                          setFiltroEstado('todos')
                          setBusqueda('')
                        }}
                        className="cursor-pointer text-xs font-medium text-destructive hover:underline"
                      >
                        Limpiar filtros
                      </button>
                    )}
                  </div>
                </ModuleSurface>

                {/* Tabla / Lista de usuarios */}
                <ModuleSurface>
                  {/* Móvil */}
                  <div className="divide-y divide-border md:hidden">
                    {loading ? (
                      <p className="px-4 py-6 text-center font-mono text-xs text-muted-foreground">
                        Cargando usuarios...
                      </p>
                    ) : usuariosFiltrados.length === 0 ? (
                      <ModuleEmptyState
                        icon={User}
                        title="Sin usuarios"
                        description="No hay usuarios que coincidan con la búsqueda o los filtros."
                        className="border-0"
                      />
                    ) : (
                      usuariosFiltrados.map((u) => {
                        const opVinculado = u.operadorId
                          ? operadores.find((o) => o.id === u.operadorId)
                          : null
                        return (
                          <div key={u.id} className="space-y-2 p-3.5 text-xs">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="break-all font-semibold text-foreground">{u.email}</p>
                                {u.operadorNombre ? (
                                  <div className="mt-1 flex items-center gap-1.5">
                                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
                                      <User className="h-3 w-3 text-muted-foreground" />
                                      {u.operadorNombre}
                                      {opVinculado && (
                                        <span className="font-mono text-[9px] uppercase text-muted-foreground">
                                          ({opVinculado.area})
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="font-mono text-[10px] italic text-muted-foreground">
                                    Sin operador
                                  </span>
                                )}
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                {u.esSuperAdmin && (
                                  <span className="rounded border border-rose-200 bg-rose-50 px-1 py-0.5 font-mono text-[9px] font-bold text-rose-700">
                                    SA
                                  </span>
                                )}
                                {esMatrizPersonalizada(u.plantilla, u.modulos) && (
                                  <span className="rounded border border-amber-200 bg-amber-50 px-1 py-0.5 font-mono text-[9px] font-bold text-amber-800">
                                    CUSTOM
                                  </span>
                                )}
                              </div>
                            </div>
                            <p className="font-mono text-[11px] text-muted-foreground">
                              Plantilla: {u.plantilla} · {u.proveedor} · {u.modulos.length} módulos
                            </p>
                            <AccionesUsuario
                              usuario={u}
                              onEditar={() => setEditando(u)}
                              onCambiarActivo={handleCambiarActivo}
                              onResetearPassword={handleResetPassword}
                              onEliminar={handleEliminar}
                            />
                          </div>
                        )
                      })
                    )}
                  </div>

                  {/* Escritorio */}
                  <div className="hidden md:block">
                    <Table className="text-left text-xs">
                      <TableHeader className="border-b border-border bg-muted font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
                        <TableRow>
                          <TableHead className="px-3.5 py-2.5">Correo</TableHead>
                          <TableHead className="px-3.5 py-2.5">Operador Vinculado</TableHead>
                          <TableHead className="px-3.5 py-2.5">Plantilla</TableHead>
                          <TableHead className="px-3.5 py-2.5">Módulos</TableHead>
                          <TableHead className="px-3.5 py-2.5">Proveedor</TableHead>
                          <TableHead className="px-3.5 py-2.5 text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="divide-y divide-border">
                        {loading ? (
                          <TableRow>
                            <TableCell
                              colSpan={6}
                              className="px-4 py-6 text-center font-mono text-xs text-muted-foreground"
                            >
                              Cargando usuarios...
                            </TableCell>
                          </TableRow>
                        ) : usuariosFiltrados.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="p-0">
                              <ModuleEmptyState
                                icon={User}
                                title="Sin usuarios"
                                description="Sin usuarios registrados o que coincidan con los filtros."
                                className="border-0"
                              />
                            </TableCell>
                          </TableRow>
                        ) : (
                          usuariosFiltrados.map((u) => {
                            const opVinculado = u.operadorId
                              ? operadores.find((o) => o.id === u.operadorId)
                              : null
                            return (
                              <ContextMenu key={u.id}>
                                <ContextMenuTrigger asChild>
                                  <TableRow className="cursor-pointer border-b border-border text-xs select-none hover:bg-muted/50">
                                    <TableCell className="px-3.5 py-2.5 font-semibold text-foreground">
                                      <div className="flex items-center gap-1.5">
                                        {u.email}
                                        {u.esSuperAdmin && (
                                          <span className="rounded border border-rose-200 bg-rose-50 px-1 py-0.5 font-mono text-[9px] font-bold text-rose-700">
                                            SA
                                          </span>
                                        )}
                                        {esMatrizPersonalizada(u.plantilla, u.modulos) && (
                                          <span className="rounded border border-amber-200 bg-amber-50 px-1 py-0.5 font-mono text-[9px] font-bold text-amber-800">
                                            CUSTOM
                                          </span>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell className="px-3.5 py-2.5">
                                      {u.operadorNombre ? (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                                          <User className="h-3 w-3 text-muted-foreground" />
                                          {u.operadorNombre}
                                          {opVinculado && (
                                            <span className="font-mono text-[10px] uppercase text-muted-foreground">
                                              ({opVinculado.area})
                                            </span>
                                          )}
                                        </span>
                                      ) : (
                                        <span className="font-mono text-[11px] italic text-muted-foreground">
                                          Sin operador
                                        </span>
                                      )}
                                    </TableCell>
                                    <TableCell className="px-3.5 py-2.5 font-mono">{u.plantilla}</TableCell>
                                    <TableCell className="px-3.5 py-2.5 font-mono text-muted-foreground">
                                      {u.modulos.length}
                                    </TableCell>
                                    <TableCell className="px-3.5 py-2.5 font-mono text-[11px] text-muted-foreground">
                                      {u.proveedor}
                                    </TableCell>
                                    <TableCell
                                      className="px-3.5 py-2.5"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <div className="flex justify-end">
                                        <AccionesUsuario
                                          usuario={u}
                                          onEditar={() => setEditando(u)}
                                          onCambiarActivo={handleCambiarActivo}
                                          onResetearPassword={handleResetPassword}
                                          onEliminar={handleEliminar}
                                        />
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                </ContextMenuTrigger>

                                <ContextMenuContent className="w-56">
                                  <ContextMenuItem onClick={() => setEditando(u)}>
                                    <Pencil className="text-primary" />
                                    <span>Editar permisos</span>
                                    <ContextMenuShortcut>↵</ContextMenuShortcut>
                                  </ContextMenuItem>

                                  <ContextMenuItem
                                    onClick={() => void handleCambiarActivo(u.id, !u.activo)}
                                  >
                                    {u.activo ? (
                                      <>
                                        <UserX className="text-amber-600" />
                                        <span>Desactivar cuenta</span>
                                      </>
                                    ) : (
                                      <>
                                        <UserCheck className="text-emerald-600" />
                                        <span>Activar cuenta</span>
                                      </>
                                    )}
                                  </ContextMenuItem>

                                  <ContextMenuItem onClick={() => void handleResetPassword(u.id)}>
                                    <KeyRound className="text-sky-600" />
                                    <span>Generar contraseña temporal</span>
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
                                          void copiarAlPortapapeles(u.email, 'Correo copiado')
                                        }}
                                      >
                                        <span>Correo ({u.email})</span>
                                      </ContextMenuItem>
                                      <ContextMenuItem
                                        onClick={() => {
                                          void copiarAlPortapapeles(u.id, 'UID copiado')
                                        }}
                                      >
                                        <span>UID ({u.id})</span>
                                      </ContextMenuItem>
                                      <ContextMenuItem
                                        onClick={() => {
                                          void copiarAlPortapapeles(u.plantilla, 'Plantilla copiada')
                                        }}
                                      >
                                        <span>Plantilla ({u.plantilla})</span>
                                      </ContextMenuItem>
                                      {u.operadorNombre && (
                                        <ContextMenuItem
                                          onClick={() => {
                                            void copiarAlPortapapeles(
                                              u.operadorNombre || '',
                                              'Operador copiado'
                                            )
                                          }}
                                        >
                                          <span>Operador ({u.operadorNombre})</span>
                                        </ContextMenuItem>
                                      )}
                                    </ContextMenuSubContent>
                                  </ContextMenuSub>

                                  <ContextMenuSeparator />

                                  <ContextMenuItem
                                    variant="destructive"
                                    onClick={() => void handleEliminar(u.id)}
                                  >
                                    <Trash2 />
                                    <span>Eliminar usuario</span>
                                  </ContextMenuItem>
                                </ContextMenuContent>
                              </ContextMenu>
                            )
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </ModuleSurface>
              </div>
            ),
          },
          {
            value: 'plantillas',
            label: (
              <span className="inline-flex items-center gap-1.5">
                <Layers className="h-4 w-4" />
                <span>Matriz de Plantillas</span>
              </span>
            ),
            content: (
              <VistaMatrizPlantillas
                usuarios={usuarios}
                onSeleccionarPlantilla={(p) => {
                  setFiltroPlantilla(p)
                  setTabActual('cuentas')
                }}
              />
            ),
          },
          {
            value: 'alta',
            label: (
              <span className="inline-flex items-center gap-1.5">
                <UserPlus className="h-4 w-4" />
                <span>Asignación & Nuevo Usuario</span>
              </span>
            ),
            content: (
              <div className="space-y-4">
                <TarjetaCoberturaOperadores
                  operadores={operadores}
                  usuarios={usuarios}
                  onSeleccionarParaCrear={(op) => {
                    setOperadorPreseleccionado(op)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                />

                <FormNuevoUsuario
                  operadores={operadores}
                  operadorPreseleccionado={operadorPreseleccionado}
                  onCrear={handleCrear}
                />
              </div>
            ),
          },
        ]}
      />

      {editando && (
        <ModalEditarPermisos
          usuario={editando}
          usuariosLista={usuarios}
          operadores={operadores}
          onGuardar={handleGuardarPermisos}
          onCerrar={() => setEditando(null)}
        />
      )}
    </PageShell>
  )
}

export default function UsuariosPage() {
  return (
    <AuthGuard>
      <UsuariosContent />
    </AuthGuard>
  )
}
