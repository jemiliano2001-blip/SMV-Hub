/**
 * POST /api/memoria-operativa/consultar — "¿qué sé ya de estas piezas?" (frente C, T2.4).
 *
 * Recibe 1–20 piezas en captura y devuelve un ContextoOperativo por pieza: compras y
 * cotizaciones previas (exactas / hermanas / parecidas), alerta de precio solo sobre exactos,
 * proveedor preferido, clave SAT validada y familia aprobada. Ver
 * docs/superpowers/specs/2026-09-13-memoria-operativa-design.md y el plan 2026-09-15.
 *
 * Por qué en servidor: la key de Gemini, `busqueda_indice` bloqueado al cliente y el filtro por
 * módulos antes de leer (misma tabla que Cmd+K: lib/memoria-operativa/permisos.ts).
 * Una sola llamada de embeddings por request (lote) y una lectura del índice cacheada 5 min.
 * Nada bloquea la captura: si Gemini o el índice fallan, responde `degradado: true` con empate
 * exacto por llave contra `cotizaciones` en lugar de 502.
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { verificarUsuarioAutorizado } from "@/lib/api-auth"
import { obtenerUsuarioAdmin } from "@/lib/usuarios-admin"
import { excedeLimite } from "@/lib/rate-limit-memoria"
import { adminDb } from "@/lib/firebase-admin"
import { generarEmbeddingsLote } from "@/lib/embeddings-ia"
import { leerIndiceVectorizado, type EntradaIndiceVectorizada } from "@/lib/busqueda-semantica-catalogo"
import { cargarMapeosSatDesdeFirestore } from "@/lib/sat/cargar-mapeos-firestore"
import { cargarMapeosAprobadosAdmin } from "@/lib/compras-odoo/mapeos-aprobados-admin"
import { fuentesPermitidasPara, puedeVerPrecios } from "@/lib/memoria-operativa/permisos"
import { construirContextoOperativo } from "@/lib/memoria-operativa/consultar"
import { generarLlavePieza } from "@/lib/pieza-matching"
import {
  MAX_PIEZAS_POR_CONSULTA,
  type PiezaConsulta,
  type RespuestaMemoriaOperativa,
} from "@/lib/memoria-operativa/tipos"
import type { FuenteBusquedaIndice } from "@/lib/schemas"

export const runtime = "nodejs"
/** Un lote de embeddings + una lectura del índice (cacheada). 60 s sobra; el cliente corta a 8 s. */
export const maxDuration = 60

const DIMENSIONES_INDICE = 768

const PiezaConsultaSchema = z.object({
  descripcion: z.string().trim().min(1).max(500),
  numeroParte: z.string().trim().max(120).nullable().optional(),
  proveedor: z.string().trim().max(200).nullable().optional(),
  proveedorId: z.string().trim().max(120).nullable().optional(),
  precioUnitario: z.number().finite().nullable().optional(),
  moneda: z.enum(["USD", "MXN"]).nullable().optional(),
})

const BodySchema = z.object({
  piezas: z.array(PiezaConsultaSchema).min(1).max(MAX_PIEZAS_POR_CONSULTA),
})

type Doc = FirebaseFirestore.QueryDocumentSnapshot

function texto(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null
}

/**
 * Empate exacto sin índice ni Gemini: `cotizaciones` por `llavePieza` (persistida en el 100 % de
 * las filas desde el frente B). Las filas `origen=compra` se presentan como compra (orden-item).
 */
async function entradasDegradadas(piezas: readonly PiezaConsulta[]): Promise<EntradaIndiceVectorizada[]> {
  const llaves = [...new Set(piezas.map((p) => generarLlavePieza(p.numeroParte, p.descripcion)).filter(Boolean))]
  if (llaves.length === 0) return []
  const snap = await adminDb.collection("cotizaciones").where("llavePieza", "in", llaves.slice(0, 30)).get()
  return snap.docs.map((doc: Doc) => {
    const d = doc.data()
    const esCompra = d.origen === "compra"
    const precio = typeof d.precioUnitario === "number" ? d.precioUnitario : null
    return {
      id: esCompra ? `${texto(d.ordenIdOrigen) ?? doc.id}#?` : `cot#${doc.id}`,
      embedding: [],
      data: {
        id: doc.id,
        fuente: (esCompra ? "orden-item" : "cotizacion") as FuenteBusquedaIndice,
        refPath: esCompra ? `/ordenes?id=${texto(d.ordenIdOrigen) ?? ""}` : `/cotizaciones?id=${doc.id}`,
        titulo: texto(d.descripcion) ?? "",
        metadata: {
          ...(texto(d.proveedor) ? { proveedorNombre: d.proveedor as string } : {}),
          ...(texto(d.proveedorId) ? { proveedorId: d.proveedorId as string } : {}),
          ...(precio != null && precio > 0 ? { precio } : {}),
          ...(texto(d.moneda) ? { moneda: d.moneda as string } : {}),
          ...(texto(d.fecha) ? { fecha: d.fecha as string } : {}),
          ...(texto(d.numeroParte) ? { numeroParte: d.numeroParte as string } : {}),
          ...(texto(d.llavePieza) ? { llavePieza: d.llavePieza as string } : {}),
          ...(texto(d.ubicacion) ? { ubicacion: d.ubicacion as string } : {}),
          ...(texto(d.estatus) ? { estatus: d.estatus as string } : {}),
        },
      },
    }
  })
}

