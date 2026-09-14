import { z } from "zod"
import { FieldValue } from "firebase-admin/firestore"
import { verificarSuperAdmin } from "@/lib/api-auth"
import { registrarAuditoriaServer } from "@/lib/auditoria-server"
import { adminDb } from "@/lib/firebase-admin"
import { normalizarNombreProveedor } from "@/lib/pieza-matching"
import {
  analizarVinculacionHistoricaEnMemoria,
  type AnalisisVinculacionHistorica,
  type DocumentoProveedorHistorico,
  type ProveedorCatalogoMinimo,
  type ResultadoBackfill,
  type VinculoProveedorPendiente,
} from "@/lib/proveedores-vinculacion-core"

const BATCH_SIZE = 400
const MAX_VINCULOS_MANUALES = 20
const MAX_ALIASES = 20

const IdsDocsSchema = z.array(z.string().trim().min(1)).min(1).max(MAX_VINCULOS_MANUALES)

const RequestSchema = z.discriminatedUnion("accion", [
  z.object({ accion: z.literal("analizar") }),
  z.object({ accion: z.literal("aplicarAutomaticas") }),
  z.object({
    accion: z.literal("vincularManual"),
    coleccion: z.enum(["ordenes", "cotizaciones"]),
    idsDocs: IdsDocsSchema,
    proveedorId: z.string().trim().min(1),
    /**
     * Aprendizaje de alias: el nombre libre con el que venían los documentos se agrega a
     * `proveedor.aliases` para que la próxima captura con ese nombre vincule sola.
     */
    nombreLibre: z.string().trim().min(1).max(80).optional(),
    guardarAlias: z.boolean().optional().default(false),
  }),
  z.object({
    accion: z.literal("altaYVincular"),
    coleccion: z.enum(["ordenes", "cotizaciones"]),
    idsDocs: IdsDocsSchema,
    nombre: z.string().trim().min(1).max(120),
    mercado: z.enum(["usa", "mexico"]),
    esMarketplace: z.boolean().optional().default(false),
    /** Nombre crudo en los documentos; si difiere del nombre elegido, nace como alias. */
    nombreLibre: z.string().trim().min(1).max(80).optional(),
  }),
])

function documentoHistorico(id: string, data: Record<string, unknown>): DocumentoProveedorHistorico {
  return {
    id,
    proveedor: typeof data.proveedor === "string" ? data.proveedor : "",
    proveedorId: typeof data.proveedorId === "string" ? data.proveedorId : null,
  }
}

function aliasesDeDoc(data: Record<string, unknown>): string[] {
  return Array.isArray(data.aliases)
    ? data.aliases.filter((a): a is string => typeof a === "string" && a.trim() !== "")
    : []
}

function proveedorCatalogo(id: string, data: Record<string, unknown>): ProveedorCatalogoMinimo | null {
  const nombre = typeof data.nombre === "string" ? data.nombre.trim() : ""
  return nombre ? { id, nombre, aliases: aliasesDeDoc(data) } : null
}

/**
 * Agrega `nombreLibre` a los alias del proveedor si aporta algo: no es el nombre mismo, no está
 * ya, y hay lugar (tope 20). Devuelve si escribió.
 */
async function aprenderAlias(
  proveedorRef: FirebaseFirestore.DocumentReference,
  proveedorData: Record<string, unknown>,
  nombreLibre: string
): Promise<boolean> {
  const nombre = typeof proveedorData.nombre === "string" ? proveedorData.nombre : ""
  const alias = nombreLibre.trim()
  const existentes = aliasesDeDoc(proveedorData)
  const norm = normalizarNombreProveedor(alias)
  if (!norm || norm === normalizarNombreProveedor(nombre)) return false
  if (existentes.some((a) => normalizarNombreProveedor(a) === norm)) return false
  if (existentes.length >= MAX_ALIASES) return false
  await proveedorRef.update({
    aliases: FieldValue.arrayUnion(alias),
    actualizadoEn: FieldValue.serverTimestamp(),
  })
  return true
}

