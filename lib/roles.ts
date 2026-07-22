import type { Rol } from "@/lib/schemas"
import { ModuloIdSchema, type ModuloId } from "@/lib/schemas"

export type { Rol, ModuloId }

/** Ruta base asociada a cada módulo (excepto reabastecimiento-rop, que vive en /almacen). */
export const RUTA_POR_MODULO: Record<Exclude<ModuloId, "reabastecimiento-rop">, string> = {
  "nueva-compra": "/nueva-compra",
  ordenes: "/ordenes",
  "claves-sat": "/claves-sat",
  cotizaciones: "/cotizaciones",
  requisiciones: "/requisiciones",
  proveedores: "/proveedores",
  reportes: "/reportes",
  "caja-chica": "/caja-chica",
  almacen: "/almacen",
  "pedidos-almacen": "/pedidos-almacen",
  "ordenes-servicio": "/ordenes-servicio",
  operadores: "/operadores",
  "horas-extra": "/horas-extra",
  banos: "/banos",
  finanzas: "/finanzas",
  auditoria: "/auditoria",
  usuarios: "/usuarios",
}

/** Módulos agrupados para la UI de /usuarios. */
export const GRUPOS_MODULOS: { nombre: string; modulos: { id: ModuloId; label: string }[] }[] = [
  {
    nombre: "Compras",
    modulos: [
      { id: "nueva-compra", label: "Nueva compra" },
      { id: "ordenes", label: "Órdenes" },
      { id: "claves-sat", label: "Claves SAT" },
      { id: "cotizaciones", label: "Cotizaciones" },
      { id: "requisiciones", label: "Requisiciones" },
      { id: "proveedores", label: "Proveedores" },
      { id: "reportes", label: "Reportes" },
    ],
  },
  {
    nombre: "Finanzas",
    modulos: [
      { id: "caja-chica", label: "Caja chica" },
      { id: "finanzas", label: "Finanzas (Odoo)" },
    ],
  },
  {
    nombre: "Operación",
    modulos: [
      { id: "almacen", label: "Almacén (entradas/salidas)" },
      { id: "reabastecimiento-rop", label: "Reabastecimiento ROP" },
      { id: "pedidos-almacen", label: "Pedidos de almacén" },
      { id: "ordenes-servicio", label: "Órdenes de servicio" },
      { id: "banos", label: "Baños" },
    ],
  },
  {
    nombre: "Personal",
    modulos: [
      { id: "operadores", label: "Operadores" },
      { id: "horas-extra", label: "Horas extra" },
    ],
  },
  {
    nombre: "Administración",
    modulos: [
      { id: "auditoria", label: "Auditoría" },
      { id: "usuarios", label: "Usuarios (ver)" },
    ],
  },
]

const PLANTILLA_ADMIN: ModuloId[] = [
  "nueva-compra",
  "ordenes",
  "claves-sat",
  "cotizaciones",
  "requisiciones",
  "proveedores",
  "reportes",
  "caja-chica",
  "almacen",
  "reabastecimiento-rop",
  "pedidos-almacen",
  "ordenes-servicio",
  "operadores",
  "horas-extra",
  "banos",
  "finanzas",
  "auditoria",
  "usuarios",
]

const PLANTILLA_COMPRAS: ModuloId[] = [
  "nueva-compra",
  "cotizaciones",
  "requisiciones",
  "proveedores",
  "caja-chica",
  "almacen",
  "reabastecimiento-rop",
  "pedidos-almacen",
  "ordenes-servicio",
  "operadores",
  "horas-extra",
  "banos",
]

const PLANTILLA_DISENO: ModuloId[] = ["cotizaciones", "requisiciones", "horas-extra"]

const PLANTILLA_ALMACEN: ModuloId[] = ["almacen", "pedidos-almacen", "banos"]

/** Mapa de plantilla → módulos (atajo; la fuente de verdad por usuario es modulos[]). */
export const MODULOS_POR_PLANTILLA: Record<Rol, ModuloId[]> = {
  admin: PLANTILLA_ADMIN,
  compras: PLANTILLA_COMPRAS,
  diseno: PLANTILLA_DISENO,
  almacen: PLANTILLA_ALMACEN,
}

/**
 * @deprecated Usar MODULOS_POR_PLANTILLA + tienePermiso(modulos, path).
 * Se mantiene para migración y tests legacy: rutas base por rol (sin ROP como ruta).
 */