export async function POST(req: NextRequest) {
  const inicio = performance.now()

  const auth = await verificarUsuarioAutorizado(req)
  if (!auth.ok) return auth.response

  if (excedeLimite(auth.uid)) {
    return NextResponse.json({ error: "Demasiadas consultas. Espera un momento e intenta de nuevo." }, { status: 429 })
  }

  const info = await obtenerUsuarioAdmin(auth.uid, auth.email)
  if (!info?.activo) return NextResponse.json({ error: "No autorizado" }, { status: 403 })

  // La memoria es de piezas: proveedores no aplica aunque el usuario tenga el módulo.
  const fuentes = fuentesPermitidasPara(info).filter((f) => f !== "proveedor")
  if (fuentes.length === 0) {
    return NextResponse.json(
      { error: "Tu usuario no tiene acceso a órdenes ni cotizaciones; la memoria operativa no aplica." },
      { status: 403 }
    )
  }
  const verPrecios = puedeVerPrecios(info)

  let bodyRaw: unknown
  try {
    bodyRaw = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido en el cuerpo de la petición" }, { status: 400 })
  }
  const parsed = BodySchema.safeParse(bodyRaw)
  if (!parsed.success) {
    return NextResponse.json({ error: "Piezas inválidas", detalles: parsed.error.format() }, { status: 400 })
  }
  const piezas: PiezaConsulta[] = parsed.data.piezas

  // Todo en paralelo: mapeos (best-effort, cacheados), índice (cacheado) y UNA llamada de embeddings.
  const [mapeosSat, mapeosAprobados, indice, vectores] = await Promise.all([
    cargarMapeosSatDesdeFirestore().catch(() => []),
    cargarMapeosAprobadosAdmin().catch(() => null),
    leerIndiceVectorizado(fuentes).then(
      (entradas) => ({ ok: true as const, entradas }),
      (error: unknown) => ({ ok: false as const, error })
    ),
    generarEmbeddingsLote(
      piezas.map((p) => p.descripcion),
      { taskType: "RETRIEVAL_QUERY", outputDimensionality: DIMENSIONES_INDICE }
    ).then(
      (v) => (v.every((x) => x.length === DIMENSIONES_INDICE) ? { ok: true as const, vectores: v } : { ok: false as const, error: new Error("dimensión inesperada") }),
      (error: unknown) => ({ ok: false as const, error })
    ),
  ])

  let degradado = false
  let entradas: EntradaIndiceVectorizada[]
  let vectoresConsulta: Array<number[] | null>

  if (indice.ok) {
    entradas = indice.entradas
  } else {
    degradado = true
    console.warn("[memoria-operativa] índice no disponible; empate exacto contra cotizaciones:", indice.error)
    try {
      entradas = await entradasDegradadas(piezas)
    } catch (error) {
      console.error("[memoria-operativa] fallback degradado también falló:", error)
      entradas = []
    }
  }

  if (vectores.ok && indice.ok) {
    vectoresConsulta = vectores.vectores
  } else {
    degradado = true
    if (!vectores.ok) console.warn("[memoria-operativa] embeddings no disponibles; solo empate exacto:", vectores.error)
    vectoresConsulta = piezas.map(() => null)
  }

  const contextos = construirContextoOperativo(piezas, vectoresConsulta, entradas, {
    verPrecios,
    mapeosSat,
    mapeosAprobados,
  })

  const respuesta: RespuestaMemoriaOperativa = {
    contextos,
    fuentesConsultadas: fuentes,
    verPrecios,
    degradado,
    tiempoMs: Math.round(performance.now() - inicio),
  }
  return NextResponse.json({ ok: true, ...respuesta })
}