async function cargarAnalisis(): Promise<AnalisisVinculacionHistorica> {
  const [ordenesSnap, cotizacionesSnap, proveedoresSnap] = await Promise.all([
    adminDb.collection("ordenes").get(),
    adminDb.collection("cotizaciones").get(),
    adminDb.collection("proveedores").get(),
  ])

  const ordenes = ordenesSnap.docs.map((doc) => documentoHistorico(doc.id, doc.data()))
  const cotizaciones = cotizacionesSnap.docs.map((doc) => documentoHistorico(doc.id, doc.data()))
  const proveedores = proveedoresSnap.docs.flatMap((doc) => {
    const proveedor = proveedorCatalogo(doc.id, doc.data())
    return proveedor ? [proveedor] : []
  })

  return analizarVinculacionHistoricaEnMemoria(ordenes, cotizaciones, proveedores)
}

function respuestaPrevisualizacion(analisis: AnalisisVinculacionHistorica) {
  return {
    ordenes: analisis.ordenes,
    cotizaciones: analisis.cotizaciones,
    fantasmas: analisis.fantasmas,
  }
}

async function aplicarVinculos(
  coleccion: "ordenes" | "cotizaciones",
  vinculos: VinculoProveedorPendiente[]
): Promise<void> {
  for (let inicio = 0; inicio < vinculos.length; inicio += BATCH_SIZE) {
    const batch = adminDb.batch()
    for (const vinculo of vinculos.slice(inicio, inicio + BATCH_SIZE)) {
      batch.update(adminDb.collection(coleccion).doc(vinculo.id), {
        proveedorId: vinculo.proveedorId,
        actualizadoEn: FieldValue.serverTimestamp(),
      })
    }
    await batch.commit()
  }
}

function resultadoAplicado(analisis: AnalisisVinculacionHistorica): {
  ordenes: ResultadoBackfill
  cotizaciones: ResultadoBackfill
} {
  return { ordenes: analisis.ordenes, cotizaciones: analisis.cotizaciones }
}

