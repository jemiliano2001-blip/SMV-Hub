import { describe, expect, it } from "vitest"
import { fuentesPermitidasPara, puedeVerPrecios, MODULO_POR_FUENTE } from "@/lib/memoria-operativa/permisos"
import { FuenteBusquedaIndiceSchema } from "@/lib/schemas"
import type { ModuloId } from "@/lib/schemas"

const usuario = (modulos: ModuloId[], esSuperAdmin = false) => ({ modulos, esSuperAdmin })

describe("fuentesPermitidasPara — tabla fuente → módulo compartida por Cmd+K y la memoria operativa", () => {
  it("cubre todas las fuentes del enum (agregar una fuente sin módulo rompe aquí, no en producción)", () => {
    expect(Object.keys(MODULO_POR_FUENTE).sort()).toEqual([...FuenteBusquedaIndiceSchema.options].sort())
  })

  it("super-admin ve todas las fuentes aunque no tenga módulos", () => {
    expect(fuentesPermitidasPara(usuario([], true))).toEqual(["orden-item", "proveedor", "cotizacion"])
  })

  it("cada módulo habilita solo su fuente", () => {
    expect(fuentesPermitidasPara(usuario(["ordenes"]))).toEqual(["orden-item"])
    expect(fuentesPermitidasPara(usuario(["proveedores"]))).toEqual(["proveedor"])
    expect(fuentesPermitidasPara(usuario(["cotizaciones"]))).toEqual(["cotizacion"])
  })

  it("criterio #7: un usuario sin `cotizaciones` nunca recibe la fuente cotizacion", () => {
    const fuentes = fuentesPermitidasPara(usuario(["ordenes", "proveedores", "almacen", "requisiciones"]))
    expect(fuentes).not.toContain("cotizacion")
    expect(fuentes).toEqual(["orden-item", "proveedor"])
  })

  it("sin módulos relevantes → lista vacía (la ruta responde 403 sin tocar Firestore)", () => {
    expect(fuentesPermitidasPara(usuario(["almacen", "banos"]))).toEqual([])
  })

  it("el orden es estable sin importar el orden de los módulos (clave de caché y `where in` iguales)", () => {
    expect(fuentesPermitidasPara(usuario(["cotizaciones", "ordenes"]))).toEqual(
      fuentesPermitidasPara(usuario(["ordenes", "cotizaciones"]))
    )
  })
})

describe("puedeVerPrecios — decisión #3 del plan del frente C", () => {
  it("ordenes o cotizaciones ven montos; almacén no; super-admin siempre", () => {
    expect(puedeVerPrecios(usuario(["ordenes"]))).toBe(true)
    expect(puedeVerPrecios(usuario(["cotizaciones"]))).toBe(true)
    expect(puedeVerPrecios(usuario(["almacen", "proveedores"]))).toBe(false)
    expect(puedeVerPrecios(usuario([], true))).toBe(true)
  })
})
