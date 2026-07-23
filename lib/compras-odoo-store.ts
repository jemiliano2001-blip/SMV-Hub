/**
 * Lectura del espejo de compras Odoo (solo Admin SDK escribe).
 */

import { collection, doc, getDoc, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { CompraOdooFacturaCrudo, CompraOdooItem, CompraOdooPoCrudo } from "@/lib/schemas"
import { makeDateConverter } from "@/lib/firestore-helpers"
import {
  listarMedidasEnCategoria,
  listarTiposEnCategoria,
  rangoPreciosPorFamilia,
  type CompraOdooItemNormalizado,
  type FiltroRangoFamilia,
  type RangoPreciosFamilia,
} from "@/lib/compras-odoo"

export type EstadoSyncComprasOdoo = {
  ultimaCorridaEn: Date | null
  ultimoError: string | null
  posSincronizados: number
  facturasSincronizadas: number
  itemsSincronizados: number
  proveedoresUpsert: number
}

const itemConverter = makeDateConverter<CompraOdooItem>()
const poConverter = makeDateConverter<CompraOdooPoCrudo>()
const facturaConverter = makeDateConverter<CompraOdooFacturaCrudo>()

export async function listarItemsComprasOdoo(): Promise<CompraOdooItem[]> {
  const snap = await getDocs(collection(db, "compras_odoo_items").withConverter(itemConverter))
  const items = snap.docs.map((d) => d.data())
  return items.sort((a, b) => (b.fecha ?? "").localeCompare(a.fecha ?? ""))
}

export async function listarPosComprasOdoo(): Promise<CompraOdooPoCrudo[]> {
  const snap = await getDocs(collection(db, "compras_odoo_po").withConverter(poConverter))
  const pos = snap.docs.map((d) => d.data())
  return pos.sort((a, b) => (b.fechaOrden ?? "").localeCompare(a.fechaOrden ?? ""))
}

export async function listarFacturasProveedorOdoo(): Promise<CompraOdooFacturaCrudo[]> {
  const snap = await getDocs(collection(db, "compras_odoo_facturas").withConverter(facturaConverter))
  const facturas = snap.docs.map((d) => d.data())
  return facturas.sort((a, b) => (b.fechaFactura ?? "").localeCompare(a.fechaFactura ?? ""))
}

export async function obtenerEstadoSyncComprasOdoo(): Promise<EstadoSyncComprasOdoo> {
  const snap = await getDoc(doc(db, "compras_odoo_sync_state", "odoo"))
  if (!snap.exists()) {
    return {
      ultimaCorridaEn: null,
      ultimoError: null,
      posSincronizados: 0,
      facturasSincronizadas: 0,
      itemsSincronizados: 0,
      proveedoresUpsert: 0,
    }
  }
  const data = snap.data()
  const ultimaCorridaEn = data.ultimaCorridaEn?.toDate
    ? data.ultimaCorridaEn.toDate()
    : null
  return {
    ultimaCorridaEn,
    ultimoError: data.ultimoError ?? null,
    posSincronizados: data.posSincronizados ?? 0,
    facturasSincronizadas: data.facturasSincronizadas ?? 0,
    itemsSincronizados: data.itemsSincronizados ?? 0,
    proveedoresUpsert: data.proveedoresUpsert ?? 0,
  }
}

function aNormalizado(item: CompraOdooItem): CompraOdooItemNormalizado {
  return {
    id: item.id,
    llaveItem: item.llaveItem,
    fuente: item.fuente,
    odooDocId: item.odooDocId,
    odooLineId: item.odooLineId,
    referenciaDoc: item.referenciaDoc,
    origenPo: item.origenPo,
    descripcion: item.descripcion,
    cantidad: item.cantidad,
    precioUnitario: item.precioUnitario,
    subtotal: item.subtotal,
    moneda: item.moneda,
    fecha: item.fecha,
    odooPartnerId: item.odooPartnerId,
    proveedorNombre: item.proveedorNombre,
    productOdooId: item.productOdooId,
    claveProdServ: item.claveProdServ,
    satPendiente: item.satPendiente,
    categoriaId: item.categoriaId,
    tipoMetal: item.tipoMetal,
    tipoInsumo: item.tipoInsumo ?? item.tipoMetal,
    medida: item.medida,
    unidad: item.unidad,
    esRfq: item.esRfq,
    origen: "odoo",
    odooCategoria: item.odooCategoria ?? null,
    odooUom: item.odooUom ?? null,
    odooCostoEstandar: item.odooCostoEstandar ?? null,
    odooRefInterna: item.odooRefInterna ?? null,
    clasificadoPorIa: item.clasificadoPorIa ?? false,
  }
}

export function calcularRangoPreciosDesdeItems(
  items: CompraOdooItem[],
  filtro: FiltroRangoFamilia
): RangoPreciosFamilia {
  return rangoPreciosPorFamilia(items.map(aNormalizado), filtro)
}

export function tiposDesdeItems(items: CompraOdooItem[], categoriaId: string): string[] {
  return listarTiposEnCategoria(items.map(aNormalizado), categoriaId)
}

/** @deprecated */
export function tiposMetalDesdeItems(items: CompraOdooItem[]): string[] {
  return tiposDesdeItems(items, "metals")
}

export function medidasDesdeItems(
  items: CompraOdooItem[],
  categoriaId: string,
  tipo?: string | null
): string[] {
  return listarMedidasEnCategoria(items.map(aNormalizado), categoriaId, tipo)
}
