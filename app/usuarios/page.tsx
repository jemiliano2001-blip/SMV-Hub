/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · tone: utilitario · scope: usuarios */
'use client'

import { useState } from 'react'
import { UserPlus, Copy, Check, AlertCircle, Trash2, KeyRound, Shield, Pencil } from 'lucide-react'
import AuthGuard from '../AuthGuard'
import { useUsuarios, type UsuarioAdmin } from '@/lib/hooks/useUsuarios'
import type { ModuloId, Rol } from '@/lib/schemas'
import {
  GRUPOS_MODULOS,
  esMatrizPersonalizada,
  modulosDePlantilla,
} from '@/lib/roles'
import { useConfirmDialog } from '@/components/ConfirmDialogProvider'

const PLANTILLAS: Rol[] = ['admin', 'compras', 'diseno', 'almacen', 'automatizacion']

function BannerPasswordTemporal({ password, onClose }: { password: string; onClose: () => void }) {
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    await navigator.clipboard.writeText(password)
    setCopiado(true)
  }

  return (
    <div className="p-4 bg-sky-50 rounded-xl border border-sky-200">
      <p className="text-xs font-mono font-bold text-[#0369A1] uppercase tracking-wider mb-2">
        Contraseña temporal — cópiala ahora (no se vuelve a mostrar):
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 bg-white px-3 py-1.5 rounded-lg border border-sky-300 text-xs font-mono font-bold text-slate-900">
          {password}
        </code>
        <button
          onClick={copiar}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0369A1] hover:bg-[#0284C7] text-white text-xs font-bold transition-colors"
        >
          {copiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copiado ? 'Copiada' : 'Copiar'}
        </button>
        <button onClick={onClose} className="px-2 py-1.5 text-xs text-slate-500 hover:underline">
          Cerrar
        </button>
      </div>
    </div>
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
    <div className="space-y-3 max-h-64 overflow-y-auto border border-slate-200 rounded-lg p-3 bg-slate-50">
      {GRUPOS_MODULOS.map((grupo) => (
        <div key={grupo.nombre}>
          <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 mb-1.5">
            {grupo.nombre}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {grupo.modulos.map((m) => (
              <label
                key={m.id}
                className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer hover:bg-white rounded px-1.5 py-1"
              >
                <input
                  type="checkbox"
                  checked={set.has(m.id)}
                  onChange={() => toggle(m.id)}
                  className="rounded border-slate-300 text-[#0369A1] focus:ring-[#0369A1]"
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

function FormNuevoUsuario({
  onCrear,
}: {
  onCrear: (input: {
    email: string
    plantilla: Rol
    modulos: ModuloId[]
    esSuperAdmin: boolean
    atiendeDocumentosVenta: boolean
    editaHorasExtra: boolean
    password?: string
  }) => Promise<void>
}) {
  const [email, setEmail] = useState('')
  const [plantilla, setPlantilla] = useState<Rol>('compras')
  const [modulos, setModulos] = useState<ModuloId[]>(() => modulosDePlantilla('compras'))
  const [esSuperAdmin, setEsSuperAdmin] = useState(false)
  const [atiendeDocumentosVenta, setAtiendeDocumentosVenta] = useState(false)
  const [editaHorasExtra, setEditaHorasExtra] = useState(false)
  const [password, setPassword] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handlePlantilla(p: Rol) {
    setPlantilla(p)
    setModulos(modulosDePlantilla(p))
    if (p === 'admin') setEsSuperAdmin(true)
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
        password: password || undefined,
      })
      setEmail('')
      setPlantilla('compras')
      setModulos(modulosDePlantilla('compras'))
      setEsSuperAdmin(false)
      setAtiendeDocumentosVenta(false)
      setEditaHorasExtra(false)
      setPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el usuario')
    } finally {
      setEnviando(false)
    }
  }

  const personalizado = esMatrizPersonalizada(plantilla, modulos)

  return (
    <form
      onSubmit={handleSubmit}
      className="p-4 bg-white rounded-xl border border-slate-200 space-y-3 shadow-xs"
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[220px]">
          <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500 mb-1">
            Correo Electrónico
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="persona@gmail.com"
            className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-[#0369A1]"
          />
        </div>
        <div>
          <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500 mb-1">
            Plantilla
          </label>
          <select
            value={plantilla}
            onChange={(e) => handlePlantilla(e.target.value as Rol)}
            className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white text-slate-900 focus:outline-none focus:border-[#0369A1]"
          >
            {PLANTILLAS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[180px]">
          <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500 mb-1">
            Contraseña (Opcional)
          </label>
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="En blanco = temporal"
            className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-[#0369A1]"
          />
        </div>
        <button
          type="submit"
          disabled={enviando}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#0369A1] hover:bg-[#0284C7] text-white text-xs font-bold disabled:opacity-50 transition-colors active:scale-[0.98]"
        >
          <UserPlus className="h-3.5 w-3.5" />
          {enviando ? 'Creando...' : 'Crear usuario'}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
          <input
            type="checkbox"
            checked={esSuperAdmin}
            onChange={(e) => setEsSuperAdmin(e.target.checked)}
            className="rounded border-slate-300 text-[#0369A1]"
          />
          <Shield className="h-3.5 w-3.5 text-rose-600" />
          Super-admin (puede editar usuarios)
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
          <input
            type="checkbox"
            checked={atiendeDocumentosVenta}
            onChange={(e) => setAtiendeDocumentosVenta(e.target.checked)}
            className="rounded border-slate-300 text-[#0369A1]"
          />
          Atiende documentos de venta (cola remisión/factura)
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
          <input
            type="checkbox"
            checked={editaHorasExtra}
            onChange={(e) => setEditaHorasExtra(e.target.checked)}
            className="rounded border-slate-300 text-[#0369A1]"
          />
          Edita horas extra (además de admin/compras)
        </label>
        {personalizado && (
          <span className="text-[10px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded">
            PERSONALIZADO
          </span>
        )}
      </div>

      <div>
        <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500 mb-1.5">
          Módulos
        </p>
        <MatrizModulos modulos={modulos} onChange={setModulos} />
      </div>

      {error && <p className="text-xs font-mono text-rose-600">{error}</p>}
    </form>
  )
}

function ModalEditarPermisos({
  usuario,
  onGuardar,
  onCerrar,
}: {
  usuario: UsuarioAdmin
  onGuardar: (cambios: {
    plantilla: Rol
    modulos: ModuloId[]
    esSuperAdmin: boolean
    atiendeDocumentosVenta: boolean
    editaHorasExtra: boolean
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
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handlePlantilla(p: Rol) {
    setPlantilla(p)
    setModulos(modulosDePlantilla(p))
    if (p === 'admin') setEsSuperAdmin(true)
  }

  async function guardar() {
    setGuardando(true)
    setError(null)
    try {
      await onGuardar({ plantilla, modulos, esSuperAdmin, atiendeDocumentosVenta, editaHorasExtra })
      onCerrar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }

  const personalizado = esMatrizPersonalizada(plantilla, modulos)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl border border-slate-200 shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Editar permisos</h2>
            <p className="text-xs text-slate-500 break-all">{usuario.email}</p>
          </div>
          <button onClick={onCerrar} className="text-xs text-slate-500 hover:underline">
            Cerrar
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500 mb-1">
              Plantilla
            </label>
            <select
              value={plantilla}
              onChange={(e) => handlePlantilla(e.target.value as Rol)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
            >
              {PLANTILLAS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer mt-4">
            <input
              type="checkbox"
              checked={esSuperAdmin}
              onChange={(e) => setEsSuperAdmin(e.target.checked)}
              className="rounded border-slate-300 text-[#0369A1]"
            />
            <Shield className="h-3.5 w-3.5 text-rose-600" />
            Super-admin
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer mt-4">
            <input
              type="checkbox"
              checked={atiendeDocumentosVenta}
              onChange={(e) => setAtiendeDocumentosVenta(e.target.checked)}
              className="rounded border-slate-300 text-[#0369A1]"
            />
            Atiende documentos de venta
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer mt-2">
            <input
              type="checkbox"
              checked={editaHorasExtra}
              onChange={(e) => setEditaHorasExtra(e.target.checked)}
              className="rounded border-slate-300 text-[#0369A1]"
            />
            Edita horas extra (además de admin/compras)
          </label>
          {personalizado && (
            <span className="mt-4 text-[10px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded">
              PERSONALIZADO
            </span>
          )}
        </div>

        <MatrizModulos modulos={modulos} onChange={setModulos} />

        {error && <p className="text-xs font-mono text-rose-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCerrar}
            className="px-3 py-1.5 text-xs text-slate-600 hover:underline"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={guardando}
            onClick={guardar}
            className="px-3.5 py-1.5 rounded-lg bg-[#0369A1] text-white text-xs font-bold disabled:opacity-50"
          >
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
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
        onClick={onEditar}
        className="flex items-center gap-1 text-[11px] font-bold text-[#0369A1] hover:underline"
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
              className="w-28 px-2 py-1 text-xs rounded border border-slate-300"
            />
            <button onClick={confirmarReset} className="text-[11px] font-bold text-[#0369A1] hover:underline">
              OK
            </button>
            <button
              onClick={() => {
                setMostrarReset(false)
                setNuevaPassword('')
                setErrorReset(null)
              }}
              className="text-[11px] text-slate-400 hover:underline"
            >
              X
            </button>
            {errorReset && <span className="text-[10px] text-rose-600">{errorReset}</span>}
          </div>
        ) : (
          <button
            onClick={() => setMostrarReset(true)}
            className="flex items-center gap-1 text-[11px] font-bold text-[#0369A1] hover:underline"
          >
            <KeyRound className="h-3 w-3" />
            Password
          </button>
        ))}
      <button
        onClick={handleToggleActivo}
        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
          usuario.activo
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : 'bg-slate-100 text-slate-500 border-slate-200'
        }`}
      >
        {usuario.activo ? 'ACTIVO' : 'INACTIVO'}
      </button>
      <button
        onClick={handleEliminar}
        className="flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:underline"
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
  const [passwordTemporal, setPasswordTemporal] = useState<string | null>(null)
  const [accionError, setAccionError] = useState<string | null>(null)
  const [editando, setEditando] = useState<UsuarioAdmin | null>(null)

  async function handleCrear(input: {
    email: string
    plantilla: Rol
    modulos: ModuloId[]
    esSuperAdmin: boolean
    atiendeDocumentosVenta: boolean
    editaHorasExtra: boolean
    password?: string
  }) {
    const tempPassword = await crearUsuario(input)
    if (tempPassword) setPasswordTemporal(tempPassword)
  }

  async function handleGuardarPermisos(cambios: {
    plantilla: Rol
    modulos: ModuloId[]
    esSuperAdmin: boolean
    atiendeDocumentosVenta: boolean
    editaHorasExtra: boolean
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

  return (
    <main className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex-1 space-y-4">
        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-slate-900 tracking-tight">Usuarios y Matriz de Permisos</h1>
            <span className="text-[10px] font-mono font-bold bg-rose-50 text-rose-800 border border-rose-200 px-1.5 py-0.5 rounded">
              Super-admin
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Asigna módulos por persona. Las plantillas solo rellenan los checkboxes.
          </p>
        </div>

        {passwordTemporal && (
          <BannerPasswordTemporal password={passwordTemporal} onClose={() => setPasswordTemporal(null)} />
        )}

        {(error || accionError) && (
          <div className="p-3 bg-rose-50 rounded-lg flex items-start gap-2.5 border border-rose-200 text-xs">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-rose-700 font-medium">{error || accionError}</p>
              {error && (
                <button
                  onClick={() => fetchUsuarios()}
                  className="mt-1 text-xs font-bold text-rose-800 underline hover:text-rose-900"
                >
                  Reintentar
                </button>
              )}
            </div>
          </div>
        )}

        <FormNuevoUsuario onCrear={handleCrear} />

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="md:hidden divide-y divide-slate-100">
            {loading ? (
              <p className="px-4 py-6 text-center text-xs font-mono text-slate-500">Cargando usuarios...</p>
            ) : usuarios.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs font-mono text-slate-500">Sin usuarios registrados.</p>
            ) : (
              usuarios.map((u) => (
                <div key={u.id} className="p-3.5 space-y-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-slate-900 break-all">{u.email}</p>
                    <div className="flex items-center gap-1 shrink-0">
                      {u.esSuperAdmin && (
                        <span className="text-[9px] font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200 px-1 py-0.5 rounded">
                          SA
                        </span>
                      )}
                      {esMatrizPersonalizada(u.plantilla, u.modulos) && (
                        <span className="text-[9px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200 px-1 py-0.5 rounded">
                          CUSTOM
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-slate-500 font-mono text-[11px]">
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
              ))
            )}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-xs text-left whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-600 font-mono text-[11px] uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-3.5 py-2.5">Correo</th>
                  <th className="px-3.5 py-2.5">Plantilla</th>
                  <th className="px-3.5 py-2.5">Módulos</th>
                  <th className="px-3.5 py-2.5">Proveedor</th>
                  <th className="px-3.5 py-2.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-xs font-mono text-slate-500">
                      Cargando usuarios...
                    </td>
                  </tr>
                ) : usuarios.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-xs font-mono text-slate-500">
                      Sin usuarios registrados.
                    </td>
                  </tr>
                ) : (
                  usuarios.map((u) => (
                    <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50 text-xs">
                      <td className="px-3.5 py-2.5 font-semibold text-slate-900">
                        <div className="flex items-center gap-1.5">
                          {u.email}
                          {u.esSuperAdmin && (
                            <span className="text-[9px] font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200 px-1 py-0.5 rounded">
                              SA
                            </span>
                          )}
                          {esMatrizPersonalizada(u.plantilla, u.modulos) && (
                            <span className="text-[9px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200 px-1 py-0.5 rounded">
                              CUSTOM
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5 font-mono">{u.plantilla}</td>
                      <td className="px-3.5 py-2.5 text-slate-500 font-mono">{u.modulos.length}</td>
                      <td className="px-3.5 py-2.5 text-slate-500 font-mono text-[11px]">{u.proveedor}</td>
                      <td className="px-3.5 py-2.5">
                        <div className="flex justify-end">
                          <AccionesUsuario
                            usuario={u}
                            onEditar={() => setEditando(u)}
                            onCambiarActivo={handleCambiarActivo}
                            onResetearPassword={handleResetPassword}
                            onEliminar={handleEliminar}
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {editando && (
        <ModalEditarPermisos
          usuario={editando}
          onGuardar={handleGuardarPermisos}
          onCerrar={() => setEditando(null)}
        />
      )}
    </main>
  )
}

export default function UsuariosPage() {
  return (
    <AuthGuard>
      <UsuariosContent />
    </AuthGuard>
  )
}
