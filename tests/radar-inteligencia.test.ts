import { describe, it, expect } from "vitest"
import { detectarAtrasosOperativos } from "@/lib/radar/detector-atrasos"
import { detectarAnomaliasPrecio } from "@/lib/radar/detector-precios"
import { evaluarSaludOperativa } from "@/lib/radar/orquestador"
import type { Requisicion, PedidoAlmacen } from "@/lib/schemas"
import type { PuntoPrecioHistorico } from "@/lib/proveedores-inteligencia-cruzada"

describe("Radar de Inteligencia Operativa", () => {
  describe("detector-atrasos", () => {
    it("retorna arreglo vacío si no hay requisiciones ni pedidos", () => {
      const res = detectarAtrasosOperativos([], [], "2026-08-04")
      expect(res).toEqual([])
    })

    it("ignora requisiciones ya compradas o recibidas", () => {
      const reqComprada: Requisicion = {
        id: "req-1",
        tipo: "general",
        solicitante: "Juan",
        estado: "comprado",
        fechaPedido: "2026-07-01",
        tienda: "Shars",
        descripcion: "Endmill 1/2",
        link: null,
        cantidad: "5 pz",
        prioridad: "1-2 dias",
        empresa: "SMV",
        ordenServicio: null,
        parteNumero: null,
        fechaEntregaEst: null,
        recibio: null,
        revisionFinanzas: null,
        nota: null,
        creadoEn: new Date("2026-07-01"),
        actualizadoEn: new Date("2026-07-01"),
      }

      const res = detectarAtrasosOperativos([reqComprada], [], "2026-08-04")
      expect(res).toEqual([])
    })

    it("detecta requisiciones atrasadas por prioridad", () => {
      const reqAtrasada: Requisicion = {
        id: "req-2",
        folio: "REQ-2026-101",
        tipo: "general",
        solicitante: "Edgar",
        estado: "no_comprado",
        prioridadFlujo: "urgente",
        prioridad: "1-2 dias",
        fechaPedido: "2026-07-20",
        tienda: "McMaster",
        descripcion: "Tornillos Inox 1/4-20",
        link: null,
        cantidad: "50 pz",
        empresa: "SMV",
        ordenServicio: null,
        parteNumero: null,
        fechaEntregaEst: null,
        recibio: null,
        revisionFinanzas: null,
        nota: null,
        creadoEn: new Date("2026-07-20"),
        actualizadoEn: new Date("2026-07-20"),
      }

      const res = detectarAtrasosOperativos([reqAtrasada], [], "2026-08-04")
      expect(res.length).toBe(1)
      expect(res[0].id).toBe("req-2")
      expect(res[0].urgente).toBe(true)
      expect(res[0].solicitante).toBe("Edgar")
    })

    it("detecta pedidos de almacén pendientes y urgentes", () => {
      const pedUrgente: PedidoAlmacen = {
        id: "ped-1",
        descripcion: "Aceite Soluble Maquinado",
        urgente: true,
        estado: "pendiente",
        solicitadoPorUid: "uid-1",
        solicitadoPorNombre: "Carlos Almacén",
        ordenIdVinculada: null,
        creadoEn: new Date("2026-08-03T10:00:00Z"),
        actualizadoEn: new Date("2026-08-03T10:00:00Z"),
      }

      const res = detectarAtrasosOperativos([], [pedUrgente], "2026-08-04")
      expect(res.length).toBe(1)
      expect(res[0].tipo).toBe("pedido_almacen")
      expect(res[0].solicitante).toBe("Carlos Almacén")
      expect(res[0].urgente).toBe(true)
    })
  })

  describe("detector-precios", () => {
    it("retorna arreglo vacío si no hay suficientes puntos para comparar", () => {
      const puntos: PuntoPrecioHistorico[] = [
        {
          llavePieza: "endmill-1-2",
          descripcion: "Endmill 1/2",
          numeroParte: "EM-500",
          proveedorId: "shars",
          proveedorNombre: "Shars Tool",
          precioUnitarioUSD: 25.0,
          monedaOriginal: "USD",
          precioOriginal: 25.0,
          fecha: "2026-06-01",
          fuente: "compra",
          docId: "c-1",
        },
      ]

      const res = detectarAnomaliasPrecio(puntos)
      expect(res).toEqual([])
    })

    it("detecta desvío de precio superior al 15%", () => {
      const puntos: PuntoPrecioHistorico[] = [
        {
          llavePieza: "endmill-1-2",
          descripcion: "Endmill 1/2 Carburo",
          numeroParte: "EM-500",
          proveedorId: "shars",
          proveedorNombre: "Shars Tool",
          precioUnitarioUSD: 20.0,
          monedaOriginal: "USD",
          precioOriginal: 20.0,
          fecha: "2026-06-01",
          fuente: "compra",
          docId: "c-1",
        },
        {
          llavePieza: "endmill-1-2",
          descripcion: "Endmill 1/2 Carburo",
          numeroParte: "EM-500",
          proveedorId: "shars",
          proveedorNombre: "Shars Tool",
          precioUnitarioUSD: 28.0, // +40% de incremento
          monedaOriginal: "USD",
          precioOriginal: 28.0,
          fecha: "2026-08-01",
          fuente: "cotizacion_historica",
          docId: "c-2",
        },
      ]

      const res = detectarAnomaliasPrecio(puntos)
      expect(res.length).toBe(1)
      expect(res[0].porcentajeIncremento).toBe(40)
      expect(res[0].proveedorNombre).toBe("Shars Tool")
    })
  })

  describe("orquestador", () => {
    it("calcula score 100 y nivel 'optimo' sin problemas", () => {
      const diag = evaluarSaludOperativa({
        requisiciones: [],
        pedidosAlmacen: [],
        puntosPrecio: [],
        hoyISO: "2026-08-04",
      })

      expect(diag.scoreSaludOperativa).toBe(100)
      expect(diag.nivelSalud).toBe("optimo")
      expect(diag.totalAlertasCriticas).toBe(0)
    })

    it("penaliza score y marca 'critico' cuando hay atrasos urgentes y desvíos severos", () => {
      const reqUrgente: Requisicion = {
        id: "req-crit",
        folio: "REQ-URG-1",
        tipo: "general",
        solicitante: "Pedro",
        estado: "no_comprado",
        prioridadFlujo: "urgente",
        prioridad: "1-2 dias",
        fechaPedido: "2026-07-01",
        tienda: "Iscar",
        descripcion: "Inserto APMT 1604",
        link: null,
        cantidad: "20 pz",
        empresa: "SMV",
        ordenServicio: null,
        parteNumero: null,
        fechaEntregaEst: null,
        recibio: null,
        revisionFinanzas: null,
        nota: null,
        creadoEn: new Date("2026-07-01"),
        actualizadoEn: new Date("2026-07-01"),
      }

      const puntosAnomalia: PuntoPrecioHistorico[] = [
        {
          llavePieza: "inserto-apmt",
          descripcion: "Inserto APMT 1604",
          numeroParte: "APMT1604",
          proveedorId: "iscar",
          proveedorNombre: "Iscar",
          precioUnitarioUSD: 10.0,
          monedaOriginal: "USD",
          precioOriginal: 10.0,
          fecha: "2026-05-01",
          fuente: "compra",
          docId: "p-1",
        },
        {
          llavePieza: "inserto-apmt",
          descripcion: "Inserto APMT 1604",
          numeroParte: "APMT1604",
          proveedorId: "iscar",
          proveedorNombre: "Iscar",
          precioUnitarioUSD: 16.0, // +60%
          monedaOriginal: "USD",
          precioOriginal: 16.0,
          fecha: "2026-08-01",
          fuente: "cotizacion_historica",
          docId: "p-2",
        },
      ]

      const diag = evaluarSaludOperativa({
        requisiciones: [reqUrgente],
        pedidosAlmacen: [],
        puntosPrecio: puntosAnomalia,
        hoyISO: "2026-08-04",
      })

      expect(diag.scoreSaludOperativa).toBeLessThan(100)
      expect(diag.atrasos.length).toBe(1)
      expect(diag.anomaliasPrecio.length).toBe(1)
    })
  })
})
