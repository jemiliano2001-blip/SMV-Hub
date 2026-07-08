export type Rol = 'admin' | 'compras' | 'diseno' | 'almacen'

// Mapeo estático de correos a roles. 
// Si un correo autorizado no está aquí, por defecto se le podría negar acceso 
// o darle un rol muy básico, pero en nuestro caso, la UI solo mostrará lo que su rol permita.
export const MAPA_ROLES: Record<string, Rol> = {
  "jemiliano2001@gmail.com": "admin",
  "lorena@smv.com": "compras",
  // TODO: Actualiza estos correos con los reales de tu equipo de diseño y almacén
  "diseno@smv.com": "diseno",
  "almacen@smv.com": "almacen",
}

export function obtenerRol(email: string | null | undefined): Rol | null {
  if (!email) return null
  return MAPA_ROLES[email.trim().toLowerCase()] || null
}

// Rutas permitidas para cada rol (rutas base).
// Nota: '/login' está permitido para todos los que no tienen sesión en AuthGuard.
export const PERMISOS_POR_ROL: Record<Rol, string[]> = {
  admin: [
    '/',
    '/nueva-compra', '/ordenes', '/importar', '/claves-sat', '/cotizaciones', '/requisiciones', '/reportes',
    '/almacen', '/ordenes-servicio', '/operadores',
    '/horas-extra', '/banos',
    '/auditoria' // Pantalla exclusiva
  ],
  compras: [
    '/',
    '/nueva-compra', '/importar', '/cotizaciones', '/requisiciones',
    '/almacen', '/ordenes-servicio', '/operadores',
    '/horas-extra', '/banos'
    // Excluidos: /ordenes, /claves-sat, /reportes, /auditoria
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
