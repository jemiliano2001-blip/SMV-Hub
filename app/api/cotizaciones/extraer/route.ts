import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { verificarUsuarioAutorizado } from "@/lib/api-auth"
import { extraerCotizacionScreenshotIA } from "@/lib/cotizaciones-extraer-ia"
import { ErrorIA, esMediaTypeValido, type MediaTypeFactura } from "@/lib/extraer-ia"

export const runtime = "nodejs"
export const maxDuration = 120

const ExtraerCotizacionSchema = z.object({
  base64: z.string().min(1, "El archivo en base64 no puede estar vacío"),
  mimeType: z.string().refine((t) => esMediaTypeValido(t), {
    message: "Tipo de archivo no soportado (debe ser imagen o PDF)",
  }),
  link: z.string().nullable().optional(),
})

export async function POST(req: NextRequest) {
  const auth = await verificarUsuarioAutorizado(req)
  if (!auth.ok) {
    return auth.response
  }

  let bodyRaw: unknown
  try {
    bodyRaw = await req.json()
  } catch {
    return NextResponse.json(
      { error: "JSON inválido en el cuerpo de la petición" },
      { status: 400 }
    )
  }

  const parsed = ExtraerCotizacionSchema.safeParse(bodyRaw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Parámetros inválidos", detalles: parsed.error.format() },
      { status: 400 }
    )
  }

  const { base64, mimeType, link } = parsed.data

  try {
    const datos = await extraerCotizacionScreenshotIA(
      base64,
      mimeType as MediaTypeFactura,
      link
    )
    return NextResponse.json({
      ok: true,
      datos,
    })
  } catch (error) {
    if (error instanceof ErrorIA) {
      return NextResponse.json({ error: error.message }, { status: 502 })
    }
    console.error("[extraer-cotizacion] Error inesperado:", error)
    return NextResponse.json(
      { error: "Ocurrió un error al extraer los datos del producto con IA" },
      { status: 500 }
    )
  }
}
