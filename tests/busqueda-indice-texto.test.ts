import { describe, it, expect } from "vitest"
import {
  calcularTextoHash,
  construirEntradasOrden,
  construirEntradaProveedor,
  construirEntradaCotizacion,
  type CotizacionParaIndice,
  type OrdenParaIndice,
  type ProveedorParaIndice,
} from "../functions/src/busqueda-indice-texto"

describe("construirEntradasOrden", () => {
  const ordenBase: OrdenParaIndice = {
    id: "orden-1",
    proveedor: "Changzhou North Carbide",
    moneda: "USD",
    fechaFactura: "2026-06-01",
    items: [
      { descripcion: "4 Flute Carbide End Mill Fresa for Stainless Steel", precioUnitario: 12.5 },
    ],
  }

  it("arma texto, hash, título y metadata para un ítem real de factura abreviada", () => {
    const entradas = construirEntradasOrden(ordenBase)
    expect(entradas).toHaveLength(1)

    const [e] = entradas
    expect(e.id).toBe("orden-1#0")
    expect(e.refId).toBe("orden-1#0")
    expect(e.refPath).toBe("/ordenes?id=orden-1")
    expect(e.fuente).toBe("orden-item")
    expect(e.titulo).toBe("4 Flute Carbide End Mill Fresa for Stainless Steel")
    expect(e.texto).toContain("4 Flute Carbide End Mill")
    expect(e.texto).toContain("Proveedor: Changzhou North Carbide.")
    expect(e.textoHash).toBe(calcularTextoHash(e.texto))
    expect(e.metadata).toEqual({
      proveedorNombre: "Changzhou North Carbide",
      precio: 12.5,
      moneda: "USD",
      fecha: "2026-06-01",
      ordenId: "orden-1",
    })
  })

  it("genera un refId distinto por índice cuando la orden tiene varios ítems", () => {
    const orden: OrdenParaIndice = {
      ...ordenBase,
      items: [
        { descripcion: "Endmill 1/4 4FL", precioUnitario: 10 },
        { descripcion: "Endmill 3/8 4FL", precioUnitario: 15 },
      ],
    }
    const entradas = construirEntradasOrden(orden)
    expect(entradas.map((e) => e.refId)).toEqual(["orden-1#0", "orden-1#1"])
  })

  it("omite ítems sin descripción (evita indexar texto vacío)", () => {
    const orden: OrdenParaIndice = {
      ...ordenBase,
      items: [
        { descripcion: "   ", precioUnitario: 5 },
        { descripcion: "Resorte de compresión 9657K286", precioUnitario: 3 },
      ],
    }
    const entradas = construirEntradasOrden(orden)
    expect(entradas).toHaveLength(1)
    expect(entradas[0].titulo).toBe("Resorte de compresión 9657K286")
  })

  it("no duplica la descripción simplificada cuando es idéntica a la original", () => {
    const orden: OrdenParaIndice = {
      ...ordenBase,
      items: [
        {
          descripcion: "Sensor inductivo M12",
          descripcionSimplificada: "Sensor inductivo M12",
          precioUnitario: 20,
        },
      ],
    }
    const [e] = construirEntradasOrden(orden)
    // Debe aparecer una sola vez, no "Sensor inductivo M12. Sensor inductivo M12."
    expect(e.texto.match(/Sensor inductivo M12/g)).toHaveLength(1)
  })

  it("incluye la descripción simplificada cuando aporta algo distinto", () => {
    const orden: OrdenParaIndice = {
      ...ordenBase,
      items: [
        {
          descripcion: "IFM EFECTOR PN4221",
          descripcionSimplificada: "Sensor de proximidad inductivo M12",
          precioUnitario: 45,
        },
      ],
    }
    const [e] = construirEntradasOrden(orden)
    expect(e.texto).toContain("IFM EFECTOR PN4221")
    expect(e.texto).toContain("Sensor de proximidad inductivo M12")
  })

  it("omite las claves de metadata que la orden no trae, en vez de dejarlas en undefined", () => {
    const orden: OrdenParaIndice = {
      id: "orden-2",
      proveedor: "",
      moneda: "",
      fechaFactura: null,
      items: [{ descripcion: "Pieza sin datos completos", precioUnitario: null }],
    }
    const [e] = construirEntradasOrden(orden)
    // No basta con toBeUndefined(): una clave AUSENTE y una clave presente con
    // valor undefined dan lo mismo con obj.clave. El Admin SDK de Firestore sí
    // distingue — truena con un campo undefined — así que la prueba real es
    // que la clave no exista en el objeto.
    expect(Object.keys(e.metadata)).toEqual(["ordenId"])
    expect(e.texto).not.toContain("Proveedor:")
  })

  it("nunca produce un valor undefined en metadata (el Admin SDK de Firestore truena con eso)", () => {
    const orden: OrdenParaIndice = {
      id: "orden-3",
      proveedor: "",
      moneda: "",
      fechaFactura: null,
      items: [{ descripcion: "Pieza sin datos", precioUnitario: null }],
    }
    const [e] = construirEntradasOrden(orden)
    expect(Object.values(e.metadata)).not.toContain(undefined)
  })

  it("lleva proveedorId a metadata cuando la orden ya está vinculada al catálogo (frente B)", () => {
    const [e] = construirEntradasOrden({ ...ordenBase, proveedorId: "prov-mcmaster" })
    expect(e.metadata.proveedorId).toBe("prov-mcmaster")
    // Sin FK, la clave no existe (ni null ni undefined).
    const [sinFk] = construirEntradasOrden({ ...ordenBase, proveedorId: null })
    expect("proveedorId" in sinFk.metadata).toBe(false)
    // Y no cambia el texto (ni el hash): vincular un proveedor no obliga a re-embeber.
    expect(e.textoHash).toBe(sinFk.textoHash)
  })
})

