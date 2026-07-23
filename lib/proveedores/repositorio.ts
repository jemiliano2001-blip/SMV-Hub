import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { mapearProveedorDocumento, obtenerProveedores } from "@/lib/proveedores"
import type { Proveedor } from "@/lib/schemas"
import type { MercadoProveedor } from "@/lib/proveedores/directorio"

const COLECCION_PROVEEDORES = "proveedores"
const TAMANO_MAXIMO_PAGINA = 100

export type CursorProveedor = QueryDocumentSnapshot<DocumentData>

export interface SolicitudPaginaProveedores {
  mercado: MercadoProveedor
  tamano?: number
  cursor?: CursorProveedor | null
}

export interface PaginaProveedores {
  items: Proveedor[]
  siguienteCursor: CursorProveedor | null
  hayMas: boolean
}

export interface ResumenProveedores {
  usa: number
  mexico: number
  total: number
  sinMercado: number
}

function normalizarTamanoPagina(tamano: number): number {
  if (!Number.isFinite(tamano)) return 18
  return Math.min(TAMANO_MAXIMO_PAGINA, Math.max(1, Math.trunc(tamano)))
}

export async function obtenerPaginaProveedores({
  mercado,
  tamano = 18,
  cursor,
}: SolicitudPaginaProveedores): Promise<PaginaProveedores> {
  const tamanoSeguro = normalizarTamanoPagina(tamano)
  const items: Proveedor[] = []
  let cursorEscaneo = cursor ?? null

  // Se pagina el catálogo global para conservar documentos históricos sin `mercado`.
  // El mapper aplica la inferencia retrocompatible antes de filtrar el resultado visible.
  while (items.length < tamanoSeguro) {
    const restricciones: QueryConstraint[] = [orderBy("nombre", "asc")]
    if (cursorEscaneo) restricciones.push(startAfter(cursorEscaneo))
    restricciones.push(limit(tamanoSeguro + 1))

    const snapshot = await getDocs(query(collection(db, COLECCION_PROVEEDORES), ...restricciones))
    const hayOtroLote = snapshot.docs.length > tamanoSeguro
    const documentosEscaneados = snapshot.docs.slice(0, tamanoSeguro)

    if (documentosEscaneados.length === 0) {
      return { items, siguienteCursor: null, hayMas: false }
    }

    for (const [indice, documento] of documentosEscaneados.entries()) {
      cursorEscaneo = documento
      const proveedor = mapearProveedorDocumento(documento.id, documento.data())
      if (proveedor.mercado === mercado) items.push(proveedor)

      if (items.length === tamanoSeguro) {
        const quedanDocumentosEnLote = indice < documentosEscaneados.length - 1
        return {
          items,
          siguienteCursor: quedanDocumentosEnLote || hayOtroLote ? documento : null,
          hayMas: quedanDocumentosEnLote || hayOtroLote,
        }
      }
    }

    if (!hayOtroLote) {
      return { items, siguienteCursor: null, hayMas: false }
    }
  }

  return { items, siguienteCursor: cursorEscaneo, hayMas: true }
}

export async function obtenerTodosProveedoresMercado(
  mercado: MercadoProveedor
): Promise<Proveedor[]> {
  const proveedores: Proveedor[] = []
  let cursor: CursorProveedor | null = null
  let hayMas = true

  while (hayMas) {
    const pagina = await obtenerPaginaProveedores({
      mercado,
      tamano: TAMANO_MAXIMO_PAGINA,
      cursor,
    })
    proveedores.push(...pagina.items)
    cursor = pagina.siguienteCursor
    hayMas = pagina.hayMas
  }

  return proveedores
}

export async function obtenerCatalogoCompletoProveedores(): Promise<Proveedor[]> {
  return obtenerProveedores()
}

export async function obtenerResumenProveedores(): Promise<ResumenProveedores> {
  const referencia = collection(db, COLECCION_PROVEEDORES)
  const [total, usa, mexico] = await Promise.all([
    getCountFromServer(referencia),
    getCountFromServer(query(referencia, where("mercado", "==", "usa"))),
    getCountFromServer(query(referencia, where("mercado", "==", "mexico"))),
  ])
  const totalGeneral = total.data().count
  const totalUSA = usa.data().count
  const totalMexico = mexico.data().count
  return {
    usa: totalUSA,
    mexico: totalMexico,
    total: totalGeneral,
    sinMercado: Math.max(0, totalGeneral - totalUSA - totalMexico),
  }
}
