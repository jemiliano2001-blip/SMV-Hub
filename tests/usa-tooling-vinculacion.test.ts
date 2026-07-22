import { describe, it, expect } from "vitest"
import { aUSD, aMXN, TIPO_CAMBIO_DEFAULT_USD_MXN } from "../lib/tipo-cambio"
import {
  generarLlavePieza,
  llavesCoinciden,
  normalizarNumeroParte,
  matchProveedorPorNombre,
  simplificarDescripcion,
} from "../lib/pieza-matching"
import { detectarFantasmasEnMemoria } from "../lib/proveedores-vinculacion"
import {
  fusionarPuntosPrecio,
  resumirPreciosPorPiezaProveedor,
  evaluarAlertaPrecio,
  calcularConfiabilidadLeadTime,
  mapaConfiabilidad,
  generarScorecardsDesdeOrdenes,
  rankingMasBaratoPorCategoria,
  calcularKpisPorProveedor,
  aprenderProveedorPreferidoPorPieza,
  sugerirPrecioYProveedor,
  ofertasDesdeHistorico,
} from "../lib/proveedores-inteligencia-cruzada"
import { evaluarYRecomendarProveedores } from "../lib/motor-recomendador-proveedores"
import type {
  Cotizacion,
  CompraProveedor,
  CotizacionRequisicion,
  OrdenCompra,
  Proveedor,
} from "../lib/schemas"
import { OrdenCompraSchema, CotizacionSchema } from "../lib/schemas"

const provShars = {
  id: "shars-tool",
  nombre: "Shars Tool Company",
  estatus: "actual",
  tipoProveedor: "barato",
  barato: true,
  recomendado: true,
  categorias: ["endmills", "tooling"],
  pais: "Estados Unidos",
  moneda: "USD",
  facturaUSD: true,
  metodosPago: ["tarjeta"],
  tiempoRespuesta: "mismo_dia",
  frecuenciaCompra: "mensual",
  prioridad: "alta",
  calificacion: 4.8,
} as Proveedor

const provOnline = {
  id: "onlinecarbide",
  nombre: "OnlineCarbide",
  estatus: "actual",
  tipoProveedor: "barato",
  barato: true,
  recomendado: true,
  categorias: ["endmills"],
  pais: "Estados Unidos",
  moneda: "USD",
  facturaUSD: true,
  metodosPago: ["tarjeta"],
  tiempoRespuesta: "24_48h",
  frecuenciaCompra: "mensual",
  prioridad: "media",
  calificacion: 4.5,
} as Proveedor

describe("Tipo de cambio configurable", () => {
  it("convierte MXN a USD con el tipo dado", () => {
    expect(aUSD(400, "MXN", 20)).toBe(20)
    expect(aUSD(400, "MXN", 16)).toBe(25)
    expect(aUSD(20, "USD", 20)).toBe(20)
  })

  it("convierte USD a MXN", () => {
    expect(aMXN(10, "USD", 20)).toBe(200)
    expect(aMXN(200, "MXN", 20)).toBe(200)
  })

  it("usa default si tipo inválido", () => {
    expect(aUSD(400, "MXN", 0)).toBe(400 / TIPO_CAMBIO_DEFAULT_USD_MXN)
  })
})

describe("Llave de matching de pieza", () => {
  it("genera llave con número de parte normalizado", () => {
    const llave = generarLlavePieza("EM-1/2-4F", 'Endmill Carburo 1/2" 4 Flute')
    expect(normalizarNumeroParte("EM-1/2-4F")).toBe("EM124F")
    expect(llave.startsWith("EM124F|")).toBe(true)
  })

  it("coincide por número de parte aunque la descripción varíe", () => {
    const a = generarLlavePieza("ABC-123", "Endmill corto")
    const b = generarLlavePieza("ABC-123", "Endmill largo AlTiN")
    expect(llavesCoinciden(a, b)).toBe(true)
  })

  it("simplifica descripción quitando unidades", () => {
    expect(simplificarDescripcion("Fresa 10 pzas")).not.toContain("pza")
  })

  it("matchProveedorPorNombre encuentra por inclusión", () => {
    const m = matchProveedorPorNombre("Shars Tool", [provShars, provOnline])
    expect(m?.id).toBe("shars-tool")
  })
})

