import type { Rol } from "@/lib/schemas"

export type { Rol }

// Rutas permitidas para cada rol (rutas base).
// Nota: '/login' está permitido para todos los que no tienen sesión en AuthGuard.
export const PERMISOS_POR_ROL: Record<Rol, string[]> = {
  admin: [
    '/',
    '/nueva-compra', '/ordenes', '/importar', '/claves-sat', '/cotizaciones', '/requisiciones', '/reportes',
    '/almacen', '/ordenes-servicio', '/operadores',
    '/horas-extra', '/banos',
    '/auditoria', // Pantalla exclusiva
    '/usuarios', // Administración de accesos y roles
  ],
  compras: [
    '/',
    '/nueva-compra', '/importar', '/cotizaciones', '/requisiciones',
    '/almacen', '/ordenes-servicio', '/operadores',
    '/horas-extra', '/banos'
    // Excluidos: /ordenes, /claves-sat, /reportes, /auditoria, /usuarios
  ],
  diseno: [
    '/',
    '/cotizaciones', '/requisiciones', '/horas-extra'
  ],
  almacen: [
    '/',
    '/almacen', '/banos'
  ]
}

export function tienePermiso(rol: Rol | null, pathname: string): boolean {
  if (!rol) return false
  if (pathname === '/') return true // Todo usuario con rol puede ver la raíz

  const rutasPermitidas = PERMISOS_POR_ROL[rol]
  return rutasPermitidas.some(ruta =>
    ruta !== '/' && (pathname === ruta || pathname.startsWith(`${ruta}/`))
  )
}
