import { describe, it, expect } from "vitest"
import { calcularFlujoCaja } from "@/lib/flujo-caja"
import type { FacturaCliente, FacturaProveedor } from "@/lib/schemas"

const mockFacturasCliente: FacturaCliente[] = [
  {
    id: "odoo_1",
    odooId: 1,
    odooCompanyId: 1,
    numeroFactura: "INV/2026/001",
    cliente: "Cliente A",
    odooPartnerId: 201,
    fechaFactura: "2026-07-05",
    fechaVencimiento: "2026-07-20",
    moneda: "MXN",
    subtotal: 10000,
    impuestos: 1600,
    total: 11600,
    saldoPendiente: 11600,
    montoPagado: 0,
    estadoPago: "no_pagado",
    estado: "publicado",
    tipo: "factura",
    referencia: null,
    origenVenta: null,
    origen: "odoo",
    sincronizadoEn: new Date(),
    creadoEn: new Date(),
    actualizadoEn: new Date(),
  },
]

const mockFacturasProveedor: FacturaProveedor[] = [
  {
    id: "vi_1",
    odooId: 1,
    odooCompanyId: 1,
    numeroFactura: "BILL/2026/001",
    proveedorNombre: "Proveedor B",
    odooPartnerId: 101,
    fechaFactura: "2026-07-02",
    fechaVencimiento: "2026-07-18",
    moneda: "MXN",
    subtotal: 4000,
    impuestos: 640,
    total: 4640,
    saldoPendiente: 4640,
    estadoPago: "not_paid",
    estado: "posted",
    tipo: "factura_proveedor",
    origenPo: null,
    origen: "odoo",
    sincronizadoEn: new Date(),
    creadoEn: new Date(),
    actualizadoEn: new Date(),
  },
]

describe("flujo-caja", () => {
  it("calcula el flujo de caja proyectado neto (AR - AP)", () => {
    const resumen = calcularFlujoCaja(mockFacturasCliente, mockFacturasProveedor, "MXN")

    expect(resumen.totalIngresosEsperados).toBe(11600)
    expect(resumen.totalEgresosComprometidos).toBe(4640)
    expect(resumen.balanceNetoProyectado).toBe(6960) // 11600 - 4640
    expect(resumen.coberturaPorcentaje).toBeGreaterThan(100)
    expect(resumen.puntosSemanales.length).toBeGreaterThan(0)
  })
})
