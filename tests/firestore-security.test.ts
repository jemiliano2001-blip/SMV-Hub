import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const raiz = resolve(import.meta.dirname, "..")

describe("reglas de firestore para configuraciones", () => {
  it("permite lectura y escritura de configuraciones a usuarios autorizados", () => {
    const reglas = readFileSync(resolve(raiz, "firestore.rules"), "utf8")
    const bloque = reglas.match(/match \/configuraciones\/\{configId\} \{([\s\S]*?)\n    \}/)?.[1]

    expect(bloque).toBeTruthy()
    expect(bloque).toMatch(/allow read, create, update: if esUsuarioAutorizado\(\);/)
  })
})

describe("reglas de firestore para horas extra", () => {
  it("la lectura es abierta pero la escritura exige puedeEditarHorasExtra", () => {
    const reglas = readFileSync(resolve(raiz, "firestore.rules"), "utf8")
    const bloque = reglas.match(/match \/horas-extra\/\{horaId\} \{([\s\S]*?)\n    \}/)?.[1]

    expect(bloque).toBeTruthy()
    expect(bloque).toMatch(/allow read: if esUsuarioAutorizado\(\);/)
    expect(bloque).toMatch(/allow create: if puedeEditarHorasExtra\(\)/)
    expect(bloque).toMatch(/allow update: if puedeEditarHorasExtra\(\)/)
    expect(bloque).toMatch(/allow delete: if puedeEditarHorasExtra\(\);/)
    expect(bloque).not.toMatch(/allow create: if esUsuarioAutorizado\(\)/)
  })

  it("puedeEditarHorasExtra cubre admin/compras, super-admin y el flag por usuario", () => {
    const reglas = readFileSync(resolve(raiz, "firestore.rules"), "utf8")
    const fn = reglas.match(/function puedeEditarHorasExtra\(\) \{([\s\S]*?)\n    \}/)?.[1]

    expect(fn).toBeTruthy()
    expect(fn).toMatch(/esSuperAdminDoc\(\)/)
    expect(fn).toMatch(/docUsuario\(\)\.rol in \['admin', 'compras', 'automatizacion'\]/)
    expect(fn).toMatch(/docUsuario\(\)\.plantilla in \['admin', 'compras', 'automatizacion'\]/)
    expect(fn).toMatch(/docUsuario\(\)\.editaHorasExtra == true/)
  })
})

describe("reglas de firestore para notificaciones leídas", () => {
  it("separa la lectura de la validación exclusiva de escrituras", () => {
    const reglas = readFileSync(resolve(raiz, "firestore.rules"), "utf8")
    const bloque = reglas.match(
      /match \/notificaciones_leidas\/\{notificacionId\} \{([\s\S]*?)\n      \}/
    )?.[1]

    expect(bloque).toBeTruthy()
    expect(bloque).toMatch(
      /allow read: if estaAutenticado\(\)[\s\S]*?request\.auth\.uid == uid;/
    )
    expect(bloque).toMatch(
      /allow create, update: if estaAutenticado\(\)[\s\S]*?request\.resource\.data\.keys\(\)\.hasOnly\(\['leidoEn'\]\)/
    )
    expect(bloque).not.toMatch(/allow read, create, update/)
  })
})

describe("reglas de firestore para el feed de notificaciones", () => {
  it("no concede un feed global y exige audiencia/destinatario en cada lectura", () => {
    const reglas = readFileSync(resolve(raiz, "firestore.rules"), "utf8")
    const bloque = reglas.match(
      /function puedeVerNotificacion\(d\) \{([\s\S]*?)\n    \}/
    )?.[1]

    expect(bloque).toBeTruthy()
    expect(bloque).toMatch(/d\.destinatarioUid == request\.auth\.uid/)
    expect(bloque).toMatch(/d\.audiencia == 'documentos-venta'/)
    expect(bloque).toMatch(/d\.audiencia == 'banos'/)
    expect(reglas).not.toMatch(/function puedeVerNotificaciones\(\)/)
    expect(reglas).toMatch(/allow read: if puedeVerNotificacion\(resource\.data\);/)
  })

  it("liga tipo, origen y audiencia, y no permite que el cliente emita baños", () => {
    const reglas = readFileSync(resolve(raiz, "firestore.rules"), "utf8")
    const bloque = reglas.match(
      /function puedeCrearNotificacion\(\) \{([\s\S]*?)\n    \}/
    )?.[1]

    expect(bloque).toBeTruthy()
    expect(bloque).toMatch(/creadoPorUid == request\.auth\.uid/)
    expect(bloque).toMatch(/audiencia == 'pedidos-almacen'/)
    expect(bloque).toMatch(/audiencia == 'requisiciones'/)
    expect(bloque).toMatch(/audiencia == 'documentos-venta'/)
    expect(bloque).not.toMatch(/audiencia == 'banos'/)
    expect(reglas).toMatch(/solicitadoPorUid ==\s*request\.resource\.data\.destinatarioUid/)
  })
})

