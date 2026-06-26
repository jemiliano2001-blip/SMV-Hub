import { NextRequest } from "next/server"
import { verificarUsuarioAutorizado } from "@/lib/api-auth"
import {
  extraerRegistros,
  esMediaTypeValido,
  MODELO_EXTRACCION,
  MODELO_EXTRACCION_ALTA,
  ErrorIA,
} from "@/lib/extraer-ia"
import type { ExtraccionInvoice } from "@/lib/schemas"
const MAX_IMAGENES = 20
const MAX_BYTES_IMAGEN = 10 * 1024 * 1024
const MAX_BYTES_LOTE = 50 * 1024 * 1024

export async function POST(req: NextRequest) {
  const auth = await verificarUsuarioAutorizado(req)
  if (!auth.ok) return auth.response

  const formData = await req.formData()
  const imagenes = formData.getAll("imagenes").filter((v): v is File => v instanceof File)

  if (imagenes.length === 0) {
    return Response.json(
      { error: "Se requiere al menos una imagen en el campo 'imagenes'" },
      { status: 400 }
    )
  }
  if (imagenes.length > MAX_IMAGENES) {
    return Response.json(
      { error: `Máximo ${MAX_IMAGENES} imágenes por lote` },
      { status: 400 }
    )
  }
  for (const img of imagenes) {
    if (!esMediaTypeValido(img.type)) {
      return Response.json(
        { error: `'${img.name}' no es válido (jpeg, png, gif, webp o PDF)` },
        { status: 400 }
      )
    }
  }

  const bytesTotales = imagenes.reduce((total, img) => total + img.size, 0)
  if (bytesTotales > MAX_BYTES_LOTE) {
    return Response.json(
      { error: "El lote no puede exceder 50 MB" },
      { status: 413 }
    )
  }

  for (const img of imagenes) {
    if (img.size > MAX_BYTES_IMAGEN) {
      return Response.json(
        { error: `'${img.name}' excede el límite de 10 MB` },
        { status: 413 }
      )
    }
  }

  // "alta" usa un modelo más capaz para tablas densas; por defecto flash.
  const modelo =
    formData.get("calidad") === "alta" ? MODELO_EXTRACCION_ALTA : MODELO_EXTRACCION

  try {
    const porImagen = await Promise.all(
      imagenes.map(async (img) => {
        const base64 = Buffer.from(await img.arrayBuffer()).toString("base64")
        return extraerRegistros(base64, img.type as Parameters<typeof extraerRegistros>[1], modelo)
      })
    )
    const extracciones: ExtraccionInvoice[] = porImagen.flat()
    return Response.json({ extracciones })
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : "error desconocido"
    console.error("[extraer-lote] error:", mensaje)
    const status =
      err instanceof ErrorIA && mensaje.includes("GEMINI_API_KEY") ? 503 : 502
    const error =
      err instanceof ErrorIA ? mensaje : "Error al consultar la IA"
    return Response.json({ error }, { status })
  }
}
