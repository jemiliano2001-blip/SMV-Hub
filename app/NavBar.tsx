'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown, Menu, Shield } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import LogoSMV from '@/app/LogoSMV'
import BotonSesion from '@/app/BotonSesion'
import BuscadorGlobalCommand from '@/components/BuscadorGlobalCommand'
import PedidoAlmacenBadge from '@/app/pedidos-almacen/PedidoAlmacenBadge'
import NotificacionesBell from '@/app/notificaciones/NotificacionesBell'
import { authBypassActivo, useUsuario } from '@/lib/auth'
import { abrirAppConSSO } from '@/lib/sso-cliente'
import { tienePermiso } from '@/lib/roles'
import { usePermisos } from '@/lib/hooks/useRol'
import { cn } from '@/lib/utils'

type GrupoNav = { nombre: string; links: { href: string; label: string }[] }

const GRUPOS: GrupoNav[] = [
  {
    nombre: 'Compras',
    links: [
      { href: '/nueva-compra', label: 'Nueva compra (IA)' },
      { href: '/compras-odoo', label: 'Compras Odoo' },
      { href: '/caja-chica', label: 'Caja chica' },
      { href: '/ordenes', label: 'Ver órdenes' },
      { href: '/requisiciones', label: 'Requisiciones' },
      { href: '/cotizaciones', label: 'Cotizaciones' },
      { href: '/proveedores', label: 'Catálogo de proveedores' },
      { href: '/reportes', label: 'Reportes de compras' },
    ],
  },
  {
    nombre: 'Operación',
    links: [
      { href: 'https://smv-vision.web.app/', label: 'SMV Vision ↗' },
      { href: '/notificaciones', label: 'Notificaciones' },
      { href: '/documentos-venta', label: 'Documentos de venta' },
      { href: '/pedidos-almacen', label: 'Pedidos de almacén' },
      { href: '/almacen', label: 'Almacén de materiales' },
      { href: '/endmills', label: 'Endmills China' },
      { href: '/operadores', label: 'Catálogo de operadores' },
    ],
  },
  {
    nombre: 'Finanzas',
    links: [
      { href: 'https://dashboardsmv.web.app/', label: 'Dashboard SMV ↗' },
      { href: '/finanzas', label: 'Resumen financiero' },
      { href: '/finanzas/facturacion', label: 'Facturación clientes (Odoo)' },
      { href: '/finanzas/cobranza', label: 'Control de cobranza' },
      { href: '/reportes/contable', label: 'Reportes Contables SAT' },
      { href: '/claves-sat', label: 'Claves SAT' },
      { href: '/finanzas/reportes', label: 'Reportes financieros' },
    ],
  },
  {
    nombre: 'Personal',
    links: [
      { href: '/gafetes', label: 'Gafetes de personal' },
      { href: '/horas-extra', label: 'Horas extra' },
      { href: '/banos', label: 'Control de baños' },
    ],
  },
]

