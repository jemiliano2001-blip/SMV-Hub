import { getDb } from "./firestore-db"
import { inferirMercadoProveedor } from "./proveedor-mercado"
import {
  construirEntradasOrden,
  construirEntradaProveedor,
  construirEntradaCotizacion,
  type CotizacionParaIndice,
  type EntradaBusquedaIndice,
  type OrdenParaIndice,
  type ProveedorParaIndice,
} from "./busqueda-indice-texto"
import {
  generarEmbeddingsIndice,
  MODELO_EMBEDDING_INDICE,
  DIMENSIONES_EMBEDDING_INDICE,
} from "./busqueda-indice-gemini"

const db = getDb()
const COLECCION_INDICE = "busqueda_indice"
// Aunque writeBatch admite hasta 500 operaciones, 400 documentos con embeddings
// de 768 dimensiones exceden el límite de 10 MiB por transacción de Firestore.
// 100 deja margen para metadata y evita que una indexación inicial falle completa.
const TAMANO_LOTE = 100

function ordenDesdeDoc(doc: FirebaseFirestore.QueryDocumentSnapshot): OrdenParaIndice | null {
  const d = doc.data()
  if (!Array.isArray(d.items)) return null
  return {
    id: doc.id,
    proveedor: typeof d.proveedor === "string" ? d.proveedor : "",
    proveedorId: typeof d.proveedorId === "string" ? d.proveedorId : null,
    moneda: typeof d.moneda === "string" ? d.moneda : "",
    fechaFactura: typeof d.fechaFactura === "string" ? d.fechaFactura : null,
    items: (d.items as unknown[])
      .filter((it): it is Record<string, unknown> => typeof it === "object" && it !== null)
      .map((it) => ({
        descripcion: typeof it.descripcion === "string" ? it.descripcion : "",
        descripcionSimplificada:
          typeof it.descripcionSimplificada === "string" ? it.descripcionSimplificada : undefined,
        precioUnitario: typeof it.precioUnitario === "number" ? it.precioUnitario : null,
      })),
  }
}

function proveedorDesdeDoc(doc: FirebaseFirestore.QueryDocumentSnapshot): ProveedorParaIndice | null {
  const d = doc.data()
  if (typeof d.nombre !== "string") return null
  return {
    id: doc.id,
    nombre: d.nombre,
    categorias: Array.isArray(d.categorias)
      ? d.categorias.filter((c: unknown): c is string => typeof c === "string")
      : [],
    marcas: Array.isArray(d.marcas) ? d.marcas.filter((m: unknown): m is string => typeof m === "string") : [],
    // Misma regla que el cliente y el backfill: sin esto 101 de 104 proveedores llegaban al
    // índice sin mercado y Cmd+K no podía distinguir USA de México.
    mercado: inferirMercadoProveedor(d),
  }
}

function cotizacionDesdeDoc(doc: FirebaseFirestore.QueryDocumentSnapshot): CotizacionParaIndice | null {
  const d = doc.data()
  if (typeof d.descripcion !== "string") return null
  return {
    id: doc.id,
    descripcion: d.descripcion,
    numeroParte: typeof d.numeroParte === "string" ? d.numeroParte : null,
    proveedor: typeof d.proveedor === "string" ? d.proveedor : "",
    proveedorId: typeof d.proveedorId === "string" ? d.proveedorId : null,
    precioUnitario: typeof d.precioUnitario === "number" ? d.precioUnitario : null,
    moneda: typeof d.moneda === "string" ? d.moneda : "",
    fecha: typeof d.fecha === "string" ? d.fecha : null,
    ubicacion: typeof d.ubicacion === "string" ? d.ubicacion : "",
    estatus: typeof d.estatus === "string" ? d.estatus : "",
    origen: typeof d.origen === "string" ? d.origen : undefined,
    llavePieza: typeof d.llavePieza === "string" ? d.llavePieza : null,
  }
}

export interface ResultadoIndexacion {
  entradasEsperadas: number
  reembebidas: number
  sinCambios: number
  /** Entradas con el mismo texto pero metadata/título/ruta distintos: se actualizan sin re-embeber. */
  metadataActualizadas: number
  podadas: number
  ordenesLeidas: number
  proveedoresLeidos: number
  /** Docs leídos de `cotizaciones`; las `origen === "compra"` se leen pero no producen entrada. */
  cotizacionesLeidas: number
}

