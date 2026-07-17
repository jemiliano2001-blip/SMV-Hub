'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import LogoSMV from '@/app/LogoSMV'
import BotonSesion from '@/app/BotonSesion'
import { authBypassActivo, useUsuario } from '@/lib/auth'
import { tienePermiso } from '@/lib/roles'
import { useRol } from '@/lib/hooks/useRol'

type GrupoNav = { nombre: string; links: { href: string; label: string }[] }

const GRUPOS: GrupoNav[] = [
  {
    nombre: 'Compras',
    links: [
      { href: '/nueva-compra', label: 'Nueva compra' },
      { href: '/ordenes', label: 'Órdenes' },
      { href: '/importar', label: 'Importar' },
      { href: '/claves-sat', label: 'Claves SAT' },
      { href: '/cotizaciones', label: 'Cotizaciones' },
      { href: '/requisiciones', label: 'Requisiciones' },
      { href: '/caja-chica', label: 'Caja chica' },
      { href: '/reportes', label: 'Reportes' },
    ],
  },
  {
    nombre: 'Finanzas',
    links: [
      { href: '/finanzas', label: 'Resumen' },
      { href: '/finanzas/facturacion', label: 'Facturación por cliente' },
      { href: '/finanzas/cobranza', label: 'Cobranza' },
      { href: '/finanzas/reportes', label: 'Reportes' },
    ],
  },
  {
    nombre: 'Operación',
    links: [
      { href: '/almacen', label: 'Almacén' },
      { href: '/ordenes-servicio', label: 'Órdenes de servicio' },
      { href: '/operadores', label: 'Operadores' },
    ],
  },
  {
    nombre: 'Personal',
    links: [
      { href: '/horas-extra', label: 'Horas extra' },
      { href: '/banos', label: 'Baños' },
    ],
  },
]

export default function NavBar() {
  const pathname = usePathname()
  const { usuario } = useUsuario()
  const { rol } = useRol(authBypassActivo() ? null : usuario)
  const [abierto, setAbierto] = useState<string | null>(null)
  const navRef = useRef<HTMLElement>(null)

  // Cierra el dropdown con clic fuera o Escape.
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

  // Cierra el dropdown al navegar.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAbierto(null)
  }, [pathname])

  // Exacta o hija: evita que /ordenes se marque activa al visitar /ordenes-servicio.
  const esActiva = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  if (pathname === '/login') return null

  return (
    <header ref={navRef} className="bg-white border-b border-[#E2E8F0] sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoSMV />
            <span className="text-gray-300 font-light">|</span>
            <span className="text-sm font-semibold text-[#0F172A]">SMV Hub</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm font-medium">
            {(() => {
              const gruposFiltrados = GRUPOS.map(g => ({
                ...g,
                links: g.links.filter(l => tienePermiso(rol, l.href))
              })).filter(g => g.links.length > 0)

              if (rol === 'admin') {
                gruposFiltrados.push({
                  nombre: 'Administración',
                  links: [
                    { href: '/auditoria', label: 'Auditoría' },
                    { href: '/usuarios', label: 'Usuarios' },
                  ]
                })
              }

              return gruposFiltrados.map((g) => {
                const activo = g.links.some((l) => esActiva(l.href))
                const desplegado = abierto === g.nombre
              return (
                <div key={g.nombre} className="relative">
                  <button
                    onClick={() => setAbierto(desplegado ? null : g.nombre)}
                    className={`flex items-center gap-1 rounded-lg px-3 py-2 transition-colors ${
                      activo ? 'text-[#0369A1] font-semibold' : 'text-[#64748B] hover:text-[#0F172A]'
                    }`}
                  >
                    {g.nombre}
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${desplegado ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {desplegado && (
                    <div className="absolute right-0 mt-1 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                      {g.links.map((l) => (
                        <Link
                          key={l.href}
                          href={l.href}
                          className={`block px-4 py-2 text-sm transition-colors ${
                            esActiva(l.href)
                              ? 'bg-blue-50 text-[#0369A1] font-semibold'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {l.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )
            })})()}
            <div className="ml-4">
              <BotonSesion />
            </div>
          </nav>
        </div>
      </div>
    </header>
  )
}
