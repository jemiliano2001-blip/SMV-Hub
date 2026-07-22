import { crearRequisicionFlujo } from "@/lib/requisiciones-flujo"

export interface ItemRecompra {
  id: string
  nombre: string
  categoria: "endmills" | "insertos" | "tooling" | "consumibles"
  marca: string
  especificacionTecnica: string
  proveedorPreferidoId: string
  proveedorPreferidoNombre: string
  unidad: string
  stockActual: number
  stockMinimo: number
  stockSeguridad: number
  consumoPromedioSemanal: number
  leadTimeDias: number
  pedidoMinimoMOQ: number
  ultimaCompraFecha: string
  costoEstimadoUSD: number
  frecuenciaCompra: "semanal" | "mensual" | "trimestral" | "ocasional"
  estatusRecompra: "monitorear" | "sugerir_recompra" | "urgente"
  nivelUrgencia: "bajo" | "medio" | "alto"
  cantidadSugerida: number
  puntoRecompraROP: number
  explicacionSugerencia: string
  revisionRealizada?: boolean
}

/**
 * Calcula la Lógica de Sugerencia e Inventario de Recompra (ROP & EOQ).
 */
export function calcularEvaluacionRecompra(item: Omit<ItemRecompra, "puntoRecompraROP" | "cantidadSugerida" | "estatusRecompra" | "nivelUrgencia" | "explicacionSugerencia">): ItemRecompra {
  // Consumo diario laboral (5 días/semana)
  const consumoDiario = item.consumoPromedioSemanal / 5.0

  // Demanda esperada durante Lead Time + Stock de Seguridad
  const demandaLeadTime = Math.ceil(consumoDiario * item.leadTimeDias)
  const puntoRecompraROP = demandaLeadTime + item.stockSeguridad

  // Deficit de stock
  const deficit = Math.max(0, (item.stockSeguridad + item.stockMinimo) - item.stockActual)
  const cantidadSugerida = Math.max(deficit, item.pedidoMinimoMOQ)

  let estatusRecompra: "monitorear" | "sugerir_recompra" | "urgente" = "monitorear"
  let nivelUrgencia: "bajo" | "medio" | "alto" = "bajo"
  let explicacionSugerencia = `Nivel de inventario saludable (${item.stockActual} ${item.unidad}). Sin riesgo de paro.`

  if (item.stockActual <= item.stockSeguridad) {
    estatusRecompra = "urgente"
    nivelUrgencia = "alto"
    explicacionSugerencia = `⚠️ Stock crítico por debajo del mínimo de seguridad (${item.stockActual} <= ${item.stockSeguridad} ${item.unidad}). Riesgo inminente de paro de maquinado CNC.`
  } else if (item.stockActual <= puntoRecompraROP) {
    estatusRecompra = "sugerir_recompra"
    nivelUrgencia = "medio"
    explicacionSugerencia = `⚡ Inventario en Punto de Reabastecimiento (ROP = ${puntoRecompraROP} ${item.unidad}). Se sugiere reordenar antes de agotar el stock durante el Lead Time (${item.leadTimeDias} días).`
  }

  return {
    ...item,
    puntoRecompraROP,
    cantidadSugerida,
    estatusRecompra,
    nivelUrgencia,
    explicacionSugerencia,
  }
}

