import type { Rol } from "@/lib/schemas"
import { ModuloIdSchema, RolSchema, type ModuloId } from "@/lib/schemas"

export type { Rol, ModuloId }

/** Ruta base asociada a cada módulo. */
export const RUTA_POR_MODULO: Record<ModuloId, string> = {
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
  notificaciones: "/notificaciones",
  finanzas: "/finanzas",
  "documentos-venta": "/documentos-venta",
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
      { id: "pedidos-almacen", label: "Pedidos de almacén" },
      { id: "ordenes-servicio", label: "Órdenes de servicio" },
      { id: "notificaciones", label: "Notificaciones" },
      { id: "documentos-venta", label: "Documentos de venta" },
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
      // Sin efecto real: /usuarios se gatea 100% por esSuperAdmin, no por este módulo
      // (ver AuthGuard.tsx y NavBar.tsx). Se deja marcable por retrocompatibilidad de
      // datos existentes, pero la etiqueta lo deja claro para no confundir al armar la matriz.
      { id: "usuarios", label: "Usuarios (sin efecto — el acceso real es por Super-admin)" },
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
  "pedidos-almacen",
  "ordenes-servicio",
  "operadores",
  "horas-extra",
  "banos",
  "notificaciones",
  "documentos-venta",
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
  "pedidos-almacen",
  "ordenes-servicio",
  "operadores",
  "horas-extra",
  "banos",
  "notificaciones",
  "documentos-venta",
]

const PLANTILLA_DISENO: ModuloId[] = ["cotizaciones", "requisiciones", "horas-extra"]

const PLANTILLA_AUTOMATIZACION: ModuloId[] = [
  "cotizaciones",
  "requisiciones",
  "horas-extra",
  "notificaciones",
]

const PLANTILLA_ALMACEN: ModuloId[] = [
  "almacen",
  "pedidos-almacen",
  "banos",
  "notificaciones",
  "documentos-venta",
]

/** Mapa de plantilla → módulos (atajo; la fuente de verdad por usuario es modulos[]). */
export const MODULOS_POR_PLANTILLA: Record<Rol, ModuloId[]> = {
  admin: PLANTILLA_ADMIN,
  compras: PLANTILLA_COMPRAS,
  diseno: PLANTILLA_DISENO,
  almacen: PLANTILLA_ALMACEN,
  automatizacion: PLANTILLA_AUTOMATIZACION,
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
    "/notificaciones",
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
    "/notificaciones",
  ],
  diseno: ["/", "/cotizaciones", "/requisiciones", "/horas-extra"],
  almacen: ["/", "/almacen", "/pedidos-almacen", "/banos", "/notificaciones"],
  automatizacion: ["/", "/cotizaciones", "/requisiciones", "/horas-extra", "/notificaciones"],
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
  const entradas = Object.entries(RUTA_POR_MODULO) as [ModuloId, string][]
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
 * Lectura del feed `/notificaciones`: módulo dedicado o cualquiera de sus
 * módulos de origen. Debe mantenerse sincronizado con
 * `puedeVerNotificaciones()` en `firestore.rules`.
 */
export function puedeVerNotificaciones(
  modulos: readonly ModuloId[] | null | undefined
): boolean {
  if (!modulos) return false
  return (
    tieneModulo(modulos, "notificaciones") ||
    tieneModulo(modulos, "pedidos-almacen") ||
    tieneModulo(modulos, "requisiciones") ||
    tieneModulo(modulos, "documentos-venta") ||
    tieneModulo(modulos, "banos")
  )
}

/**
 * Autorización de ruta por módulos.
 * - null/undefined modulos → sin acceso
 * - `/` siempre permitido si hay lista (usuario activo con permisos cargados)
 * - `/usuarios` exige el módulo `usuarios` (la API además exige esSuperAdmin)
 * - `/notificaciones` usa `puedeVerNotificaciones` (OR de módulos)
 */
export function tienePermiso(
  modulos: readonly ModuloId[] | null | undefined,
  pathname: string
): boolean {
  if (!modulos) return false
  if (pathname === "/") return true

  const modulo = rutaAModulo(pathname)
  if (!modulo) return false
  if (modulo === "notificaciones") return puedeVerNotificaciones(modulos)
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

  if (
    plantilla === "admin" ||
    plantilla === "compras" ||
    plantilla === "diseno" ||
    plantilla === "almacen" ||
    plantilla === "automatizacion"
  ) {
    return modulosDePlantilla(plantilla)
  }
  return []
}

export function plantillaDesdeUsuarioLegacy(data: {
  plantilla?: unknown
  rol?: unknown
}): Rol | null {
  const r1 = RolSchema.safeParse(data.plantilla)
  if (r1.success) return r1.data
  const r2 = RolSchema.safeParse(data.rol)
  if (r2.success) return r2.data
  return null
}

/**
 * Edición de /horas-extra: super-admin, plantilla admin/compras/automatización
 * (compras, contabilidad y el encargado de automatización) o el flag por
 * usuario `editaHorasExtra` para casos individuales con otra plantilla. El
 * resto —incluida la plantilla diseño— ve en solo lectura. Debe mantenerse
 * sincronizado con `puedeEditarHorasExtra()` en `firestore.rules`.
 */
export function puedeEditarHorasExtra(u: {
  plantilla?: Rol | null
  esSuperAdmin?: boolean
  editaHorasExtra?: boolean
} | null | undefined): boolean {
  if (!u) return false
  if (u.esSuperAdmin === true || u.editaHorasExtra === true) return true
  return u.plantilla === "admin" || u.plantilla === "compras" || u.plantilla === "automatizacion"
}

export function puedeAtenderDocumentosVenta(u: {
  atiendeDocumentosVenta?: boolean
  esSuperAdmin?: boolean
} | null | undefined): boolean {
  if (!u) return false
  return u.esSuperAdmin === true || u.atiendeDocumentosVenta === true
}

export function esSuperAdminDesdeUsuarioLegacy(data: {
  esSuperAdmin?: unknown
  rol?: unknown
  plantilla?: unknown
}): boolean {
  // Si el documento ya tiene el campo explícito (true o false), manda sobre
  // cualquier fallback — permite revocar super-admin a un usuario con
  // plantilla/rol "admin" sin que este fallback lo ignore.
  if (typeof data.esSuperAdmin === "boolean") return data.esSuperAdmin
  // Migración: documentos legacy sin el campo esSuperAdmin, con plantilla/rol admin.
  if (data.rol === "admin" || data.plantilla === "admin") return true
  return false
}
