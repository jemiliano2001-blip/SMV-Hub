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
  type LucideIcon,
} from 'lucide-react'
import { authBypassActivo, useUsuario } from '@/lib/auth'
import { usePermisos } from '@/lib/hooks/useRol'
import { puedeVerNotificaciones, tieneModulo } from '@/lib/roles'
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
 * para la barra de navegación móvil inferior según los permisos del usuario.
 */
export function calcularDestinosBottomNav(
  modulos: readonly ModuloId[] | ModuloId[] | null | undefined,
  esSuperAdmin: boolean,
  bypass = false,
): BottomNavItem[] {
  const modulosList = modulos ?? []
  const items: BottomNavItem[] = [
    { href: '/', label: 'Inicio', icon: Home },
  ]

  const puedePedidos = bypass || esSuperAdmin || tieneModulo(modulosList, 'pedidos-almacen')
  const puedeBanos = bypass || esSuperAdmin || tieneModulo(modulosList, 'banos')
  const puedeAlmacen = bypass || esSuperAdmin || tieneModulo(modulosList, 'almacen')
  const puedeNuevaCompra = bypass || esSuperAdmin || tieneModulo(modulosList, 'nueva-compra')
  const puedeOrdenes = bypass || esSuperAdmin || tieneModulo(modulosList, 'ordenes')
  const puedeNotifs = bypass || esSuperAdmin || puedeVerNotificaciones(modulosList)

  if (puedePedidos) {
    items.push({
      href: '/pedidos-almacen',
      label: 'Pedidos',
      icon: PackagePlus,
      badgeKey: 'pedidos',
    })
  }

  if (puedeBanos) {
    items.push({
      href: '/banos',
      label: 'Baños',
      icon: Timer,
    })
  } else if (puedeAlmacen) {
    items.push({
      href: '/almacen',
      label: 'Almacén',
      icon: Archive,
    })
  } else if (puedeNuevaCompra) {
    items.push({
      href: '/nueva-compra',
      label: 'Comprar',
      icon: ShoppingCart,
    })
  }

  // Si aún hay espacio y es de compras, agregar órdenes
  if (items.length < 4 && puedeOrdenes) {
    items.push({
      href: '/ordenes',
      label: 'Órdenes',
      icon: FileText,
    })
  } else if (items.length < 4 && puedeAlmacen && !items.some((i) => i.href === '/almacen')) {
    items.push({
      href: '/almacen',
      label: 'Almacén',
      icon: Archive,
    })
  }

  if (puedeNotifs) {
    items.push({
      href: '/notificaciones',
      label: 'Avisos',
      icon: Bell,
      badgeKey: 'notificaciones',
    })
  }

  // Máximo 5 items para no saturar la pantalla móvil
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
    () => calcularDestinosBottomNav(modulos, esSuperAdmin, bypass),
    [modulos, esSuperAdmin, bypass],
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
                  <span className="absolute -top-1 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground shadow-xs animate-in zoom-in-50">
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