describe("construirEntradaCotizacion", () => {
  const base: CotizacionParaIndice = {
    id: "cot-1",
    descripcion: "Sensor de proximidad inductivo M12 PNP",
    numeroParte: "PN2271",
    proveedor: "Acomee",
    proveedorId: "prov-acomee",
    precioUnitario: 850,
    moneda: "MXN",
    fecha: "2026-08-20",
    ubicacion: "MX",
    estatus: "cotizado",
    llavePieza: "PN2271|sensor de proximidad inductivo m12 pnp",
  }

  it("arma texto, hash, título, ruta y metadata completa para una cotización manual", () => {
    const e = construirEntradaCotizacion(base)
    expect(e).not.toBeNull()
    expect(e!.id).toBe("cot#cot-1")
    expect(e!.fuente).toBe("cotizacion")
    expect(e!.refId).toBe("cot-1")
    expect(e!.refPath).toBe("/cotizaciones?id=cot-1")
    expect(e!.texto).toBe("Sensor de proximidad inductivo M12 PNP. Parte: PN2271. Proveedor: Acomee.")
    expect(e!.textoHash).toBe(calcularTextoHash(e!.texto))
    expect(e!.titulo).toBe("Sensor de proximidad inductivo M12 PNP")
    expect(e!.metadata).toEqual({
      proveedorNombre: "Acomee",
      proveedorId: "prov-acomee",
      precio: 850,
      moneda: "MXN",
      fecha: "2026-08-20",
      cotizacionId: "cot-1",
      numeroParte: "PN2271",
      llavePieza: "PN2271|sensor de proximidad inductivo m12 pnp",
      ubicacion: "MX",
      estatus: "cotizado",
    })
  })

  it("excluye las filas origen=compra: ya están como orden-item y duplicarían cada compra", () => {
    expect(construirEntradaCotizacion({ ...base, origen: "compra" })).toBeNull()
    // origen ausente (legacy) o "cotizacion" sí se indexan.
    expect(construirEntradaCotizacion({ ...base, origen: undefined })).not.toBeNull()
    expect(construirEntradaCotizacion({ ...base, origen: "cotizacion" })).not.toBeNull()
  })

  it("indexa la fila con precio 0 o null para recuperación, pero sin `precio` en metadata", () => {
    const cero = construirEntradaCotizacion({ ...base, precioUnitario: 0 })
    expect(cero).not.toBeNull()
    expect("precio" in cero!.metadata).toBe(false)
    const nulo = construirEntradaCotizacion({ ...base, precioUnitario: null })
    expect("precio" in nulo!.metadata).toBe(false)
  })

  it("omite descripción vacía y no deja fragmentos ni claves undefined cuando faltan datos", () => {
    expect(construirEntradaCotizacion({ ...base, descripcion: "   " })).toBeNull()
    const e = construirEntradaCotizacion({
      ...base,
      numeroParte: null,
      proveedor: "",
      proveedorId: null,
      precioUnitario: null,
      moneda: "",
      fecha: null,
      ubicacion: "",
      estatus: "",
      llavePieza: null,
    })
    expect(e!.texto).toBe("Sensor de proximidad inductivo M12 PNP")
    expect(Object.keys(e!.metadata)).toEqual(["cotizacionId"])
    expect(Object.values(e!.metadata)).not.toContain(undefined)
  })

  it("el hash depende solo del texto: cambiar precio, fecha o estatus refresca metadata sin re-embeber", () => {
    const a = construirEntradaCotizacion(base)!
    const b = construirEntradaCotizacion({ ...base, precioUnitario: 900, fecha: "2026-09-01", estatus: "cancelado" })!
    expect(b.textoHash).toBe(a.textoHash)
    expect(b.metadata.precio).toBe(900)
  })
})