export const PERMISOS_POR_ROL: Record<Rol, string[]> = {
  admin: [
    "/",
    "/nueva-compra",
    "/ordenes",
    "/claves-sat",
    "/cotizaciones",
    "/requisiciones",
    "/proveedores",
    "/reportes",
    "/caja-chica",
    "/almacen",
    "/pedidos-almacen",
    "/ordenes-servicio",
    "/operadores",
    "/horas-extra",
    "/banos",
    "/finanzas",
    "/auditoria",
    "/usuarios",
  ],
  compras: [
    "/",
    "/nueva-compra",
    "/cotizaciones",
    "/requisiciones",
    "/proveedores",
    "/caja-chica",
    "/almacen",
    "/pedidos-almacen",
    "/ordenes-servicio",
    "/operadores",
    "/horas-extra",
    "/banos",
  ],
  diseno: ["/", "/cotizaciones", "/requisiciones", "/horas-extra"],
  almacen: ["/", "/almacen", "/pedidos-almacen", "/banos"],
}

export function modulosDePlantilla(plantilla: Rol): ModuloId[] {
  return [...MODULOS_POR_PLANTILLA[plantilla]]
}

/** Compara dos listas de módulos sin importar el orden. */
export function mismosModulos(a: readonly ModuloId[], b: readonly ModuloId[]): boolean {
  if (a.length !== b.length) return false
  const setB = new Set(b)
  return a.every((m) => setB.has(m))
}

export function esMatrizPersonalizada(plantilla: Rol | null | undefined, modulos: readonly ModuloId[]): boolean {
  if (!plantilla) return modulos.length > 0
  return !mismosModulos(modulos, modulosDePlantilla(plantilla))
}

/** Resuelve el módulo de ruta para un pathname (null = home u desconocido). */
export function rutaAModulo(pathname: string): ModuloId | null {
  if (pathname === "/" || pathname === "") return null
  const entradas = Object.entries(RUTA_POR_MODULO) as [Exclude<ModuloId, "reabastecimiento-rop">, string][]
  // Rutas más largas primero para evitar que /finanzas cloquee /finanzas/x mal
  const ordenadas = [...entradas].sort((a, b) => b[1].length - a[1].length)
  for (const [modulo, ruta] of ordenadas) {
    if (pathname === ruta || pathname.startsWith(`${ruta}/`)) return modulo
  }
  return null
}

export function tieneModulo(modulos: readonly ModuloId[] | null | undefined, modulo: ModuloId): boolean {
  if (!modulos) return false
  return modulos.includes(modulo)
}

/**
 * Autorización de ruta por módulos.
 * - null/undefined modulos → sin acceso
 * - `/` siempre permitido si hay lista (usuario activo con permisos cargados)
 * - `/usuarios` exige el módulo `usuarios` (la API además exige esSuperAdmin)
 * - `reabastecimiento-rop` no es ruta; se gated en la UI de /almacen
 */
export function tienePermiso(
  modulos: readonly ModuloId[] | null | undefined,
  pathname: string
): boolean {
  if (!modulos) return false
  if (pathname === "/") return true

  const modulo = rutaAModulo(pathname)
  if (!modulo) return false
  return tieneModulo(modulos, modulo)
}

/**
 * Compat: firma antigua `tienePermiso(rol, path)`. Preferir módulos.
 * @deprecated
 */
export function tienePermisoPorRol(rol: Rol | null, pathname: string): boolean {
  if (!rol) return false
  return tienePermiso(modulosDePlantilla(rol), pathname)
}

/** Deriva módulos desde un doc legacy (solo `rol`) o campos nuevos. */
export function modulosDesdeUsuarioLegacy(data: {
  modulos?: unknown
  plantilla?: unknown
  rol?: unknown
}): ModuloId[] {
  if (Array.isArray(data.modulos)) {
    const parseados: ModuloId[] = []
    for (const m of data.modulos) {
      const r = ModuloIdSchema.safeParse(m)
      if (r.success) parseados.push(r.data)
    }
    if (parseados.length > 0 || Array.isArray(data.modulos)) return parseados
  }

  const plantilla =
    typeof data.plantilla === "string"
      ? data.plantilla
      : typeof data.rol === "string"
        ? data.rol
        : null

  if (plantilla === "admin" || plantilla === "compras" || plantilla === "diseno" || plantilla === "almacen") {
    return modulosDePlantilla(plantilla)
  }
  return []
}

export function plantillaDesdeUsuarioLegacy(data: {
  plantilla?: unknown
  rol?: unknown
}): Rol | null {
  if (data.plantilla === "admin" || data.plantilla === "compras" || data.plantilla === "diseno" || data.plantilla === "almacen") {
    return data.plantilla
  }
  if (data.rol === "admin" || data.rol === "compras" || data.rol === "diseno" || data.rol === "almacen") {
    return data.rol
  }
  return null
}

export function esSuperAdminDesdeUsuarioLegacy(data: {
  esSuperAdmin?: unknown
  rol?: unknown
  plantilla?: unknown
}): boolean {
  if (data.esSuperAdmin === true) return true
  // Migración: admins legacy son super-admin
  if (data.rol === "admin" || data.plantilla === "admin") return true
  return false
}
