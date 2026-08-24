import { NextRequest } from "next/server"
import { verificarUsuarioAutorizado } from "@/lib/api-auth"
import { obtenerUsuarioAdmin } from "@/lib/usuarios-admin"
import { listarMedidasEndmills } from "@/lib/endmills"
import { ErrorIA } from "@/lib/extraer-ia"
import {
  parsearTextoExcelEndmills,
  parsearArchivoExcelEndmills,
  extraerPedidoEndmillsMultimodalIA,
} from "@/lib/endmills-extraer-ia"

export const runtime = "nodejs"
export const maxDuration = 120

const MAX_BYTES_ARCHIVO = 15 * 1024 * 1024

export async function POST(req: NextRequest) {
  const auth = await verificarUsuarioAutorizado(req)
  if (!auth.ok) return auth.response

  const info = await obtenerUsuarioAdmin(auth.uid, auth.email)
  if (!info?.activo || (!info.esSuperAdmin && !info.modulos.includes("endmills"))) {
    return Response.json(
      { error: "No tienes acceso al módulo de endmills" },
      { status: 403 }
    )
  }

  const contentType = req.headers.get("content-type") || ""

  try {
    const catalogo = await listarMedidasEndmills()

    // 1. Caso Form-Data (Archivos subidos: Excel, PDF, Imágenes)
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData()
      const archivo = formData.get("archivo")
      const texto = formData.get("texto")

      if (archivo && archivo instanceof File) {
        if (archivo.size > MAX_BYTES_ARCHIVO) {
          return Response.json(
            { error: "El archivo no puede exceder 15 MB" },
            { status: 413 }
          )
        }

        const buffer = await archivo.arrayBuffer()
        const nombreLower = archivo.name.toLowerCase()
        const mimeType = archivo.type.toLowerCase()

        // Si es Excel (.xlsx, .xls, .csv)
        if (
          nombreLower.endsWith(".xlsx") ||
          nombreLower.endsWith(".xls") ||
          nombreLower.endsWith(".csv") ||
          mimeType.includes("spreadsheet") ||
          mimeType.includes("excel") ||
          mimeType.includes("csv")
        ) {
          try {
            const resExcel = parsearArchivoExcelEndmills(buffer, catalogo)
            if (resExcel.items.length > 0) {
              return Response.json(resExcel)
            }
          } catch (errExcel) {
            console.warn("[extraer-pedido] Error parseando excel nativo, intentando con IA:", errExcel)
          }
        }

        // Si es PDF o Imagen (Vision Gemini)
        const base64 = Buffer.from(buffer).toString("base64")
        const resultado = await extraerPedidoEndmillsMultimodalIA(
          {
            base64,
            mimeType: mimeType || (nombreLower.endsWith(".pdf") ? "application/pdf" : "image/jpeg"),
            texto: typeof texto === "string" ? texto : undefined,
          },
          catalogo
        )
        return Response.json(resultado)
      }

      if (typeof texto === "string" && texto.trim()) {
        const nativo = parsearTextoExcelEndmills(texto, catalogo)
        if (nativo.length > 0 && nativo.some((i) => i.medidaIdCoincidencia !== null)) {
          return Response.json({ origen: "excel_tsv", items: nativo })
        }
        const resultado = await extraerPedidoEndmillsMultimodalIA({ texto }, catalogo)
        return Response.json(resultado)
      }

      return Response.json(
        { error: "No se proporcionó archivo ni texto para extraer" },
        { status: 400 }
      )
    }

    // 2. Caso JSON Payload
    let body: { texto?: string; base64?: string; mimeType?: string }
    try {
      body = (await req.json()) as { texto?: string; base64?: string; mimeType?: string }
    } catch {
      return Response.json({ error: "JSON inválido" }, { status: 400 })
    }

    if (body.texto && !body.base64) {
      // 1. Probar parser nativo TSV primero si es tabla copiada
      const nativo = parsearTextoExcelEndmills(body.texto, catalogo)
      if (nativo.length > 0 && nativo.some((i) => i.medidaIdCoincidencia !== null)) {
        return Response.json({ origen: "excel_tsv", items: nativo })
      }
    }

    const resultado = await extraerPedidoEndmillsMultimodalIA(
      {
        texto: body.texto,
        base64: body.base64,
        mimeType: body.mimeType,
      },
      catalogo
    )
    return Response.json(resultado)
  } catch (err: unknown) {
    if (err instanceof ErrorIA) {
      return Response.json({ error: err.message }, { status: 502 })
    }
    console.error("Error al extraer pedido de endmills:", err)
    const mensaje = err instanceof Error ? err.message : "Error al procesar la extracción"
    return Response.json({ error: mensaje }, { status: 500 })
  }
}
