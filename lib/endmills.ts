import {
  Timestamp,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  where,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
} from "firebase/firestore"
import { db, getClienteAuth } from "@/lib/firebase"
import { registrarAuditoria } from "@/lib/auditoria"
import { makeDateConverter } from "@/lib/firestore-helpers"
import { crearRepositorio } from "@/lib/repositorio"
import {
  EndmillMedidaSchema,
  PartidaPedidoEndmillsSchema,
  PedidoEndmillsSchema,
  RecibirPedidoEndmillsInputSchema,
  RegistrarPedidoEndmillsInputSchema,
  type EndmillMedida,
  type PartidaPedidoEndmills,
  type PedidoEndmills,
  type RecepcionParcialEndmill,
  type RecibirPedidoEndmillsInput,
  type RegistrarPedidoEndmillsInput,
} from "@/lib/schemas"
import {
  calcularObjetivoPar,
  calcularTotalesPedidoEndmills,
  clasificarStockEndmill,
  diferenciaEnDias,
  redondearUSD,
} from "@/lib/endmills-calculos"
import { fechaHoyLocal } from "@/lib/format"
import { emitirNotificacion } from "@/lib/notificaciones"

const COLECCION_MEDIDAS = "endmills-medidas"
const COLECCION_PEDIDOS = "endmills-pedidos"
const COLECCION_PARTIDAS = "endmills-pedido-partidas"

const baseMedidaConverter = makeDateConverter<EndmillMedida>()
const medidaConverter: FirestoreDataConverter<EndmillMedida> = {
  toFirestore: baseMedidaConverter.toFirestore,
  fromFirestore(snap: QueryDocumentSnapshot) {
    const medida = baseMedidaConverter.fromFirestore(snap, {})
    const raw = snap.data()
    return EndmillMedidaSchema.parse({
      ...medida,
      stockActualizadoEn:
        raw.stockActualizadoEn instanceof Timestamp
          ? raw.stockActualizadoEn.toDate()
          : medida.stockActualizadoEn instanceof Date
            ? medida.stockActualizadoEn
            : new Date(),
    })
  },
}

const repoMedidas = crearRepositorio<EndmillMedida>({
  coleccion: COLECCION_MEDIDAS,
  converter: medidaConverter,
})
const repoPedidos = crearRepositorio<PedidoEndmills>({ coleccion: COLECCION_PEDIDOS })
const repoPartidas = crearRepositorio<PartidaPedidoEndmills>({ coleccion: COLECCION_PARTIDAS })

export interface ActorEndmills {
  uid: string
  nombre: string
}

function emailActual(): string | null | undefined {
  return getClienteAuth().currentUser?.email
}

async function auditarEndmillsBestEffort(
  accion: "CREAR" | "EDITAR",
  coleccion: string,
  id: string,
  resumen: string
): Promise<void> {
  try {
    await registrarAuditoria(emailActual(), accion, coleccion, id, resumen)
  } catch (error) {
    // La escritura de dominio ya fue confirmada. No propagamos el error para
    // evitar que la interfaz reintente y cree un segundo pedido/recepción.
    console.error(`[endmills] No se pudo registrar auditoría para ${coleccion}/${id}`, error)
  }
}

export async function listarMedidasEndmills(): Promise<EndmillMedida[]> {
  return repoMedidas.listar([orderBy("orden", "asc")])
}

export function suscribirMedidasEndmills(
  onData: (medidas: EndmillMedida[]) => void,
  onError?: (error: Error) => void
): () => void {
  return onSnapshot(
    query(repoMedidas.ref(), orderBy("orden", "asc")),
    (snapshot) => onData(snapshot.docs.map((item) => item.data())),
    (error) => onError?.(error)
  )
}

export async function listarPedidosEndmills(): Promise<PedidoEndmills[]> {
  return repoPedidos.listar([orderBy("fecha", "desc"), limit(200)])
}

