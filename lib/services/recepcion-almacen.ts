import { getClienteAuth } from "@/lib/firebase"

export interface ResultadoRecepcionAlmacenApi {
  estadoRecepcion: "recibida"
  entradaAlmacenId: string
}

export async function recibirOrdenAlmacenApi(
  ordenId: string,
  notas?: string | null
): Promise<ResultadoRecepcionAlmacenApi> {
  const auth = getClienteAuth()
  const user = auth.currentUser

  if (!user) {
    throw new Error("No hay sesión activa para registrar la recepción")
  }

  const token = await user.getIdToken()

  const response = await fetch(`/api/ordenes/${encodeURIComponent(ordenId)}/recibir`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ notas: notas?.trim() || null }),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || "No se pudo registrar la recepción en almacén")
  }

  return data as ResultadoRecepcionAlmacenApi
}
