'use client'

import { useState, useDeferredValue, useMemo } from 'react'
import Link from 'next/link'
import {
  Search,
  ExternalLink,
  ChevronRight,
  Tv,
  Eye,
  FileText,
  ClipboardCheck,
  Archive,
  Package,
  Bell,
  ShoppingCart,
  FileSpreadsheet,
  FileSearch,
  Building2,
  BarChart3,
  Wallet,
  TrendingUp,
  Receipt,
  DollarSign,
  Users,
  Clock,
  Timer,
  UserCog,
  ShieldCheck,
  type LucideIcon,
  X,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { abrirAppConSSO } from '@/lib/sso-cliente'
import { tienePermiso } from '@/lib/roles'
import type { ModuloId } from '@/lib/schemas'
import { cn } from '@/lib/utils'

export interface MobileMasItem {
  href: string
  label: string
  desc: string
  icon: LucideIcon
  tags: string[]
  external?: boolean
}

export interface MobileMasSection {
  nombre: string
  colorToken: string
  items: MobileMasItem[]
}

const SECCIONES_MODULOS: MobileMasSection[] = [
  {
    nombre: 'Operación',
    colorToken: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20',
    items: [
      {
        href: 'https://dashboardsmv.web.app/',
        label: 'Dashboard SMV (Fábrica Visual)',
        desc: 'Pantallas de taller en vivo con estatus de planta',
        icon: Tv,
        tags: ['dashboard', 'tv', 'taller', 'fabrica', 'produccion'],
        external: true,
      },
      {
        href: 'https://smv-vision.web.app/',
        label: 'SMV Visión (Planos & Medidas)',
        desc: 'Consulta de planos técnicos y carga de ingeniería',
        icon: Eye,
        tags: ['vision', 'blueprints', 'planos', 'medidas', 'dibujos'],
        external: true,
      },
      {
        href: '/documentos-venta',
        label: 'Documentos de venta',
        desc: 'Solicita remisiones o facturas y chatea con ventas',
        icon: FileText,
        tags: ['remisiones', 'facturas', 'ventas', 'odoo', 'so'],
      },
      {
        href: '/pedidos-almacen',
        label: 'Pedidos de almacén',
        desc: 'Solicitud inmediata de materiales para piso',
        icon: ClipboardCheck,
        tags: ['pedidos', 'almacen', 'piso', 'taller', 'urgente'],
      },
      {
        href: '/almacen',
        label: 'Almacén de materiales',
        desc: 'Entradas, salidas y existencias de materia prima',
        icon: Archive,
        tags: ['almacen', 'inventario', 'materiales', 'entradas', 'salidas'],
      },
      {
        href: '/endmills',
        label: 'Endmills China',
        desc: 'Inventario y recepción de cortadores CNC',
        icon: Package,
        tags: ['endmills', 'cortadores', 'herramientas', 'cnc', 'china'],
      },
      {
        href: '/notificaciones',
        label: 'Notificaciones',
        desc: 'Alertas de pedidos, requisiciones y avisos',
        icon: Bell,
        tags: ['notificaciones', 'avisos', 'alertas', 'mensajes'],
      },
    ],
  },
  {
    nombre: 'Compras',
    colorToken: 'bg-primary/10 text-primary border-primary/20',
    items: [
      {
        href: '/nueva-compra',
        label: 'Nueva compra (IA)',
        desc: 'Extracción automática de facturas y tickets con IA',
        icon: ShoppingCart,
        tags: ['nueva', 'compra', 'ia', 'scanner', 'factura', 'gemini'],
      },
      {
        href: '/compras-odoo',
        label: 'Compras Odoo',
        desc: 'Creación rápida de solicitudes de cotización',
        icon: FileSpreadsheet,
        tags: ['odoo', 'compras', 'rfq', 'cotizacion'],
      },
      {
        href: '/ordenes-compra',
        label: 'Órdenes de compra USA (PO)',
        desc: 'Generación formal de purchase orders y envío a proveedores',
        icon: FileText,
        tags: ['po', 'ordenes', 'compra', 'usa', 'purchase', 'order'],
      },
      {
        href: '/ordenes',
        label: 'Ver órdenes',
        desc: 'Historial y seguimiento de compras realizadas',
        icon: Package,
        tags: ['ordenes', 'historial', 'facturas', 'proveedores'],
      },
      {
        href: '/requisiciones',
        label: 'Requisiciones',
        desc: 'Control y semáforo de requerimientos de compras',
        icon: ClipboardCheck,
        tags: ['requisiciones', 'solicitudes', 'compras', 'status'],
      },
      {
        href: '/cotizaciones',
        label: 'Cotizaciones',
        desc: 'Comparador de precios históricos y proveedores',
        icon: FileSearch,
        tags: ['cotizaciones', 'precios', 'comparador', 'insumos'],
      },
      {
        href: '/proveedores',
        label: 'Proveedores',
        desc: 'Directorio e inteligencia de compras USA y México',
        icon: Building2,
        tags: ['proveedores', 'catalogo', 'directorio', 'calificacion'],
      },
      {
        href: '/reportes',
        label: 'Reportes de compras',
        desc: 'Métricas de gasto por área, empresa y requisitor',
        icon: BarChart3,
        tags: ['reportes', 'metricas', 'graficas', 'gasto'],
      },
    ],
  },
  {
    nombre: 'Finanzas',
    colorToken: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
    items: [
      {
        href: '/caja-chica',
        label: 'Caja chica',
        desc: 'Fondo disponible, vales de gasto y comprobaciones',
        icon: Wallet,
        tags: ['caja', 'chica', 'vales', 'gastos', 'efectivo'],
      },
      {
        href: '/finanzas',
        label: 'Resumen financiero',
        desc: 'KPIs de cobranza, saldos y flujo operativo',
        icon: TrendingUp,
        tags: ['finanzas', 'kpi', 'cuentas', 'cobrar', 'flujo'],
      },
      {
        href: '/finanzas/facturacion',
        label: 'Facturación clientes (Odoo)',
        desc: 'Facturas emitidas y pendientes de cobro',
        icon: Receipt,
        tags: ['facturacion', 'clientes', 'odoo', 'ingresos'],
      },
      {
        href: '/finanzas/cobranza',
        label: 'Control de cobranza',
        desc: 'Seguimiento a cuentas vencidas y cartera de clientes',
        icon: DollarSign,
        tags: ['cobranza', 'cartera', 'vencidas', 'clientes'],
      },
      {
        href: '/reportes/contable',
        label: 'Reportes Contables SAT',
        desc: 'Cierre mensual, conciliación de facturas y Excel',
        icon: FileSpreadsheet,
        tags: ['contable', 'sat', 'cierre', 'mes', 'excel', 'auditoria'],
      },
      {
        href: '/claves-sat',
        label: 'Claves SAT',
        desc: 'Catálogo y buscador de claves de producto/servicio',
        icon: Search,
        tags: ['sat', 'claves', 'unspsc', 'catalogo'],
      },
      {
        href: '/finanzas/reportes',
        label: 'Reportes gerenciales',
        desc: 'Análisis gerencial y reportes consolidados',
        icon: BarChart3,
        tags: ['gerenciales', 'reportes', 'consolidados'],
      },
    ],
  },
  {
    nombre: 'Personal',
    colorToken: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20',
    items: [
      {
        href: '/operadores',
        label: 'Catálogo de operadores',
        desc: 'Directorio de personal técnico y maquinistas',
        icon: Users,
        tags: ['operadores', 'personal', 'maquinistas', 'directorio'],
      },
      {
        href: '/horas-extra',
        label: 'Horas extra',
        desc: 'Registro, autorización y cómputo de turnos adicionales',
        icon: Clock,
        tags: ['horas', 'extra', 'turnos', 'nomina', 'personal'],
      },
      {
        href: '/banos',
        label: 'Control de baños',
        desc: 'Monitoreo táctil de ocupación y tiempo de uso',
        icon: Timer,
        tags: ['banos', 'tiempo', 'operadores', 'planta'],
      },
      {
        href: '/gafetes',
        label: 'Gafetes de personal',
        desc: 'Generación e impresión de credenciales con código QR',
        icon: UserCog,
        tags: ['gafetes', 'credenciales', 'qr', 'impresion'],
      },
    ],
  },
  {
    nombre: 'Administración',
    colorToken: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
    items: [
      {
        href: '/usuarios',
        label: 'Usuarios y roles',
        desc: 'Matriz de permisos, plantillas y accesos al sistema',
        icon: UserCog,
        tags: ['usuarios', 'roles', 'permisos', 'seguridad', 'admin'],
      },
      {
        href: '/auditoria',
        label: 'Bitácora de auditoría',
        desc: 'Registro detallado de acciones y cambios críticos',
        icon: ShieldCheck,
        tags: ['auditoria', 'bitacora', 'seguridad', 'logs'],
      },
    ],
  },
]

interface MobileMasDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  modulos: readonly ModuloId[] | ModuloId[] | null | undefined
  esSuperAdmin: boolean
  bypass?: boolean
}

