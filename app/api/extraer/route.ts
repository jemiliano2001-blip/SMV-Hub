import { NextRequest } from "next/server"
import { verificarUsuarioAutorizado } from "@/lib/api-auth"
import { extraerFactura, esMediaTypeValido, ErrorIA } from "@/lib/extraer-ia"

export const runtime = "nodejs"
/** Gemini visión + PDF puede tardar >60s; alinear con firebase.json frameworksBackend. */
export const maxDuration = 120

const MAX_BYTES_IMAGEN = 10 * 1024 * 1024

export async function POST(req: NextRequest) {
  const auth = await verificarUsuarioAutorizado(req)
  if (!auth.ok) return auth.response

  // 1. Leer la imagen del form
  const formData = await req.formData()
  const imagen = formData.get("imagen")

  if (!imagen || !(imagen instanceof File)) {
    return Response.json(
      { error: "Campo 'imagen' requerido (File)" },
      { status: 400 }
    )
  }

  if (!esMediaTypeValido(imagen.type)) {
    return Response.json(
      { error: "El archivo debe ser imagen (jpeg, png, gif o webp) o PDF" },
      { status: 400 }
    )
  }

  if (imagen.size > MAX_BYTES_IMAGEN) {
    return Response.json(
      { error: "El archivo no puede exceder 10 MB" },
      { status: 413 }
    )
  }

  // 2. Convertir a base64
  const buffer = await imagen.arrayBuffer()
  const base64 = Buffer.from(buffer).toString("base64")

  // 3. Extraer con Gemini (structured outputs garantiza el schema)
  try {
    const datos = await extraerFactura(base64, imagen.type)
    return Response.json(datos)
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : "error desconocido"
    console.error("[extraer] error:", mensaje)
    const status =
      err instanceof ErrorIA && mensaje.includes("GEMINI_API_KEY") ? 503 : 502
    const error =
      err instanceof ErrorIA ? mensaje : "Error al consultar la IA"
    return Response.json({ error }, { status })
  }
}