export function suscribirPedidosEndmills(
  onData: (pedidos: PedidoEndmills[]) => void,
  onError?: (error: Error) => void
): () => void {
  return onSnapshot(
    query(repoPedidos.ref(), orderBy("fecha", "desc"), limit(200)),
    (snapshot) => onData(snapshot.docs.map((item) => PedidoEndmillsSchema.parse(item.data()))),
    (error) => onError?.(error)
  )
}

export async function listarPartidasPedidoEndmills(
  pedidoId: string
): Promise<PartidaPedidoEndmills[]> {
  const partidas = await repoPartidas.listar([where("pedidoId", "==", pedidoId)])
  return partidas.sort((a, b) => a.descripcion.localeCompare(b.descripcion, "es"))
}

export async function listarHistorialMedidaEndmills(
  medidaId: string
): Promise<PartidaPedidoEndmills[]> {
  const partidas = await repoPartidas.listar([where("medidaId", "==", medidaId)])
  return partidas.sort((a, b) => b.fechaPedido.localeCompare(a.fechaPedido))
}

interface AlertaStockCriticoEndmill {
  medidaId: string
  descripcion: string
  stockActual: number
  objetivoPar: number | null
}

/**
 * Solo alerta cuando la medida **entra** a crítico. Sin comparar contra el
 * estado anterior, cada reguardado de una medida que ya estaba crítica volvería
 * a notificar lo mismo.
 */
function alertaSiEntraEnCritico(
  medidaId: string,
  medida: Pick<EndmillMedida, "descripcion" | "objetivoPar">,
  stockAntes: number,
  stockDespues: number
): AlertaStockCriticoEndmill | null {
  const antes = clasificarStockEndmill(stockAntes, medida.objetivoPar)
  const despues = clasificarStockEndmill(stockDespues, medida.objetivoPar)
  if (antes === "critico" || despues !== "critico") return null
  return {
    medidaId,
    descripcion: medida.descripcion,
    stockActual: stockDespues,
    objetivoPar: medida.objetivoPar,
  }
}

async function emitirAlertasStockCritico(
  alertas: readonly AlertaStockCriticoEndmill[]
): Promise<void> {
  if (alertas.length === 0) return
  const usuario = getClienteAuth().currentUser
  await Promise.all(
    alertas.map((alerta) =>
      emitirNotificacion({
        tipo: "endmills_stock_critico",
        titulo: `Stock crítico: ${alerta.descripcion}`,
        cuerpo: `Quedan ${alerta.stockActual} pzas de ${alerta.descripcion} (Objetivo PAR: ${alerta.objetivoPar ?? "N/A"}).`,
        origenModulo: "endmills",
        origenId: alerta.medidaId,
        audiencia: "endmills",
        destinatarioUid: null,
        href: "/endmills",
        creadoPorUid: usuario?.uid ?? "",
        creadoPorNombre: usuario?.email ?? "Sistema",
      })
    )
  )
}

export async function actualizarStockEndmill(id: string, stockActual: number): Promise<void> {
  const stock = Math.trunc(stockActual)
  if (!Number.isFinite(stock) || stock < 0) {
    throw new Error("El stock debe ser un entero no negativo")
  }
  const medida = await repoMedidas.obtener(id)
  await repoMedidas.actualizar(
    id,
    { stockActual: stock, stockActualizadoEn: new Date() },
    `Actualizó stock de endmill a ${stock} pzas`
  )
  const alerta = medida
    ? alertaSiEntraEnCritico(id, medida, medida.stockActual, stock)
    : null
  if (alerta) await emitirAlertasStockCritico([alerta])
}

const MAX_CAMBIOS_EN_AUDITORIA = 20

/** Deja el detalle antes→después en la bitácora sin generar un resumen kilométrico. */
function resumirCambios(cambios: readonly string[]): string {
  if (cambios.length <= MAX_CAMBIOS_EN_AUDITORIA) return cambios.join(", ")
  const visibles = cambios.slice(0, MAX_CAMBIOS_EN_AUDITORIA).join(", ")
  return `${visibles} y ${cambios.length - MAX_CAMBIOS_EN_AUDITORIA} más`
}

