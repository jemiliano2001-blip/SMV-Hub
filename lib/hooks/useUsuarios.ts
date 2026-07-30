import { useState, useEffect, useCallback } from "react"
import { getClienteAuth } from "@/lib/firebase"
import { onAuthStateChanged } from "firebase/auth"
import type { ModuloId, Rol } from "@/lib/schemas"

export interface UsuarioAdmin {
  id: string
  email: string
  rol: Rol
  plantilla: Rol
  modulos: ModuloId[]
  esSuperAdmin: boolean
  atiendeDocumentosVenta: boolean
  activo: boolean
  proveedor: "google" | "password"
  creadoPor: string
  creadoEn: string
  actualizadoEn: string
}

export interface CrearUsuarioInput {
  email: string
  plantilla: Rol
  modulos?: ModuloId[]
  esSuperAdmin?: boolean
  atiendeDocumentosVenta?: boolean
  password?: string
}

export interface ActualizarUsuarioInput {
  plantilla?: Rol
  modulos?: ModuloId[]
  esSuperAdmin?: boolean
  atiendeDocumentosVenta?: boolean
  activo?: boolean
}

async function headersAutenticados(): Promise<HeadersInit | null> {
  const auth = getClienteAuth()
  const token = await auth.currentUser?.getIdToken()
  if (!token) return null
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  }
}

export function useUsuarios() {
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUsuarios = useCallback(async (isMounted = { current: true }) => {
    setLoading(true)
    setError(null)
    try {
      const headers = await headersAutenticados()
      if (!headers) {
        if (isMounted.current) {
          setUsuarios([])
          setLoading(false)
        }
        return
      }
      const res = await fetch("/api/usuarios", { headers })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error ?? "No se pudo cargar la lista de usuarios")
      }
      const lista = (data?.usuarios ?? []) as UsuarioAdmin[]
      if (isMounted.current) {
        setUsuarios(
          lista.map((u) => ({
            ...u,
            plantilla: u.plantilla ?? u.rol,
            modulos: u.modulos ?? [],
            esSuperAdmin: u.esSuperAdmin === true,
            atiendeDocumentosVenta: u.atiendeDocumentosVenta === true,
          }))
        )
      }
    } catch (err) {
      console.error("Error cargando usuarios:", err)
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : "No se pudo cargar la lista de usuarios. Intenta de nuevo.")
      }
    } finally {
      if (isMounted.current) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    const isMounted = { current: true }
    const unsub = onAuthStateChanged(getClienteAuth(), (user) => {
      if (user) {
        void fetchUsuarios(isMounted)
      } else {
        if (isMounted.current) {
          setUsuarios([])
          setLoading(false)
        }
      }
    })
    return () => {
      isMounted.current = false
      unsub()
    }
  }, [fetchUsuarios])

  async function crearUsuario(input: CrearUsuarioInput): Promise<string | null> {
    const headers = await headersAutenticados()
    if (!headers) throw new Error("Sesión no iniciada")
    const res = await fetch("/api/usuarios", {
      method: "POST",
      headers,
      body: JSON.stringify(input),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) throw new Error(data?.error ?? "No se pudo crear el usuario")
    await fetchUsuarios()
    return (data?.tempPassword as string | null) ?? null
  }

  async function actualizarUsuario(uid: string, cambios: ActualizarUsuarioInput): Promise<void> {
    const headers = await headersAutenticados()
    if (!headers) throw new Error("Sesión no iniciada")
    const res = await fetch(`/api/usuarios/${uid}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(cambios),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      throw new Error(data?.error ?? "No se pudo actualizar el usuario")
    }
    await fetchUsuarios()
  }

  /** @deprecated Preferir actualizarUsuario con plantilla */
  async function cambiarRol(uid: string, rol: Rol): Promise<void> {
    await actualizarUsuario(uid, { plantilla: rol })
  }

  async function cambiarActivo(uid: string, activo: boolean): Promise<void> {
    await actualizarUsuario(uid, { activo })
  }

  async function resetearPassword(uid: string, password?: string): Promise<string | null> {
    const headers = await headersAutenticados()
    if (!headers) throw new Error("Sesión no iniciada")
    const res = await fetch(`/api/usuarios/${uid}/reset-password`, {
      method: "POST",
      headers,
      body: JSON.stringify({ password }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) throw new Error(data?.error ?? "No se pudo resetear la contraseña")
    return (data?.tempPassword as string | null) ?? null
  }

  async function eliminarUsuario(uid: string): Promise<void> {
    const headers = await headersAutenticados()
    if (!headers) throw new Error("Sesión no iniciada")
    const res = await fetch(`/api/usuarios/${uid}`, {
      method: "DELETE",
      headers,
    })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      throw new Error(data?.error ?? "No se pudo eliminar el usuario")
    }
    await fetchUsuarios()
  }

  return {
    usuarios,
    loading,
    error,
    fetchUsuarios,
    crearUsuario,
    actualizarUsuario,
    cambiarRol,
    cambiarActivo,
    resetearPassword,
    eliminarUsuario,
  }
}
