'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  PackagePlus,
  Timer,
  Archive,
  ShoppingCart,
  FileText,
  Bell,
  Clock,
  FileSpreadsheet,
  BadgePercent,
  type LucideIcon,
} from 'lucide-react'
import { authBypassActivo, useUsuario } from '@/lib/auth'
import { usePermisos } from '@/lib/hooks/useRol'
import { puedeVerNotificaciones, tieneModulo, tienePermiso } from '@/lib/roles'
import type { ModuloId } from '@/lib/schemas'
import { usePedidosAlmacenPendientesCount } from '@/lib/hooks/usePedidosAlmacenPendientesCount'
import { useNotificaciones } from '@/lib/hooks/useNotificaciones'
import { cn } from '@/lib/utils'

export interface BottomNavItem {
  href: string
  label: string
  icon: LucideIcon
  badgeKey?: 'pedidos' | 'notificaciones'
}

/**
 * Función pura que calcula los 4-5 destinos tácticos más relevantes
 * para la barra de navegación móvil inferior según los permisos y rol del usuario.
 * 
 * Reglas de diseño por perfil:
 * - Almacén: Inicio, Pedidos, Almacén, Baños/Ventas, Avisos (NUNCA órdenes ni nueva compra)
 * - Diseño: Inicio, Requisiciones, Cotizaciones, Horas Extra, Avisos
 * - Automatización: Inicio, Requisiciones, Cotizaciones, Horas Extra, Avisos
 * - Ventas: Inicio, Doc. Venta, Avisos
 * - Compras: Inicio, Nueva Compra, Requisiciones, Pedidos, Avisos
 * - Admin: Inicio, Nueva Compra, Órdenes, Requisiciones, Avisos
 */
export function calcularDestinosBottomNav(
  modulos: readonly ModuloId[] | ModuloId[] | null | undefined,
  esSuperAdmin: boolean,
  bypass = false,
  atiendeDocumentosVenta = false,
): BottomNavItem[] {
  const modulosList = modulos ?? []

  const puede = (href: string, modId?: ModuloId) =>
    bypass || esSuperAdmin || (modId ? tieneModulo(modulosList, modId) : tienePermiso(modulosList, href, esSuperAdmin))

  const puedeNotifs = bypass || esSuperAdmin || puedeVerNotificaciones(modulosList)

  const items: BottomNavItem[] = [
    { href: '/', label: 'Inicio', icon: Home },
  ]

  const tieneCompras = puede('/nueva-compra', 'nueva-compra')
  const tieneOrdenes = puede('/ordenes', 'ordenes')

  // 1. PERFIL OPERACIÓN / TALLER / DISEÑO / ALMACÉN (Sin módulo de compras directas)
  if (!tieneCompras && !tieneOrdenes && !esSuperAdmin) {
    if (puede('/requisiciones', 'requisiciones')) {
      items.push({ href: '/requisiciones', label: 'Requisiciones', icon: FileSpreadsheet })
    }
    if (puede('/cotizaciones', 'cotizaciones') && items.length < 4) {
      items.push({ href: '/cotizaciones', label: 'Cotizaciones', icon: BadgePercent })
    }
    if (puede('/pedidos-almacen', 'pedidos-almacen') && items.length < 4) {
      items.push({ href: '/pedidos-almacen', label: 'Pedidos', icon: PackagePlus, badgeKey: 'pedidos' })
    }
    if (puede('/almacen', 'almacen') && items.length < 4) {
      items.push({ href: '/almacen', label: 'Almacén', icon: Archive })
    }
    if (puede('/documentos-venta', 'documentos-venta') && (atiendeDocumentosVenta || items.length < 4)) {
      items.push({ href: '/documentos-venta', label: 'Doc. Venta', icon: FileText })
    }
    if (puede('/horas-extra', 'horas-extra') && items.length < 4) {
      items.push({ href: '/horas-extra', label: 'Horas Extra', icon: Clock })
    }
    if (puede('/banos', 'banos') && items.length < 4) {
      items.push({ href: '/banos', label: 'Baños', icon: Timer })
    }
  }
  // 2. PERFIL COMPRAS / ADMIN
  else {
    if (puede('/nueva-compra', 'nueva-compra')) {
      items.push({ href: '/nueva-compra', label: 'Comprar', icon: ShoppingCart })
    }

    if (esSuperAdmin && puede('/ordenes', 'ordenes')) {
      items.push({ href: '/ordenes', label: 'Órdenes', icon: FileText })
    } else if (puede('/requisiciones', 'requisiciones')) {
      items.push({ href: '/requisiciones', label: 'Requisiciones', icon: FileSpreadsheet })
    } else if (puede('/pedidos-almacen', 'pedidos-almacen')) {
      items.push({ href: '/pedidos-almacen', label: 'Pedidos', icon: PackagePlus, badgeKey: 'pedidos' })
    }

    if (items.length < 4 && puede('/requisiciones', 'requisiciones') && !items.some((i) => i.href === '/requisiciones')) {
      items.push({ href: '/requisiciones', label: 'Requisiciones', icon: FileSpreadsheet })
    }
    if (items.length < 4 && puede('/pedidos-almacen', 'pedidos-almacen') && !items.some((i) => i.href === '/pedidos-almacen')) {
      items.push({ href: '/pedidos-almacen', label: 'Pedidos', icon: PackagePlus, badgeKey: 'pedidos' })
    }
    if (items.length < 4 && puede('/almacen', 'almacen') && !items.some((i) => i.href === '/almacen')) {
      items.push({ href: '/almacen', label: 'Almacén', icon: Archive })
    }
    if (items.length < 4 && puede('/ordenes', 'ordenes') && !items.some((i) => i.href === '/ordenes')) {
      items.push({ href: '/ordenes', label: 'Órdenes', icon: FileText })
    }
  }

  // Notificaciones como último destino si el usuario tiene permiso
  if (puedeNotifs && items.length < 5) {
    items.push({
      href: '/notificaciones',
      label: 'Avisos',
      icon: Bell,
      badgeKey: 'notificaciones',
    })
  }

  // Máximo 5 items para ergonomía táctil en pantalla móvil
  return items.slice(0, 5)
}

