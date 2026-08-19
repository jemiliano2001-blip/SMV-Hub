import { describe, it, expect } from "vitest"
import { conciliarComprasConOdoo } from "@/lib/conciliaciones-odoo"
import type { OrdenCompra, FacturaProveedor } from "@/lib/schemas"

const mockOrdenesLocales: OrdenCompra[] = [
  {
    id: "ord_1",
    numeroFactura: "F-1001",
    fechaFactura: "2026-07-01",
    proveedor: "Shars Tool",
    proveedorId: "prov_1",
    requisitor: "Juan",
    ordenTrabajo: "OT-500",
    empresa: "SMV",
    destino: "SMV",
    cuentaCargo: "Stock",
    moneda: "USD",
    subtotal: 100,
    impuestos: 8,
    total: 108,
    envio: null,
    items: [
      {
        descripcion: "Endmill 1/2",
        descripcionSimplificada: "",
        cantidad: 2,
        precioUnitario: 50,
        total: 100,
        claveProdServ: null,
        satPendiente: false,
        empresa: "SMV",
        cuentaCargo: "Stock",
        requisitor: "Juan",
        ordenTrabajo: "OT-500",
      },
    ],
    estado: "aprobada",
    estadoRecepcion: "pendiente",
    creadoEn: new Date(),
    actualizadoEn: new Date(),
  },
  {
    id: "ord_2",
    numeroFactura: "F-1002",
    fechaFactura: "2026-07-02",
    proveedor: "McMaster-Carr",
    proveedorId: "prov_2",
    requisitor: "Pedro",
    ordenTrabajo: "OT-501",
    empresa: "SMV",
    destino: "SMV",
    cuentaCargo: "Consumibles",
    moneda: "USD",
    subtotal: 200,
    impuestos: 16,
    total: 216,
    envio: null,
    items: [],
    estado: "aprobada",
    estadoRecepcion: "pendiente",
    creadoEn: new Date(),
    actualizadoEn: new Date(),
  },
]

const mockFacturasOdoo: FacturaProveedor[] = [
  {
    id: "vi_1",
    odooId: 101,
    odooCompanyId: 1,
    numeroFactura: "F-1001",
    proveedorNombre: "Shars Tool",
    odooPartnerId: 1,
    fechaFactura: "2026-07-01",
    fechaVencimiento: "2026-07-15",
    moneda: "USD",
    subtotal: 100,
    impuestos: 8,
    total: 108, // Match exacto
    saldoPendiente: 108,
    estadoPago: "not_paid",
    estado: "posted",
    tipo: "factura_proveedor",
    origenPo: null,
    origen: "odoo",
    sincronizadoEn: new Date(),
    creadoEn: new Date(),
    actualizadoEn: new Date(),
  },
  {
    id: "vi_2",
    odooId: 102,
    odooCompanyId: 1,
    numeroFactura: "F-1002",
    proveedorNombre: "McMaster-Carr",
    odooPartnerId: 2,
    fechaFactura: "2026-07-02",
    fechaVencimiento: "2026-07-16",
    moneda: "USD",
    subtotal: 250,
    impuestos: 20,
    total: 270, // Desviación: 270 vs 216
    saldoPendiente: 270,
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

describe("conciliaciones-odoo", () => {
  it("detecta conciliaciones exactas y desviaciones de precio correctamente", () => {
    const resumen = conciliarComprasConOdoo(mockOrdenesLocales, mockFacturasOdoo)

    expect(resumen.totalConciliadas).toBe(1)
    expect(resumen.totalDesviaciones).toBe(1)
    expect(resumen.totalSoloLocal).toBe(0)
    expect(resumen.totalSoloOdoo).toBe(0)

    const desv = resumen.items.find((it) => it.estatus === "desviacion_precio")
    expect(desv).toBeDefined()
    expect(desv?.diferenciaMonto).toBe(54) // 270 - 216
  })
})