describe("construirEntradaProveedor", () => {
  it("arma texto compacto con nombre + categorías + marcas", () => {
    const proveedor: ProveedorParaIndice = {
      id: "prov-1",
      nombre: "RYASA (Rodamientos y Accesorios)",
      categorias: ["tooling", "consumibles"],
      marcas: ["SKF", "NSK"],
      mercado: "mexico",
    }
    const e = construirEntradaProveedor(proveedor)
    expect(e).not.toBeNull()
    expect(e?.refPath).toBe("/proveedores?id=prov-1")
    expect(e?.titulo).toBe("RYASA (Rodamientos y Accesorios)")
    expect(e?.texto).toBe("RYASA (Rodamientos y Accesorios) Categorías: tooling, consumibles. Marcas: SKF, NSK.")
    expect(e?.metadata).toEqual({ mercado: "mexico", categorias: ["tooling", "consumibles"] })
  })

  it("no deja fragmentos colgantes ni claves undefined cuando no hay categorías ni marcas ni mercado", () => {
    const proveedor: ProveedorParaIndice = {
      id: "prov-2",
      nombre: "Proveedor Genérico",
      categorias: [],
      marcas: [],
    }
    const e = construirEntradaProveedor(proveedor)
    expect(e?.texto).toBe("Proveedor Genérico")
    expect(e?.metadata).toEqual({})
    expect(Object.values(e?.metadata ?? {})).not.toContain(undefined)
  })

  it("retorna null cuando el proveedor no tiene nombre", () => {
    const proveedor: ProveedorParaIndice = {
      id: "prov-3",
      nombre: "   ",
      categorias: ["tooling"],
      marcas: [],
    }
    expect(construirEntradaProveedor(proveedor)).toBeNull()
  })
})

describe("calcularTextoHash", () => {
  it("es determinístico: mismo texto produce mismo hash", () => {
    expect(calcularTextoHash("hola mundo")).toBe(calcularTextoHash("hola mundo"))
  })

  it("distingue textos distintos", () => {
    expect(calcularTextoHash("hola mundo")).not.toBe(calcularTextoHash("hola mundo!"))
  })
})