export default function BottomNavBar() {
  const pathname = usePathname()
  const { usuario } = useUsuario()
  const { modulos, esSuperAdmin, atiendeDocumentosVenta, cargando: cargandoPermisos } = usePermisos(
    authBypassActivo() ? null : usuario,
  )

  const bypass = authBypassActivo()
  const visible = Boolean(usuario || bypass)

  const items = useMemo(
    () => calcularDestinosBottomNav(modulos, esSuperAdmin, bypass, atiendeDocumentosVenta),
    [modulos, esSuperAdmin, bypass, atiendeDocumentosVenta],
  )

  const pedidosCount = usePedidosAlmacenPendientesCount()

  const { noLeidas: notificacionesCount } = useNotificaciones({
    enabled: visible && !cargandoPermisos && puedeVerNotificaciones(modulos),
    uid: bypass ? null : usuario?.uid,
    modulos,
    esSuperAdmin,
    atiendeDocumentosVenta,
  })

  if (!visible || items.length <= 1) return null

  return (
    <nav
      aria-label="Navegación móvil inferior"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/80 bg-card/95 pb-[max(env(safe-area-inset-bottom,0px),0.5rem)] pt-1.5 shadow-lg backdrop-blur-lg md:hidden"
    >
      <div className="mx-auto flex max-w-lg items-center justify-around px-2">
        {items.map((item) => {
          const Icon = item.icon
          const activo = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
          const badgeCount =
            item.badgeKey === 'pedidos'
              ? pedidosCount
              : item.badgeKey === 'notificaciones'
                ? notificacionesCount
                : 0

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group relative flex min-w-[3.5rem] flex-1 flex-col items-center justify-center rounded-xl py-1.5 transition-all duration-150 active:scale-95 select-none',
                activo ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <div className="relative">
                <div
                  className={cn(
                    'flex size-8 items-center justify-center rounded-xl transition-all duration-150',
                    activo
                      ? 'bg-primary/15 text-primary shadow-2xs'
                      : 'group-hover:bg-muted text-muted-foreground',
                  )}
                >
                  <Icon className="size-4.5 transition-transform duration-150 group-active:scale-90" />
                </div>

                {badgeCount > 0 && (
                  <span
                    className={cn(
                      'absolute -top-1 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold leading-none ring-1.5 ring-card shadow-xs animate-in zoom-in-50',
                      item.badgeKey === 'pedidos'
                        ? 'bg-amber-600 text-white dark:bg-amber-500'
                        : 'bg-rose-500 text-white',
                    )}
                  >
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                )}
              </div>

              <span className="mt-1 text-[10px] tracking-tight truncate max-w-[4rem]">
                {item.label}
              </span>

              {activo && (
                <span className="absolute bottom-0.5 h-0.5 w-4 rounded-full bg-primary animate-in fade-in-50 duration-150" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
