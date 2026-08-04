/**
 * Repositorio genérico para colecciones de Firestore.
 *
 * Encapsula el boilerplate CRUD + auditoría automática + manejo de timestamps
 * que antes se copiaba en cada módulo de lib/.
 *
 * Uso:
 *   const repo = crearRepositorio<Operador>({ coleccion: "operadores" })
 *   await repo.crear(payload, "Creó operador: Juan (taller)")
 *   await repo.actualizar(id, cambios, "Actualizó operador")
 *   await repo.eliminar(id, "Eliminó operador")
 */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  deleteDoc,
  getCountFromServer,
  query,
  type QueryConstraint,
  type FirestoreDataConverter,
  type CollectionReference,
} from "firebase/firestore"
import { db, getClienteAuth } from "@/lib/firebase"
import { registrarAuditoria, type AccionAuditoria } from "@/lib/auditoria"
import {
  makeDateConverter,
  actualizarDocumento,
  crearLote,
  eliminarLote,
  actualizarLote,
} from "@/lib/firestore-helpers"

// ── Tipos ─────────────────────────────────────────────────────────────────────

type WithTimestamps = { id: string; creadoEn: Date; actualizadoEn: Date }

export interface ConfigRepositorio<T extends WithTimestamps> {
  /** Nombre de la colección en Firestore (e.g. "operadores"). */
  coleccion: string
  /** Converter custom. Si no se proporciona, se usa makeDateConverter<T>(). */
  converter?: FirestoreDataConverter<T>
}

export interface Repositorio<T extends WithTimestamps> {
  /** Referencia tipada a la colección (para queries custom). */
  ref: () => CollectionReference<T>

  /** Nombre de la colección. */
  readonly coleccion: string

  /** Crea un documento y registra auditoría. Devuelve el id generado. */
  crear(payload: Omit<T, "id" | "creadoEn" | "actualizadoEn">, resumen: string): Promise<string>

  /** Obtiene un documento por id. */
  obtener(id: string): Promise<T | null>

  /** Lista documentos con constraints opcionales (orderBy, where, limit, etc.). */
  listar(constraints?: QueryConstraint[]): Promise<T[]>

  /** Cuenta documentos en la colección. */
  contar(): Promise<number>

  /** Actualiza un documento y registra auditoría. */
  actualizar(
    id: string,
    cambios: Partial<Omit<T, "id" | "creadoEn">>,
    resumen?: string
  ): Promise<void>

  /** Elimina un documento y registra auditoría. */
  eliminar(id: string, resumen?: string): Promise<void>

  /** Inserta muchos documentos con writeBatch y registra auditoría. */
  crearEnLote(
    payloads: Record<string, unknown>[],
    resumen?: string,
    onProgreso?: (completadas: number, total: number) => void
  ): Promise<number>

  /** Elimina muchos documentos con writeBatch y registra auditoría. */
  eliminarEnLote(ids: string[], resumen?: string): Promise<number>

  /** Actualiza muchos documentos con writeBatch y registra auditoría. */
  actualizarEnLote(
    actualizaciones: Array<{ id: string; cambios: Record<string, unknown> }>,
    resumen?: string,
    onProgreso?: (completadas: number, total: number) => void
  ): Promise<number>
}

// ── Helpers internos ──────────────────────────────────────────────────────────

/** Obtiene el email del usuario autenticado (para auditoría). */
function emailUsuarioActual(): string | null | undefined {
  return getClienteAuth().currentUser?.email
}

/** Registra auditoría sin tumbar el flujo si falla (fire-and-forget seguro). */
async function auditar(
  accion: AccionAuditoria,
  coleccion: string,
  idDoc: string,
  resumen: string
): Promise<void> {
  await registrarAuditoria(emailUsuarioActual(), accion, coleccion, idDoc, resumen)
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function crearRepositorio<T extends WithTimestamps>(
  config: ConfigRepositorio<T>
): Repositorio<T> {
  const { coleccion } = config
  const converter = config.converter ?? makeDateConverter<T>()
  const colRef = () => collection(db, coleccion).withConverter(converter)

  return {
    ref: colRef,
    coleccion,

    async crear(payload, resumen) {
      const ahora = new Date()
      const ref = await addDoc(colRef(), {
        ...payload,
        creadoEn: ahora,
        actualizadoEn: ahora,
      } as T)
      await auditar("CREAR", coleccion, ref.id, resumen)
      return ref.id
    },

    async obtener(id) {
      const snap = await getDoc(doc(db, coleccion, id).withConverter(converter))
      return snap.exists() ? snap.data() : null
    },

    async listar(constraints = []) {
      const snap = await getDocs(query(colRef(), ...constraints))
      return snap.docs.map((d) => d.data())
    },

    async contar() {
      const snapshot = await getCountFromServer(colRef())
      return snapshot.data().count
    },

    async actualizar(id, cambios, resumen) {
      await actualizarDocumento(coleccion, id, cambios as Record<string, unknown>)
      if (resumen) {
        await auditar("EDITAR", coleccion, id, resumen)
      }
    },

    async eliminar(id, resumen) {
      await deleteDoc(doc(db, coleccion, id))
      await auditar("BORRAR", coleccion, id, resumen ?? "Eliminó documento")
    },

    async crearEnLote(payloads, resumen, onProgreso) {
      const result = await crearLote(colRef, payloads, onProgreso)
      if (resumen) {
        await auditar("CREAR", coleccion, "LOTE", resumen)
      }
      return result
    },

    async eliminarEnLote(ids, resumen) {
      const result = await eliminarLote(coleccion, ids)
      if (resumen) {
        await auditar("BORRAR", coleccion, "LOTE", resumen)
      }
      return result
    },

    async actualizarEnLote(actualizaciones, resumen, onProgreso) {
      const result = await actualizarLote(coleccion, actualizaciones, onProgreso)
      if (resumen) {
        await auditar("EDITAR", coleccion, "LOTE", resumen)
      }
      return result
    },
  }
}