export interface ConteoEndmillInput {
  id: string
  stockActual: number
  /** Stock que el usuario tenía a la vista cuando empezó a contar. */
  stockEsperado: number
}

/**
 * Guarda un conteo físico de varias medidas en una sola transacción.
 *
 * Solo debe recibir las filas que el usuario capturó de verdad. Cada una viaja
 * con el stock que tenía a la vista (`stockEsperado`): si alguien más lo movió
 * mientras contaba, la transacción aborta completa en vez de revertir el cambio
 * ajeno en silencio — el mismo criterio que usa `registrarPedidoEndmills`.
 */
export async function actualizarStockBatchEndmills(
  items: readonly ConteoEndmillInput[]
): Promise<void> {
  const limpios = items.map((item) => ({
    id: item.id,
    stockActual: Math.trunc(item.stockActual),
    stockEsperado: Math.trunc(item.stockEsperado),
  }))
  if (limpios.some((item) => !Number.isFinite(item.stockActual) || item.stockActual < 0)) {
    throw new Error("Todos los stocks deben ser enteros no negativos")
  }
  if (limpios.length === 0) return

  const ahora = new Date()
  let alertas: AlertaStockCriticoEndmill[] = []
  let cambios: string[] = []
  await runTransaction(db, async (transaction) => {
    // La transacción se puede reintentar, así que alertas y bitácora se
    // recalculan desde cero en cada intento y solo se usan tras el commit.
    const pendientes: AlertaStockCriticoEndmill[] = []
    const deltas: string[] = []
    const refs = limpios.map((item) => doc(repoMedidas.ref(), item.id))
    const snaps = await Promise.all(refs.map((ref) => transaction.get(ref)))
    const actuales = snaps.map((snap, idx) => {
      if (!snap.exists()) throw new Error(`La medida ${limpios[idx].id} no existe`)
      return EndmillMedidaSchema.parse(snap.data())
    })

    const conflictos = actuales
      .map((actual, idx) => ({ actual, esperado: limpios[idx].stockEsperado }))
      .filter(({ actual, esperado }) => actual.stockActual !== esperado)
      .map(
        ({ actual, esperado }) =>
          `${actual.descripcion} (viste ${esperado}, ahora hay ${actual.stockActual})`
      )
    if (conflictos.length > 0) {
      throw new Error(
        `Alguien más movió el stock mientras contabas, no se guardó nada. ` +
          `Actualiza la lista y vuelve a capturar: ${conflictos.join(" · ")}`
      )
    }

    actuales.forEach((actual, idx) => {
      const nuevoStock = limpios[idx].stockActual
      if (actual.stockActual === nuevoStock) return
      transaction.update(refs[idx], {
        stockActual: nuevoStock,
        stockActualizadoEn: ahora,
        actualizadoEn: ahora,
      })
      deltas.push(`${limpios[idx].id} ${actual.stockActual}→${nuevoStock}`)
      const alerta = alertaSiEntraEnCritico(
        limpios[idx].id,
        actual,
        actual.stockActual,
        nuevoStock
      )
      if (alerta) pendientes.push(alerta)
    })
    alertas = pendientes
    cambios = deltas
  })

  if (cambios.length > 0) {
    await auditarEndmillsBestEffort(
      "EDITAR",
      COLECCION_MEDIDAS,
      "conteo-masivo",
      `Conteo masivo de ${cambios.length} endmills: ${resumirCambios(cambios)}`
    )
  }
  await emitirAlertasStockCritico(alertas)
}

export async function confirmarMedidaEndmill(id: string): Promise<void> {
  await repoMedidas.actualizar(
    id,
    { requiereConfirmacion: false, actualizadoEn: new Date() },
    `Confirmó especificación/precio de endmill`
  )
}

