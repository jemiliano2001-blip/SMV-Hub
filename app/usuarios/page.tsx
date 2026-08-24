'use client'

import { useState, useEffect } from 'react'
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
} from 'lucide-react'
import { toast } from 'sonner'
import AuthGuard from '../AuthGuard'
import ModuleEmptyState from '@/components/layout/ModuleEmptyState'
import ModuleFilterChips from '@/components/layout/ModuleFilterChips'
import ModuleSurface from '@/components/layout/ModuleSurface'
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
  esMatrizPersonalizada,
  modulosDePlantilla,
} from '@/lib/roles'
import { useConfirmDialog } from '@/components/ConfirmDialogProvider'

const PLANTILLAS: Rol[] = ['admin', 'compras', 'diseno', 'almacen', 'automatizacion']

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
  }

  return (
    <ModuleSurface className="border-sky-200 bg-sky-50 p-4">
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
          className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {copiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copiado ? 'Copiada' : 'Copiar'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-2 py-1.5 text-xs text-muted-foreground hover:underline"
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

  return (
    <div className="max-h-64 space-y-3 overflow-y-auto rounded-lg border border-border bg-muted/40 p-3">
      {GRUPOS_MODULOS.map((grupo) => (
        <div key={grupo.nombre}>
          <p className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {grupo.nombre}
          </p>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {grupo.modulos.map((m) => (
              <label
                key={m.id}
                className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs text-foreground hover:bg-card"
              >
                <input
                  type="checkbox"
                  checked={set.has(m.id)}
                  onChange={() => toggle(m.id)}
                  className="rounded border-input text-primary focus:ring-ring"
                />
                {m.label}
              </label>
            ))}
          </div>
        </div>
      ))}
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
  const [expandido, setExpandido] = useState(false)
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
            className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 transition-colors hover:bg-amber-100"
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
            Operadores sin cuenta de usuario en SMV Hub:
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
                    className="ml-1 flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
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

  // TODO(usuarios): esto sincroniza el formulario desde un prop; lo correcto es
  // estado derivado o remontar el form con `key={operadorPreseleccionado?.id}`.
  // Se suprime en vez de refactorizar porque toca el alta con permisos de
  // super-admin y no hay tests que cubran ese flujo; va en su propio cambio.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (operadorPreseleccionado) {
      setOperadorId(operadorPreseleccionado.id)
      setOperadorNombre(operadorPreseleccionado.nombre)
      const rec = plantillaRecomendadaPorArea(operadorPreseleccionado.area)
      setPlantilla(rec)
      setModulos(modulosDePlantilla(rec))
      if (rec === 'admin') setEsSuperAdmin(true)
    }
    /* eslint-enable react-hooks/set-state-in-effect */
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
      if (rec === 'admin') setEsSuperAdmin(true)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password && password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    setEnviando(true)
    setError(null)
    try {
      await onCrear({
        email,
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
      setPlantilla('compras')
      setModulos(modulosDePlantilla('compras'))
      setEsSuperAdmin(false)
      setAtiendeDocumentosVenta(false)
      setEditaHorasExtra(false)
      setOperadorId(null)
      setOperadorNombre(null)
      setPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el usuario')
    } finally {
      setEnviando(false)
    }
  }

  const personalizado = esMatrizPersonalizada(plantilla, modulos)
  const opSeleccionado = operadores.find((o) => o.id === operadorId)

  return (
    <ModuleSurface>
      <form onSubmit={handleSubmit} className="space-y-3 p-4">
      <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
        <span className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
          Nuevo usuario y vinculación
        </span>
        {opSeleccionado && (
          <span className="flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 font-mono text-[11px] font-bold text-primary">
            <Sparkles className="h-3 w-3" />
            Plantilla sugerida ({plantillaRecomendadaPorArea(opSeleccionado.area)}) por área {opSeleccionado.area}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
          <label className="mb-1 block font-mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Correo Electrónico
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="persona@gmail.com"
            className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
          />
        </div>

        <div className="min-w-[200px] flex-1">
          <label className="mb-1 block font-mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Operador del Catálogo
          </label>
          <select
            value={operadorId || ''}
            onChange={(e) => handleSeleccionarOperador(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
          >
            <option value="">-- Sin operador (externo / administrativo) --</option>
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
            Plantilla
          </label>
          <select
            value={plantilla}
            onChange={(e) => handlePlantilla(e.target.value as Rol)}
            className="rounded-lg border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
          >
            {PLANTILLAS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-[160px]">
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

        <button
          type="submit"
          disabled={enviando}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50"
        >
          <UserPlus className="h-3.5 w-3.5" />
          {enviando ? 'Creando...' : 'Crear usuario'}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground">
          <input
            type="checkbox"
            checked={esSuperAdmin}
            onChange={(e) => setEsSuperAdmin(e.target.checked)}
            className="rounded border-input text-primary"
          />
          <Shield className="h-3.5 w-3.5 text-rose-600" />
          Super-admin (puede editar usuarios)
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground">
          <input
            type="checkbox"
            checked={atiendeDocumentosVenta}
            onChange={(e) => setAtiendeDocumentosVenta(e.target.checked)}
            className="rounded border-input text-primary"
          />
          Atiende documentos de venta (cola remisión/factura)
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground">
          <input
            type="checkbox"
            checked={editaHorasExtra}
            onChange={(e) => setEditaHorasExtra(e.target.checked)}
            className="rounded border-input text-primary"
          />
          Edita horas extra (además de admin/compras)
        </label>
        {personalizado && (
          <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-800">
            PERSONALIZADO
          </span>
        )}
      </div>

      <div>
        <p className="mb-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Módulos
        </p>
        <MatrizModulos modulos={modulos} onChange={setModulos} />
      </div>

      {error && <p className="font-mono text-xs text-destructive">{error}</p>}
      </form>
    </ModuleSurface>
  )
}

function ModalEditarPermisos({
  usuario,
  operadores,
  onGuardar,
  onCerrar,
}: {
  usuario: UsuarioAdmin
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
    }
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
      <DialogContent className="flex max-h-[90vh] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border px-4 py-3">
          <DialogTitle>Editar permisos y operador</DialogTitle>
          <DialogDescription className="break-all">{usuario.email}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 overflow-y-auto p-4">

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
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs font-bold text-primary hover:bg-sky-100"
                title={`Aplicar plantilla recomendada (${plantillaRecomendadaPorArea(opSeleccionado.area)})`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Sugerir plantilla
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="mb-1 block font-mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Plantilla
            </label>
            <select
              value={plantilla}
              onChange={(e) => handlePlantilla(e.target.value as Rol)}
              className="rounded-lg border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
            >
              {PLANTILLAS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <label className="mt-4 flex cursor-pointer items-center gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              checked={esSuperAdmin}
              onChange={(e) => setEsSuperAdmin(e.target.checked)}
              className="rounded border-input text-primary"
            />
            <Shield className="h-3.5 w-3.5 text-rose-600" />
            Super-admin
          </label>
          <label className="mt-4 flex cursor-pointer items-center gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              checked={atiendeDocumentosVenta}
              onChange={(e) => setAtiendeDocumentosVenta(e.target.checked)}
              className="rounded border-input text-primary"
            />
            Atiende documentos de venta
          </label>
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              checked={editaHorasExtra}
              onChange={(e) => setEditaHorasExtra(e.target.checked)}
              className="rounded border-input text-primary"
            />
            Edita horas extra (además de admin/compras)
          </label>
          {personalizado && (
            <span className="mt-4 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-800">
              PERSONALIZADO
            </span>
          )}
        </div>

        <MatrizModulos modulos={modulos} onChange={setModulos} />

        {error && <p className="font-mono text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter className="border-t border-border px-4 py-3">
          <Button type="button" variant="outline" size="sm" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button type="button" size="sm" disabled={guardando} onClick={guardar}>
            {guardando ? 'Guardando...' : 'Guardar'}
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
      description: `Se eliminará a ${usuario.email} y perderá su acceso permanentemente.`,
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
    <div className="flex flex-wrap items-center gap-3 font-mono">
      <button
        type="button"
        onClick={onEditar}
        className="flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
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
              className="w-28 rounded border border-input bg-background px-2 py-1 text-xs text-foreground"
            />
            <button
              type="button"
              onClick={confirmarReset}
              className="text-[11px] font-bold text-primary hover:underline"
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
              className="text-[11px] text-muted-foreground hover:underline"
            >
              X
            </button>
            {errorReset && <span className="text-[10px] text-destructive">{errorReset}</span>}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setMostrarReset(true)}
            className="flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
          >
            <KeyRound className="h-3 w-3" />
            Password
          </button>
        ))}
      <button
        type="button"
        onClick={handleToggleActivo}
        className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold ${
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
        className="flex items-center gap-1 text-[11px] font-bold text-destructive hover:underline"
      >
        <Trash2 className="h-3 w-3" />
        Eliminar
      </button>
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

  const [passwordTemporal, setPasswordTemporal] = useState<string | null>(null)
  const [accionError, setAccionError] = useState<string | null>(null)
  const [editando, setEditando] = useState<UsuarioAdmin | null>(null)
  const [operadorPreseleccionado, setOperadorPreseleccionado] = useState<Operador | null>(null)

  // Filtros y Búsqueda (Mejora B)
  const [busqueda, setBusqueda] = useState('')
  const [filtroPlantilla, setFiltroPlantilla] = useState<Rol | 'todas'>('todas')
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
    } catch (err) {
      console.error('Error reseteando contraseña:', err)
      setAccionError('No se pudo resetear la contraseña. Intenta de nuevo.')
    }
  }

  async function handleEliminar(uid: string) {
    setAccionError(null)
    try {
      await eliminarUsuario(uid)
    } catch (err) {
      console.error('Error eliminando usuario:', err)
      setAccionError(err instanceof Error ? err.message : 'No se pudo eliminar el usuario.')
    }
  }

  // Filtrado de la lista de usuarios
  const usuariosFiltrados = usuarios.filter((u) => {
    if (filtroEstado === 'activos' && !u.activo) return false
    if (filtroEstado === 'inactivos' && u.activo) return false
    if (filtroPlantilla !== 'todas' && u.plantilla !== filtroPlantilla) return false
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase().trim()
      const matchEmail = u.email.toLowerCase().includes(q)
      const matchOperador = u.operadorNombre?.toLowerCase().includes(q)
      return matchEmail || matchOperador
    }
    return true
  })

  return (
    <PageShell maxWidth="6xl">
        <PageHeader
          title="Usuarios y matriz de permisos"
          badge="Super-admin"
          icon={Shield}
          description="Asigna módulos por persona y vincula su cuenta con un operador del catálogo maestro."
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
                  className="mt-1 text-xs font-bold text-rose-800 underline hover:text-rose-900"
                >
                  Reintentar
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tarjeta de Cobertura de Operadores */}
        <TarjetaCoberturaOperadores
          operadores={operadores}
          usuarios={usuarios}
          onSeleccionarParaCrear={(op) => {
            setOperadorPreseleccionado(op)
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
        />

        {/* Formulario Nuevo Usuario */}
        <FormNuevoUsuario
          operadores={operadores}
          operadorPreseleccionado={operadorPreseleccionado}
          onCrear={handleCrear}
        />

        {/* Barra de Filtros y Búsqueda */}
        <ModuleSurface className="flex flex-wrap items-center justify-between gap-3 p-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por correo u operador..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full rounded-lg border border-input bg-background py-1.5 pr-3 pl-8 text-xs text-foreground focus:border-primary focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-mono text-[11px]">Plantilla:</span>
              <select
                value={filtroPlantilla}
                onChange={(e) => setFiltroPlantilla(e.target.value as Rol | 'todas')}
                className="rounded-lg border border-input bg-background px-2 py-1 text-xs text-foreground"
              >
                <option value="todas">Todas</option>
                {PLANTILLAS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

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
        </ModuleSurface>

        {/* Tabla / Lista de usuarios */}
        <ModuleSurface>
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
                const opVinculado = u.operadorId ? operadores.find((o) => o.id === u.operadorId) : null
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
                            <TableCell className="px-3.5 py-2.5" onClick={(e) => e.stopPropagation()}>
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

                          <ContextMenuItem onClick={() => void handleCambiarActivo(u.id, !u.activo)}>
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
                                  void navigator.clipboard.writeText(u.email)
                                  toast.success('Correo copiado')
                                }}
                              >
                                <span>Correo ({u.email})</span>
                              </ContextMenuItem>
                              <ContextMenuItem
                                onClick={() => {
                                  void navigator.clipboard.writeText(u.id)
                                  toast.success('UID copiado')
                                }}
                              >
                                <span>UID ({u.id})</span>
                              </ContextMenuItem>
                              <ContextMenuItem
                                onClick={() => {
                                  void navigator.clipboard.writeText(u.plantilla)
                                  toast.success('Plantilla copiada')
                                }}
                              >
                                <span>Plantilla ({u.plantilla})</span>
                              </ContextMenuItem>
                              {u.operadorNombre && (
                                <ContextMenuItem
                                  onClick={() => {
                                    void navigator.clipboard.writeText(u.operadorNombre || '')
                                    toast.success('Operador copiado')
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

      {editando && (
        <ModalEditarPermisos
          usuario={editando}
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