describe("reglas de firestore para proveedores", () => {
  it("separa lectura operativa de escritura/borrado por modulo", () => {
    const reglas = readFileSync(resolve(raiz, "firestore.rules"), "utf8")
    const bloque = reglas.match(/match \/proveedores\/\{proveedorId\} \{([\s\S]*?)\n    \}/)?.[1]

    expect(bloque).toBeTruthy()
    expect(bloque).toMatch(/allow read: if esProveedoresAutorizado\(\);/)
    expect(bloque).toMatch(/allow delete: if esProveedoresEditor\(\);/)
    expect(bloque).not.toMatch(/allow read, delete: if esUsuarioAutorizado\(\);/)

    const editor = reglas.match(/function esProveedoresEditor\(\) \{([\s\S]*?)\n    \}/)?.[1]
    expect(editor).toBeTruthy()
    expect(editor).toMatch(/tieneModulo\('proveedores'\)/)
    expect(editor).toMatch(/esSuperAdminDoc\(\)/)
  })
})

describe("reglas de alcance para almacén y solicitudes de venta", () => {
  it("exige el módulo correspondiente para almacén y pedidos de almacén", () => {
    const reglas = readFileSync(resolve(raiz, "firestore.rules"), "utf8")
    const entradas = reglas.match(/match \/almacen-entradas\/\{entradaId\} \{([\s\S]*?)\n    \}/)?.[1]
    const salidas = reglas.match(/match \/almacen-salidas\/\{salidaId\} \{([\s\S]*?)\n    \}/)?.[1]
    const pedidos = reglas.match(/match \/pedidos-almacen\/\{pedidoId\} \{([\s\S]*?)\n    \}/)?.[1]

    expect(entradas).toMatch(/tieneModulo\('almacen'\)/)
    expect(salidas).toMatch(/tieneModulo\('almacen'\)/)
    expect(pedidos).toMatch(/allow read: if esUsuarioAutorizado\(\) && tieneModulo\('pedidos-almacen'\);/)
    const creador = reglas.match(/function esPedidoAlmacenCreador\(\) \{([\s\S]*?)\n    \}/)?.[1]
    const gestor = reglas.match(/function esPedidoAlmacenGestor\(\) \{([\s\S]*?)\n    \}/)?.[1]
    expect(creador).toMatch(/tieneModulo\('pedidos-almacen'\)/)
    expect(gestor).toMatch(/tieneModulo\('pedidos-almacen'\)/)
    expect(gestor).toMatch(/tieneModulo\('nueva-compra'\)/)
  })

  it("cierra la creación directa de solicitudes de venta", () => {
    const reglas = readFileSync(resolve(raiz, "firestore.rules"), "utf8")
    const bloque = reglas.match(/match \/solicitudes_documento\/\{solicitudId\} \{([\s\S]*?)\n    \}/)?.[1]
    expect(bloque).toMatch(/allow create: if false;/)
  })

  it("exige reportes para los lotes contables", () => {
    const reglas = readFileSync(resolve(raiz, "firestore.rules"), "utf8")
    const bloque = reglas.match(/match \/reportes_contables\/\{reporteId\} \{([\s\S]*?)\n    \}/)?.[1]
    expect(bloque).toMatch(/allow read: if esUsuarioAutorizado\(\) && tieneModulo\('reportes'\);/)
    expect(bloque).toMatch(/allow create: if esUsuarioAutorizado\(\) && tieneModulo\('reportes'\)/)
  })

  it("alinea Storage con los módulos de almacén", () => {
    const reglas = readFileSync(resolve(raiz, "storage.rules"), "utf8")
    const bloque = reglas.match(/match \/pedidos-almacen\/\{imagen=\*\*\} \{([\s\S]*?)\n    \}/)?.[1]
    expect(bloque).toMatch(/tieneModulo\('pedidos-almacen'\)/)
  })
})
