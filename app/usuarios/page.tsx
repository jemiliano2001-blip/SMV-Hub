'use client'

import { useState } from 'react'
import { UserPlus, Copy, Check, AlertCircle } from 'lucide-react'
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
    <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
      <p className="text-sm text-blue-900 mb-2">
        Contraseña temporal — cópiala ahora, no se vuelve a mostrar:
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 bg-white px-3 py-2 rounded border border-blue-200 text-sm font-mono">
          {password}
        </code>
        <button
          onClick={copiar}
          className="flex items-center gap-1 px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
        >
          {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copiado ? 'Copiada' : 'Copiar'}
        </button>
        <button onClick={onClose} className="px-3 py-2 text-sm text-blue-700 hover:underline">
          Cerrar
        </button>
      </div>
    </div>
  )
}

function FormNuevoUsuario({ onCrear }: { onCrear: (email: string, rol: Rol) => Promise<void> }) {
  const [email, setEmail] = useState('')
  const [rol, setRol] = useState<Rol>('compras')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setError(null)
    try {
      await onCrear(email, rol)
      setEmail('')
      setRol('compras')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el usuario')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-8 p-4 bg-white rounded-lg border border-gray-200 flex flex-wrap items-end gap-3">
      <div className="flex-1 min-w-[220px]">
        <label className="block text-xs font-medium text-gray-500 mb-1">Correo</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="persona@gmail.com"
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Rol</label>
        <select
          value={rol}
          onChange={(e) => setRol(e.target.value as Rol)}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={enviando}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0F172A] hover:bg-[#1E293B] text-white text-sm font-medium disabled:opacity-50"
      >
        <UserPlus className="h-4 w-4" />
        {enviando ? 'Creando...' : 'Nuevo usuario'}
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  )
}

function FilaUsuario({
  usuario,
  onCambiarRol,
  onCambiarActivo,
  onResetearPassword,
}: {
  usuario: UsuarioAdmin
  onCambiarRol: (uid: string, rol: Rol) => Promise<void>
  onCambiarActivo: (uid: string, activo: boolean) => Promise<void>
  onResetearPassword: (uid: string) => Promise<void>
}) {
  return (
    <tr className="border-b border-gray-100">
      <td className="px-4 py-3 text-sm text-gray-900">{usuario.email}</td>
      <td className="px-4 py-3">
        <select
          value={usuario.rol}
          onChange={(e) => onCambiarRol(usuario.id, e.target.value as Rol)}
          className="text-sm rounded border border-gray-200 px-2 py-1"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">{usuario.proveedor}</td>
      <td className="px-4 py-3">
        <button
          onClick={() => onCambiarActivo(usuario.id, !usuario.activo)}
          className={`text-xs font-medium px-2 py-1 rounded-full ${
            usuario.activo ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}
        >
          {usuario.activo ? 'Activo' : 'Desactivado'}
        </button>
      </td>
      <td className="px-4 py-3">
        {usuario.proveedor === 'password' && (
          <button
            onClick={() => onResetearPassword(usuario.id)}
            className="text-xs text-[#0369A1] hover:underline"
          >
            Resetear contraseña
          </button>
        )}
      </td>
    </tr>
  )
}

function UsuariosContent() {
  const { usuarios, loading, error, crearUsuario, cambiarRol, cambiarActivo, resetearPassword } = useUsuarios()
  const [passwordTemporal, setPasswordTemporal] = useState<string | null>(null)

  async function handleCrear(email: string, rol: Rol) {
    const tempPassword = await crearUsuario(email, rol)
    setPasswordTemporal(tempPassword)
  }

  async function handleResetPassword(uid: string) {
    const tempPassword = await resetearPassword(uid)
    setPasswordTemporal(tempPassword)
  }

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-xl font-semibold text-[#0F172A] mb-1">Usuarios</h1>
      <p className="text-sm text-[#64748B] mb-6">Administra quién puede entrar a SMV Hub y qué ve cada quien.</p>

      {passwordTemporal && (
        <BannerPasswordTemporal password={passwordTemporal} onClose={() => setPasswordTemporal(null)} />
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 rounded-lg flex items-start gap-3 border border-red-100">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <FormNuevoUsuario onCrear={handleCrear} />

      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500">
              <th className="px-4 py-3">Correo</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">Proveedor</th>
              <th className="px-4 py-3">Acceso</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">Cargando…</td></tr>
            ) : usuarios.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">Sin usuarios todavía.</td></tr>
            ) : (
              usuarios.map((u) => (
                <FilaUsuario
                  key={u.id}
                  usuario={u}
                  onCambiarRol={cambiarRol}
                  onCambiarActivo={cambiarActivo}
                  onResetearPassword={handleResetPassword}
                />
              ))
            )}
          </tbody>
        </table>
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