/** Serialización estable (claves ordenadas) para comparar lo que ve el usuario sin tocar el vector. */
function huellaVisible(e: { titulo: string; refPath: string; metadata: Record<string, unknown> }): string {
  const claves = Object.keys(e.metadata).sort()
  const metadata: Record<string, unknown> = {}
  for (const k of claves) if (e.metadata[k] !== undefined) metadata[k] = e.metadata[k]
  return JSON.stringify({ titulo: e.titulo, refPath: e.refPath, metadata })
}

export interface OpcionesSincronizarIndice {
  /** Inyectable para pruebas contra el emulator (sin red a Gemini). */
  fetchFn?: typeof fetch
}

export async function sincronizarIndiceBusqueda(
  apiKey: string,
  opciones: OpcionesSincronizarIndice = {}
): Promise<ResultadoIndexacion> {
  // 1. Leer fuentes completas. Universo pequeño (Fase 0: 123 órdenes / 102
  // proveedores) — full-scan + diff por textoHash es más simple y barato que
  // un cursor incremental, y es la ÚNICA forma de detectar fuentes borradas
  // (bulk delete existe en /ordenes) sin una segunda pasada de reconciliación.
  // Si el universo crece a miles de documentos, revisar con un cursor real.
  const [ordenesSnap, proveedoresSnap, cotizacionesSnap] = await Promise.all([
    db.collection("ordenes").get(),
    db.collection("proveedores").get(),
    db.collection("cotizaciones").get(),
  ])

  const entradasEsperadas: EntradaBusquedaIndice[] = []
  for (const doc of ordenesSnap.docs) {
    const orden = ordenDesdeDoc(doc)
    if (!orden) {
      console.warn(`[busqueda-indice] orden ${doc.id} con forma inválida, se omite`)
      continue
    }
    entradasEsperadas.push(...construirEntradasOrden(orden))
  }
  for (const doc of proveedoresSnap.docs) {
    const proveedor = proveedorDesdeDoc(doc)
    if (!proveedor) {
      console.warn(`[busqueda-indice] proveedor ${doc.id} con forma inválida, se omite`)
      continue
    }
    const entrada = construirEntradaProveedor(proveedor)
    if (entrada) entradasEsperadas.push(entrada)
  }
  for (const doc of cotizacionesSnap.docs) {
    const cotizacion = cotizacionDesdeDoc(doc)
    if (!cotizacion) {
      console.warn(`[busqueda-indice] cotizacion ${doc.id} con forma inválida, se omite`)
      continue
    }
    const entrada = construirEntradaCotizacion(cotizacion)
    if (entrada) entradasEsperadas.push(entrada)
  }

  // 2. Leer qué ya existe en el índice (id + textoHash + modelo — no los vectores).
  const indiceExistenteSnap = await db
    .collection(COLECCION_INDICE)
    .select("textoHash", "fuente", "modelo", "dimensiones", "titulo", "refPath", "metadata")
    .get()
  type EntradaExistente = {
    textoHash?: string
    modelo?: string
    dimensiones?: number
    titulo?: string
    refPath?: string
    metadata?: Record<string, unknown>
  }
  const existentePorId = new Map(indiceExistenteSnap.docs.map((d) => [d.id, d.data() as EntradaExistente]))

  const necesitanEmbed = entradasEsperadas.filter((e) => {
    const prev = existentePorId.get(e.id)
    if (!prev) return true
    return (
      prev.textoHash !== e.textoHash ||
      prev.modelo !== MODELO_EMBEDDING_INDICE ||
      prev.dimensiones !== DIMENSIONES_EMBEDDING_INDICE
    )
  })
  const idsAEmbeber = new Set(necesitanEmbed.map((e) => e.id))

  // Mismo texto (mismo vector) pero cambió lo que se pinta en el resultado — p. ej. `mercado`
  // del proveedor tras el backfill de B4. Se actualiza la metadata sin gastar embeddings.
  const necesitanMetadata = entradasEsperadas.filter((e) => {
    if (idsAEmbeber.has(e.id)) return false
    const prev = existentePorId.get(e.id)
    if (!prev) return false
    return (
      huellaVisible({ titulo: prev.titulo ?? "", refPath: prev.refPath ?? "", metadata: prev.metadata ?? {} }) !==
      huellaVisible(e)
    )
  })
  const sinCambios = entradasEsperadas.length - necesitanEmbed.length - necesitanMetadata.length

  // 3. Embeber solo lo que cambió (esto es lo caro; los reads de arriba son gratis en comparación).
  const embeddings = await generarEmbeddingsIndice(
    necesitanEmbed.map((e) => ({ id: e.id, texto: e.texto, titulo: e.titulo })),
    { apiKey, ...(opciones.fetchFn ? { fetchFn: opciones.fetchFn } : {}) }
  )

  // 4. Escribir en lotes que respetan el límite de tamaño por transacción.
  const ahora = new Date()
  for (let i = 0; i < necesitanEmbed.length; i += TAMANO_LOTE) {
    const batch = db.batch()
    for (const entrada of necesitanEmbed.slice(i, i + TAMANO_LOTE)) {
      const vector = embeddings.get(entrada.id)
      if (!vector) continue // generarEmbeddingsIndice ya truena si falta alguno; defensivo nada más
      batch.set(db.collection(COLECCION_INDICE).doc(entrada.id), {
        fuente: entrada.fuente,
        refId: entrada.refId,
        refPath: entrada.refPath,
        texto: entrada.texto,
        textoHash: entrada.textoHash,
        embedding: vector,
        modelo: MODELO_EMBEDDING_INDICE,
        dimensiones: DIMENSIONES_EMBEDDING_INDICE,
        titulo: entrada.titulo,
        metadata: entrada.metadata,
        actualizadoEn: ahora,
      })
    }
    await batch.commit()
  }

  // 4b. Refrescar metadata de lo que no cambió de texto (update parcial: el vector se queda).
  for (let i = 0; i < necesitanMetadata.length; i += TAMANO_LOTE) {
    const batch = db.batch()
    for (const entrada of necesitanMetadata.slice(i, i + TAMANO_LOTE)) {
      batch.update(db.collection(COLECCION_INDICE).doc(entrada.id), {
        titulo: entrada.titulo,
        refPath: entrada.refPath,
        metadata: entrada.metadata,
        actualizadoEn: ahora,
      })
    }
    await batch.commit()
  }

  // 5. Podar huérfanos, por fuente — mismo guard que podarHuerfanos() en
  // odoo-compras-sync.ts: nunca podar una fuente cuya lectura vino vacía
  // mientras el índice ya tenía entradas suyas (huele a falla transitoria del
  // read, no a que de verdad se vaciaron las órdenes/proveedores).
  const idsEsperados = new Set(entradasEsperadas.map((e) => e.id))
  const existentesPorFuente = new Map<string, string[]>()
  for (const doc of indiceExistenteSnap.docs) {
    const fuente = (doc.data() as { fuente?: string }).fuente ?? "desconocida"
    existentesPorFuente.set(fuente, [...(existentesPorFuente.get(fuente) ?? []), doc.id])
  }

  const idsAPodar: string[] = []
  for (const [fuente, ids] of existentesPorFuente) {
    const lecturaVacia =
      (fuente === "orden-item" && ordenesSnap.empty) ||
      (fuente === "proveedor" && proveedoresSnap.empty) ||
      (fuente === "cotizacion" && cotizacionesSnap.empty)
    if (lecturaVacia && ids.length > 0) {
      console.warn(`[busqueda-indice] ${fuente}: la fuente vino vacía; se omite la poda de ${ids.length} entradas`)
      continue
    }
    idsAPodar.push(...ids.filter((id) => !idsEsperados.has(id)))
  }

  let podadas = 0
  for (let i = 0; i < idsAPodar.length; i += TAMANO_LOTE) {
    const batch = db.batch()
    for (const id of idsAPodar.slice(i, i + TAMANO_LOTE)) batch.delete(db.collection(COLECCION_INDICE).doc(id))
    await batch.commit()
    podadas += Math.min(TAMANO_LOTE, idsAPodar.length - i)
  }

  return {
    entradasEsperadas: entradasEsperadas.length,
    reembebidas: necesitanEmbed.length,
    sinCambios,
    metadataActualizadas: necesitanMetadata.length,
    podadas,
    ordenesLeidas: ordenesSnap.size,
    proveedoresLeidos: proveedoresSnap.size,
    cotizacionesLeidas: cotizacionesSnap.size,
  }
}
