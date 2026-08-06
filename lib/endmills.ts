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
  type RecibirPedidoEndmillsInput,
  type RegistrarPedidoEndmillsInput,
} from "@/lib/schemas"
import {
  calcularObjetivoPar,
  calcularTotalesPedidoEndmills,
  redondearUSD,
} from "@/lib/endmills-calculos"

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

export async function actualizarStockEndmill(id: string, stockActual: number): Promise<void> {
  const stock = Math.trunc(stockActual)
  if (!Number.isFinite(stock) || stock < 0) {
    throw new Error("El stock debe ser un entero no negativo")
  }
  await repoMedidas.actualizar(
    id,
    { stockActual: stock, stockActualizadoEn: new Date() },
    `Actualizó stock de endmill a ${stock} pzas`
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
      origen: "manual",
      motivoCancelacion: null,
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
  const todasLasPartidas = await listarPartidasPedidoEndmills(pedidoId)
  const recibidasPorId = new Map(
    parsed.partidas.map((partida) => [partida.partidaId, partida.cantidadRecibida])
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
      const nuevaCantidad = recibidasPorId.get(actual.id) ?? actual.cantidadRecibida
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
        transaction.update(partidaRefs[index], {
          cantidadRecibida: nuevaCantidad,
          actualizadoEn: ahora,
        })
      }
    }

    transaction.update(pedidoRef, {
      estado: completo ? "recibido" : "confirmado",
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
