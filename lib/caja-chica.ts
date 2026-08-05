import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  setDoc,
  doc,
  query,
  orderBy,
  where,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore"
import { db, getClienteAuth } from "@/lib/firebase"
import type { MovimientoCajaChica, CorteCaja } from "@/lib/schemas"
export type { CorteCaja }
import { makeDateConverter, actualizarDocumento } from "@/lib/firestore-helpers"
import { registrarAuditoria } from "@/lib/auditoria"
import { fechaHoyLocal } from "@/lib/format"

const movimientoConverter = makeDateConverter<MovimientoCajaChica>()
const cajaChicaRef = () => collection(db, "caja_chica_movimientos").withConverter(movimientoConverter)

const corteConverter = makeDateConverter<CorteCaja>()
const cajaChicaCortesRef = () => collection(db, "caja_chica_cortes").withConverter(corteConverter)

const COLECCION_CONFIG = "caja_chica_config"
const DOC_FONDO_FIJO = "fondo_fijo"
const COLECCION_ARQUEOS = "caja_chica_arqueos"

export type NuevoMovimientoCajaPayload = Omit<MovimientoCajaChica, "id" | "creadoEn" | "actualizadoEn" | "estadoCorte"> & {
  estadoCorte?: MovimientoCajaChica["estadoCorte"]
}

export type ModoFiltroCaja = "CICLO_ACTIVO" | "TODOS" | "CORTE" | "PERIODO"

export type OpcionesFiltroCaja = {
  modo?: ModoFiltroCaja
  corteId?: string
  periodo?: string
}

export async function listarMovimientosCajaChica(
  filtro?: string | OpcionesFiltroCaja
): Promise<MovimientoCajaChica[]> {
  const opts: OpcionesFiltroCaja =
    typeof filtro === "string"
      ? { modo: "PERIODO", periodo: filtro }
      : filtro ?? { modo: "CICLO_ACTIVO" }

  const modo = opts.modo ?? "CICLO_ACTIVO"

  // Traer lista de Firestore ordenada por fecha desc, creadoEn desc
  let q = query(cajaChicaRef(), orderBy("fecha", "desc"), orderBy("creadoEn", "desc"))

  if (modo === "PERIODO" && opts.periodo) {
    q = query(
      cajaChicaRef(),
      where("periodo", "==", opts.periodo),
      orderBy("fecha", "desc"),
      orderBy("creadoEn", "desc")
    )
  }

  const snap = await getDocs(q)
  const todos = snap.docs.map((d) => d.data()).filter((m) => !m.anulado)

  if (modo === "CICLO_ACTIVO") {
    // Muestra todos los movimientos acumulados que aún NO han sido cortados
    return todos.filter((m) => m.estadoCorte !== "CORTADO" && !m.corteId)
  }

  if (modo === "CORTE" && opts.corteId) {
    return todos.filter((m) => m.corteId === opts.corteId)
  }

  return todos
}

export async function crearMovimientoCajaChica(payload: NuevoMovimientoCajaPayload): Promise<string> {
  const ahora = new Date()
  const ref = await addDoc(cajaChicaRef(), {
    ...payload,
    estadoCorte: payload.estadoCorte ?? "ACTIVO",
    creadoEn: ahora,
    actualizadoEn: ahora,
  } as MovimientoCajaChica)

  const user = getClienteAuth().currentUser
  await registrarAuditoria(
    user?.email,
    "CREAR",
    "caja_chica_movimientos",
    ref.id,
    `Registró movimiento de caja chica (${payload.tipo}): $${payload.monto} - ${payload.descripcion}`
  )

  return ref.id
}

export async function actualizarMovimientoCajaChica(
  id: string,
  cambios: Partial<Omit<MovimientoCajaChica, "id" | "creadoEn">>
): Promise<void> {
  await actualizarDocumento("caja_chica_movimientos", id, cambios as Record<string, unknown>)
  const user = getClienteAuth().currentUser
  await registrarAuditoria(
    user?.email,
    "EDITAR",
    "caja_chica_movimientos",
    id,
    `Actualizó movimiento de caja chica: ${Object.keys(cambios).join(", ")}`
  )
}

// Soft delete: preserva el registro (trazabilidad de movimientos de dinero real)
export async function eliminarMovimientoCajaChica(id: string): Promise<void> {
  await actualizarDocumento("caja_chica_movimientos", id, { anulado: true })
  const user = getClienteAuth().currentUser
  await registrarAuditoria(user?.email, "BORRAR", "caja_chica_movimientos", id, "Anuló movimiento de caja chica")
}

// ── Fondo fijo (compartido en Firestore) ────────────────────────────────────

export async function obtenerFondoFijoCajaChica(): Promise<number> {
  const snap = await getDoc(doc(db, COLECCION_CONFIG, DOC_FONDO_FIJO))
  if (!snap.exists()) return 0
  const valor = snap.data().fondoFijo
  return typeof valor === "number" && valor >= 0 ? valor : 0
}

export async function guardarFondoFijoCajaChica(valor: number): Promise<void> {
  if (!(valor >= 0) || !Number.isFinite(valor)) {
    throw new Error("El fondo fijo debe ser un número no negativo.")
  }
  await setDoc(doc(db, COLECCION_CONFIG, DOC_FONDO_FIJO), {
    fondoFijo: valor,
    actualizadoEn: serverTimestamp(),
  })
  const user = getClienteAuth().currentUser
  await registrarAuditoria(
    user?.email,
    "EDITAR",
    COLECCION_CONFIG,
    DOC_FONDO_FIJO,
    `Actualizó el fondo fijo de caja chica a $${valor}`
  )
}

// ── Cortes de Caja (Cierre de ciclo activo & Reabastecimiento automático) ────

