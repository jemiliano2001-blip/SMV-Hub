'use client'

import { useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  ClipboardCheck,
  Bell,
  LayoutGrid,
  ShoppingCart,
  FileSpreadsheet,
  type LucideIcon,
} from 'lucide-react'
import { authBypassActivo, useUsuario } from '@/lib/auth'
import { usePermisos } from '@/lib/hooks/useRol'
import { puedeVerNotificaciones, tieneModulo, tienePermiso } from '@/lib/roles'
import type { ModuloId } from '@/lib/schemas'
import { usePedidosAlmacenPendientesCount } from '@/lib/hooks/usePedidosAlmacenPendientesCount'
import { useNotificaciones } from '@/lib/hooks/useNotificaciones'
import { MobileMasDrawer } from '@/components/layout/MobileMasDrawer'
import { cn } from '@/lib/utils'

export interface BottomNavItem {
  href?: string
  action?: 'mas'
  label: string
  icon: LucideIcon
  badgeKey?: 'pedidos' | 'notificaciones'
}

/**
 * Función pura que calcula los 4 destinos tácticos universales
 * para la barra de navegación móvil inferior:
 * 
 * 1. Inicio (Cockpit móvil)
 * 2. Pedidos / Requisiciones (Flujo operativo principal con badge)
 * 3. Alertas (Notificaciones con badge de pendientes)
 * 4. Más (Abre el cajón de todos los módulos autorizados)
 */
export function calcularDestinosBottomNav(
  modulos: readonly ModuloId[] | ModuloId[] | null | undefined,
  esSuperAdmin: boolean,
  bypass = false,
): BottomNavItem[] {
  const modulosList = modulos ?? []

  const puede = (href: string, modId?: ModuloId) =>
    bypass || esSuperAdmin || (modId ? tieneModulo(modulosList, modId) : tienePermiso(modulosList, href, esSuperAdmin))

  const items: BottomNavItem[] = [
    { href: '/', label: 'Inicio', icon: Home },
  ]

  // 2. Destino operativo secundario (Pedidos de piso o Requisiciones de compras)
  if (puede('/pedidos-almacen', 'pedidos-almacen')) {
    items.push({
      href: '/pedidos-almacen',
      label: 'Pedidos',
      icon: ClipboardCheck,
      badgeKey: 'pedidos',
    })
  } else if (puede('/requisiciones', 'requisiciones')) {
    items.push({
      href: '/requisiciones',
      label: 'Requisiciones',
      icon: FileSpreadsheet,
    })
  } else if (puede('/nueva-compra', 'nueva-compra')) {
    items.push({
      href: '/nueva-compra',
      label: 'Comprar',
      icon: ShoppingCart,
    })
  }

  // 3. Destino de Notificaciones / Alertas
  if (bypass || esSuperAdmin || puedeVerNotificaciones(modulosList)) {
    items.push({
      href: '/notificaciones',
      label: 'Alertas',
      icon: Bell,
      badgeKey: 'notificaciones',
    })
  }

  // 4. Cajón "Más" (Launcher de todos los módulos autorizados)
  items.push({
    action: 'mas',
    label: 'Más',
    icon: LayoutGrid,
  })

  return items
}

export default function BottomNavBar() {
  const pathname = usePathname()
  const [masDrawerAbierto, setMasDrawerAbierto] = useState(false)
  const { usuario } = useUsuario()
  const { modulos, esSuperAdmin, atiendeDocumentosVenta, cargando: cargandoPermisos } = usePermisos(
    authBypassActivo() ? null : usuario,
  )

  const bypass = authBypassActivo()
  const visible = Boolean(usuario || bypass)

  // Permite que cualquier botón o acceso de la app (ej. en la cabina de inicio) abra el cajón Más
  useEffect(() => {
    const handler = () => setMasDrawerAbierto(true)
    window.addEventListener('smv:abrir-mas-drawer', handler)
    return () => window.removeEventListener('smv:abrir-mas-drawer', handler)
  }, [])

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
    <>
      <nav
        aria-label="Navegación móvil inferior"
        className="no-print fixed bottom-0 left-0 right-0 z-40 border-t border-border/80 bg-card/95 pb-[max(env(safe-area-inset-bottom,0px),0.5rem)] pt-1.5 shadow-lg backdrop-blur-lg md:hidden print:hidden"
      >
        <div className="mx-auto flex max-w-lg items-center justify-around px-2">
          {items.map((item) => {
            const Icon = item.icon
            const esAccionMas = item.action === 'mas'
            const activo = esAccionMas
              ? masDrawerAbierto
              : pathname === item.href || (item.href !== '/' && !!item.href && pathname.startsWith(item.href))

            const badgeCount =
              item.badgeKey === 'pedidos'
                ? pedidosCount
                : item.badgeKey === 'notificaciones'
                  ? notificacionesCount
                  : 0

            const content = (
              <>
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
              </>
            )

            if (esAccionMas) {
              return (
                <button
                  key="action-mas"
                  type="button"
                  onClick={() => setMasDrawerAbierto(true)}
                  className={cn(
                    'group relative flex min-w-[3.5rem] flex-1 flex-col items-center justify-center rounded-xl py-1.5 transition-all duration-150 active:scale-95 select-none touch-manipulation',
                    activo ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground',
                  )}
                  aria-label="Abrir catálogo de módulos"
                >
                  {content}
                </button>
              )
            }

            return (
              <Link
                key={item.href}
                href={item.href!}
                className={cn(
                  'group relative flex min-w-[3.5rem] flex-1 flex-col items-center justify-center rounded-xl py-1.5 transition-all duration-150 active:scale-95 select-none touch-manipulation',
                  activo ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {content}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Cajón deslizante con catálogo y buscador a 60 FPS */}
      <MobileMasDrawer
        open={masDrawerAbierto}
        onOpenChange={setMasDrawerAbierto}
        modulos={modulos}
        esSuperAdmin={esSuperAdmin}
        bypass={bypass}
      />
    </>
  )
}