export async function registrarPedidoEndmills(
  input: RegistrarPedidoEndmillsInput,
  actor: ActorEndmills
): Promise<string> {
  const parsed = RegistrarPedidoEndmillsInputSchema.parse(input)
  const incluidas = parsed.partidas.filter((partida) => partida.cantidadPedida > 0)
  if (incluidas.length === 0) throw new Error("Selecciona al menos una partida")

  const pedidoRef = doc(repoPedidos.ref())
  const medidaRefs = incluidas.map((partida) => doc(repoMedidas.ref(), partida.medidaId))
  const partidaRefs = incluidas.map((partida) =>
    doc(repoPartidas.ref(), `${pedidoRef.id}_${partida.medidaId}`)
  )

  await runTransaction(db, async (transaction) => {
    const medidaSnaps = await Promise.all(medidaRefs.map((ref) => transaction.get(ref)))
    const medidas = medidaSnaps.map((snapshot, index) => {
      if (!snapshot.exists()) {
        throw new Error(`La medida ${incluidas[index].medidaId} ya no existe`)
      }
      return EndmillMedidaSchema.parse(snapshot.data())
    })

    for (let index = 0; index < medidas.length; index++) {
      const medida = medidas[index]
      const borrador = incluidas[index]
      if (medida.stockActual !== borrador.stockRevisado) {
        throw new Error(
          `El stock de ${medida.descripcion} cambió de ${borrador.stockRevisado} a ${medida.stockActual}. Revisa el pedido otra vez.`
        )
      }
      if (medida.requiereConfirmacion && !borrador.confirmacionResuelta) {
        throw new Error(`Confirma la especificación y precio de ${medida.descripcion}`)
      }
    }

    const totales = calcularTotalesPedidoEndmills(
      incluidas,
      parsed.aliCostUSD,
      parsed.shippingUSD
    )
    const ahora = new Date()
    const pedido = PedidoEndmillsSchema.parse({
      id: pedidoRef.id,
      fecha: parsed.fecha,
      numeroProveedor: parsed.numeroProveedor,
      estado: "confirmado",
      proveedor: parsed.proveedor,
      moneda: "USD",
      ...totales,
      costosAdicionalesConfirmados: parsed.costosAdicionalesConfirmados,
      tipoCambioUSD: parsed.tipoCambioUSD ?? null,
      origen: "manual",
      motivoCancelacion: null,
      fechaRecepcionCompleta: null,
      diasLeadTime: null,
      creadoPorUid: actor.uid,
      creadoPorNombre: actor.nombre,
      creadoEn: ahora,
      actualizadoEn: ahora,
    })
    transaction.set(pedidoRef, pedido)

    for (let index = 0; index < medidas.length; index++) {
      const medida = medidas[index]
      const borrador = incluidas[index]
      const objetivoPar = calcularObjetivoPar(medida.stockActual, borrador.cantidadPedida)
      const partida = PartidaPedidoEndmillsSchema.parse({
        id: partidaRefs[index].id,
        pedidoId: pedidoRef.id,
        fechaPedido: parsed.fecha,
        tipo: "catalogada",
        medidaId: medida.id,
        categoria: medida.categoria,
        medidaPulgadas: medida.medidaPulgadas,
        descripcion: medida.descripcion,
        spec: medida.specPropuesta,
        stockAntesPedido: medida.stockActual,
        cantidadPedida: borrador.cantidadPedida,
        cantidadRecibida: 0,
        recepciones: [],
        precioUnitarioUSD: borrador.precioUnitarioUSD,
        subtotalUSD: redondearUSD(borrador.cantidadPedida * borrador.precioUnitarioUSD),
        objetivoPar,
        requiereConfirmacionAlCrear: medida.requiereConfirmacion,
        confirmacionResuelta: borrador.confirmacionResuelta,
        creadoEn: ahora,
        actualizadoEn: ahora,
      })
      transaction.set(partidaRefs[index], partida)
      transaction.update(medidaRefs[index], {
        objetivoPar,
        ultimoPedidoId: pedidoRef.id,
        actualizadoEn: ahora,
      })
    }
  })

  await auditarEndmillsBestEffort(
    "CREAR",
    COLECCION_PEDIDOS,
    pedidoRef.id,
    `Registró pedido de endmills con ${incluidas.length} partidas`
  )
  return pedidoRef.id
}

