/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · tone: utilitario · scope: usuarios */
'use client'

import { useState } from 'react'
import { UserPlus, Copy, Check, AlertCircle, Trash2, KeyRound } from 'lucide-react'
import AuthGuard from '../AuthGuard'
import { useUsuarios, type UsuarioAdmin } from '@/lib/hooks/useUsuarios'
import type { Rol } from '@/lib/schemas'

const ROLES: Rol[] = ['admin', 'compras', 'diseno', 'almacen']

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

function FormNuevoUsuario({ onCrear }: { onCrear: (email: string, rol: Rol, password?: string) => Promise<void> }) {
  const [email, setEmail] = useState('')
  const [rol, setRol] = useState<Rol>('compras')
  const [password, setPassword] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password && password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    setEnviando(true)
    setError(null)
    try {
      await onCrear(email, rol, password || undefined)
      setEmail('')
      setRol('compras')
      setPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el usuario')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-white rounded-xl border border-slate-200 flex flex-wrap items-end gap-3 shadow-xs">
      <div className="flex-1 min-w-[220px]">
        <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500 mb-1">Correo Electrónico</label>
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
        <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500 mb-1">Rol</label>
        <select
          value={rol}
          onChange={(e) => setRol(e.target.value as Rol)}
          className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white text-slate-900 focus:outline-none focus:border-[#0369A1]"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>
      <div className="min-w-[180px]">
        <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500 mb-1">Contraseña (Opcional)</label>
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
      {error && <p className="w-full text-xs font-mono text-rose-600 mt-1">{error}</p>}
    </form>
  )
}

function FilaUsuario({
  usuario,
  onCambiarRol,
  onCambiarActivo,
  onResetearPassword,
  onEliminar,
}: {
  usuario: UsuarioAdmin
  onCambiarRol: (uid: string, rol: Rol) => Promise<void>
  onCambiarActivo: (uid: string, activo: boolean) => Promise<void>
  onResetearPassword: (uid: string, password?: string) => Promise<void>
  onEliminar: (uid: string) => Promise<void>
}) {
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

  function handleEliminar() {
    if (window.confirm(`¿Eliminar a ${usuario.email}? Esto borra su acceso permanentemente.`)) {
      onEliminar(usuario.id)
    }
  }

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50 text-xs">
      <td className="px-3.5 py-2.5 font-semibold text-slate-900">{usuario.email}</td>
      <td className="px-3.5 py-2.5">
        <select
          value={usuario.rol}
          onChange={(e) => onCambiarRol(usuario.id, e.target.value as Rol)}
          className="text-xs rounded border border-slate-300 px-2 py-1 bg-white font-mono"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </td>
      <td className="px-3.5 py-2.5 text-slate-500 font-mono text-[11px]">{usuario.proveedor}</td>
      <td className="px-3.5 py-2.5">
        <button
          onClick={() => onCambiarActivo(usuario.id, !usuario.activo)}
          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
            usuario.activo ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'
          }`}
        >
          {usuario.activo ? 'ACTIVO' : 'INACTIVO'}
        </button>
      </td>
      <td className="px-3.5 py-2.5">
        <div className="flex items-center justify-end gap-3 font-mono">
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
            onClick={handleEliminar}
            className="flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:underline"
          >
            <Trash2 className="h-3 w-3" />
            Eliminar
          </button>
        </div>
      </td>
    </tr>
  )
}

// Tarjeta para < md: mismos datos y acciones que la fila de tabla, sin scroll horizontal.
function TarjetaUsuario({
  usuario,
  onCambiarRol,
  onCambiarActivo,
  onResetearPassword,
  onEliminar,
}: {
  usuario: UsuarioAdmin
  onCambiarRol: (uid: string, rol: Rol) => Promise<void>
  onCambiarActivo: (uid: string, activo: boolean) => Promise<void>
  onResetearPassword: (uid: string, password?: string) => Promise<void>
  onEliminar: (uid: string) => Promise<void>
}) {
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

  function handleEliminar() {
    if (window.confirm(`¿Eliminar a ${usuario.email}? Esto borra su acceso permanentemente.`)) {
      onEliminar(usuario.id)
    }
  }

  return (
    <div className="p-3.5 space-y-2.5 text-xs">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-slate-900 break-all">{usuario.email}</p>
        <button
          onClick={() => onCambiarActivo(usuario.id, !usuario.activo)}
          className={`shrink-0 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
            usuario.activo ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'
          }`}
        >
          {usuario.activo ? 'ACTIVO' : 'INACTIVO'}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <select
          value={usuario.rol}
          onChange={(e) => onCambiarRol(usuario.id, e.target.value as Rol)}
          className="text-xs rounded border border-slate-300 px-2 py-1 bg-white font-mono"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <span className="text-slate-500 font-mono text-[11px]">{usuario.proveedor}</span>
      </div>

      <div className="flex items-center gap-3 pt-2 border-t border-slate-50 font-mono">
        {usuario.proveedor === 'password' &&
          (mostrarReset ? (
            <div className="flex flex-wrap items-center gap-1.5">
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
              {errorReset && <span className="text-[10px] text-rose-600 w-full">{errorReset}</span>}
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
          onClick={handleEliminar}
          className="flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:underline"
        >
          <Trash2 className="h-3 w-3" />
          Eliminar
        </button>
      </div>
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
    cambiarRol,
    cambiarActivo,
    resetearPassword,
    eliminarUsuario,
  } = useUsuarios()
  const [passwordTemporal, setPasswordTemporal] = useState<string | null>(null)
  const [accionError, setAccionError] = useState<string | null>(null)

  async function handleCrear(email: string, rol: Rol, password?: string) {
    const tempPassword = await crearUsuario(email, rol, password)
    if (tempPassword) setPasswordTemporal(tempPassword)
  }

  async function handleCambiarRol(uid: string, rol: Rol) {
    setAccionError(null)
    try {
      await cambiarRol(uid, rol)
    } catch (err) {
      console.error('Error cambiando rol:', err)
      setAccionError('No se pudo cambiar el rol. Intenta de nuevo.')
    }
  }

  async function handleCambiarActivo(uid: string, activo: boolean) {
    setAccionError(null)
    try {
      await cambiarActivo(uid, activo)
    } catch (err) {
      console.error('Error cambiando acceso:', err)
      setAccionError('No se pudo cambiar el acceso. Intenta de nuevo.')
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
      setAccionError(err instanceof Error ? err.message : 'No se pudo eliminar el usuario. Intenta de nuevo.')
    }
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex-1 space-y-4">
        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-slate-900 tracking-tight">Usuarios y Matriz de Permisos</h1>
            <span className="text-[10px] font-mono font-bold bg-rose-50 text-rose-800 border border-rose-200 px-1.5 py-0.5 rounded">
              Seguridad Admin
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Administra credenciales de acceso y asignación de roles para el personal.
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
                  onClick={fetchUsuarios}
                  className="mt-1 text-xs font-bold text-rose-800 underline hover:text-rose-900"
                >
                  Reintentar
                </button>
              )}
            </div>
          </div>
        )}

        <FormNuevoUsuario onCrear={handleCrear} />

        <div className="md:hidden bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 shadow-xs">
          {loading ? (
            <p className="px-4 py-6 text-center text-xs font-mono text-slate-500">Cargando usuarios...</p>
          ) : usuarios.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs font-mono text-slate-500">Sin usuarios registrados.</p>
          ) : (
            usuarios.map((u) => (
              <TarjetaUsuario
                key={u.id}
                usuario={u}
                onCambiarRol={handleCambiarRol}
                onCambiarActivo={handleCambiarActivo}
                onResetearPassword={handleResetPassword}
                onEliminar={handleEliminar}
              />
            ))
          )}
        </div>

        <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-xs">
          <table className="w-full text-xs text-left whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-600 font-mono text-[11px] uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-3.5 py-2.5">Correo</th>
                <th className="px-3.5 py-2.5">Rol Asignado</th>
                <th className="px-3.5 py-2.5">Proveedor</th>
                <th className="px-3.5 py-2.5">Estado</th>
                <th className="px-3.5 py-2.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-xs font-mono text-slate-500">Cargando usuarios...</td></tr>
              ) : usuarios.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-xs font-mono text-slate-500">Sin usuarios registrados.</td></tr>
              ) : (
                usuarios.map((u) => (
                  <FilaUsuario
                    key={u.id}
                    usuario={u}
                    onCambiarRol={handleCambiarRol}
                    onCambiarActivo={handleCambiarActivo}
                    onResetearPassword={handleResetPassword}
                    onEliminar={handleEliminar}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
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
