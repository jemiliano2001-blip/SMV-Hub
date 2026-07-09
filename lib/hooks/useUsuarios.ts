import { useState, useEffect } from "react"
import { getClienteAuth } from "@/lib/firebase"
import type { Rol } from "@/lib/schemas"

export interface UsuarioAdmin {
  id: string
  email: string
  rol: Rol
  activo: boolean
  proveedor: "google" | "password"
  creadoPor: string
  creadoEn: string
  actualizadoEn: string
}

async function headersAutenticados(): Promise<HeadersInit> {
  const token = await getClienteAuth().currentUser?.getIdToken()
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export function useUsuarios() {
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchUsuarios()
  }, [])

  async function fetchUsuarios() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/usuarios", { headers: await headersAutenticados() })
      if (!res.ok) throw new Error("No se pudo cargar la lista de usuarios")
      const data = await res.json()
      setUsuarios(data.usuarios)
    } catch (err) {
      console.error("Error cargando usuarios:", err)
      setError("No se pudo cargar la lista de usuarios. Intenta de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  async function crearUsuario(email: string, rol: Rol): Promise<string> {
    const res = await fetch("/api/usuarios", {
      method: "POST",
      headers: await headersAutenticados(),
      body: JSON.stringify({ email, rol }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? "No se pudo crear el usuario")
    await fetchUsuarios()
    return data.tempPassword as string
  }

  async function cambiarRol(uid: string, rol: Rol): Promise<void> {
    const res = await fetch(`/api/usuarios/${uid}`, {
      method: "PATCH",
      headers: await headersAutenticados(),
      body: JSON.stringify({ rol }),
    })
    if (!res.ok) throw new Error("No se pudo cambiar el rol")
    await fetchUsuarios()
  }

  async function cambiarActivo(uid: string, activo: boolean): Promise<void> {
    const res = await fetch(`/api/usuarios/${uid}`, {
      method: "PATCH",
      headers: await headersAutenticados(),
      body: JSON.stringify({ activo }),
    })
    if (!res.ok) throw new Error("No se pudo cambiar el acceso")
    await fetchUsuarios()
  }

  async function resetearPassword(uid: string): Promise<string> {
    const res = await fetch(`/api/usuarios/${uid}/reset-password`, {
      method: "POST",
      headers: await headersAutenticados(),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? "No se pudo resetear la contraseña")
    return data.tempPassword as string
  }

  return {
    usuarios,
    loading,
    error,
    fetchUsuarios,
    crearUsuario,
    cambiarRol,
    cambiarActivo,
    resetearPassword,
  }
}
