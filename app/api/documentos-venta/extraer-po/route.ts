import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { verificarUsuarioAutorizado } from "@/lib/api-auth"
import { extraerOrdenCompraClienteIA } from "@/lib/documentos-venta-lector-ia"
import { ErrorIA } from "@/lib/extraer-ia"

export const runtime = "nodejs"

const ExtraerPoBodySchema = z.object({
  base64: z.string().min(1, "El archivo en base64 no puede estar vacío"),
  mimeType: z.enum([
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/jpg",
  ]),
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
    return NextResponse.json({ error: "JSON inválido en el cuerpo de la petición" }, { status: 400 })
  }

  const parsed = ExtraerPoBodySchema.safeParse(bodyRaw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Parámetros de extracción inválidos", detalles: parsed.error.format() },
      { status: 400 }
    )
  }

  const { base64, mimeType } = parsed.data

  try {
    const ordenExtraida = await extraerOrdenCompraClienteIA(base64, mimeType)
    return NextResponse.json({
      ok: true,
      orden: ordenExtraida,
    })
  } catch (error) {
    if (error instanceof ErrorIA) {
      return NextResponse.json({ error: error.message }, { status: 502 })
    }
    console.error("[extraer-po-cliente] Error inesperado:", error)
    return NextResponse.json(
      { error: "Ocurrió un error al extraer los datos de la orden de compra" },
      { status: 500 }
    )
  }
}
