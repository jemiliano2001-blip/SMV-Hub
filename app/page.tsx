/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · tone: utilitario · scope: centro-de-trabajo */
'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import LogoSMV from '@/app/LogoSMV'
import PedidoAlmacenBadge from '@/app/pedidos-almacen/PedidoAlmacenBadge'
import { authBypassActivo, useUsuario } from '@/lib/auth'
import { usePermisos } from '@/lib/hooks/useRol'
import { tienePermiso } from '@/lib/roles'
import type { Rol } from '@/lib/schemas'
import Link from 'next/link'
import {
  Archive,
  ArrowRight,
  BarChart3,
  Building2,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Command,
  DollarSign,
  FileSearch,
  FileSpreadsheet,
  FileText,
  Bell,
  Package,
  Receipt,
  Search,
  Shield,
  ShieldCheck,
  ShoppingCart,
  Timer,
  TrendingUp,
  UserCog,
  Users,
  Wallet,
  Wrench,
  X
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type GrupoId = 'compras' | 'finanzas' | 'operacion' | 'personal' | 'administracion'

type TarjetaNavegacion = {
  href: string
  icon: LucideIcon
  label: string
  desc: string
  grupo: GrupoId
  principal?: boolean
  tags: string[]
}

const NAV_CARDS: readonly TarjetaNavegacion[] = [
  // ── Compras y Caja Chica ──────────────────────────────
  {
    href: '/nueva-compra',
    icon: ShoppingCart,
    label: 'Nueva compra (IA)',
    desc: 'Escaneo y extracción automática de facturas mediante IA.',
    grupo: 'compras',
    principal: true,
    tags: ['ia', 'factura', 'compra', 'pdf', 'xml', 'ticket'],
  },
  {
    href: '/caja-chica',
    icon: Wallet,
    label: 'Caja Chica',
    desc: 'Fondo fijo, vales de préstamo provisionales y reembolso.',
    grupo: 'compras',
    principal: true,
    tags: ['caja', 'chica', 'fondo', 'fijo', 'vales', 'reembolso', 'efectivo', 'cambio'],
  },
  {
    href: '/ordenes',
    icon: Package,
    label: 'Ver órdenes',
    desc: 'Bitácora general y seguimiento de órdenes registradas.',
    grupo: 'compras',
    tags: ['ordenes', 'historial', 'compras', 'proveedores'],
  },
  {
    href: '/cotizaciones',
    icon: FileSearch,
    label: 'Cotizaciones',
    desc: 'Base de datos histórica de cotizaciones (MX y USA).',
    grupo: 'compras',
    tags: ['cotizacion', 'precios', 'historico', 'proveedores'],
  },
  {
    href: '/claves-sat',
    icon: Search,
    label: 'Claves SAT',
    desc: 'Catálogo y buscador de claves de productos del SAT.',
    grupo: 'compras',
    tags: ['sat', 'cfdi', 'claves', 'impuestos'],
  },
  {
    href: '/proveedores',
    icon: Building2,
    label: 'Proveedores (USA Tooling)',
    desc: 'Catálogo de proveedores de endmills, insertos y herramental económico.',
    grupo: 'compras',
    tags: ['proveedores', 'usa', 'endmills', 'insertos', 'tooling', 'barato', 'compras'],
  },
  {
    href: '/reportes',
    icon: BarChart3,
    label: 'Reportes de compras',
    desc: 'Análisis de volumen de compras, KPIs y exportaciones.',
    grupo: 'compras',
    tags: ['reportes', 'kpi', 'excel', 'graficas'],
  },

  // ── Finanzas y Cobranza ──────────────────────────────
  {
    href: '/finanzas',
    icon: TrendingUp,
    label: 'Resumen financiero',
    desc: 'Indicadores generales de facturación y cobranza.',
    grupo: 'finanzas',
    principal: true,
    tags: ['finanzas', 'odoo', 'ingresos', 'resumen'],
  },
  {
    href: '/finanzas/facturacion',
    icon: Receipt,
    label: 'Facturación por cliente',
    desc: 'Espejo de facturas de clientes vinculadas con Odoo.',
    grupo: 'finanzas',
    tags: ['odoo', 'facturas', 'clientes', 'ventas'],
  },
  {
    href: '/finanzas/cobranza',
    icon: DollarSign,
    label: 'Control de cobranza',
    desc: 'Promesas de pago, cuentas por cobrar y estatus.',
    grupo: 'finanzas',
    tags: ['cobranza', 'pagos', 'vencido', 'cartera'],
  },
  {
    href: '/finanzas/reportes',
    icon: FileSpreadsheet,
    label: 'Reportes financieros',
    desc: 'Reportes ejecutivos de ingresos y saldos pendientes.',
    grupo: 'finanzas',
    tags: ['reportes', 'finanzas', 'cobros'],
  },

  // ── Operación del Taller ─────────────────────────────
  {
    href: '/notificaciones',
    icon: Bell,
    label: 'Notificaciones',
    desc: 'Avisos de pedidos de almacén y requisiciones del taller.',
    grupo: 'operacion',
    principal: true,
    tags: ['notificaciones', 'avisos', 'alerta', 'taller'],
  },
  {
    href: '/documentos-venta',
    icon: FileText,
    label: 'Documentos de venta',
    desc: 'Pide remisiones o facturas de órdenes de venta y chatea con ventas.',
    grupo: 'operacion',
    principal: true,
    tags: ['remision', 'factura', 'odoo', 'ventas', 'po'],
  },
  {
    href: '/pedidos-almacen',
    icon: ClipboardCheck,
    label: 'Pedidos de almacén',
    desc: 'Solicitudes inmediatas de almacén convertibles en compra.',
    grupo: 'operacion',
    principal: true,
    tags: ['almacen', 'pedidos', 'urgente', 'compra'],
  },
  {
    href: '/almacen',
    icon: Archive,
    label: 'Almacén de materiales',
    desc: 'Control de inventario, entradas, salidas y existencias.',
    grupo: 'operacion',
    tags: ['almacen', 'inventario', 'materiales', 'herramienta'],
  },
  {
    href: '/requisiciones',
    icon: ClipboardList,
    label: 'Requisiciones',
    desc: 'Solicitudes de material y automatización de ingenieros.',
    grupo: 'operacion',
    tags: ['requisicion', 'solicitud', 'ingenieria', 'automatizacion'],
  },
  {
    href: '/ordenes-servicio',
    icon: Wrench,
    label: 'Órdenes de servicio',
    desc: 'Seguimiento a OTs enviadas con proveedores externos.',
    grupo: 'operacion',
    tags: ['ot', 'servicio', 'maquinado', 'externo', 'fisher'],
  },

  // ── Personal ──────────────────────────────────────────
  {
    href: '/operadores',
    icon: Users,
    label: 'Catálogo de operadores',
    desc: 'Directorio de personal del taller por departamento.',
    grupo: 'personal',
    tags: ['operadores', 'empleados', 'taller', 'personal'],
  },
  {
    href: '/horas-extra',
    icon: Clock,
    label: 'Horas extra',
    desc: 'Captura y autorización de horas laboradas extra.',
    grupo: 'personal',
    tags: ['horas', 'extra', 'nomina', 'tiempo'],
  },
  {
    href: '/banos',
    icon: Timer,
    label: 'Control de baños',
    desc: 'Métricas de tiempos de uso e incidencias de taller.',
    grupo: 'personal',
    tags: ['banos', 'registro', 'tiempos'],
  },

  // ── Administración ────────────────────────────────────
  {
    href: '/usuarios',
    icon: UserCog,
    label: 'Usuarios y roles',
    desc: 'Gestión de cuentas de acceso y matriz de permisos.',
    grupo: 'administracion',
    tags: ['usuarios', 'roles', 'permisos', 'admin', 'cuentas'],
  },
  {
    href: '/auditoria',
    icon: ShieldCheck,
    label: 'Bitácora de auditoría',
    desc: 'Registro detallado de acciones y seguridad del sistema.',
    grupo: 'administracion',
    tags: ['auditoria', 'logs', 'seguridad', 'bitacora'],
  },
]

const SECCIONES = [
  {
    id: 'compras',
    titulo: 'Compras y Caja Chica',
    badgeText: 'Módulo Operativo',
    badgeStyle: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  {
    id: 'finanzas',
    titulo: 'Finanzas y Cobranza',
    badgeText: 'Módulo Financiero',
    badgeStyle: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  {
    id: 'operacion',
    titulo: 'Operación del Taller',
    badgeText: 'Módulo de Producción',
    badgeStyle: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  {
    id: 'personal',
    titulo: 'Personal y Control',
    badgeText: 'Recursos Humanos',
    badgeStyle: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  {
    id: 'administracion',
    titulo: 'Administración del Sistema',
    badgeText: 'Seguridad',
    badgeStyle: 'bg-rose-50 text-rose-700 border-rose-200',
  },
] as const

function TarjetaAcceso({
  href,
  icon: Icon,
  label,
  desc,
  principal = false,
}: TarjetaNavegacion) {
  return (
    <Link
      href={href}
      className={[
        'group relative flex items-start gap-3.5 rounded-lg border p-3.5 transition-all duration-150 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0369A1]',
        principal
          ? 'border-slate-800 bg-slate-900 text-white shadow-sm hover:bg-slate-800 hover:border-slate-700'
          : 'border-slate-200 bg-white hover:border-[#0369A1]/50 hover:bg-sky-50/20 hover:shadow-sm',
      ].join(' ')}
    >
      <div
        className={[
          'shrink-0 rounded-md p-2 transition-colors',
          principal ? 'bg-white/10 text-sky-300' : 'bg-slate-100 text-[#0369A1] group-hover:bg-[#0369A1] group-hover:text-white',
        ].join(' ')}
      >
        <Icon className="h-4.5 w-4.5" aria-hidden="true" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1">
          <span className={['text-sm font-semibold tracking-tight', principal ? 'text-white' : 'text-slate-900'].join(' ')}>
            {label}
          </span>
          {href === '/pedidos-almacen' && <PedidoAlmacenBadge />}
        </div>
        <p className={['mt-0.5 text-xs leading-normal line-clamp-2', principal ? 'text-slate-300' : 'text-slate-500'].join(' ')}>
          {desc}
        </p>
      </div>

      <ArrowRight
        className={[
          'mt-0.5 h-4 w-4 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5',
          principal ? 'text-slate-400 group-hover:text-white' : 'text-slate-300 group-hover:text-[#0369A1]',
        ].join(' ')}
      />
    </Link>
  )
}

const NOMBRE_ROL: Record<Rol, string> = {
  admin: 'Administrador Principal',
  compras: 'Equipo de Compras',
  diseno: 'Ingeniería y Diseño',
  almacen: 'Encargado de Almacén',
  automatizacion: 'Automatización',
}

export default function Home() {
  const { usuario, cargando: cargandoUsuario } = useUsuario()
  const bypassActivo = authBypassActivo()
  const { plantilla: rol, modulos, esSuperAdmin, cargando: cargandoRol } = usePermisos(bypassActivo ? null : usuario)
  const cargando = cargandoUsuario || cargandoRol

  const [busqueda, setBusqueda] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Escuchar shortcut de teclado (Ctrl + K o /) para enfocar el buscador utilitario
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      } else if (e.key === '/' && document.activeElement !== searchInputRef.current && (document.activeElement?.tagName !== 'INPUT')) {
        e.preventDefault()
        searchInputRef.current?.focus()
      } else if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        setBusqueda('')
        searchInputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Filtrado estrictamente por permisos según módulos del usuario
  const tarjetasVisibles = useMemo(() => {
    return NAV_CARDS.filter((tarjeta) => {
      if (bypassActivo) return true
      if (tarjeta.href === '/usuarios') return esSuperAdmin
      return tienePermiso(modulos, tarjeta.href)
    })
  }, [modulos, esSuperAdmin, bypassActivo])

  // Filtrado dinámico por texto en tiempo real
  const tarjetasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return tarjetasVisibles
    return tarjetasVisibles.filter((t) => {
      return (
        t.label.toLowerCase().includes(q) ||
        t.desc.toLowerCase().includes(q) ||
        t.href.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.includes(q))
      )
    })
  }, [tarjetasVisibles, busqueda])

  const nombreRol = rol ? NOMBRE_ROL[rol] : 'Usuario del Sistema'

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-4 py-6 sm:px-6 lg:px-8 font-sans">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        {/* Top Operational Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
          <div className="flex items-center gap-3">
            <LogoSMV height={28} />
            <span className="text-slate-300 font-light">|</span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900 tracking-tight">SMV Hub</span>
                <span className="text-[10px] font-mono font-medium bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                  v2.4 Utilitario
                </span>
              </div>
              <p className="text-xs text-slate-500">Centro de Operación y Administración</p>
            </div>
          </div>

          {!cargando && (
            <div className="flex items-center gap-2 text-xs">
              <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 font-mono">
                <Shield className="h-3.5 w-3.5 text-[#0369A1]" />
                <span className="font-semibold text-slate-800">{nombreRol}</span>
              </div>
              <div className="bg-emerald-50 text-emerald-700 font-mono text-[11px] px-2.5 py-1.5 rounded-lg border border-emerald-200 font-semibold">
                {tarjetasVisibles.length} Módulos
              </div>
            </div>
          )}
        </div>

        {/* Buscador Rápido Utilitario (Búsqueda en Vivo) */}
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar módulo rápidamente (ej. caja chica, odoo, almacén)..."
              className="w-full pl-10 pr-24 py-3 text-sm bg-white border border-slate-300 rounded-xl shadow-xs focus:outline-none focus:border-[#0369A1] focus:ring-2 focus:ring-[#0369A1]/20 text-slate-900 placeholder:text-slate-400 font-medium transition-all"
            />
            {busqueda ? (
              <button
                onClick={() => setBusqueda('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md"
              >
                <X className="h-4 w-4" />
              </button>
            ) : (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1 text-[11px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 pointer-events-none">
                <Command className="h-3 w-3" />
                <span>K</span>
              </div>
            )}
          </div>

          {busqueda && (
            <p className="mt-2 text-xs text-slate-500 font-mono">
              Mostrando {tarjetasFiltradas.length} resultados para &ldquo;{busqueda}&rdquo;
            </p>
          )}
        </div>

        {cargando ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-lg border border-slate-200 bg-white" />
            ))}
          </div>
        ) : tarjetasFiltradas.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-2">
            <Search className="h-8 w-8 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-900">No se encontraron módulos</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No hay ninguna sección autorizada que coincida con &ldquo;{busqueda}&rdquo;. Intenta borrar el texto de búsqueda.
            </p>
            <button
              onClick={() => setBusqueda('')}
              className="mt-3 px-3 py-1.5 text-xs font-semibold text-[#0369A1] bg-sky-50 rounded-lg hover:bg-sky-100 transition-colors"
            >
              Limpiar búsqueda
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Si no hay búsqueda activa, mostrar secciones estructuradas por área */}
            {SECCIONES.map((seccion) => {
              const tarjetasEnSeccion = tarjetasFiltradas.filter((t) => t.grupo === seccion.id)
              if (tarjetasEnSeccion.length === 0) return null

              return (
                <section key={seccion.id} className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                      <span>{seccion.titulo}</span>
                    </h2>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${seccion.badgeStyle}`}>
                      {tarjetasEnSeccion.length} {tarjetasEnSeccion.length === 1 ? 'Acceso' : 'Accesos'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {tarjetasEnSeccion.map((tarjeta) => (
                      <TarjetaAcceso key={tarjeta.href} {...tarjeta} />
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        )}

        {/* Footer Utilitario */}
        <footer className="pt-4 text-center text-xs text-slate-400 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-2 font-mono">
          <span>SMV MAQUINADOS · Hub Operativo de Escritorio</span>
          <span>Monterrey, N.L. México</span>
        </footer>
      </div>
    </main>
  )
}