export async function registrarRecepcionPedidoEndmills(
  pedidoId: string,
  input: RecibirPedidoEndmillsInput
): Promise<void> {
  const parsed = RecibirPedidoEndmillsInputSchema.parse(input)
  const fechaRecepcion = parsed.fechaRecepcion || fechaHoyLocal()
  const todasLasPartidas = await listarPartidasPedidoEndmills(pedidoId)
  const recibidasPorId = new Map(
    parsed.partidas.map((partida) => [partida.partidaId, partida])
  )
  const partidaRefs = todasLasPartidas.map((partida) => doc(repoPartidas.ref(), partida.id))
  const catalogadas = todasLasPartidas.filter(
    (partida): partida is PartidaPedidoEndmills & { medidaId: string } =>
      partida.tipo === "catalogada" && partida.medidaId !== null
  )
  const medidaRefs = catalogadas.map((partida) => doc(repoMedidas.ref(), partida.medidaId))
  const pedidoRef = doc(repoPedidos.ref(), pedidoId)

  await runTransaction(db, async (transaction) => {
    const pedidoSnap = await transaction.get(pedidoRef)
    if (!pedidoSnap.exists()) throw new Error("Pedido no encontrado")
    const pedido = PedidoEndmillsSchema.parse(pedidoSnap.data())
    if (pedido.estado === "cancelado") throw new Error("No se puede recibir un pedido cancelado")

    const partidaSnaps = await Promise.all(partidaRefs.map((ref) => transaction.get(ref)))
    const medidaSnaps = await Promise.all(medidaRefs.map((ref) => transaction.get(ref)))
    const medidasPorId = new Map(
      medidaSnaps
        .filter((snapshot) => snapshot.exists())
        .map((snapshot) => [snapshot.id, EndmillMedidaSchema.parse(snapshot.data())])
    )
    const ahora = new Date()
    let completo = true

    for (let index = 0; index < partidaSnaps.length; index++) {
      const snapshot = partidaSnaps[index]
      if (!snapshot.exists()) throw new Error("Una partida del pedido ya no existe")
      const actual = PartidaPedidoEndmillsSchema.parse(snapshot.data())
      const borrador = recibidasPorId.get(actual.id)
      const nuevaCantidad = borrador?.cantidadRecibida ?? actual.cantidadRecibida
      if (nuevaCantidad < actual.cantidadRecibida || nuevaCantidad > actual.cantidadPedida) {
        throw new Error(`Cantidad recibida inválida para ${actual.descripcion}`)
      }
      if (nuevaCantidad < actual.cantidadPedida) completo = false
      const delta = nuevaCantidad - actual.cantidadRecibida
      if (delta > 0 && actual.medidaId) {
        const medida = medidasPorId.get(actual.medidaId)
        if (!medida) throw new Error(`La medida ${actual.medidaId} ya no existe`)
        transaction.update(doc(repoMedidas.ref(), actual.medidaId), {
          stockActual: medida.stockActual + delta,
          stockActualizadoEn: ahora,
          actualizadoEn: ahora,
        })
      }
      if (nuevaCantidad !== actual.cantidadRecibida) {
        const nuevasRecepciones = [...(actual.recepciones || [])]
        if (delta > 0) {
          // Firestore rechaza `undefined` (no usamos `ignoreUndefinedProperties`),
          // así que la llave `notas` solo se escribe cuando trae contenido real.
          const recepcion: RecepcionParcialEndmill = { cantidad: delta, fecha: fechaRecepcion }
          const notas = borrador?.notas?.trim()
          if (notas) recepcion.notas = notas
          nuevasRecepciones.push(recepcion)
        }
        transaction.update(partidaRefs[index], {
          cantidadRecibida: nuevaCantidad,
          recepciones: nuevasRecepciones,
          actualizadoEn: ahora,
        })
      }
    }

    const leadTime = completo ? diferenciaEnDias(pedido.fecha, fechaRecepcion) : null
    if (completo && leadTime === null) {
      throw new Error(
        `La fecha de recepción (${fechaRecepcion}) no puede ser anterior a la del pedido (${pedido.fecha}).`
      )
    }
    transaction.update(pedidoRef, {
      estado: completo ? "recibido" : "confirmado",
      fechaRecepcionCompleta: completo ? fechaRecepcion : null,
      diasLeadTime: completo ? leadTime : null,
      actualizadoEn: ahora,
    })
  })

  await auditarEndmillsBestEffort(
    "EDITAR",
    COLECCION_PEDIDOS,
    pedidoId,
    "Registró recepción de pedido de endmills"
  )
}

