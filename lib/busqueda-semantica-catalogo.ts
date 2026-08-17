/**
 * Motor de Búsqueda Semántica de Catálogo, Refacciones y Herramientas para SMV Hub.
 *
 * Conecta Gemini Embeddings con el catálogo técnico industrial, permitiendo
 * resolver intenciones de búsqueda complejas y bilingües.
 */

import {
  generarEmbeddingTexto,
  buscarPorSimilitudSemantica,
  type ItemVectorizado,
  type ResultadoSimilitud,
} from "./embeddings-ia"
import { z } from "zod"

export const ItemCatalogoSemanticoSchema = z.object({
  id: z.string(),
  tituloES: z.string(),
  tituloEN: z.string(),
  categoria: z.enum([
    "herramientas_corte",
    "metales",
    "plasticos",
    "tornilleria_fijacion",
    "automatizacion_neumatica",
    "seguridad_taller",
    "consumibles_general",
  ]),
  especificaciones: z.array(z.string()).default([]),
  proveedoresHabituales: z.array(z.string()).default([]),
  urlDestino: z.string().default(""),
  claveSatSugerida: z.string().optional(),
})

export type ItemCatalogoSemantico = z.infer<typeof ItemCatalogoSemanticoSchema>

/**
 * Base de conocimiento técnico inicial de SMV Hub indexada semánticamente.
 */
