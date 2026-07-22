import { describe, it, expect } from "vitest"
import { calcularKpisAP, agruparPorProveedorAP } from "@/lib/finanzas-ap"
import type { FacturaProveedor } from "@/lib/schemas"

const mockFacturasProveedor: FacturaProveedor[] = [
  {
    id: "vi_1",
    odooId: 1,
    odooCompanyId: 1,
    numeroFactura: "BILL/2026/001",
    proveedorNombre: "Shars Tool",
    odooPartnerId: 101,
    fechaFactura: "2026-07-01",
    fechaVencimiento: "2026-07-15",
    moneda: "USD",
    subtotal: 1000,
    impuestos: 80,
    total: 1080,
    saldoPendiente: 1080,
    estadoPago: "not_paid",
    estado: "posted",
    tipo: "factura_proveedor",
    origenPo: "PO001",
    origen: "odoo",
    sincronizadoEn: new Date(),
    creadoEn: new Date(),
    actualizadoEn: new Date(),
  },
  {
    id: "vi_2",
    odooId: 2,
    odooCompanyId: 1,
    numeroFactura: "BILL/2026/002",
    proveedorNombre: "McMaster-Carr",
    odooPartnerId: 102,
    fechaFactura: "2026-06-01",
    fechaVencimiento: "2026-06-15",
    moneda: "USD",
    subtotal: 500,
    impuestos: 40,
    total: 540,
    saldoPendiente: 540,
    estadoPago: "not_paid",
    estado: "posted",
    tipo: "factura_proveedor",
    origenPo: "PO002",
    origen: "odoo",
    sincronizadoEn: new Date(),
    creadoEn: new Date(),
    actualizadoEn: new Date(),
  },
  {
    id: "vi_3",
    odooId: 3,
    odooCompanyId: 1,
    numeroFactura: "BILL/2026/003",
    proveedorNombre: "Shars Tool",
    odooPartnerId: 101,
    fechaFactura: "2026-07-10",
    fechaVencimiento: "2026-07-25",
    moneda: "USD",
    subtotal: 300,
    impuestos: 24,
    total: 324,
    saldoPendiente: 0, // Pagada
    estadoPago: "paid",
    estado: "posted",
    tipo: "factura_proveedor",
    origenPo: "PO003",
    origen: "odoo",
    sincronizadoEn: new Date(),
    creadoEn: new Date(),
    actualizadoEn: new Date(),
  },
]

describe("finanzas-ap", () => {
  it("calcula correctamente los KPIs de Cuentas por Pagar (AP) y Aging", () => {
    const hoy = new Date("2026-07-22")
    const kpis = calcularKpisAP(mockFacturasProveedor, hoy)

    expect(kpis.totalPorPagar).toBe(1620) // 1080 + 540
    expect(kpis.numFacturasPendientes).toBe(2)
    expect(kpis.numProveedoresConSaldo).toBe(2)

    // BILL 1 (due 2026-07-15) -> 7 días atrás -> alDia
    // BILL 2 (due 2026-06-15) -> 37 días atrás -> dias31a60
    expect(kpis.aging.alDia).toBe(1080)
    expect(kpis.aging.dias31a60).toBe(540)
  })

  it("agrupa correctamente facturas por proveedor", () => {
    const grupos = agruparPorProveedorAP(mockFacturasProveedor)
    expect(grupos.length).toBe(2)
    expect(grupos[0].proveedor).toBe("Shars Tool")
    expect(grupos[0].totalPorPagar).toBe(1080)
  })
})