export default function NavBar() {
  const pathname = usePathname()
  const { usuario } = useUsuario()
  const { modulos, esSuperAdmin } = usePermisos(authBypassActivo() ? null : usuario)
  const [abierto, setAbierto] = useState<string | null>(null)
  const [menuMovil, setMenuMovil] = useState(false)
  // Cierra el dropdown y el menú móvil al navegar. Ajuste durante el render
  // (no en un efecto) para evitar el commit intermedio con el menú todavía
  // abierto en la ruta nueva.
  const [pathnamePrevio, setPathnamePrevio] = useState(pathname)
  if (pathname !== pathnamePrevio) {
    setPathnamePrevio(pathname)
    setAbierto(null)
    setMenuMovil(false)
  }
  const navRef = useRef<HTMLElement>(null)

  const gruposFiltrados = useMemo(() => {
    const bypass = authBypassActivo()
    const grupos = GRUPOS.map((g) => ({
      ...g,
      links: g.links.filter((l) => bypass || tienePermiso(modulos, l.href, esSuperAdmin)),
    })).filter((g) => g.links.length > 0)

    const linksAdmin = [
      ...(bypass || esSuperAdmin ? [{ href: '/usuarios', label: 'Usuarios y roles' }] : []),
      ...(bypass || esSuperAdmin || tienePermiso(modulos, '/auditoria')
        ? [{ href: '/auditoria', label: 'Bitácora de auditoría' }]
        : []),
    ]
    if (linksAdmin.length > 0) {
      grupos.push({ nombre: 'Administración', links: linksAdmin })
    }

    return grupos
  }, [modulos, esSuperAdmin])

  useEffect(() => {
    if (!abierto) return
    function onClickFuera(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setAbierto(null)
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setAbierto(null)
    }
    document.addEventListener('mousedown', onClickFuera)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onClickFuera)
      document.removeEventListener('keydown', onEscape)
    }
  }, [abierto])

  const esActiva = (href: string) => pathname === href || (href !== '/' && pathname.startsWith(`${href}/`))

  if (pathname === '/login') return null

  return (
    <header
      ref={navRef}
      className="no-print sticky top-0 z-40 border-b border-border bg-card font-sans shadow-xs"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-90">
            <LogoSMV height={26} />
            <span className="font-light text-border">|</span>
            <span className="text-xs font-bold uppercase tracking-tight text-foreground">SMV Hub</span>
          </Link>

          {/* Escritorio Utilitario */}
          <nav className="hidden items-center gap-1 text-xs font-medium md:flex">
            {gruposFiltrados.map((g) => {
              const activo = g.links.some((l) => esActiva(l.href))
              const desplegado = abierto === g.nombre
              return (
                <div key={g.nombre} className="relative">
                  <button
                    type="button"
                    onClick={() => setAbierto(desplegado ? null : g.nombre)}
                    className={cn(
                      'flex cursor-pointer items-center gap-1 rounded-md px-3 py-1.5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      activo
                        ? 'bg-muted font-bold text-primary'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                    )}
                  >
                    <span>{g.nombre}</span>
                    {g.links.some((l) => l.href === '/pedidos-almacen') && <PedidoAlmacenBadge />}
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5 transition-transform duration-150',
                        desplegado ? 'rotate-180 text-primary' : 'text-muted-foreground'
                      )}
                    />
                  </button>

                  {desplegado && (
                    <div className="absolute right-0 z-50 mt-1.5 w-56 animate-in fade-in-50 zoom-in-95 rounded-lg border border-border bg-card py-1 shadow-md duration-100">
                      <div className="mb-1 border-b border-border px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {g.nombre}
                      </div>
                      {g.links.map((l) => {
                        const esExt = l.href.startsWith('http')
                        if (esExt) {
                          return (
                            <a
                              key={l.href}
                              href={l.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => {
                                e.preventDefault()
                                void abrirAppConSSO(l.href)
                              }}
                              className="flex items-center justify-between px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                            >
                              <span>{l.label}</span>
                            </a>
                          )
                        }
                        return (
                          <Link
                            key={l.href}
                            href={l.href}
                            className={cn(
                              'flex items-center justify-between px-3 py-2 text-xs transition-colors',
                              esActiva(l.href)
                                ? 'border-l-2 border-primary bg-primary/5 font-bold text-primary'
                                : 'text-foreground hover:bg-muted hover:text-foreground'
                            )}
                          >
                            <span>{l.label}</span>
                            {l.href === '/pedidos-almacen' && <PedidoAlmacenBadge />}
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}

            <div className="ml-3 flex items-center gap-2 border-l border-border pl-3">
              <NotificacionesBell />
              <BuscadorGlobalCommand />
              <BotonSesion />
            </div>
          </nav>

          {/* Menú Móvil */}
          <div className="flex items-center gap-1 md:hidden">
            <NotificacionesBell />
            <Sheet open={menuMovil} onOpenChange={setMenuMovil}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  aria-label="Abrir menú"
                  className="flex cursor-pointer items-center gap-1 rounded-lg p-2 text-foreground transition-colors hover:bg-muted"
                >
                  <Menu className="h-5 w-5" />
                  <PedidoAlmacenBadge />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[85vw] max-w-sm overflow-y-auto border-l border-border p-0">
                <SheetHeader className="border-b border-border p-4">
                  <SheetTitle className="flex items-center gap-2 text-sm font-bold text-foreground">
                    <Shield className="h-4 w-4 text-primary" />
                    Menú de Accesos
                  </SheetTitle>
                </SheetHeader>

                <nav className="flex flex-col gap-4 p-4">
                  {gruposFiltrados.map((g) => (
                    <div key={g.nombre} className="space-y-1">
                      <p className="px-2 font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {g.nombre}
                      </p>
                      <div className="flex flex-col">
                        {g.links.map((l) => {
                          const esExt = l.href.startsWith('http')
                          if (esExt) {
                            return (
                              <a
                                key={l.href}
                                href={l.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => {
                                  e.preventDefault()
                                  setMenuMovil(false)
                                  void abrirAppConSSO(l.href)
                                }}
                                className="flex items-center justify-between rounded-md px-2.5 py-2 text-xs font-medium text-foreground active:bg-muted"
                              >
                                <span>{l.label}</span>
                              </a>
                            )
                          }
                          return (
                            <Link
                              key={l.href}
                              href={l.href}
                              className={cn(
                                'flex items-center justify-between rounded-md px-2.5 py-2 text-xs font-medium transition-colors',
                                esActiva(l.href)
                                  ? 'bg-primary/5 font-bold text-primary'
                                  : 'text-foreground active:bg-muted'
                              )}
                            >
                              <span>{l.label}</span>
                              {l.href === '/pedidos-almacen' && <PedidoAlmacenBadge />}
                            </Link>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </nav>

                <div className="mt-auto border-t border-border p-4 text-xs">
                  <BotonSesion />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  )
}