export async function cancelarPedidoEndmills(pedidoId: string, motivo: string): Promise<void> {
  const motivoLimpio = motivo.trim()
  if (!motivoLimpio) throw new Error("Indica el motivo de cancelación")
  const pedidoRef = doc(repoPedidos.ref(), pedidoId)
  const partidas = await listarPartidasPedidoEndmills(pedidoId)
  const catalogadas = partidas.filter(
    (partida): partida is PartidaPedidoEndmills & { medidaId: string } =>
      partida.tipo === "catalogada" && partida.medidaId !== null
  )
  const pedidos = await listarPedidosEndmills()
  const activos = new Set(
    pedidos.filter((pedido) => pedido.id !== pedidoId && pedido.estado !== "cancelado").map((pedido) => pedido.id)
  )
  const basesPrevias = new Map<string, PartidaPedidoEndmills | null>()
  await Promise.all(catalogadas.map(async (partida) => {
    const historial = await listarHistorialMedidaEndmills(partida.medidaId)
    basesPrevias.set(
      partida.medidaId,
      historial.find((anterior) => anterior.pedidoId !== pedidoId && activos.has(anterior.pedidoId)) ?? null
    )
  }))
  const medidaRefs = catalogadas.map((partida) => doc(repoMedidas.ref(), partida.medidaId))

  await runTransaction(db, async (transaction) => {
    const pedidoSnap = await transaction.get(pedidoRef)
    if (!pedidoSnap.exists()) throw new Error("Pedido no encontrado")
    const pedido = PedidoEndmillsSchema.parse(pedidoSnap.data())
    if (pedido.estado === "recibido") throw new Error("Un pedido recibido no se puede cancelar")
    if (pedido.estado === "cancelado") return
    const medidaSnaps = await Promise.all(medidaRefs.map((ref) => transaction.get(ref)))
    const ahora = new Date()
    transaction.update(pedidoRef, {
      estado: "cancelado",
      motivoCancelacion: motivoLimpio,
      actualizadoEn: ahora,
    })
    for (let index = 0; index < medidaSnaps.length; index++) {
      const medidaSnap = medidaSnaps[index]
      if (!medidaSnap.exists()) continue
      const medida = EndmillMedidaSchema.parse(medidaSnap.data())
      if (medida.ultimoPedidoId !== pedidoId) continue
      const previa = basesPrevias.get(medida.id) ?? null
      transaction.update(medidaRefs[index], {
        objetivoPar: previa?.objetivoPar ?? null,
        ultimoPedidoId: previa?.pedidoId ?? null,
        actualizadoEn: ahora,
      })
    }
  })

  await auditarEndmillsBestEffort(
    "EDITAR",
    COLECCION_PEDIDOS,
    pedidoId,
    `Canceló pedido de endmills: ${motivoLimpio}`
  )
}
