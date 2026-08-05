/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · tone: utilitario · scope: navbar */
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
import { tienePermiso } from '@/lib/roles'
import { usePermisos } from '@/lib/hooks/useRol'

type GrupoNav = { nombre: string; links: { href: string; label: string }[] }

const GRUPOS: GrupoNav[] = [
  {
    nombre: 'Compras',
    links: [
      { href: '/nueva-compra', label: 'Nueva compra (IA)' },
      { href: '/caja-chica', label: 'Caja chica' },
      { href: '/ordenes', label: 'Ver órdenes' },
      { href: '/claves-sat', label: 'Claves SAT' },
      { href: '/cotizaciones', label: 'Cotizaciones' },
      { href: '/requisiciones', label: 'Requisiciones' },
      { href: '/proveedores', label: 'Catálogo de proveedores' },
      { href: '/reportes', label: 'Reportes de compras' },
    ],
  },
  {
    nombre: 'Finanzas',
    links: [
      { href: '/finanzas', label: 'Resumen financiero' },
      { href: '/finanzas/facturacion', label: 'Facturación clientes (Odoo)' },
      { href: '/finanzas/cobranza', label: 'Control de cobranza' },
      { href: '/finanzas/reportes', label: 'Reportes financieros' },
    ],
  },
  {
    nombre: 'Operación',
    links: [
      { href: '/notificaciones', label: 'Notificaciones' },
      { href: '/documentos-venta', label: 'Documentos de venta' },
      { href: '/almacen', label: 'Almacén de materiales' },
      { href: '/pedidos-almacen', label: 'Pedidos de almacén' },
      { href: '/operadores', label: 'Catálogo de operadores' },
    ],
  },
  {
    nombre: 'Personal',
    links: [
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
      links: g.links.filter((l) => bypass || tienePermiso(modulos, l.href)),
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
    <header ref={navRef} className="bg-white border-b border-slate-200 sticky top-0 z-40 font-sans shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14">
          <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-90">
            <LogoSMV height={26} />
            <span className="text-slate-300 font-light">|</span>
            <span className="text-xs font-bold tracking-tight text-slate-900 uppercase">SMV Hub</span>
          </Link>

          {/* Escritorio Utilitario */}
          <nav className="hidden md:flex items-center gap-1 text-xs font-medium">
            {gruposFiltrados.map((g) => {
              const activo = g.links.some((l) => esActiva(l.href))
              const desplegado = abierto === g.nombre
              return (
                <div key={g.nombre} className="relative">
                  <button
                    onClick={() => setAbierto(desplegado ? null : g.nombre)}
                    className={`flex items-center gap-1 rounded-md px-3 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0369A1] ${
                      activo
                        ? 'bg-slate-100 text-[#0369A1] font-bold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <span>{g.nombre}</span>
                    {g.links.some((l) => l.href === '/pedidos-almacen') && <PedidoAlmacenBadge />}
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform duration-150 ${desplegado ? 'rotate-180 text-[#0369A1]' : 'text-slate-400'}`}
                    />
                  </button>

                  {desplegado && (
                    <div className="absolute right-0 mt-1.5 w-56 rounded-lg border border-slate-200 bg-white py-1 shadow-md z-50 animate-in fade-in-50 zoom-in-95 duration-100">
                      <div className="px-3 py-1 text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1">
                        {g.nombre}
                      </div>
                      {g.links.map((l) => (
                        <Link
                          key={l.href}
                          href={l.href}
                          className={`flex items-center justify-between px-3 py-2 text-xs transition-colors ${
                            esActiva(l.href)
                              ? 'bg-sky-50 text-[#0369A1] font-bold border-l-2 border-[#0369A1]'
                              : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                          }`}
                        >
                          <span>{l.label}</span>
                          {l.href === '/pedidos-almacen' && <PedidoAlmacenBadge />}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            <div className="ml-3 pl-3 border-l border-slate-200 flex items-center gap-2">
              <NotificacionesBell />
              <BuscadorGlobalCommand />
              <BotonSesion />
            </div>
          </nav>

          {/* Menú Móvil */}
          <div className="md:hidden flex items-center gap-1">
            <NotificacionesBell />
            <Sheet open={menuMovil} onOpenChange={setMenuMovil}>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="Abrir menú"
                className="flex items-center gap-1 rounded-lg p-2 text-slate-900 hover:bg-slate-100 transition-colors"
              >
                <Menu className="h-5 w-5" />
                <PedidoAlmacenBadge />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[85vw] max-w-sm overflow-y-auto p-0 border-l border-slate-200">
              <SheetHeader className="border-b border-slate-200 p-4">
                <SheetTitle className="text-sm font-bold flex items-center gap-2 text-slate-900">
                  <Shield className="h-4 w-4 text-[#0369A1]" />
                  Menú de Accesos
                </SheetTitle>
              </SheetHeader>

              <nav className="flex flex-col gap-4 p-4">
                {gruposFiltrados.map((g) => (
                  <div key={g.nombre} className="space-y-1">
                    <p className="px-2 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                      {g.nombre}
                    </p>
                    <div className="flex flex-col">
                      {g.links.map((l) => (
                        <Link
                          key={l.href}
                          href={l.href}
                          className={`flex items-center justify-between rounded-md px-2.5 py-2 text-xs font-medium transition-colors ${
                            esActiva(l.href)
                              ? 'bg-sky-50 text-[#0369A1] font-bold'
                              : 'text-slate-700 active:bg-slate-100'
                          }`}
                        >
                          <span>{l.label}</span>
                          {l.href === '/pedidos-almacen' && <PedidoAlmacenBadge />}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </nav>

              <div className="mt-auto border-t border-slate-200 p-4 text-xs">
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