describe("Schemas con FKs opcionales", () => {
  it("OrdenCompra acepta proveedorId/cotizacionGanadoraId/requisicionId", () => {
    const res = OrdenCompraSchema.safeParse({
      id: "o1",
      proveedor: "Shars Tool Company",
      proveedorId: "shars-tool",
      cotizacionGanadoraId: "cot-1",
      requisicionId: "req-1",
      numeroFactura: null,
      fechaFactura: null,
      moneda: "USD",
      subtotal: 100,
      envio: 10,
      impuestos: 0,
      total: 110,
      items: [],
      requisitor: "",
      ordenTrabajo: "",
      empresa: "",
      cuentaCargo: "",
      destino: "",
      estado: "aprobada",
      creadoEn: new Date(),
      actualizadoEn: new Date(),
    })
    expect(res.success).toBe(true)
  })

  it("Cotizacion acepta proveedorId y llavePieza", () => {
    const res = CotizacionSchema.safeParse({
      id: "c1",
      solicitante: "Edgar",
      fecha: "2026-07-01",
      estatus: "cotizado",
      ubicacion: "USA",
      proveedor: "Shars",
      proveedorId: "shars-tool",
      descripcion: "Endmill 1/2",
      numeroParte: "EM-12",
      llavePieza: generarLlavePieza("EM-12", "Endmill 1/2"),
      cantidad: 10,
      precioUnitario: 25,
      moneda: "USD",
      total: 250,
      diasHabiles: "3 dias",
      link: null,
      notas: null,
      creadoEn: new Date(),
      actualizadoEn: new Date(),
    })
    expect(res.success).toBe(true)
  })
})

describe("Proveedores fantasma", () => {
  it("detecta nombres sin match en catálogo", () => {
    const fantasmas = detectarFantasmasEnMemoria(
      [
        { id: "o1", proveedor: "Shars Tool Company", proveedorId: null },
        { id: "o2", proveedor: "Proveedor Inventado XYZ", proveedorId: null },
      ],
      [{ id: "c1", proveedor: "Otro Fantasma", proveedorId: null }],
      [provShars, provOnline]
    )
    expect(fantasmas.some((f) => f.nombreLibre.includes("Inventado"))).toBe(true)
    expect(fantasmas.some((f) => f.nombreLibre.includes("Shars"))).toBe(false)
  })
})