export async function POST(request: Request) {
  const auth = await verificarSuperAdmin(request)
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 })
  }

  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "Solicitud de vinculación inválida" }, { status: 400 })
  }

  try {
    if (parsed.data.accion === "analizar") {
      return Response.json(respuestaPrevisualizacion(await cargarAnalisis()), {
        headers: { "Cache-Control": "no-store" },
      })
    }

    if (parsed.data.accion === "aplicarAutomaticas") {
      const analisis = await cargarAnalisis()
      await Promise.all([
        aplicarVinculos("ordenes", analisis.vinculosOrdenes),
        aplicarVinculos("cotizaciones", analisis.vinculosCotizaciones),
      ])
      const resultado = resultadoAplicado(analisis)
      await registrarAuditoriaServer(
        auth.email,
        "EDITAR",
        "proveedores",
        "BACKFILL_PROVEEDOR_ID",
        `Vinculación automática exacta: ${resultado.ordenes.vinculados} órdenes y ${resultado.cotizaciones.vinculados} cotizaciones.`
      )
      return Response.json(resultado)
    }

    if (parsed.data.accion === "altaYVincular") {
      const solicitud = parsed.data
      const idsDocs = [...new Set(solicitud.idsDocs)]

      // No duplicar catálogo: si ya existe un proveedor con ese nombre o alias, la acción
      // correcta es vincular al existente, no dar de alta otro.
      const proveedoresSnap = await adminDb.collection("proveedores").get()
      const normNombre = normalizarNombreProveedor(solicitud.nombre)
      const existente = proveedoresSnap.docs.find((doc) => {
        const p = proveedorCatalogo(doc.id, doc.data())
        if (!p) return false
        return [p.nombre, ...(p.aliases ?? [])].some((n) => normalizarNombreProveedor(n) === normNombre)
      })
      if (existente) {
        return Response.json(
          {
            error: `Ya existe "${existente.data().nombre}" en el catálogo. Vincula a ese proveedor en vez de dar de alta otro.`,
            proveedorExistenteId: existente.id,
          },
          { status: 409 }
        )
      }

      const documentos = await adminDb.getAll(
        ...idsDocs.map((id) => adminDb.collection(solicitud.coleccion).doc(id))
      )
      if (documentos.some((documento) => !documento.exists)) {
        return Response.json({ error: "Uno de los registros históricos ya no existe. Actualiza el análisis." }, { status: 409 })
      }

      const nombreLibre = solicitud.nombreLibre?.trim() ?? ""
      const aliases =
        nombreLibre && normalizarNombreProveedor(nombreLibre) !== normNombre ? [nombreLibre] : []
      const esMexico = solicitud.mercado === "mexico"
      const proveedorRef = adminDb.collection("proveedores").doc()
      // Mismos defaults que `crearProveedor` en el cliente; lo que no se sabe queda neutro para
      // que el equipo lo complete en /proveedores cuando le toque.
      await proveedorRef.set({
        id: proveedorRef.id,
        nombre: solicitud.nombre,
        estatus: "actual",
        tipoProveedor: "estandar",
        barato: false,
        recomendado: false,
        categorias: ["otros"],
        pais: esMexico ? "México" : "Estados Unidos",
        ubicacion: "",
        shippingAddressUSA: "",
        brokerAduanal: "",
        web: "",
        contacto: "",
        email: "",
        telefono: "",
        whatsapp: "",
        marcas: [],
        aliases,
        esMarketplace: solicitud.esMarketplace,
        moneda: esMexico ? "MXN" : "USD",
        facturaUSD: !esMexico,
        metodosPago: ["tarjeta"],
        tiempoRespuesta: "mismo_dia",
        frecuenciaCompra: "mensual",
        prioridad: "media",
        leadTimeDias: null,
        pedidoMinimo: null,
        calificacion: 5,
        notas: "",
        experienciaCompra: "",
        odooPartnerId: null,
        mercado: solicitud.mercado,
        origenProveedor: "manual",
        creadoEn: FieldValue.serverTimestamp(),
        actualizadoEn: FieldValue.serverTimestamp(),
      })

      await aplicarVinculos(
        solicitud.coleccion,
        idsDocs.map((id) => ({ id, proveedorId: proveedorRef.id }))
      )
      await registrarAuditoriaServer(
        auth.email,
        "CREAR",
        "proveedores",
        proveedorRef.id,
        `Alta desde vinculación histórica: "${solicitud.nombre}" (${solicitud.mercado}${solicitud.esMarketplace ? ", marketplace" : ""}); vinculó ${idsDocs.length} registro(s) de ${solicitud.coleccion}.`
      )
      return Response.json({ ok: true, proveedorId: proveedorRef.id })
    }

    if (parsed.data.accion !== "vincularManual") {
      return Response.json({ error: "Acción de vinculación no soportada" }, { status: 400 })
    }
    const solicitud = parsed.data
    const idsDocs = [...new Set(solicitud.idsDocs)]
    const proveedorRef = adminDb.collection("proveedores").doc(solicitud.proveedorId)
    const [proveedor, ...documentos] = await adminDb.getAll(
      proveedorRef,
      ...idsDocs.map((id) => adminDb.collection(solicitud.coleccion).doc(id))
    )
    if (!proveedor.exists) {
      return Response.json({ error: "El proveedor seleccionado ya no existe en el catálogo." }, { status: 400 })
    }
    if (documentos.some((documento) => !documento.exists)) {
      return Response.json({ error: "Uno de los registros históricos ya no existe. Actualiza el análisis." }, { status: 409 })
    }

    await aplicarVinculos(
      solicitud.coleccion,
      idsDocs.map((id) => ({ id, proveedorId: solicitud.proveedorId }))
    )
    let aliasAprendido = false
    if (solicitud.guardarAlias && solicitud.nombreLibre) {
      aliasAprendido = await aprenderAlias(proveedorRef, proveedor.data() ?? {}, solicitud.nombreLibre)
    }
    await registrarAuditoriaServer(
      auth.email,
      "EDITAR",
      solicitud.coleccion,
      "VINCULACION_MANUAL",
      `Vinculó ${idsDocs.length} registro(s) a proveedorId=${solicitud.proveedorId}.${
        aliasAprendido ? ` Alias aprendido: "${solicitud.nombreLibre}".` : ""
      }`
    )
    return Response.json({ ok: true, aliasAprendido })
  } catch (error) {
    console.error("[proveedores/vinculacion]", error)
    return Response.json({ error: "No se pudo completar la vinculación histórica." }, { status: 500 })
  }
}