export const CATALOGO_BASE_SMV: readonly ItemCatalogoSemantico[] = [
  // Herramientas de Corte
  {
    id: "tool-endmill-carbide",
    tituloES: "Fresa de carburo sólido para aluminio y metales no ferrosos (Endmill)",
    tituloEN: "Solid Carbide End Mill 2/3/4 Flute AlTiN / Bright for Aluminum & Steels",
    categoria: "herramientas_corte",
    especificaciones: ["Carburo de tungsteno", "2, 3 o 4 gavilanes", "Recubrimiento AlTiN / DLC"],
    proveedoresHabituales: ["Shars Tool", "McMaster-Carr", "Accupro"],
    urlDestino: "/endmills",
    claveSatSugerida: "23171600",
  },
  {
    id: "tool-taps-spiral",
    tituloES: "Machuelo helicoidal / punta espiral para roscado ciego y pasado en CNC",
    tituloEN: "Spiral Flute / Spiral Point High Speed Steel & Cobalt Threading Taps",
    categoria: "herramientas_corte",
    especificaciones: ["HSS / Cobalto M42", "Roscas métricas y UNC/UNF", "Recubrimiento TiN / TiCN"],
    proveedoresHabituales: ["McMaster-Carr", "YG-1", "OSG"],
    urlDestino: "/proveedores",
    claveSatSugerida: "23171600",
  },
  {
    id: "tool-drills-carbide",
    tituloES: "Brocas de carburo sólido y alta velocidad para barrenado profundo y de centros",
    tituloEN: "Carbide & HSS Jobber / Center / Spotting Drill Bits with Coolant Through",
    categoria: "herramientas_corte",
    especificaciones: ["Ángulo 118° / 135° / 140°", "Salida de refrigerante interno opcional"],
    proveedoresHabituales: ["Shars Tool", "Guhring", "McMaster-Carr"],
    urlDestino: "/proveedores",
    claveSatSugerida: "23171600",
  },
  {
    id: "tool-inserts-lathe",
    tituloES: "Insertos de carburo indexables para torneado y fresado (CNMG, WNMG, APKT)",
    tituloEN: "Indexable Carbide Turning & Milling Inserts (CNMG, WNMG, CCMT, APKT)",
    categoria: "herramientas_corte",
    especificaciones: ["Rompevirutas positivo/negativo", "Grados para acero, inox y fundición"],
    proveedoresHabituales: ["Kennametal", "Sandvik", "Iscar", "Shars Tool"],
    urlDestino: "/proveedores",
    claveSatSugerida: "23171600",
  },

  // Metales
  {
    id: "metal-al-6061",
    tituloES: "Placa, solera y barra redonda de aluminio 6061-T6 maquinable",
    tituloEN: "Aluminum 6061-T6 Plate, Bar, Sheet & Round Rod for Precision CNC Machining",
    categoria: "metales",
    especificaciones: ["Temple T6", "Excelente maquinabilidad y resistencia a la corrosión"],
    proveedoresHabituales: ["Aceros Murillo", "OnlineMetals", "Almetales"],
    urlDestino: "/almacen",
    claveSatSugerida: "30102400",
  },
  {
    id: "metal-steel-4140",
    tituloES: "Acero aleado 4140 bonificado / tratado térmicamente y recocido",
    tituloEN: "Alloy Steel 4140 Prehardened / Annealed Round Rod & Flat Bar",
    categoria: "metales",
    especificaciones: ["Dureza 28-32 HRC (bonificado)", "Alta tenacidad para flechas y pernos"],
    proveedoresHabituales: ["Aceros Murillo", "Grupo Acerero", "EMJ Metals"],
    urlDestino: "/almacen",
    claveSatSugerida: "30102400",
  },
  {
    id: "metal-steel-o1-a2",
    tituloES: "Acero para herramientas grado O1 / A2 / D2 templable al aceite y al aire",
    tituloEN: "Tool Steel O1 / A2 / D2 Ground Flat Stock & Drill Rod",
    categoria: "metales",
    especificaciones: ["Resistencia extrema al desgaste", "Para punzones, matrices y navajas"],
    proveedoresHabituales: ["Starrett", "McMaster-Carr", "Aceros Levinson"],
    urlDestino: "/almacen",
    claveSatSugerida: "30102400",
  },
  {
    id: "metal-ss-304-316",
    tituloES: "Acero inoxidable grado 304 y 316 austenítico anticorrosión",
    tituloEN: "Stainless Steel 304 / 316 Rod, Sheet & Tube Corrosion Resistant",
    categoria: "metales",
    especificaciones: ["Grado alimenticio y químico", "Excelente resistencia química"],
    proveedoresHabituales: ["Aceros Murillo", "McMaster-Carr"],
    urlDestino: "/almacen",
    claveSatSugerida: "30102400",
  },

  // Plásticos de Ingeniería
  {
    id: "plastic-delrin-acetal",
    tituloES: "Placa y barra de Delrin (Polioximetileno / Acetal POM-C) maquinable",
    tituloEN: "Delrin Acetal Resin Homopolymer / Copolymer Sheet and Rod",
    categoria: "plasticos",
    especificaciones: ["Baja fricción", "Alta estabilidad dimensional", "Color blanco y negro"],
    proveedoresHabituales: ["McMaster-Carr", "Plásticos Industriales", "Port Plastics"],
    urlDestino: "/almacen",
    claveSatSugerida: "13101500",
  },
  {
    id: "plastic-uhmw-nylon",
    tituloES: "Nylon 6/6 y Polietileno de Ultra Alto Peso Molecular (UHMW-PE)",
    tituloEN: "Nylon 6/6 Extruded & UHMW-PE Wear Resistant Sheets and Bars",
    categoria: "plasticos",
    especificaciones: ["Resistencia al impacto y abrasión", "Para guías y chumaceras"],
    proveedoresHabituales: ["McMaster-Carr", "Plásticos Industriales"],
    urlDestino: "/almacen",
    claveSatSugerida: "13101500",
  },
  {
    id: "plastic-peek-ptfe",
    tituloES: "Plásticos de alto desempeño PEEK y Teflón PTFE para alta temperatura",
    tituloEN: "High Performance PEEK & PTFE (Teflon) Rods and Sheets",
    categoria: "plasticos",
    especificaciones: ["Temperatura de operación continua hasta 260°C", "Inercia química"],
    proveedoresHabituales: ["McMaster-Carr", "Boedeker"],
    urlDestino: "/almacen",
    claveSatSugerida: "13101500",
  },

  // Tornillería & Fijación
  {
    id: "fastener-socket-screws",
    tituloES: "Tornillos Allen cabeza cilíndrica grado 12.9 y acero inoxidable (Socket Head Cap)",
    tituloEN: "Socket Head Cap Screws Alloy Steel Grade 12.9 & 18-8 Stainless Steel",
    categoria: "tornilleria_fijacion",
    especificaciones: ["Métricas M3 a M16", "Estándar 4-40 a 5/8-11", "Pavonado negro e Inox"],
    proveedoresHabituales: ["McMaster-Carr", "Fijaciones Industriales", "Fastenal"],
    urlDestino: "/proveedores",
    claveSatSugerida: "31161500",
  },
  {
    id: "fastener-dowel-ejector-pins",
    tituloES: "Pernos guía templados rectificados y pernos expulsores para troqueles y moldes",
    tituloEN: "Precision Hardened & Ground Dowel Pins & Nitrided Ejector Pins",
    categoria: "tornilleria_fijacion",
    especificaciones: ["Tolerancia h6 (+0.0002\")", "Dureza 58-62 HRC"],
    proveedoresHabituales: ["McMaster-Carr", "Misumi", "Punch Industry"],
    urlDestino: "/proveedores",
    claveSatSugerida: "31161600",
  },

  // Automatización & Neumática
  {
    id: "auto-pneumatic-fittings",
    tituloES: "Conexiones rápidas neumáticas push-to-connect y manguera de poliuretano",
    tituloEN: "Push-to-Connect Pneumatic Tube Fittings & Flexible Polyurethane Tubing",
    categoria: "automatizacion_neumatica",
    especificaciones: ["Presión hasta 150 PSI", "Roscas NPT y BSPT", "Tubos 4mm a 12mm"],
    proveedoresHabituales: ["SMC", "Festo", "AutomationDirect", "McMaster-Carr"],
    urlDestino: "/requisiciones",
    claveSatSugerida: "40141600",
  },
  {
    id: "auto-sensors-inductive",
    tituloES: "Sensores de proximidad inductivos y fotoeléctricos para posicionamiento",
    tituloEN: "Inductive Proximity Sensors NPN/PNP & Photoelectric Beam Sensors",
    categoria: "automatizacion_neumatica",
    especificaciones: ["M8, M12, M18", "Salida NPN/PNP NO/NC", "Protección IP67"],
    proveedoresHabituales: ["Keyence", "Omron", "Sick", "Banner"],
    urlDestino: "/requisiciones",
    claveSatSugerida: "39121500",
  },
]