/** DATOS DEMO REALISTAS DE RECOMPRA DE HERRAMIENTAL (EE.UU. / TALLER SMV) */
export const DEMO_ITEMS_RECOMPRA: ItemRecompra[] = [
  calcularEvaluacionRecompra({
    id: "rec-101",
    nombre: 'Endmill Carburo Sólido 1/2" AlTiN (4-Flute)',
    categoria: "endmills",
    marca: "Shars Tool",
    especificacionTecnica: "Cortador de alto rendimiento para aceros A36 y 4140, shank 1/2",
    proveedorPreferidoId: "prov-shars",
    proveedorPreferidoNombre: "Shars Tool Company",
    unidad: "pza",
    stockActual: 2,
    stockMinimo: 8,
    stockSeguridad: 5,
    consumoPromedioSemanal: 10,
    leadTimeDias: 3,
    pedidoMinimoMOQ: 10,
    ultimaCompraFecha: "2026-06-28",
    costoEstimadoUSD: 24.50,
    frecuenciaCompra: "semanal",
  }),
  calcularEvaluacionRecompra({
    id: "rec-102",
    nombre: "Inserto WNMG 080408 para Torneado CNC",
    categoria: "insertos",
    marca: "Kennametal",
    especificacionTecnica: "Grado KCP25B para corte continuo e interrumpido en acero inoxidable",
    proveedorPreferidoId: "prov-kennametal",
    proveedorPreferidoNombre: "Kennametal Authorized",
    unidad: "pza",
    stockActual: 12,
    stockMinimo: 30,
    stockSeguridad: 25,
    consumoPromedioSemanal: 35,
    leadTimeDias: 4,
    pedidoMinimoMOQ: 30,
    ultimaCompraFecha: "2026-07-02",
    costoEstimadoUSD: 8.90,
    frecuenciaCompra: "semanal",
  }),
  calcularEvaluacionRecompra({
    id: "rec-103",
    nombre: 'Endmill Esférico 3/8" TiAlN (Ball Nose)',
    categoria: "endmills",
    marca: "OnlineCarbide",
    especificacionTecnica: "Radio 3/16 para acabado de moldes y superficies 3D",
    proveedorPreferidoId: "prov-onlinecarbide",
    proveedorPreferidoNombre: "OnlineCarbide USA",
    unidad: "pza",
    stockActual: 7,
    stockMinimo: 10,
    stockSeguridad: 6,
    consumoPromedioSemanal: 6,
    leadTimeDias: 5,
    pedidoMinimoMOQ: 5,
    ultimaCompraFecha: "2026-06-20",
    costoEstimadoUSD: 19.80,
    frecuenciaCompra: "mensual",
  }),
  calcularEvaluacionRecompra({
    id: "rec-104",
    nombre: "Refrigerante Soluble Blaser Swisslube (55 Gal)",
    categoria: "consumibles",
    marca: "Blaser",
    especificacionTecnica: "Emulsión refrigerante biodegradable para centros de maquinado CNC",
    proveedorPreferidoId: "prov-travers",
    proveedorPreferidoNombre: "Travers Tool Co",
    unidad: "tambo",
    stockActual: 1,
    stockMinimo: 2,
    stockSeguridad: 1,
    consumoPromedioSemanal: 0.5,
    leadTimeDias: 7,
    pedidoMinimoMOQ: 2,
    ultimaCompraFecha: "2026-05-15",
    costoEstimadoUSD: 420.00,
    frecuenciaCompra: "trimestral",
  }),
  calcularEvaluacionRecompra({
    id: "rec-105",
    nombre: 'Boquilla ER32 1/2" Precision Collet',
    categoria: "tooling",
    marca: "Techniks",
    especificacionTecnica: 'Precisión 0.0002" TIR para conos BT40 de husillo principal',
    proveedorPreferidoId: "prov-mcmaster",
    proveedorPreferidoNombre: "McMaster-Carr",
    unidad: "pza",
    stockActual: 18,
    stockMinimo: 10,
    stockSeguridad: 5,
    consumoPromedioSemanal: 2,
    leadTimeDias: 2,
    pedidoMinimoMOQ: 4,
    ultimaCompraFecha: "2026-07-10",
    costoEstimadoUSD: 32.00,
    frecuenciaCompra: "ocasional",
  }),
]

/**
 * 1-Click: Crea una Requisición de Compra automática desde una sugerencia de recompra.
 */
export async function convertirSugerenciaEnRequisicion(item: ItemRecompra, solicitante = "Taller SMV Maquinados") {
  return await crearRequisicionFlujo({
    solicitante,
    departamento: "Maquinados y Tooling CNC",
    prioridadFlujo: item.nivelUrgencia === "alto" ? "urgente" : item.nivelUrgencia === "medio" ? "alta" : "media",
    motivoJustificacion: `Recompra Sugerida Automática: ${item.explicacionSugerencia}`,
    aprobacionRequerida: item.nivelUrgencia === "alto",
    items: [
      {
        descripcion: item.nombre,
        categoria: item.categoria,
        cantidad: item.cantidadSugerida,
        unidad: item.unidad,
        marcaPreferida: item.marca,
        especificacion: item.especificacionTecnica,
        proveedorSugeridoId: item.proveedorPreferidoId,
        proveedorSugeridoNombre: item.proveedorPreferidoNombre,
      },
    ],
  })
}
