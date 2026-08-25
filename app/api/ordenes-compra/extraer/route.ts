import { NextRequest } from "next/server"
import { verificarModulo } from "@/lib/api-auth"
import { esMediaTypeValido, ErrorIA } from "@/lib/extraer-ia"
import { extraerPOUsaDesdeArchivo } from "@/lib/ordenes-compra-ia"

export const runtime = "nodejs"
/** Gemini visión + PDF puede tardar >60s; alinear con firebase.json frameworksBackend. */
export const maxDuration = 120

const MAX_BYTES_ARCHIVO = 10 * 1024 * 1024

export async function POST(req: NextRequest) {
  const auth = await verificarModulo(
    req,
    ["ordenes-compra", "nueva-compra", "compras-odoo"],
    "No tienes acceso a las órdenes de compra USA"
  )
  if (!auth.ok) return auth.response

  const formData = await req.formData()
  const archivo = formData.get("archivo")

  if (!archivo || !(archivo instanceof File)) {
    return Response.json({ error: "Campo 'archivo' requerido (File)" }, { status: 400 })
  }
  if (!esMediaTypeValido(archivo.type)) {
    return Response.json(
      { error: "El archivo debe ser imagen (jpeg, png, gif o webp) o PDF" },
      { status: 400 }
    )
  }
  if (archivo.size > MAX_BYTES_ARCHIVO) {
    return Response.json({ error: "El archivo no puede exceder 10 MB" }, { status: 413 })
  }

  const base64 = Buffer.from(await archivo.arrayBuffer()).toString("base64")

  try {
    return Response.json(await extraerPOUsaDesdeArchivo(base64, archivo.type))
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : "error desconocido"
    console.error("[ordenes-compra/extraer] error:", mensaje)
    const status = err instanceof ErrorIA && mensaje.includes("GEMINI_API_KEY") ? 503 : 502
    return Response.json(
      { error: err instanceof ErrorIA ? mensaje : "Error al consultar la IA" },
      { status }
    )
  }
}
