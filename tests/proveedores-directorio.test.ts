import { describe, expect, it } from "vitest"
import {
  filtrarOrdenarDirectorio,
  requiereCatalogoCompleto,
} from "../lib/proveedores/directorio"
import type { Proveedor } from "../lib/schemas"

function proveedor(cambios: Partial<Proveedor>): Proveedor {
  return {
    id: "proveedor-base",
    nombre: "Proveedor Base",
    estatus: "actual",
    tipoProveedor: "estandar",
    barato: false,
    recomendado: false,
    categorias: ["tooling"],
    pais: "Estados Unidos",
    ubicacion: "",
    shippingAddressUSA: "",
    brokerAduanal: "",
    web: "",
    contacto: "",
    email: "",
    telefono: "",
    whatsapp: "",
    marcas: [],
    moneda: "USD",
    facturaUSD: true,
    metodosPago: ["tarjeta"],
    tiempoRespuesta: "mismo_dia",
    frecuenciaCompra: "mensual",
    prioridad: "media",
    leadTimeDias: null,
    pedidoMinimo: null,
    calificacion: 5,
    notas: "",
    experienciaCompra: "",
    creadoEn: "2026-07-22T00:00:00.000Z",
    actualizadoEn: "2026-07-22T00:00:00.000Z",
    ...cambios,
  } as Proveedor
}

const catalogo = [
  proveedor({
    id: "rapido",
    nombre: "Águila Tooling",
    categorias: ["endmills"],
    marcas: ["YG-1"],
    leadTimeDias: 2,
    calificacion: 4,
  }),
  proveedor({
    id: "premium",
    nombre: "Beta Industrial",
    categorias: ["insertos"],
    contacto: "María López",
    leadTimeDias: 8,
    calificacion: 5,
  }),
]

describe("directorio de proveedores", () => {
  it("busca sin depender de acentos y conserva todos los campos relevantes", () => {
    const resultado = filtrarOrdenarDirectorio(catalogo, {
      busqueda: "maria",
      categoria: "todas",
      orden: "nombre",
    })
    expect(resultado.map((item) => item.id)).toEqual(["premium"])
  })

  it("filtra por categoría y ordena por lead time sin mutar el catálogo", () => {
    const original = [...catalogo]
    const resultado = filtrarOrdenarDirectorio(catalogo, {
      busqueda: "",
      categoria: "endmills",
      orden: "leadTime",
    })
    expect(resultado.map((item) => item.id)).toEqual(["rapido"])
    expect(catalogo).toEqual(original)
  })

  it("solo exige catálogo completo para filtros, búsqueda u orden no paginable", () => {
    expect(
      requiereCatalogoCompleto({ busqueda: "", categoria: "todas", orden: "nombre" })
    ).toBe(false)
    expect(
      requiereCatalogoCompleto({ busqueda: "YG-1", categoria: "todas", orden: "nombre" })
    ).toBe(true)
    expect(
      requiereCatalogoCompleto({ busqueda: "", categoria: "todas", orden: "calificacion" })
    ).toBe(true)
  })
})