export async function listarCortesCaja(): Promise<CorteCaja[]> {
  const q = query(cajaChicaCortesRef(), orderBy("creadoEn", "desc"))
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data())
}

export type CrearCorteResultado = {
  corte: CorteCaja
  movimientosCortadosCount: number
}

export type OpcionesCorteCajaPayload = {
  nota?: string
  montoReabastecimiento?: number
}

export async function crearCorteCaja(options?: OpcionesCorteCajaPayload): Promise<CrearCorteResultado> {
  // 1. Obtener movimientos del ciclo activo
  const activos = await listarMovimientosCajaChica({ modo: "CICLO_ACTIVO" })

  if (activos.length === 0) {
    throw new Error("No hay movimientos activos acumulados para realizar un corte de caja.")
  }

  let totalEntradas = 0
  let totalSalidas = 0
  let fechaInicio = fechaHoyLocal()

  activos.forEach((m) => {
    if (m.tipo === "ENTRADA") {
      totalEntradas += m.monto
    } else {
      totalSalidas += m.monto
    }
    if (m.fecha && m.fecha < fechaInicio) {
      fechaInicio = m.fecha
    }
  })

  // 2. Determinar monto de reabastecimiento/reembolso entregado
  const montoReposicion =
    typeof options?.montoReabastecimiento === "number" &&
    Number.isFinite(options.montoReabastecimiento) &&
    options.montoReabastecimiento >= 0
      ? options.montoReabastecimiento
      : totalSalidas

  // 3. Generar Folio
  const cortesExistentes = await listarCortesCaja()
  const numConsecutivo = cortesExistentes.length + 1
  const hoy = fechaHoyLocal()
  const anio = new Date().getFullYear()
  const folio = `CORTE-${anio}-${String(numConsecutivo).padStart(3, "0")}`

  const user = getClienteAuth().currentUser
  const creadoPor = user?.email ?? "Administración"

  // 4. Crear documento de corte en Firestore
  const corteRef = doc(collection(db, "caja_chica_cortes"))
  const ahora = new Date()

  const corteData: CorteCaja = {
    id: corteRef.id,
    folio,
    fechaInicio,
    fechaCierre: hoy,
    totalEntradas,
    totalSalidas,
    saldoReembolsado: montoReposicion,
    cantidadMovimientos: activos.length,
    creadoPor,
    creadoEn: ahora,
    actualizadoEn: ahora,
    nota: options?.nota,
  }

  await setDoc(corteRef, corteData)

  // 5. Batch update movimientos a estado CORTADO con el corteId
  const batch = writeBatch(db)
  activos.forEach((m) => {
    const docRef = doc(db, "caja_chica_movimientos", m.id)
    batch.update(docRef, {
      estadoCorte: "CORTADO",
      corteId: corteRef.id,
      actualizadoEn: serverTimestamp(),
    })
  })
  await batch.commit()

  // 6. Generar la ENTRADA de reabastecimiento para el nuevo ciclo si montoReposicion > 0
  if (montoReposicion > 0) {
    await crearMovimientoCajaChica({
      fecha: hoy,
      periodo: hoy.substring(0, 7),
      descripcion: `Reabastecimiento de Caja Chica (${folio})`,
      proveedor: "Finanzas",
      categoria: "Recarga de Caja",
      solicitante: creadoPor,
      comprobante: "NINGUNO",
      deducible: false,
      tipo: "ENTRADA",
      monto: montoReposicion,
      costoReal: montoReposicion,
      ivaEstimado: 0,
      verificado: true,
      estadoCorte: "ACTIVO",
    })
  }

  await registrarAuditoria(
    creadoPor,
    "CREAR",
    "caja_chica_cortes",
    corteRef.id,
    `Realizó ${folio}: ${activos.length} movimientos cerrados, total gastado $${totalSalidas}, reembolsado $${montoReposicion}`
  )

  return {
    corte: corteData,
    movimientosCortadosCount: activos.length,
  }
}

// ── Arqueos de caja (conteo físico vs saldo teórico) ─────────────────────────

export type NuevoArqueoCajaPayload = {
  periodo: string
  efectivoFisico: number
  saldoTeorico: number
  diferencia: number
  nota?: string
}

export type ArqueoCaja = NuevoArqueoCajaPayload & {
  id: string
  creadoEn: Date
  creadoPor: string
}

export async function crearArqueoCaja(payload: NuevoArqueoCajaPayload): Promise<string> {
  const user = getClienteAuth().currentUser
  const ref = await addDoc(collection(db, COLECCION_ARQUEOS), {
    ...payload,
    creadoEn: serverTimestamp(),
    creadoPor: user?.email ?? "desconocido",
  })
  await registrarAuditoria(
    user?.email,
    "CREAR",
    COLECCION_ARQUEOS,
    ref.id,
    `Registró arqueo de caja chica: físico $${payload.efectivoFisico} vs teórico $${payload.saldoTeorico} (diferencia $${payload.diferencia})`
  )
  return ref.id
}

export async function listarArqueosCaja(periodo?: string): Promise<ArqueoCaja[]> {
  const ref = collection(db, COLECCION_ARQUEOS)
  const q = periodo
    ? query(ref, where("periodo", "==", periodo), orderBy("creadoEn", "desc"))
    : query(ref, orderBy("creadoEn", "desc"))
  const snap = await getDocs(q)
  return snap.docs.map((d) => {
    const data = d.data()
    return {
      id: d.id,
      periodo: data.periodo,
      efectivoFisico: data.efectivoFisico,
      saldoTeorico: data.saldoTeorico,
      diferencia: data.diferencia,
      nota: data.nota,
      creadoPor: data.creadoPor,
      creadoEn: data.creadoEn?.toDate?.() ?? new Date(),
    } as ArqueoCaja
  })
}
