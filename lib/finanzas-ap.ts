import { collection, getDocs, query, orderBy, where } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { FacturaProveedor } from "@/lib/schemas"
import { makeDateConverter } from "@/lib/firestore-helpers"
import { fechaHoyLocal } from "@/lib/format"

export type { FacturaProveedor }

const facturaProveedorConverter = makeDateConverter<FacturaProveedor>()
const facturasProveedorRef = () => collection(db, "compras_odoo_facturas").withConverter(facturaProveedorConverter)

export type AgingAP = {
  alDia: number
  dias31a60: number
  dias61a90: number
  mas90Dias: number
}

export type KpisCuentasPorPagar = {
  totalPorPagar: number
  subtotalPorPagar: number
  numFacturasPendientes: number
  numProveedoresConSaldo: number
  aging: AgingAP
}

export type GrupoProveedorAP = {
  proveedor: string
  odooPartnerId: number
  facturas: FacturaProveedor[]
  totalPorPagar: number
  facturasPendientes: number
  pctDelTotal: number
}

export async function listarFacturasProveedor(): Promise<FacturaProveedor[]> {
  const snap = await getDocs(query(facturasProveedorRef(), orderBy("fechaFactura", "desc")))
  return snap.docs.map((d) => d.data())
}

export async function listarFacturasProveedorPorPeriodo(
  desde: string,
  hasta: string
): Promise<FacturaProveedor[]> {
  const q = query(
    facturasProveedorRef(),
    where("fechaFactura", ">=", desde),
    where("fechaFactura", "<=", hasta),
    orderBy("fechaFactura", "desc")
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data())
}

function esValidaAP(f: FacturaProveedor): boolean {
  return f.estado === "posted"
}

function signoAP(f: FacturaProveedor): 1 | -1 {
  return f.tipo === "nota_credito_proveedor" ? -1 : 1
}

export function facturasValidasAP(facturas: FacturaProveedor[]): FacturaProveedor[] {
  return facturas.filter(esValidaAP)
}

export function calcularKpisAP(
  facturas: FacturaProveedor[],
  hoy: Date = new Date()
): KpisCuentasPorPagar {
  const validas = facturasValidasAP(facturas)
  const pendientes = validas.filter((f) => f.saldoPendiente > 0)
  const hoyStr = fechaHoyLocal(hoy)

  const aging: AgingAP = {
    alDia: 0,
    dias31a60: 0,
    dias61a90: 0,
    mas90Dias: 0,
  }

  for (const f of pendientes) {
    const s = signoAP(f)
    const monto = s * f.saldoPendiente
    const refFecha = f.fechaVencimiento || f.fechaFactura || hoyStr
    
    // Diferencia en días entre la fecha de referencia y hoy
    const fechaRefDate = new Date(refFecha)
    const hoyDate = new Date(hoyStr)
    const diffTime = hoyDate.getTime() - fechaRefDate.getTime()
    const diffDias = Math.floor(diffTime / (1000 * 3600 * 24))

    if (diffDias <= 30) {
      aging.alDia += monto
    } else if (diffDias <= 60) {
      aging.dias31a60 += monto
    } else if (diffDias <= 90) {
      aging.dias61a90 += monto
    } else {
      aging.mas90Dias += monto
    }
  }

  const totalPorPagar = pendientes.reduce((acc, f) => acc + signoAP(f) * f.saldoPendiente, 0)
  const subtotalPorPagar = pendientes.reduce((acc, f) => acc + signoAP(f) * f.subtotal, 0)

  const proveedoresUnicos = new Set(pendientes.map((f) => f.proveedorNombre))

  return {
    totalPorPagar,
    subtotalPorPagar,
    numFacturasPendientes: pendientes.length,
    numProveedoresConSaldo: proveedoresUnicos.size,
    aging,
  }
}

export function agruparPorProveedorAP(facturas: FacturaProveedor[]): GrupoProveedorAP[] {
  const validas = facturasValidasAP(facturas)
  const totalGeneral = validas.reduce((s, f) => s + (f.saldoPendiente > 0 ? signoAP(f) * f.saldoPendiente : 0), 0)

  const map = new Map<string, FacturaProveedor[]>()
  for (const f of validas) {
    const key = f.proveedorNombre || "Sin Proveedor"
    const arr = map.get(key) ?? []
    arr.push(f)
    map.set(key, arr)
  }

  return Array.from(map.entries())
    .map(([proveedor, fs]) => {
      const facturasPendientesArr = fs.filter((f) => f.saldoPendiente > 0)
      const totalPorPagar = facturasPendientesArr.reduce((s, f) => s + signoAP(f) * f.saldoPendiente, 0)
      const odooPartnerId = fs[0]?.odooPartnerId ?? 0

      return {
        proveedor,
        odooPartnerId,
        facturas: fs,
        totalPorPagar,
        facturasPendientes: facturasPendientesArr.length,
        pctDelTotal: totalGeneral > 0 ? (totalPorPagar / totalGeneral) * 100 : 0,
      }
    })
    .sort((a, b) => b.totalPorPagar - a.totalPorPagar)
}
