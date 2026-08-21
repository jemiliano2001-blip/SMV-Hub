'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import PedidoAlmacenBadge from '@/app/pedidos-almacen/PedidoAlmacenBadge'
import PageHeader from '@/components/layout/PageHeader'
import PageShell from '@/components/layout/PageShell'
import ModuleEmptyState from '@/components/layout/ModuleEmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
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
  ExternalLink,
  Eye,
  FileSearch,
  FileSpreadsheet,
  FileText,
  Bell,
  LayoutDashboard,
  Package,
  Receipt,
  Search,
  ShieldCheck,
  ShoppingCart,
  Timer,
  TrendingUp,
  UserCog,
  Users,
  Wallet,
  X,
  Copy,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'

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
    href: '/compras-odoo',
    icon: FileSpreadsheet,
    label: 'Compras Odoo (Cotizaciones)',
    desc: 'Captura rápida desde Excel y creación de Solicitudes de Cotización en Odoo ERP.',
    grupo: 'compras',
    principal: true,
    tags: ['odoo', 'cotizacion', 'compras', 'excel', 'nacional', 'partidas', 'rfq'],
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
    href: '/requisiciones',
    icon: ClipboardList,
    label: 'Requisiciones',
    desc: 'Solicitudes de material y automatización de ingenieros.',
    grupo: 'compras',
    tags: ['requisicion', 'solicitud', 'ingenieria', 'automatizacion'],
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

  // ── Operación del Taller ─────────────────────────────
  {
    href: 'https://smv-vision.web.app/',
    icon: Eye,
    label: 'SMV Vision',
    desc: 'Monitoreo de producción en tiempo real, taller y sincronización Odoo.',
    grupo: 'operacion',
    principal: true,
    tags: ['vision', 'monitoreo', 'taller', 'odoo', 'produccion', 'external'],
  },
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
    href: '/endmills',
    icon: Package,
    label: 'Endmills China',
    desc: 'Inventario, sugerencia de compra y recepción de cortadores en USD.',
    grupo: 'operacion',
    tags: ['endmills', 'cortadores', 'china', 'inventario', 'pedido', 'herramientas'],
  },
  {
    href: '/operadores',
    icon: Users,
    label: 'Catálogo de operadores',
    desc: 'Directorio de personal del taller por departamento.',
    grupo: 'operacion',
    tags: ['operadores', 'empleados', 'taller', 'personal'],
  },

  // ── Finanzas y Cobranza ──────────────────────────────
  {
    href: 'https://dashboardsmv.web.app/',
    icon: LayoutDashboard,
    label: 'Dashboard SMV',
    desc: 'Panel ejecutivo de indicadores generales, métricas y KPIs corporativos.',
    grupo: 'finanzas',
    principal: true,
    tags: ['dashboard', 'kpi', 'metricas', 'ejecutivo', 'reportes', 'external'],
  },
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
    href: '/reportes/contable',
    icon: FileSpreadsheet,
    label: 'Reportes Contables SAT',
    desc: 'Resumen fiscal y contable de facturación, compras y SAT.',
    grupo: 'finanzas',
    tags: ['reportes', 'contable', 'sat', 'impuestos', 'fiscal', 'cfdi'],
  },
  {
    href: '/claves-sat',
    icon: Search,
    label: 'Claves SAT',
    desc: 'Catálogo y buscador de claves de productos del SAT.',
    grupo: 'finanzas',
    tags: ['sat', 'cfdi', 'claves', 'impuestos'],
  },
  {
    href: '/finanzas/reportes',
    icon: FileSpreadsheet,
    label: 'Reportes financieros',
    desc: 'Reportes ejecutivos de ingresos y saldos pendientes.',
    grupo: 'finanzas',
    tags: ['reportes', 'finanzas', 'cobros'],
  },

  // ── Personal y Control ──────────────────────────────
  {
    href: '/gafetes',
    icon: UserCog,
    label: 'Gafetes de personal',
    desc: 'Perfiles privados, fotografías e impresión de gafetes de trabajadores.',
    grupo: 'personal',
    tags: ['gafetes', 'credenciales', 'personal', 'foto', 'impresion'],
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

  // ── Administración del Sistema ───────────────────────
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
    id: 'operacion',
    titulo: 'Operación del Taller',
    badgeText: 'Módulo de Producción',
    badgeStyle: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  {
    id: 'finanzas',
    titulo: 'Finanzas y Cobranza',
    badgeText: 'Módulo Financiero',
    badgeStyle: 'bg-emerald-50 text-emerald-700 border-emerald-200',
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
  const esExterna = href.startsWith('http://') || href.startsWith('https://')

  const contenidoInner = (
    <>
      <div
        className={cn(
          'shrink-0 rounded-md p-2 transition-colors',
          principal
            ? 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground'
            : 'bg-muted text-primary group-hover:bg-primary group-hover:text-primary-foreground',
        )}
      >
        <Icon className="size-4.5" aria-hidden="true" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1">
          <span className="text-sm font-semibold tracking-tight text-foreground">
            {label}
          </span>
          {href === '/pedidos-almacen' && <PedidoAlmacenBadge />}
          {esExterna && (
            <span className="rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-sky-800">
              Externa
            </span>
          )}
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs leading-normal text-muted-foreground">
          {desc}
        </p>
      </div>

      {esExterna ? (
        <ExternalLink className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
      ) : (
        <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-primary" />
      )}
    </>
  )

  const claseTarjeta = cn(
    'group relative flex items-start gap-3.5 rounded-lg border border-border bg-card p-3.5 text-left transition-all duration-150 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring select-none',
    principal
      ? 'border-primary/25 shadow-xs hover:border-primary/50 hover:bg-sky-50/40'
      : 'hover:border-primary/40 hover:bg-sky-50/20 hover:shadow-xs',
  )

  const cardElement = esExterna ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={claseTarjeta}>
      {contenidoInner}
    </a>
  ) : (
    <Link href={href} className={claseTarjeta}>
      {contenidoInner}
    </Link>
  )

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {cardElement}
      </ContextMenuTrigger>

      <ContextMenuContent className="w-56">
        <ContextMenuItem
          onClick={() => {
            if (esExterna) {
              window.open(href, '_blank', 'noopener,noreferrer')
            } else {
              window.location.href = href
            }
          }}
        >
          <ArrowRight className="text-primary" />
          <span>Abrir módulo</span>
          <ContextMenuShortcut>↵</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuItem
          onClick={() => {
            window.open(href, '_blank', 'noopener,noreferrer')
          }}
        >
          <ExternalLink className="text-sky-600" />
          <span>Abrir en nueva pestaña</span>
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem
          onClick={() => {
            const urlCompleta = esExterna ? href : `${window.location.origin}${href}`
            void navigator.clipboard.writeText(urlCompleta)
            toast.success('Enlace directo copiado', { description: urlCompleta })
          }}
        >
          <Copy className="text-slate-500" />
          <span>Copiar enlace directo</span>
        </ContextMenuItem>

        <ContextMenuItem
          onClick={() => {
            void navigator.clipboard.writeText(label)
            toast.success('Nombre del módulo copiado', { description: label })
          }}
        >
          <Copy className="text-slate-400" />
          <span>Copiar nombre ({label})</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
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
      if (tarjeta.href === '/usuarios' || tarjeta.href === '/gafetes') return esSuperAdmin
      return tienePermiso(modulos, tarjeta.href, esSuperAdmin)
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

  const nombreRol = rol ? NOMBRE_ROL[rol] : 'Usuario'

  return (
    <PageShell maxWidth="6xl">
      <PageHeader
        title="Inicio"
        badge={!cargando ? nombreRol : undefined}
        icon={LayoutDashboard}
        description="Centro de operación del taller: compras, finanzas, piso y personal."
        actions={
          !cargando ? (
            <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 font-mono text-[11px] font-semibold text-emerald-700">
              {tarjetasVisibles.length} módulos
            </span>
          ) : null
        }
      />

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={searchInputRef}
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar módulo (caja chica, odoo, almacén)…"
          className="h-11 bg-card pr-24 pl-10"
        />
        {busqueda ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setBusqueda('')}
            className="absolute top-1/2 right-3 -translate-y-1/2"
            aria-label="Limpiar búsqueda"
          >
            <X />
          </Button>
        ) : (
          <div className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 items-center gap-1 rounded border border-border bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground sm:flex">
            <Command className="size-3" />
            <span>K</span>
          </div>
        )}
      </div>

      {busqueda ? (
        <p className="font-mono text-xs text-muted-foreground">
          Mostrando {tarjetasFiltradas.length} resultados para &ldquo;{busqueda}&rdquo;
        </p>
      ) : null}

      {cargando ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : tarjetasFiltradas.length === 0 ? (
        <ModuleEmptyState
          icon={Search}
          title="No se encontraron módulos"
          description={`No hay ninguna sección autorizada que coincida con “${busqueda}”.`}
          action={
            <Button type="button" variant="outline" size="sm" onClick={() => setBusqueda('')}>
              Limpiar búsqueda
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          {SECCIONES.map((seccion) => {
            const tarjetasEnSeccion = tarjetasFiltradas.filter((t) => t.grupo === seccion.id)
            if (tarjetasEnSeccion.length === 0) return null

            return (
              <section key={seccion.id} className="flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <h2 className="text-xs font-bold tracking-wider text-foreground uppercase">
                    {seccion.titulo}
                  </h2>
                  <span className={`rounded border px-2 py-0.5 font-mono text-[10px] font-bold ${seccion.badgeStyle}`}>
                    {tarjetasEnSeccion.length} {tarjetasEnSeccion.length === 1 ? 'acceso' : 'accesos'}
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

      <footer className="flex flex-col items-center justify-between gap-2 border-t border-border pt-4 text-center font-mono text-xs text-muted-foreground sm:flex-row">
        <span>SMV Maquinados · Hub operativo</span>
        <span>Monterrey, N.L.</span>
      </footer>
    </PageShell>
  )
}