export function MobileMasDrawer({
  open,
  onOpenChange,
  modulos,
  esSuperAdmin,
  bypass = false,
}: MobileMasDrawerProps) {
  const [query, setQuery] = useState('')
  // Desacopla la pulsación visual del cálculo de búsqueda para garantizar 60 FPS
  const deferredQuery = useDeferredValue(query)

  // Precomputación memoizada de secciones filtradas por permiso y búsqueda diferida
  const seccionesVisibles = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase()
    const modulosList = modulos ?? []
    const puedeAcceder = (href: string) =>
      bypass || esSuperAdmin || tienePermiso(modulosList, href, esSuperAdmin)

    return SECCIONES_MODULOS.map((sec) => {
      const itemsPermitidos = sec.items.filter((it) => puedeAcceder(it.href))

      if (!q) {
        return {
          ...sec,
          items: itemsPermitidos,
        }
      }

      // Filtrado defensivo por nombre, descripción o etiquetas
      const itemsFiltrados = itemsPermitidos.filter(
        (it) =>
          (it.label || '').toLowerCase().includes(q) ||
          (it.desc || '').toLowerCase().includes(q) ||
          (sec.nombre || '').toLowerCase().includes(q) ||
          (it.tags ?? []).some((t) => (t || '').toLowerCase().includes(q))
      )

      return {
        ...sec,
        items: itemsFiltrados,
      }
    }).filter((sec) => sec.items.length > 0)
  }, [deferredQuery, modulos, esSuperAdmin, bypass])

  const totalModulos = useMemo(
    () => seccionesVisibles.reduce((acc, s) => acc + s.items.length, 0),
    [seccionesVisibles]
  )

  const handleLinkClick = (href: string, external?: boolean) => {
    onOpenChange(false)
    if (external) {
      void abrirAppConSSO(href)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-[85vh] h-[85vh] rounded-t-2xl border-t border-border bg-card p-0 flex flex-col focus:outline-hidden"
      >
        {/* Indicador superior táctil (Pull Handle) */}
        <div className="pt-2.5 pb-1.5 flex justify-center shrink-0">
          <div className="h-1.5 w-12 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Encabezado y buscador a 60 FPS */}
        <SheetHeader className="px-4 pb-3 pt-1 border-b border-border/70 shrink-0 gap-3">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="text-lg font-bold text-foreground tracking-tight">
                Todos los Módulos
              </SheetTitle>
              <p className="text-xs text-muted-foreground">
                {totalModulos} {totalModulos === 1 ? 'módulo disponible' : 'módulos disponibles'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="size-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground active:scale-95 transition-transform"
              aria-label="Cerrar cajón"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Campo de búsqueda con protección contra auto-zoom (text-base) */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por módulo, proceso o etiqueta..."
              className="h-10 pl-9 pr-8 text-base bg-muted/60 border-border rounded-xl focus-visible:ring-primary/40"
              autoComplete="off"
            />
            {query.length > 0 && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 size-5 rounded-full bg-muted-foreground/20 text-muted-foreground flex items-center justify-center hover:bg-muted-foreground/30 active:scale-90 transition-transform"
                aria-label="Limpiar búsqueda"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        </SheetHeader>

        {/* Lista de módulos agrupados con scroll nativo fluido */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-6 overscroll-contain pb-[max(env(safe-area-inset-bottom,0px),1.5rem)]">
          {seccionesVisibles.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Search className="size-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium text-foreground">Sin resultados encontrados</p>
              <p className="text-xs mt-1">No hay módulos que coincidan con &ldquo;{query}&rdquo;</p>
            </div>
          ) : (
            seccionesVisibles.map((sec) => (
              <div key={sec.nombre} className="space-y-2">
                {/* Cabecera de categoría */}
                <div className="flex items-center justify-between pb-1 border-b border-border/50">
                  <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {sec.nombre}
                  </span>
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded-full text-[10px] font-bold border font-mono',
                      sec.colorToken
                    )}
                  >
                    {sec.items.length}
                  </span>
                </div>

                {/* Items de la categoría */}
                <div className="grid grid-cols-1 gap-1.5 pt-1">
                  {sec.items.map((it) => {
                    const Icon = it.icon

                    if (it.external) {
                      return (
                        <a
                          key={it.href}
                          href={it.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => {
                            e.preventDefault()
                            handleLinkClick(it.href, true)
                          }}
                          className="flex items-center justify-between p-2.5 rounded-xl border border-transparent hover:border-border hover:bg-muted/40 active:bg-muted active:scale-[0.99] transition-all touch-manipulation group select-none"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
                              <Icon className="size-4.5" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">
                                {it.label}
                              </p>
                              <p className="text-[11px] text-muted-foreground truncate">
                                {it.desc}
                              </p>
                            </div>
                          </div>
                          <ExternalLink className="size-4 text-muted-foreground/60 shrink-0 ml-2 group-hover:text-primary transition-colors" />
                        </a>
                      )
                    }

                    return (
                      <Link
                        key={it.href}
                        href={it.href}
                        onClick={() => handleLinkClick(it.href, false)}
                        className="flex items-center justify-between p-2.5 rounded-xl border border-transparent hover:border-border hover:bg-muted/40 active:bg-muted active:scale-[0.99] transition-all touch-manipulation group select-none"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
                            <Icon className="size-4.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">
                              {it.label}
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {it.desc}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="size-4 text-muted-foreground/50 shrink-0 ml-2 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