// Cache en memoria para almacenar vectores de catálogo
const cacheEmbeddingsCatalogo = new Map<string, number[]>()

/**
 * Prepara el texto completo de representación para un ítem del catálogo.
 */
export function construirTextoItem(item: ItemCatalogoSemantico): string {
  return `${item.tituloES}. ${item.tituloEN}. Categoría: ${item.categoria}. Especificaciones: ${item.especificaciones.join(", ")}. Proveedores: ${item.proveedoresHabituales.join(", ")}.`
}

/**
 * Obtiene los ítems del catálogo con sus vectores precalculados o calculados al vuelo.
 */
export async function obtenerCatalogoVectorizado(
  apiKey?: string,
  fetchFn?: typeof fetch
): Promise<ItemVectorizado<ItemCatalogoSemantico>[]> {
  const itemsSinVector = CATALOGO_BASE_SMV.filter((it) => !cacheEmbeddingsCatalogo.has(it.id))

  if (itemsSinVector.length > 0) {
    const textos = itemsSinVector.map(construirTextoItem)
    try {
      const embeddings = await Promise.all(
        textos.map((txt) =>
          generarEmbeddingTexto(txt, {
            apiKey,
            fetchFn,
            taskType: "RETRIEVAL_DOCUMENT",
          })
        )
      )

      for (let i = 0; i < itemsSinVector.length; i++) {
        cacheEmbeddingsCatalogo.set(itemsSinVector[i].id, embeddings[i])
      }
    } catch (err) {
      console.warn("[busqueda-semantica] Fallo al generar embeddings de catálogo completo:", err)
    }
  }

  return CATALOGO_BASE_SMV.map((it) => ({
    id: it.id,
    embedding: cacheEmbeddingsCatalogo.get(it.id) || [],
    data: it,
  })).filter((v) => v.embedding.length > 0)
}

export interface ResultadoBusquedaSemanticaCompleta {
  query: string
  tiempoMs: number
  totalEncontrados: number
  resultados: Array<{
    item: ItemCatalogoSemantico
    score: number
    porcentajeSimilitud: number
  }>
}

/**
 * Ejecuta una búsqueda semántica multimodal y bilingüe sobre el catálogo técnico de SMV Hub.
 */
export async function buscarEnCatalogoSemantico(
  query: string,
  opciones: {
    apiKey?: string
    fetchFn?: typeof fetch
    topK?: number
    minScore?: number
    categoriaFiltro?: string
  } = {}
): Promise<ResultadoBusquedaSemanticaCompleta> {
  const inicio = performance.now()
  const qLimpio = query.trim()

  if (!qLimpio) {
    return {
      query: "",
      tiempoMs: 0,
      totalEncontrados: 0,
      resultados: [],
    }
  }

  // 1. Generar embedding para la consulta del usuario
  const queryVector = await generarEmbeddingTexto(qLimpio, {
    apiKey: opciones.apiKey,
    fetchFn: opciones.fetchFn,
    taskType: "RETRIEVAL_QUERY",
  })

  // 2. Obtener catálogo vectorizado
  const catalogoVectorizado = await obtenerCatalogoVectorizado(opciones.apiKey, opciones.fetchFn)

  // 3. Filtrar por categoría si se especificó
  const itemsFiltrados = opciones.categoriaFiltro
    ? catalogoVectorizado.filter((it) => it.data.categoria === opciones.categoriaFiltro)
    : catalogoVectorizado

  // 4. Calcular similitud coseno y rankear
  const resultadosSimilitud = buscarPorSimilitudSemantica(queryVector, itemsFiltrados, {
    topK: opciones.topK || 6,
    minScore: opciones.minScore ?? 0.3,
  })

  const fin = performance.now()

  return {
    query: qLimpio,
    tiempoMs: Math.round(fin - inicio),
    totalEncontrados: resultadosSimilitud.length,
    resultados: resultadosSimilitud.map((r: ResultadoSimilitud<ItemCatalogoSemantico>) => ({
      item: r.data,
      score: r.score,
      porcentajeSimilitud: r.porcentajeSimilitud,
    })),
  }
}