describe("Inteligencia cruzada", () => {
  const historico: Cotizacion[] = [
    {
      id: "h1",
      solicitante: "Edgar",
      fecha: "2026-06-01",
      estatus: "cotizado",
      ubicacion: "USA",
      proveedor: "Shars Tool Company",
      proveedorId: "shars-tool",
      descripcion: "Endmill 1/2 AlTiN",
      numeroParte: "EM-12",
      llavePieza: generarLlavePieza("EM-12", "Endmill 1/2 AlTiN"),
      cantidad: 10,
      precioUnitario: 22,
      moneda: "USD",
      total: 220,
      diasHabiles: "3",
      link: null,
      notas: null,
      creadoEn: new Date(),
      actualizadoEn: new Date(),
    },
    {
      id: "h2",
      solicitante: "Edgar",
      fecha: "2026-07-01",
      estatus: "cotizado",
      ubicacion: "USA",
      proveedor: "OnlineCarbide",
      proveedorId: "onlinecarbide",
      descripcion: "Endmill 1/2 AlTiN",
      numeroParte: "EM-12",
      llavePieza: generarLlavePieza("EM-12", "Endmill 1/2 AlTiN"),
      cantidad: 10,
      precioUnitario: 28,
      moneda: "USD",
      total: 280,
      diasHabiles: "5",
      link: null,
      notas: null,
      creadoEn: new Date(),
      actualizadoEn: new Date(),
    },
  ]

  const compras: CompraProveedor[] = [
    {
      id: "cp1",
      proveedorId: "shars-tool",
      proveedorNombre: "Shars Tool Company",
      numeroOrden: "OC-1",
      fecha: "2026-06-15",
      producto: "Endmill 1/2 AlTiN",
      categoria: "endmills",
      marca: "Shars",
      cantidad: 10,
      precioUnitario: 21,
      moneda: "USD",
      costoTotal: 210,
      leadTimeRealDias: 4,
      notas: "",
    },
  ]

  const cotReq: CotizacionRequisicion[] = [
    {
      id: "cr1",
      requisicionId: "req1",
      proveedorId: "shars-tool",
      proveedorNombre: "Shars Tool Company",
      fechaCotizacion: "2026-06-10",
      moneda: "USD",
      condicionesPago: "Net 30",
      leadTimeDias: 3,
      costoEnvioUSD: 0,
      subtotal: 220,
      total: 220,
      itemsCotizados: [
        {
          itemId: "i1",
          descripcion: "Endmill 1/2 AlTiN",
          cantidad: 10,
          precioUnitario: 22,
          subtotal: 220,
        },
      ],
      ganadora: true,
    },
  ]

  it("fusiona precios de 3 fuentes y resume", () => {
    const puntos = fusionarPuntosPrecio(historico, compras, cotReq, 20)
    expect(puntos.length).toBeGreaterThanOrEqual(3)
    const resumen = resumirPreciosPorPiezaProveedor(puntos)
    expect(resumen.length).toBeGreaterThan(0)
    expect(resumen[0].precioMinUSD).toBeLessThanOrEqual(resumen[0].precioMaxUSD)
  })

  it("alerta precio caro vs histórico", () => {
    const puntos = fusionarPuntosPrecio(historico, compras, cotReq, 20)
    const resumen = resumirPreciosPorPiezaProveedor(puntos)
    const llave = generarLlavePieza("EM-12", "Endmill 1/2 AlTiN")
    const alerta = evaluarAlertaPrecio(40, "USD", llave, "shars-tool", resumen, 20)
    expect(alerta.tipo).toBe("caro")
  })

  it("alerta mejor que histórico", () => {
    const puntos = fusionarPuntosPrecio(historico, compras, cotReq, 20)
    const resumen = resumirPreciosPorPiezaProveedor(puntos)
    const llave = generarLlavePieza("EM-12", "Endmill 1/2 AlTiN")
    const alerta = evaluarAlertaPrecio(15, "USD", llave, "shars-tool", resumen, 20)
    expect(alerta.tipo).toBe("mejor_que_historico")
  })

  it("calcula confiabilidad lead time real vs prometido", () => {
    const conf = calcularConfiabilidadLeadTime(compras, cotReq)
    expect(conf.length).toBe(1)
    expect(conf[0].deltaPromedioDias).toBe(1) // 4 real - 3 prometido
    expect(conf[0].scoreConfiabilidad).toBe(4)
    const mapa = mapaConfiabilidad(conf)
    expect(mapa["shars-tool"]).toBe(4)
  })

  it("genera scorecard automática desde órdenes", () => {
    const ordenes = [
      {
        id: "o1",
        proveedor: "Shars Tool Company",
        proveedorId: "shars-tool",
        estado: "aprobada",
        moneda: "USD",
        total: 100,
      },
      {
        id: "o2",
        proveedor: "Shars Tool Company",
        proveedorId: "shars-tool",
        estado: "aprobada",
        moneda: "USD",
        total: 200,
      },
    ] as OrdenCompra[]
    const cards = generarScorecardsDesdeOrdenes(ordenes, compras, [provShars])
    expect(cards.length).toBe(1)
    expect(cards[0].scoreCumplimiento).toBeGreaterThanOrEqual(4)
  })

  it("ranking más barato por categoría", () => {
    const ranking = rankingMasBaratoPorCategoria(compras, 20)
    expect(ranking.some((r) => r.categoria === "endmills")).toBe(true)
    expect(ranking.find((r) => r.categoria === "endmills")?.proveedorId).toBe("shars-tool")
  })

  it("KPIs por proveedor separan USD y MXN", () => {
    const ordenes = [
      {
        id: "o1",
        proveedor: "Shars",
        proveedorId: "shars-tool",
        estado: "aprobada",
        moneda: "USD",
        total: 100,
      },
      {
        id: "o2",
        proveedor: "Shars",
        proveedorId: "shars-tool",
        estado: "aprobada",
        moneda: "MXN",
        total: 2000,
      },
    ] as OrdenCompra[]
    const kpis = calcularKpisPorProveedor(ordenes, compras, [provShars])
    expect(kpis[0].gastoUSD).toBe(100)
    expect(kpis[0].gastoMXN).toBe(2000)
  })

  it("aprende proveedor preferido y sugiere precio", () => {
    const prefs = aprenderProveedorPreferidoPorPieza(cotReq, historico, 20)
    expect(prefs.length).toBeGreaterThan(0)
    const sug = sugerirPrecioYProveedor("EM-12", "Endmill 1/2 AlTiN", prefs)
    expect(sug).not.toBeNull()
    expect(sug?.proveedorId).toBeTruthy()
  })

  it("genera ofertas de comparador desde histórico", () => {
    const ofertas = ofertasDesdeHistorico("Endmill 1/2 AlTiN", "EM-12", historico, [
      provShars,
      provOnline,
    ])
    expect(ofertas.length).toBe(2)
    expect(ofertas.every((o) => o.precioUnitario > 0)).toBe(true)
  })

  it("motor usa tipo de cambio y confiabilidad", () => {
    const conf = mapaConfiabilidad(calcularConfiabilidadLeadTime(compras, cotReq))
    const res = evaluarYRecomendarProveedores(
      [
        {
          proveedorId: "shars-tool",
          proveedorNombre: "Shars Tool Company",
          precioTotal: 220,
          moneda: "USD",
          leadTimeDias: 3,
        },
        {
          proveedorId: "onlinecarbide",
          proveedorNombre: "OnlineCarbide",
          precioTotal: 5600,
          moneda: "MXN",
          leadTimeDias: 5,
        },
      ],
      [provShars, provOnline],
      [],
      compras,
      undefined,
      20,
      conf
    )
    expect(res.evaluaciones.length).toBe(2)
    expect(res.proveedorRecomendado).not.toBeNull()
  })
})
